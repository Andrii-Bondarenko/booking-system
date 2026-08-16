import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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

/** Upload data to S3. Pass a Buffer for known-size payloads, Readable for true streams. */
export async function putObject(bucket: string, key: string, body: Buffer | Readable, contentType: string): Promise<void> {
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: contentType }));
}

/** Return a pre-signed HTTPS URL valid for `expiresIn` seconds (default 1 hour). */
export async function getPresignedUrl(bucket: string, key: string, expiresIn = 3600): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn });
}
