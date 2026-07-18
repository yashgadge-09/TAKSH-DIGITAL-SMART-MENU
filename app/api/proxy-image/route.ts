import { NextResponse } from 'next/server';

// SSRF guard: this route fetches a caller-supplied URL server-side, so without
// restrictions it could be pointed at internal services or the cloud metadata
// endpoint (169.254.169.254). We only allow https and a fixed set of image
// hosts — the same hosts dish/category images are ever stored on.
function buildAllowedHosts(): Set<string> {
  const hosts = ['images.unsplash.com', 'res.cloudinary.com'];

  const cdnHost = (process.env.NEXT_PUBLIC_IMAGE_CDN_HOST || 'res.tastefy.food').trim();
  if (cdnHost) hosts.push(cdnHost.toLowerCase());

  const r2Base = process.env.R2_PUBLIC_BASE_URL?.trim();
  if (r2Base) {
    try {
      hosts.push(new URL(r2Base).hostname.toLowerCase());
    } catch {
      /* ignore malformed R2 base */
    }
  }

  return new Set(hosts);
}

const ALLOWED_HOSTS = buildAllowedHosts();

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return new NextResponse('Missing url parameter', { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return new NextResponse('Invalid url parameter', { status: 400 });
  }

  if (target.protocol !== 'https:') {
    return new NextResponse('Only https URLs are allowed', { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(target.hostname.toLowerCase())) {
    return new NextResponse('Image host not allowed', { status: 403 });
  }

  try {
    // redirect: 'error' stops an allowlisted host from 3xx-redirecting us to an
    // internal address — a common allowlist-bypass for SSRF.
    const response = await fetch(target.toString(), { redirect: 'error' });

    if (!response.ok) {
      return new NextResponse('Upstream fetch failed', { status: 502 });
    }

    const contentType = response.headers.get('Content-Type') || '';
    if (!contentType.toLowerCase().startsWith('image/')) {
      return new NextResponse('Requested resource is not an image', { status: 415 });
    }

    const blob = await response.blob();
    return new NextResponse(blob, {
      headers: {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=31536000',
      },
    });
  } catch (error) {
    return new NextResponse('Error fetching image', { status: 500 });
  }
}
