#!/usr/bin/env node
/**
 * Stage 10.3: the budgets, measured on the world seed-perf.mjs made, against a
 * production build (`next build && next start`) on a throwaway database.
 *
 *   node scripts/perf/measure.mjs perf-world.json
 *
 * Each API read is timed 12 times (the first two warm the route and are
 * dropped); pages are timed in Chromium from navigation to their ready mark,
 * and one interaction (selecting a step in the 1,000-step tree) from click to
 * its panel. Prints a table and exits 1 when anything is over its budget, or
 * when a page trips the production Content Security Policy (the e2e contract
 * checks the dev server's, which also allows 'unsafe-eval').
 */
import { readFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const world = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const BASE = world.base
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error('measure: local servers only')

/** Budgets in ms (p95 for API reads). Lists stay quick at a class of 300; the 1,000-step case gets more room. */
const BUDGET = { list: 800, bigRead: 2000, page: 3000, bigPage: 5000, interaction: 1000 }

const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b)
  return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))])
}
const claims = (t) => JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString('utf8'))

async function timeApi(path, token) {
  const ms = []
  for (let i = 0; i < 12; i++) {
    const t = performance.now()
    const r = await fetch(BASE + path, { headers: { authorization: `Bearer ${token}` } })
    await r.arrayBuffer()
    if (!r.ok) throw new Error(`${path} → ${r.status}`)
    if (i >= 2) ms.push(performance.now() - t)
  }
  return { p50: pct(ms, 50), p95: pct(ms, 95) }
}

const { owner, student, big, cls } = world
const rows = []
const api = [
  ['GET /api/projects (owner)', `/api/projects`, owner, 'list'],
  ['GET /api/projects (student)', `/api/projects`, student, 'list'],
  ['progress, 300 cases', `/api/projects/${cls.projectId}/progress`, owner, 'list'],
  ['progress, as a student', `/api/projects/${cls.projectId}/progress`, student, 'list'],
  ['members, 302 people', `/api/projects/${cls.projectId}/members`, owner, 'list'],
  ['empty flows, 300 cases', `/api/projects/${cls.projectId}/empty-flows`, owner, 'list'],
  ['compare base and a copy', `/api/projects/${cls.projectId}/compare?cases=${cls.baseCaseId},${cls.copyId}`, owner, 'list'],
  ['case GET, 1,000-step case', `/api/cases/${big.caseId}`, owner, 'list'],
  ['components, 1,000 steps', `/api/cases/${big.caseId}/components`, owner, 'bigRead'],
  ['inventory, 5,000 flows', `/api/cases/${big.caseId}/inventory`, owner, 'bigRead'],
  ['latest run, 1,000-step case', `/api/cases/${big.caseId}/assessments?latest=1`, owner, 'bigRead'],
]
for (const [name, path, tok, kind] of api) {
  const r = await timeApi(path, tok)
  rows.push({ name, ...r, budget: BUDGET[kind], ok: r.p95 <= BUDGET[kind] })
}

const browser = await chromium.launch()
const cspViolations = []
async function signedIn(token) {
  const c = claims(token)
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: {
      cookies: [],
      origins: [
        {
          origin: new URL(BASE).origin,
          localStorage: [
            { name: 'auth_token', value: token },
            { name: 'user', value: JSON.stringify({ id: c.id, email: c.email, account_type: 'user' }) },
            { name: 'lcapix-auth', value: JSON.stringify({ state: { user: { id: String(c.id), name: c.email, email: c.email, createdAt: '2026-01-01T00:00:00.000Z' }, isAuthenticated: true }, version: 0 }) },
          ],
        },
      ],
    },
  })
  const page = await ctx.newPage()
  page.on('console', (m) => {
    if (/Content Security Policy|Refused to (load|execute|apply|connect|frame)/i.test(m.text())) cspViolations.push(`${page.url()}: ${m.text().slice(0, 200)}`)
  })
  return page
}
async function timePage(page, name, path, ready, kind) {
  // Twice: the first compiles nothing (a production build) but warms the data paths; the second is the figure.
  let ms = 0
  for (let i = 0; i < 2; i++) {
    const t = performance.now()
    await page.goto(BASE + path, { waitUntil: 'commit' })
    await ready(page).first().waitFor({ state: 'visible', timeout: 30_000 })
    ms = performance.now() - t
  }
  rows.push({ name, p50: Math.round(ms), p95: Math.round(ms), budget: BUDGET[kind], ok: ms <= BUDGET[kind] })
}

const op = await signedIn(owner)
await timePage(op, 'page: Home (owner)', '/home', (p) => p.getByRole('heading', { level: 1 }), 'page')
await timePage(op, 'page: Cases, 300', `/project/${cls.projectId}/cases`, (p) => p.getByText('Your cases'), 'page')
await timePage(op, 'page: People, 302', `/project/${cls.projectId}/people`, (p) => p.getByText('Add people'), 'page')
await timePage(op, 'page: Analytics, 300', `/project/${cls.projectId}/analytics`, (p) => p.getByText('How far the class got'), 'page')
await timePage(op, 'page: Compare', `/project/${cls.projectId}/comparison?cases=${cls.baseCaseId},${cls.copyId}`, (p) => p.getByText('Change by step'), 'page')
await timePage(op, 'page: 1,000-step tree', `/project/${big.projectId}/case/${big.caseId}`, (p) => p.getByRole('treeitem'), 'bigPage')
await timePage(op, 'page: Inventory, 5,000 flows', `/project/${big.projectId}/case/${big.caseId}?tab=inventory`, (p) => p.getByRole('table'), 'bigPage')

// Interaction: select a step in the big tree, then its panel.
await op.goto(`${BASE}/project/${big.projectId}/case/${big.caseId}`)
const item = op.getByRole('treeitem', { name: /^10\. Operation 1, / })
await item.waitFor({ timeout: 30_000 })
const t = performance.now()
await item.click()
await op.getByRole('complementary', { name: /10\. Operation 1/ }).waitFor({ timeout: 30_000 })
const ims = performance.now() - t
rows.push({ name: 'select a step in the 1,000-step tree', p50: Math.round(ims), p95: Math.round(ims), budget: BUDGET.interaction, ok: ims <= BUDGET.interaction })

const sp = await signedIn(student)
await timePage(sp, 'page: Home (student)', '/home', (p) => p.getByRole('heading', { level: 1 }), 'page')
await browser.close()

rows.push({ name: 'CSP violations on a production build', p50: cspViolations.length, p95: cspViolations.length, budget: 0, ok: cspViolations.length === 0 })
for (const v of cspViolations) console.log(`CSP ${v}`)

const w = Math.max(...rows.map((r) => r.name.length))
for (const r of rows) console.log(`${r.ok ? 'ok  ' : 'OVER'} ${r.name.padEnd(w)}  p50 ${String(r.p50).padStart(5)} ms  p95 ${String(r.p95).padStart(5)} ms  budget ${r.budget} ms`)
console.log(JSON.stringify({ seeded: world.phases, measured: rows }))
process.exit(rows.every((r) => r.ok) ? 0 : 1)
