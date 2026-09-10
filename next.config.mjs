/** @type {import('next').NextConfig} */
const nextConfig = {
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
