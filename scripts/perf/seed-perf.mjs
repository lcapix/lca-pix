#!/usr/bin/env node
/**
 * Stage 10.3 / 10.4: a large world on a throwaway database, made through the
 * app's own routes (so every row is what the app would write):
 *
 *   - "Large plant": one case of 1,000 steps on five tiers and 5,000 flows.
 *   - "Class of 300": a base case (the sample's 17 steps and 9 flows), a TA
 *     who can share, and 300 students who each copy it; most of them run their
 *     copy, in bursts (the class burst of 10.4, within the rate limits).
 *
 * Run it against a server started on a throwaway database (scripts/db/fresh.mjs),
 * never a real one:
 *   PERF_BASE=http://localhost:3130 node scripts/perf/seed-perf.mjs > perf-world.json
 * Every request goes from its own forwarded address, as different people would.
 * Prints the world's ids and each phase's timings (with the run burst's latency
 * percentiles) as JSON on stdout.
 */

const BASE = process.env.PERF_BASE ?? 'http://localhost:3130'
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(BASE)) throw new Error(`PERF_BASE must be a local server, not ${BASE}`)
const STUDENTS = Number(process.env.PERF_STUDENTS ?? 300)
const STEPS = 1000
const FLOWS = 5000

let ipN = 0
const ip = () => `10.88.${Math.floor(++ipN / 250) % 250}.${ipN % 250}`
const log = (s) => process.stderr.write(`[perf] ${s}\n`)

