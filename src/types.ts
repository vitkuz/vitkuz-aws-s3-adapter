import { S3Client } from '@aws-sdk/client-s3';

export interface Logger {
    debug: (message: string, context?: { error?: any; data?: any }) => void;
    [key: string]: any;
}

export interface S3Context {
    client: S3Client;
    logger?: Logger;
}
