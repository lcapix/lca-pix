const isDev = process.env.NODE_ENV === 'development'

// Content Security Policy. Shipped as Report-Only for now: browsers log
// violations to the console but block nothing. Once a release shows no
// violations in normal use, rename the header below to
// `Content-Security-Policy` to enforce it (and ideally move to per-request
// nonces via middleware so 'unsafe-inline' can go from script-src).
// 'unsafe-inline' is needed while scripts carry no nonce, because the App
// Router injects inline bootstrap scripts. 'unsafe-eval' is only needed by
// the dev server (React Refresh / eval source maps).
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline' fonts.googleapis.com",
  "font-src 'self' fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' accounts.google.com",
].join('; ')

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Content-Security-Policy-Report-Only', value: contentSecurityPolicy },
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Don't advertise the framework in an X-Powered-By header.
  poweredByHeader: false,

  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },

  // Type and lint errors don't block `next build`; CI runs a tsc ratchet
  // instead (scripts/tsc-ratchet.mjs) until the baseline reaches zero.
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // pdfkit reads its font-metric (.afm) files from disk at runtime; webpack
  // bundling breaks those reads ("ENOENT … Helvetica.afm"). Keep it (and the
  // pptx generator) external so they resolve from node_modules normally.
  serverExternalPackages: ['pdfkit', 'pptxgenjs'],

  // AWS / container builds: set BUILD_STANDALONE=1 to emit a self-contained
  // `.next/standalone` server (used by the Dockerfile for App Runner / ECS /
  // EC2). Left undefined for Vercel, which uses its own build output — so this
  // is a no-op for the current production deploy.
  output: process.env.BUILD_STANDALONE ? 'standalone' : undefined,

  // Standalone/container ONLY: the standalone tracer doesn't follow pdfkit's
  // runtime fs reads of its .afm font-metric data, so include them explicitly
  // or PDF export 500s in a container with "ENOENT … Helvetica.afm".
  //
  // Must NOT run on Vercel: this globs `./node_modules/pdfkit/...`, and under
  // pnpm that path is a symlink into the virtual store, which makes Vercel's
  // packager reject the function ("invalid deployment package … symlinked
  // directories"). On Vercel, `serverExternalPackages: ['pdfkit']` already
  // keeps pdfkit (and its .afm data) resolvable from node_modules at runtime,
  // so the explicit include is unnecessary there. Gate it on BUILD_STANDALONE
  // exactly like `output` above.
  ...(process.env.BUILD_STANDALONE
    ? {
        outputFileTracingIncludes: {
          '/api/assessments/**': ['./node_modules/pdfkit/js/data/**/*'],
        },
      }
    : {}),
}

export default nextConfig
