import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Do NOT use output: "standalone" on Vercel — it breaks the deployment.
  // Vercel uses its own build output handler.
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,

  // IMPORTANT: Tell Turbopack NOT to bundle these Node.js packages.
  // Without this, Turbopack tries to bundle them into client chunks,
  // which breaks because they use native bindings or server-only APIs.
  serverExternalPackages: [
    'pg',
    'pg-native',
    'pusher',
    'cloudinary',
    '@supabase/supabase-js',
    'bcryptjs',
    'ioredis',
    'jsonwebtoken',
    'stripe',
    'sharp',
  ],

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "ui-avatars.com" },
    ],
  },
  allowedDevOrigins: [
    "https://preview-chat-6d31c628-88c7-439a-805c-7a7eb14c3083.space.z.ai",
  ],
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
