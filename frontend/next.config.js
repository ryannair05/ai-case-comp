/** @type {import('next').NextConfig} */
const nextConfig = {
  // API proxy to Railway backend (avoids CORS in dev)
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL ?? "https://api.draftly.ai"}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
