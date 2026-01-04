import {
    GetObjectCommand,
    GetObjectCommandInput,
    GetObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { S3Context } from '../types';

export const getObject =
    (context: S3Context) =>
    async (input: GetObjectCommandInput): Promise<GetObjectCommandOutput> => {
        const { client, logger } = context;
        logger?.debug('getObject:start', { data: { Bucket: input.Bucket, Key: input.Key } });
        try {
            const command = new GetObjectCommand(input);
            const result = await client.send(command);
            logger?.debug('getObject:success');
            return result;
        } catch (error) {
            logger?.debug('getObject:error', { error });
            throw error;
        }
    };
