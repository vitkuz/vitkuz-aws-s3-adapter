import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl as awsGetSignedUrl } from '@aws-sdk/s3-request-presigner';
import { RequestPresigningArguments } from '@aws-sdk/types';
import { S3Context } from '../types';

export enum SignedUrlOperation {
    GET = 'getObject',
    PUT = 'putObject',
}

type SignedUrlOptions = RequestPresigningArguments & {
    expiresIn?: number;
    operation: SignedUrlOperation;
    bucket: string;
    key: string;
};

export const getSignedUrl =
    (context: S3Context) =>
    async (options: SignedUrlOptions): Promise<string> => {
        const { client, logger } = context;
        const { operation, bucket, key, ...rest } = options;
        logger?.debug('getSignedUrl:start', { data: { operation, bucket, key } });

        try {
            let command;
            if (operation === SignedUrlOperation.GET) {
                command = new GetObjectCommand({ Bucket: bucket, Key: key });
            } else {
                command = new PutObjectCommand({ Bucket: bucket, Key: key });
            }

            const url = await awsGetSignedUrl(client, command, rest);
            logger?.debug('getSignedUrl:success');
            return url;
        } catch (error) {
            logger?.debug('getSignedUrl:error', { error });
            throw error;
        }
    };
