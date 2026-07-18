import { NextResponse } from 'next/server';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import heicConvert from 'heic-convert';
import sharp from 'sharp';
import { requireStaff } from '@/lib/auth-guard';
import { errorResponse } from '@/lib/api-error';

export const runtime = 'nodejs';

const MAX_DIMENSION = 1600;
const WEBP_QUALITY = 85;
const HEIC_MIME_TYPES = new Set([
  'image/heic',
  'image/heif',
  'image/heic-sequence',
  'image/heif-sequence',
]);

function isHeicLikeFile(file: File): boolean {
  const type = (file.type || '').toLowerCase();
  if (HEIC_MIME_TYPES.has(type)) return true;

  const name = (file.name || '').toLowerCase();
  return name.endsWith('.heic') || name.endsWith('.heif');
}

function isSupportedImageUpload(file: File): boolean {
  const type = (file.type || '').toLowerCase();
  return type.startsWith('image/') || isHeicLikeFile(file);
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function getR2Client() {
  const endpoint = process.env.R2_ENDPOINT?.trim();
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const resolvedEndpoint = endpoint || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');

  if (!resolvedEndpoint) {
    throw new Error('Missing R2 endpoint configuration');
  }

  return new S3Client({
    region: 'auto',
    endpoint: resolvedEndpoint,
    credentials: {
      accessKeyId: getRequiredEnv('R2_ACCESS_KEY_ID'),
      secretAccessKey: getRequiredEnv('R2_SECRET_ACCESS_KEY'),
    },
    forcePathStyle: true,
  });
}

export async function POST(request: Request) {
  // Admin/captain only — prevents anonymous abuse of R2 storage + image processing.
  try {
    await requireStaff();
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!isSupportedImageUpload(file)) {
      return NextResponse.json({ error: 'Only image uploads are supported' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    let buffer = Buffer.from(bytes);

    if (isHeicLikeFile(file)) {
      try {
        const converted = await heicConvert({
          buffer,
          format: 'JPEG',
          quality: 0.9,
        });
        buffer = Buffer.from(converted);
      } catch (error) {
        console.error('HEIC conversion failed:', error);
        return NextResponse.json({ error: 'Invalid HEIC/HEIF image file' }, { status: 400 });
      }
    }

    const resizedWebp = await sharp(buffer)
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: WEBP_QUALITY })
      .toBuffer();

    const bucket = getRequiredEnv('R2_BUCKET');
    const publicBase = getRequiredEnv('R2_PUBLIC_BASE_URL').replace(/\/$/, '');
    const key = `dishes/${randomUUID()}.webp`;
    const client = getR2Client();

    await client.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: resizedWebp,
        ContentType: 'image/webp',
        CacheControl: 'public, max-age=31536000',
      })
    );

    return NextResponse.json({ url: `${publicBase}/${key}` });
  } catch (error) {
    return errorResponse('Upload failed', 500, error);
  }
}
