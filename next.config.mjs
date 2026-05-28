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
    return [
      {
        source: '/firebase-messaging-sw.js',
        headers: [
          { key: 'Service-Worker-Allowed', value: '/' },
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
        ],
      },
    ]
  },
}

export default nextConfig
