import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
const client = new S3Client({ region });

/**
 * Upload a buffer to S3 and optionally tag it with retention metadata.
 * If S3_PUBLIC_URL is set, returns a direct URL, otherwise returns a presigned GET URL.
 */
export async function uploadBufferToS3(bucket: string, key: string, buffer: Buffer, contentType = 'application/pdf', retentionDays?: number) {
  const tagging = retentionDays ? `retention=${retentionDays}` : undefined;
  const cmd = new PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: contentType, Tagging: tagging });
  await client.send(cmd);
  // if S3_PUBLIC_URL is provided, return a stable public URL
  if (process.env.S3_PUBLIC_URL) {
    return `${process.env.S3_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
  }
  // otherwise, return a presigned GET URL
  const get = new GetObjectCommand({ Bucket: bucket, Key: key });
  const url = await getSignedUrl(client, get, { expiresIn: 60 * 60 * 24 * 7 }); // 7 days
  return url;
}

export async function deleteS3Object(bucket: string, key: string) {
  const cmd = new DeleteObjectCommand({ Bucket: bucket, Key: key });
  await client.send(cmd);
}

export default client;
