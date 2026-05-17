import { NextResponse } from 'next/server';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';
import sharp from 'sharp';

export const runtime = 'nodejs';

const MAX_DIMENSION = 1600;
const WEBP_QUALITY = 85;

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
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image uploads are supported' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
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
    console.error('Error uploading to R2:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
