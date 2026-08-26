const developmentScriptPolicy = process.env.NODE_ENV === 'development' ? " 'unsafe-eval'" : ''

/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,
  devIndicators: false,
  // Chromium ships pre-compressed platform binaries that must remain external
  // to Next's server bundle so the serverless renderer can unpack them at run
  // time.
  serverExternalPackages: ['@sparticuz/chromium'],
  // Next's file tracer follows Chromium's JavaScript entrypoint but cannot
  // infer the Brotli archives loaded dynamically by executablePath(). Include
  // them only in the two serverless functions that render Stories.
  outputFileTracingIncludes: {
    '/api/admin/products/*/approve': [
      './node_modules/@sparticuz/chromium/bin/**/*',
    ],
    '/api/admin/products/*/instagram-story/retry': [
      './node_modules/@sparticuz/chromium/bin/**/*',
    ],
  },
  turbopack: {
    root: process.cwd(),
  },
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
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              `script-src 'self' 'unsafe-inline' https://connect.facebook.net${developmentScriptPolicy}`,
              "script-src-attr 'none'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https://*.supabase.co https://images.unsplash.com https://www.facebook.com",
              "font-src 'self' data:",
              "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://connect.facebook.net https://www.facebook.com",
              "frame-src 'none'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "object-src 'none'",
              "form-action 'self' https://webpay3gint.transbank.cl https://webpay3g.transbank.cl",
              'upgrade-insecure-requests',
            ].join('; '),
          },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains',
          },
        ],
      },
    ]
  },
};

export default nextConfig;
