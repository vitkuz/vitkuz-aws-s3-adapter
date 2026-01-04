import { S3Client, S3ClientConfig } from '@aws-sdk/client-s3';

export const createS3Client = (config: S3ClientConfig): S3Client => {
    return new S3Client(config);
};