async function call(path, { method = 'GET', token, json } = {}) {
  const r = await fetch(BASE + path, {
    method,
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip(), ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: json ? JSON.stringify(json) : undefined,
  })
  const t = await r.text()
  let d = null
  try {
    d = JSON.parse(t)
  } catch {}
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status} ${t.slice(0, 200)}`)
  return d
}

/** Run `fn` over `items` with at most `n` in flight. */
async function pool(items, n, fn) {
  const out = new Array(items.length)
  let i = 0
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++
        out[k] = await fn(items[k], k)
      }
    }),
  )
  return out
}

const pct = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b)
  return s.length ? Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]) : null
}
const timed = async (fn) => {
  const t = performance.now()
  const v = await fn()
  return [v, performance.now() - t]
}

const tag = Date.now().toString(36)
const signup = async (name, i) =>
  (await call('/api/auth/signup', { method: 'POST', json: { email: `perf.${tag}.${i}@example.test`, password: `Perf${tag}${i}x9`, full_name: name } })).token

const phases = {}
const t0 = performance.now()

// ── The owner and the large case ─────────────────────────────────────────────
const owner = await signup('Pat Owner', 'owner')
const subs = (await call('/api/substances', { token: owner })).substances
const pick = ['Steel', 'Electricity', 'Aluminum', 'Natural gas', 'Water', 'Argon', 'Powder coating', 'Scrap steel']
  .map((n) => subs.find((s) => s.substance_name === n))
  .filter(Boolean)
if (pick.length < 4) throw new Error('perf: the library is missing the substances this seed uses')

const big = (await call('/api/projects', { method: 'POST', token: owner, json: { project_name: 'Large plant', description: 'Stage 10.3: 1,000 steps, 5,000 flows' } })).project.project_id
await call(`/api/projects/${big}`, { method: 'PUT', token: owner, json: { functional_unit: '1 unit', system_boundary: 'cradle-to-gate', lcia_method: 'TRACI 2.1', region_code: 'US' } })
const bigCase = (await call(`/api/projects/${big}/cases`, { method: 'POST', token: owner, json: { case_name: 'Whole plant', case_type: 'base' } })).case.case_id
const add = async (name, type, parent) =>
  Number(
    (await call(`/api/cases/${bigCase}/components`, { method: 'POST', token: owner, json: { component_name: name, component_type: type, parent_component_id: parent } }))
      .component.component_id,
  )

let [, ms] = await timed(async () => {
  // 1 product, 9 lines, 90 subprocesses, 300 operations, 600 tasks = 1,000 steps.
  const product = await add('Assembled product', 'product', null)
  const lines = await pool([...Array(9).keys()], 4, (i) => add(`Line ${i + 1}`, 'machine_line', product))
  const subsList = await pool([...Array(90).keys()], 8, (i) => add(`Process ${i + 1}`, 'subprocess', lines[i % 9]))
  const ops = await pool([...Array(300).keys()], 8, (i) => add(`${(i + 1) * 10}. Operation ${i + 1}`, 'operation', subsList[i % 90]))
  const tasks = await pool([...Array(600).keys()], 8, (i) => add(`Task ${i + 1}`, 'elemental_task', ops[i % 300]))
  phases.bigLeaves = [...ops, ...tasks]
})
phases.bigSteps = { count: STEPS, ms: Math.round(ms) }
;[, ms] = await timed(() =>
  pool([...Array(FLOWS).keys()], 10, (i) => {
    const s = pick[i % pick.length]
    return call(`/api/components/${phases.bigLeaves[i % phases.bigLeaves.length]}/flows`, {
      method: 'POST',
      token: owner,
      json: { substance_id: s.substance_id, flow_type: s.substance_name === 'Scrap steel' ? 'output' : 'input', quantity: Number((0.01 + (i % 97) / 100).toFixed(3)), unit: s.unit ?? 'kg' },
    })
  }),
)
phases.bigFlows = { count: FLOWS, ms: Math.round(ms) }
delete phases.bigLeaves
log(`large case: ${STEPS} steps, ${FLOWS} flows`)
;[, ms] = await timed(() => call(`/api/cases/${bigCase}/assessments`, { method: 'POST', token: owner, json: {} }))
phases.bigRun = { ms: Math.round(ms) }
log(`large case run: ${Math.round(ms)} ms`)

// ── The class ────────────────────────────────────────────────────────────────
const ex = await call('/api/example-project', { method: 'POST', token: owner })
const cls = (await call('/api/projects', { method: 'POST', token: owner, json: { project_name: 'Class of 300', description: 'Stage 10.3/10.4' } })).project.project_id
await call(`/api/projects/${cls}`, { method: 'PUT', token: owner, json: { functional_unit: '1 painted steel bracket', system_boundary: 'cradle-to-gate', lcia_method: 'TRACI 2.1', region_code: 'US' } })
const base = (await call(`/api/projects/${cls}/cases`, { method: 'POST', token: owner, json: { case_name: 'Base case', case_type: 'base' } })).case.case_id
// The sample's tree and flows, rebuilt here (copies stay within one project).
const srcComps = (await call(`/api/cases/${ex.case_id}/components`, { token: owner })).components
const srcInv = (await call(`/api/cases/${ex.case_id}/inventory`, { token: owner })).rows
const made = new Map()
const pending = [...srcComps]
while (pending.length) {
  const i = pending.findIndex((c) => c.parent_component_id == null || made.has(Number(c.parent_component_id)))
  const c = pending.splice(i, 1)[0]
  const d = await call(`/api/cases/${base}/components`, {
    method: 'POST',
    token: owner,
    json: { component_name: c.component_name, component_type: c.component_type, parent_component_id: c.parent_component_id == null ? null : made.get(Number(c.parent_component_id)) },
  })
  made.set(Number(c.component_id), Number(d.component.component_id))
}
for (const r of srcInv.filter((x) => x.status !== 'left_out')) {
  await call(`/api/components/${made.get(r.component_id)}/flows`, { method: 'POST', token: owner, json: { substance_id: r.substance_id, flow_type: r.direction, quantity: r.amount, unit: r.unit } })
}
await call(`/api/cases/${base}/assessments`, { method: 'POST', token: owner, json: {} })

// A TA who can share: the owner's hourly lookups (200) do not cover 300 people.
const ta = await signup('Tara Assistant', 'ta')
await call(`/api/projects/${cls}/members`, { method: 'POST', token: owner, json: { email: `perf.${tag}.ta@example.test`, role: 'admin' } })

let students
;[students, ms] = await timed(() => pool([...Array(STUDENTS).keys()], 10, (i) => signup(`Student ${i + 1}`, `s${i}`)))
phases.signups = { count: STUDENTS, ms: Math.round(ms) }
const emails = [...Array(STUDENTS).keys()].map((i) => `perf.${tag}.s${i}@example.test`)
// Half each, 100 a request (the route's cap, as the People page sends them).
for (const [k, half] of [emails.slice(0, STUDENTS / 2), emails.slice(STUDENTS / 2)].entries()) {
  for (let i = 0; i < half.length; i += 100) {
    const part = half.slice(i, i + 100)
    const r = await call(`/api/projects/${cls}/members`, { method: 'POST', token: k === 0 ? owner : ta, json: { emails: part, role: 'editor' } })
    if (r.summary.added !== part.length) throw new Error(`perf: added ${r.summary.added} of ${part.length}`)
  }
}
log(`class: ${STUDENTS} students added`)

// The burst (10.4): every student copies the base case at once (10 at a time
// per wave), then 80% run their copy.
const copyMs = []
let copies
;[copies, ms] = await timed(() =>
  pool(students, 25, async (tok, i) => {
    const [d, t] = await timed(() => call(`/api/cases/${base}/duplicate`, { method: 'POST', token: tok, json: { case_name: `Student ${i + 1}'s case` } }))
    copyMs.push(t)
    return d.case_id
  }),
)
phases.copyBurst = { count: STUDENTS, concurrency: 25, ms: Math.round(ms), p50: pct(copyMs, 50), p95: pct(copyMs, 95), max: pct(copyMs, 100) }
const runMs = []
const runners = students.map((tok, i) => [tok, copies[i]]).filter((_, i) => i % 5 !== 0)
;[, ms] = await timed(() =>
  pool(runners, 25, async ([tok, id]) => {
    const [, t] = await timed(() => call(`/api/cases/${id}/assessments`, { method: 'POST', token: tok, json: {} }))
    runMs.push(t)
  }),
)
phases.runBurst = { count: runners.length, concurrency: 25, ms: Math.round(ms), p50: pct(runMs, 50), p95: pct(runMs, 95), max: pct(runMs, 100) }
log(`class burst: ${STUDENTS} copies, ${runners.length} runs`)

process.stdout.write(
  JSON.stringify(
    { base: BASE, tag, owner, student: students[1], big: { projectId: big, caseId: bigCase }, cls: { projectId: cls, baseCaseId: base, copyId: copies[1] }, phases, totalMs: Math.round(performance.now() - t0) },
    null,
    2,
  ) + '\n',
)
