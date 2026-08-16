import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

/**
 * S3 access helpers. Like the DynamoDB client, the S3 client is created
 * once at module scope so warm Lambda invocations reuse it.
 */
const s3 = new S3Client({
  ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}),
});

export async function putObject(bucket: string, key: string, body: string, contentType: string): Promise<void> {
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
}

export async function getObject(bucket: string, key: string): Promise<string> {
  const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  // The v3 SDK stream exposes a helper to read it all as a string.
  return result.Body!.transformToString();
}
