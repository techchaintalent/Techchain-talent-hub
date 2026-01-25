import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env, isDevMode } from "../env";
import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    if (!env.S3_BUCKET && !isDevMode()) {
      throw new Error("S3_BUCKET is required in production mode");
    }

    s3Client = new S3Client({
      region: env.S3_REGION,
      ...(env.S3_ENDPOINT && {
        endpoint: env.S3_ENDPOINT,
        forcePathStyle: true,
      }),
      credentials: env.S3_ACCESS_KEY_ID
        ? {
            accessKeyId: env.S3_ACCESS_KEY_ID,
            secretAccessKey: env.S3_SECRET_ACCESS_KEY || "",
          }
        : undefined,
    });
  }
  return s3Client;
}

// Local storage for dev mode
const LOCAL_STORAGE_DIR = "/tmp/techchain-uploads";

function ensureLocalStorageDir(): void {
  if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
    fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
  }
}

export interface UploadResult {
  key: string;
  url: string;
}

export async function uploadFile(
  buffer: Buffer,
  filename: string,
  contentType: string,
  folder: string = "uploads"
): Promise<UploadResult> {
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 8);
  const ext = path.extname(filename);
  const key = `${folder}/${Date.now()}-${hash}${ext}`;

  if (isDevMode()) {
    ensureLocalStorageDir();
    const localPath = path.join(LOCAL_STORAGE_DIR, key);
    const dir = path.dirname(localPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(localPath, buffer);
    return {
      key,
      url: `file://${localPath}`,
    };
  }

  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );

  return {
    key,
    url: env.S3_ENDPOINT
      ? `${env.S3_ENDPOINT}/${env.S3_BUCKET}/${key}`
      : `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com/${key}`,
  };
}

export async function getSignedDownloadUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  if (isDevMode()) {
    const localPath = path.join(LOCAL_STORAGE_DIR, key);
    return `file://${localPath}`;
  }

  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn });
}

export async function getSignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  if (isDevMode()) {
    // In dev mode, return a mock URL - actual upload handled by uploadFile
    return `${env.APP_URL}/api/upload?key=${encodeURIComponent(key)}`;
  }

  const client = getS3Client();
  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(client, command, { expiresIn });
}

export async function deleteFile(key: string): Promise<void> {
  if (isDevMode()) {
    const localPath = path.join(LOCAL_STORAGE_DIR, key);
    if (fs.existsSync(localPath)) {
      fs.unlinkSync(localPath);
    }
    return;
  }

  const client = getS3Client();
  await client.send(
    new DeleteObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
    })
  );
}

export async function getFileContents(key: string): Promise<Buffer> {
  if (isDevMode()) {
    const localPath = path.join(LOCAL_STORAGE_DIR, key);
    return fs.readFileSync(localPath);
  }

  const client = getS3Client();
  const response = await client.send(
    new GetObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
    })
  );

  const chunks: Uint8Array[] = [];
  for await (const chunk of response.Body as any) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

// Resume text extraction (simple implementation)
export async function extractTextFromResume(
  buffer: Buffer,
  contentType: string
): Promise<string> {
  // For MVP, we do basic text extraction
  // In production, you'd use a service like AWS Textract or a PDF parser

  if (contentType === "text/plain") {
    return buffer.toString("utf-8");
  }

  if (contentType === "application/pdf") {
    // Basic PDF text extraction - in production use pdf-parse or similar
    const content = buffer.toString("utf-8");
    // Very basic extraction - look for text between stream markers
    const text = content
      .replace(/[\r\n]+/g, " ")
      .replace(/\s+/g, " ")
      .substring(0, 10000); // Limit length

    // If we can't extract meaningful text, return a placeholder
    if (text.length < 100) {
      return "[PDF content - text extraction pending]";
    }
    return text;
  }

  // For other types, try to read as text
  try {
    return buffer.toString("utf-8").substring(0, 10000);
  } catch {
    return "[Unable to extract text from file]";
  }
}
