/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tree-shake heavy icon/animation libs so only the symbols actually used ship
  // to the client. Next rewrites these barrel imports to per-symbol imports at
  // build time — no behavior change, smaller First Load JS.
  experimental: {
    optimizePackageImports: [
      'framer-motion',
      'lucide-react',
      'react-icons/gi',
      'react-icons/fa',
    ],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

export default nextConfig;
