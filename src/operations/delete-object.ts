import {
    DeleteObjectCommand,
    DeleteObjectCommandInput,
    DeleteObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { S3Context } from '../types';

export const deleteObject =
    (context: S3Context) =>
    async (input: DeleteObjectCommandInput): Promise<DeleteObjectCommandOutput> => {
        const { client, logger } = context;
        logger?.debug('deleteObject:start', { data: { Bucket: input.Bucket, Key: input.Key } });
        try {
            const command = new DeleteObjectCommand(input);
            const result = await client.send(command);
            logger?.debug('deleteObject:success', { data: result });
            return result;
        } catch (error) {
            logger?.debug('deleteObject:error', { error });
            throw error;
        }
    };
