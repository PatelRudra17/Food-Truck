import "server-only";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { nanoid } from "nanoid";
import { env } from "@/lib/env";

const s3 = new S3Client({
  endpoint: env.STORAGE_ENDPOINT,
  region: env.STORAGE_REGION,
  forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY,
  },
});

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

export class UploadValidationError extends Error {}

export function validateUpload(file: { type: string; size: number }) {
  if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    throw new UploadValidationError(`File type "${file.type}" is not allowed.`);
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadValidationError("File exceeds the 10 MB upload limit.");
  }
  if (file.size === 0) {
    throw new UploadValidationError("File is empty.");
  }
}

/** Uploads a document to private object storage. Never make this bucket/key public. */
export async function uploadObject(params: {
  buffer: Buffer;
  mimeType: string;
  entityType: string;
  originalFileName: string;
}): Promise<{ storageKey: string }> {
  const safeExt = params.originalFileName.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") ?? "bin";
  const storageKey = `${params.entityType.toLowerCase()}/${new Date().getFullYear()}/${nanoid()}.${safeExt}`;

  await s3.send(
    new PutObjectCommand({
      Bucket: env.STORAGE_BUCKET,
      Key: storageKey,
      Body: params.buffer,
      ContentType: params.mimeType,
    }),
  );

  return { storageKey };
}

/** Returns a short-lived signed URL for private document access. Never store/return public URLs. */
export async function getSignedDownloadUrl(storageKey: string): Promise<string> {
  const command = new GetObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: storageKey });
  return getSignedUrl(s3, command, { expiresIn: env.STORAGE_SIGNED_URL_TTL });
}

export async function deleteObject(storageKey: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: storageKey }));
}
