import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { Readable } from 'node:stream';

const s3 = new S3Client({
  ...(process.env.S3_ENDPOINT ? { endpoint: process.env.S3_ENDPOINT } : {}),
});

/** Return the S3 object body as a Node.js Readable stream. */
export async function getObjectStream(bucket: string, key: string): Promise<Readable> {
  const result = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!result.Body) throw new Error(`S3 object ${bucket}/${key} has no body`);
  return result.Body as Readable;
}

/** Upload a Readable stream to S3 using chunked transfer encoding. */
export async function putObjectStream(bucket: string, key: string, body: Readable, contentType: string): Promise<void> {
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
}
