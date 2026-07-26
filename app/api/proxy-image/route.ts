import { NextResponse } from 'next/server';

// SSRF guard: only proxy images from known, trusted image hosts. Without this an
// attacker could use ?url= to make the server fetch internal/cloud-metadata
// endpoints (e.g. 169.254.169.254) or arbitrary internal services.
const ALLOWED_IMAGE_HOSTS = [
  process.env.NEXT_PUBLIC_IMAGE_CDN_HOST,
  'res.cloudinary.com',
  'images.unsplash.com',
  'res.tastefy.food',
]
  .filter(Boolean)
  .map((h) => (h as string).toLowerCase());

function isAllowedImageUrl(raw: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  const host = parsed.hostname.toLowerCase();
  return ALLOWED_IMAGE_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  if (!isAllowedImageUrl(url)) {
    return new NextResponse('URL host not allowed', { status: 400 });
  }

  try {
    const response = await fetch(url);
    const contentType = response.headers.get('Content-Type') || 'image/jpeg';
    // Only pass through actual images.
    if (!contentType.startsWith('image/')) {
      return new NextResponse('Not an image', { status: 400 });
    }
    const blob = await response.blob();
    return new NextResponse(blob, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch {
    return new NextResponse('Error fetching image', { status: 500 });
  }
}
