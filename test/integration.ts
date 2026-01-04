import {
    CloudFormationClient,
    DescribeStackResourcesCommand,
} from '@aws-sdk/client-cloudformation';
import { CloudWatchLogsClient, FilterLogEventsCommand } from '@aws-sdk/client-cloudwatch-logs';
import type { FilterLogEventsCommandOutput } from '@aws-sdk/client-cloudwatch-logs';
import {
    createS3Client,
    putObject,
    getObject,
    listObjects,
    deleteObject,
    getSignedUrl,
    SignedUrlOperation,
} from '../src/index';
import { createLogger } from '@vitkuz/aws-logger';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

const STACK_NAME = 'vitkuz-testing-s3';
const REGION = process.env.AWS_REGION || 'us-east-1';

const getStackResources = async () => {
    const cf = new CloudFormationClient({ region: REGION });
    const command = new DescribeStackResourcesCommand({ StackName: STACK_NAME });
    const response = await cf.send(command);

    if (!response.StackResources) throw new Error('No resources found');

    const bucket = response.StackResources.find((r) => r.ResourceType === 'AWS::S3::Bucket');
    const lambda = response.StackResources.find(
        (r) =>
            r.ResourceType === 'AWS::Lambda::Function' &&
            r.LogicalResourceId?.includes('S3Handler'),
    );

    if (!bucket?.PhysicalResourceId || !lambda?.PhysicalResourceId) {
        throw new Error('Could not find Bucket Name or Lambda Function Name in stack resources');
    }

    return {
        bucketName: bucket.PhysicalResourceId,
        logGroupName: `/aws/lambda/${lambda.PhysicalResourceId}`,
    };
};

const waitForLogs = async (
    logGroupName: string,
    searchStrings: string[],
    timeoutMs = 60000,
): Promise<boolean> => {
    const logs = new CloudWatchLogsClient({ region: REGION });
    const startTime = Date.now();
    const found = new Set<string>();

    console.log(`Polling logs in ${logGroupName} for keys: ${searchStrings.join(', ')}...`);

    while (Date.now() - startTime < timeoutMs) {
        try {
            const command = new FilterLogEventsCommand({
                logGroupName,
                startTime: Date.now() - 60000,
            });

            const events: FilterLogEventsCommandOutput = await logs.send(command);

            if (events.events && events.events.length > 0) {
                console.log(`Debug: Found ${events.events.length} events`);
                events.events.forEach((e) => {
                    console.log(`[Log] ${e.message}`);
                    searchStrings.forEach((s) => {
                        if (e.message?.includes(s)) {
                            if (!found.has(s)) {
                                console.log(`✅ Found log for key: ${s}`);
                                console.log(
                                    `  [${new Date(e.timestamp!).toISOString()}] ${e.message}`,
                                );
                                found.add(s);
                            }
                        }
                    });
                });
            }

            if (found.size === searchStrings.length) {
                return true;
            }
        } catch (error: any) {
            console.warn(`Error polling logs: ${error.message}`);
        }

        await new Promise((r) => setTimeout(r, 2000));
    }

    console.error(
        `Timeout! Found: ${Array.from(found).join(', ')}. Missing: ${searchStrings.filter((s) => !found.has(s)).join(', ')}`,
    );
    return false;
};

const run = async () => {
    try {
        console.log(`🔍 Discovering Stack Resources for stack: ${STACK_NAME}...`);
        const { bucketName, logGroupName } = await getStackResources();
        console.log(`  Bucket: ${bucketName}`);
        console.log(`  Log Group: ${logGroupName}`);

        const testDataDir = path.join(process.cwd(), 'test-data');
        const files = ['sample1.md', 'sample2.md', 'sample3.md'];
        const uploadedKeys: string[] = [];

        const client = createS3Client({ region: REGION });
        const logger = createLogger();
        const ctx = { logger, client };

        console.log('\n🚀 Uploading Files...');
        const requestIds: string[] = [];

        for (const file of files) {
            const content = fs.readFileSync(path.join(testDataDir, file), 'utf-8');
            const key = `${file}`;
            const requestId = crypto.randomUUID();

            await putObject(ctx)({
                Bucket: bucketName,
                Key: key,
                Body: content,
                Metadata: {
                    'x-request-id': requestId,
                },
            });
            console.log(`  Uploaded ${key} (RequestID: ${requestId})`);
            uploadedKeys.push(key);
            requestIds.push(requestId);
        }

        console.log('\n⏳ Waiting for Lambda to process events...');
        // Verify filenames, "Lambda Event", AND the unique Request IDs
        const logSearchStrings = [...uploadedKeys, 'Lambda Event', ...requestIds];
        const logsSuccess = await waitForLogs(logGroupName, logSearchStrings);
        if (!logsSuccess)
            console.warn(
                '⚠️ Logs verification timed out or failed. Proceeding to verify S3 operations...',
            );

        // 3. GET OBJECT
        console.log('\n🚀 Testing getObject...');
        const getRes = await getObject(ctx)({
            Bucket: bucketName,
            Key: uploadedKeys[0],
        });
        const content = await getRes.Body?.transformToString();
        console.log(
            `  Retrieved content for ${uploadedKeys[0]}: "${content?.substring(0, 20)}..."`,
        );
        if (!content) throw new Error('Failed to retrieve content');

        // 4. LIST OBJECTS
        console.log('\n🚀 Testing listObjects...');
        const listRes = await listObjects(ctx)({
            Bucket: bucketName,
        });
        console.log(`  Found ${listRes.Contents?.length} objects`);
        const listedKeys = listRes.Contents?.map((c) => c.Key);
        if (!uploadedKeys.every((k) => listedKeys?.includes(k))) {
            throw new Error(`List mismatch. Expected ${uploadedKeys}, got ${listedKeys}`);
        }

        // 5. GET SIGNED URL
        console.log('\n🚀 Testing getSignedUrl...');
        const signedUrl = await getSignedUrl(ctx)({
            bucket: bucketName,
            key: uploadedKeys[1],
            expiresIn: 3600,
            operation: SignedUrlOperation.GET,
        });
        console.log(`  Generated Signed URL: ${signedUrl.substring(0, 50)}...`);
        if (!signedUrl.includes(bucketName)) throw new Error('Invalid Signed URL');

        // 6. DELETE OBJECT
        console.log('\n🚀 Testing deleteObject...');
        const keyToDelete = uploadedKeys[2];
        await deleteObject(ctx)({
            Bucket: bucketName,
            Key: keyToDelete,
        });
        console.log(`  Deleted ${keyToDelete}`);

        // Verify Delete
        const listResAfter = await listObjects(ctx)({ Bucket: bucketName });
        if (listResAfter.Contents?.find((c) => c.Key === keyToDelete)) {
            throw new Error(`Object ${keyToDelete} should have been deleted`);
        }

        console.log('\n✅ All S3 Operations Verified!');
        process.exit(0);
    } catch (error) {
        console.error('\n❌ Verified Failed:', error);
        process.exit(1);
    }
};

run();
