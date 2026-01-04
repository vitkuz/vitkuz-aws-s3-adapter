import {
    PutObjectCommand,
    PutObjectCommandInput,
    PutObjectCommandOutput,
} from '@aws-sdk/client-s3';
import { S3Context } from '../types';

export const putObject =
    (context: S3Context) =>
    async (input: PutObjectCommandInput): Promise<PutObjectCommandOutput> => {
        const { client, logger } = context;
        logger?.debug('putObject:start', { data: { Bucket: input.Bucket, Key: input.Key } });
        try {
            const command = new PutObjectCommand(input);
            const result = await client.send(command);
            logger?.debug('putObject:success', { data: result });
            return result;
        } catch (error) {
            logger?.debug('putObject:error', { error });
            throw error;
        }
    };
