#!/usr/bin/env node
/**
 * Stage 10.5: the security headers, read from a running server (a production
 * build: `next build && next start`). Checks a page, an API route, a 404 and a
 * static asset, since Next serves each through a different path.
 *
 *   node scripts/security/check-headers.mjs http://localhost:3130    exits 1 on a miss
 */
const BASE = process.argv[2] ?? 'http://localhost:3130'

const page = await fetch(BASE + '/')
const asset = (await page.text()).match(/\/_next\/static\/[^"']+\.js/)?.[0]
const paths = ['/', '/auth/login', '/api/health', '/no-such-page', ...(asset ? [asset] : [])]

const EXPECT = {
  'content-security-policy': (v) => v?.includes("default-src 'self'") && v.includes("frame-ancestors 'none'") && v.includes("object-src 'none'") && !v.includes("'unsafe-eval'"),
  'strict-transport-security': (v) => /max-age=(\d+)/.test(v ?? '') && Number(v.match(/max-age=(\d+)/)[1]) >= 31536000,
  'x-content-type-options': (v) => v === 'nosniff',
  'x-frame-options': (v) => v === 'DENY',
  'referrer-policy': (v) => v === 'strict-origin-when-cross-origin',
  'permissions-policy': (v) => /camera=\(\)/.test(v ?? '') && /microphone=\(\)/.test(v ?? ''),
  'x-powered-by': (v) => v == null,
  'content-security-policy-report-only': (v) => v == null,
}

const misses = []
for (const p of paths) {
  const r = await fetch(BASE + p, { redirect: 'manual' })
  for (const [h, ok] of Object.entries(EXPECT)) if (!ok(r.headers.get(h))) misses.push(`${p} (${r.status}): ${h} = ${r.headers.get(h)}`)
}
console.log(`${paths.length} paths × ${Object.keys(EXPECT).length} headers checked, ${misses.length} misses`)
for (const m of misses) console.log(m)
process.exit(misses.length ? 1 : 0)
