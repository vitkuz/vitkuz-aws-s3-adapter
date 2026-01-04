import {
    HeadObjectCommand,
    HeadObjectCommandInput,
    HeadObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { S3Context } from '../types';

export const headObject =
    (context: S3Context) =>
    async (input: HeadObjectCommandInput): Promise<HeadObjectCommandOutput> => {
        const { client, logger } = context;
        logger?.debug('headObject:start', { data: { Bucket: input.Bucket, Key: input.Key } });
        try {
            const command = new HeadObjectCommand(input);
            const result = await client.send(command);
            logger?.debug('headObject:success', { data: result });
            return result;
        } catch (error) {
            logger?.debug('headObject:error', { error });
            throw error;
        }
    };
