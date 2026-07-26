/** @type {import('next').NextConfig} */
const imageCdnHost = process.env.NEXT_PUBLIC_IMAGE_CDN_HOST || 'res.tastefy.food'

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'res.cloudinary.com',
      },
      {
        protocol: 'https',
        hostname: imageCdnHost,
      },
    ],
  },
  logging: {
    browserToTerminal: true,
  },
  async headers() {
    // Content-Security-Policy allowing only the third parties this app actually
    // uses: Supabase (REST + Realtime websockets), OneSignal (push SDK + iframe),
    // Vercel Analytics, Google Fonts, and image CDNs. Scripts are limited to our
    // own origin + these hosts.
    //
    // Dev-only relaxations (never shipped to production): React/Turbopack need
    // 'unsafe-eval' for dev-mode debugging features, and HMR needs a websocket
    // back to localhost.
    const isDev = process.env.NODE_ENV === 'development'
    const devScriptSrc = isDev ? " 'unsafe-eval'" : ''
    const devConnectSrc = isDev ? ' ws://localhost:* http://localhost:*' : ''

    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${devScriptSrc} https://cdn.onesignal.com https://onesignal.com https://*.onesignal.com https://va.vercel-scripts.com`,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data: https://fonts.gstatic.com",
      `connect-src 'self'${devConnectSrc} https://*.supabase.co wss://*.supabase.co https://onesignal.com https://*.onesignal.com https://*.r2.dev https://vitals.vercel-insights.com https://maps.googleapis.com`,
      "frame-src 'self' https://onesignal.com https://*.onesignal.com",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      // Would break plain-http LAN testing (e.g. phone on http://192.168.x.x:3000).
      ...(isDev ? [] : ['upgrade-insecure-requests']),
    ].join('; ')

    const securityHeaders = [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
      { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
      { key: 'Content-Security-Policy', value: csp },
    ]

    return [
      {
        // Apply security headers to every route.
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/firebase-messaging-sw.js',
        headers: [
          { key: 'Service-Worker-Allowed', value: '/' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
      {
        source: '/OneSignalSDKWorker.js',
        headers: [
          {
            key: 'Service-Worker-Allowed',
            value: '/',
          },
          {
            key: 'Cache-Control',
            value: 'no-cache',
          },
          {
            key: 'Content-Type',
            value: 'application/javascript; charset=utf-8',
          },
        ],
      },
    ]
  },
}

export default nextConfig
