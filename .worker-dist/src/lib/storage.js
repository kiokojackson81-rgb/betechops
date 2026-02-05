"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadBufferToS3 = uploadBufferToS3;
exports.deleteS3Object = deleteS3Object;
const client_s3_1 = require("@aws-sdk/client-s3");
const s3_request_presigner_1 = require("@aws-sdk/s3-request-presigner");
const region = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'us-east-1';
const client = new client_s3_1.S3Client({ region });
/**
 * Upload a buffer to S3 and optionally tag it with retention metadata.
 * If S3_PUBLIC_URL is set, returns a direct URL, otherwise returns a presigned GET URL.
 */
async function uploadBufferToS3(bucket, key, buffer, contentType = 'application/pdf', retentionDays) {
    const tagging = retentionDays ? `retention=${retentionDays}` : undefined;
    const cmd = new client_s3_1.PutObjectCommand({ Bucket: bucket, Key: key, Body: buffer, ContentType: contentType, Tagging: tagging });
    await client.send(cmd);
    // if S3_PUBLIC_URL is provided, return a stable public URL
    if (process.env.S3_PUBLIC_URL) {
        return `${process.env.S3_PUBLIC_URL.replace(/\/$/, '')}/${key}`;
    }
    // otherwise, return a presigned GET URL
    const get = new client_s3_1.GetObjectCommand({ Bucket: bucket, Key: key });
    const url = await (0, s3_request_presigner_1.getSignedUrl)(client, get, { expiresIn: 60 * 60 * 24 * 7 }); // 7 days
    return url;
}
async function deleteS3Object(bucket, key) {
    const cmd = new client_s3_1.DeleteObjectCommand({ Bucket: bucket, Key: key });
    await client.send(cmd);
}
exports.default = client;
