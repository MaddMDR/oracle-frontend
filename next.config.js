/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // NEXT_PUBLIC_API_URL is read at build time from the environment.
  // Set it in Vercel dashboard → Settings → Environment Variables.
  // Falls back to localhost for local dev.
  images: {
    unoptimized: true,
  },
};
module.exports = nextConfig;
