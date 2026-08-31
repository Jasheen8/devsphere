import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
const enabled = !!process.env.STORAGE_ENDPOINT && !!process.env.STORAGE_BUCKET;
const client = enabled
  ? new S3Client({
      endpoint: process.env.STORAGE_ENDPOINT,
      region: process.env.STORAGE_REGION || "auto",
      credentials: {
        accessKeyId: process.env.STORAGE_ACCESS_KEY || "",
        secretAccessKey: process.env.STORAGE_SECRET_KEY || "",
      },
      forcePathStyle: true,
    })
  : null;
export async function presignUpload(key: string, contentType: string) {
  if (!client) throw new Error("Storage is not configured");
  return getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: process.env.STORAGE_BUCKET!,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: 900 },
  );
}
export function publicUrl(key: string) {
  return process.env.STORAGE_PUBLIC_BASE_URL
    ? `${process.env.STORAGE_PUBLIC_BASE_URL.replace(/\/$/, "")}/${key}`
    : key;
}
