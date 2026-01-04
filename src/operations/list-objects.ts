import {
    ListObjectsV2Command,
    ListObjectsV2CommandInput,
    ListObjectsV2CommandOutput,
} from '@aws-sdk/client-s3';
import { S3Context } from '../types';

export const listObjects =
    (context: S3Context) =>
    async (input: ListObjectsV2CommandInput): Promise<ListObjectsV2CommandOutput> => {
        const { client, logger } = context;
        logger?.debug('listObjects:start', {
            data: { Bucket: input.Bucket, Prefix: input.Prefix },
        });
        try {
            const command = new ListObjectsV2Command(input);
            const result = await client.send(command);
            logger?.debug('listObjects:success', { data: { KeyCount: result.KeyCount } });
            return result;
        } catch (error) {
            logger?.debug('listObjects:error', { error });
            throw error;
        }
    };
