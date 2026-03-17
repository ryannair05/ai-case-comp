/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    "localhost:3000",
    "http://127.0.0.1:8080",
    "local-origin.dev",
    "*.local-origin.dev"
  ],
  output: 'export',
  images: {
    unoptimized: true,
  },
  // API proxy to Railway backend (avoids CORS in dev)
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8080"}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
