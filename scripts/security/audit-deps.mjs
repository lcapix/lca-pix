#!/usr/bin/env node
/**
 * Stage 10.5: dependency audit without installing a package manager. Reads
 * every package and version in pnpm-lock.yaml, asks the npm registry's bulk
 * advisory endpoint about them (package names and versions only), and lists
 * what it reports by severity, marking each package "prod" when the app's
 * runtime dependencies reach it and "dev" when only the tooling does (tests,
 * lint, the build's dev servers). Also flags package.json ranges that float
 * to whatever is newest ("latest", "*"), which a lockfile refresh would follow.
 *
 *   node scripts/security/audit-deps.mjs        exits 1 on a high or critical advisory in a prod package,
 *                                               unless audit-accepted.json lists it with its reason
 */
import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'

const lock = yaml.load(readFileSync(new URL('../../pnpm-lock.yaml', import.meta.url), 'utf8'))
const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8'))
const accepted = JSON.parse(readFileSync(new URL('./audit-accepted.json', import.meta.url), 'utf8')).accepted

/** "name@1.2.3(peer@...)" or "@scope/name@1.2.3" → [name, version]. */
const split = (key) => {
  const at = key.indexOf('@', 1)
  return [key.slice(0, at), key.slice(at + 1).split('(')[0]]
}
const versions = {}
for (const key of Object.keys(lock.packages ?? {})) {
  const [n, v] = split(key)
  ;(versions[n] ??= new Set()).add(v)
}

// What production reaches: the importer's dependencies, then each snapshot's
// own, breadth first so `via` holds the shortest chain from a direct dependency.
const prod = new Set()
const via = new Map()
const queue = Object.entries(lock.importers['.'].dependencies ?? {}).map(([n, d]) => [`${n}@${d.version}`, []])
while (queue.length) {
  const [key, chain] = queue.shift()
  const [n] = split(key)
  if (prod.has(key)) continue
  prod.add(key)
  prod.add(n)
  if (!via.has(n)) via.set(n, [...chain, n])
  const snap = lock.snapshots?.[key] ?? {}
  for (const [dn, dv] of Object.entries({ ...snap.dependencies, ...snap.optionalDependencies })) queue.push([`${dn}@${dv}`, [...chain, n]])
}
const body = Object.fromEntries(Object.entries(versions).map(([k, v]) => [k, [...v]]))
const count = Object.values(body).reduce((n, v) => n + v.length, 0)

const res = await fetch('https://registry.npmjs.org/-/npm/v1/security/advisories/bulk', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
})
if (!res.ok) throw new Error(`advisory endpoint answered ${res.status}`)
const advisories = await res.json()

const order = ['critical', 'high', 'moderate', 'low', 'info']
const found = []
for (const [name, list] of Object.entries(advisories)) {
  for (const a of list) {
    const id = String(a.url ?? '').split('/').pop()
    found.push({ name, severity: a.severity, title: a.title, range: a.vulnerable_versions, url: a.url, have: body[name], prod: prod.has(name), accepted: accepted[id]?.package === name })
  }
}
found.sort((a, b) => Number(b.prod) - Number(a.prod) || order.indexOf(a.severity) - order.indexOf(b.severity) || a.name.localeCompare(b.name))

const inProd = found.filter((f) => f.prod)
console.log(`${count} package versions in the lockfile, ${found.length} advisories, ${inProd.length} of them in packages production reaches`)
for (const f of found) console.log(`${f.prod ? 'prod' : 'dev '} ${f.severity.padEnd(8)} ${f.accepted ? 'accepted ' : ''}${f.name}@${f.have.join(',')}  ${f.title}  (${f.range})  ${f.url}`)
console.log('\nHow production reaches each flagged package:')
for (const n of [...new Set(inProd.map((f) => f.name))]) console.log(`  ${n}: ${via.get(n).join(' > ')}`)

const floating = Object.entries({ ...pkg.dependencies, ...pkg.devDependencies }).filter(([, r]) => r === 'latest' || r === '*')
for (const [n, r] of floating) console.log(`floating  ${n}: "${r}" in package.json (pin it to the locked version)`)

const blocking = inProd.filter((f) => (f.severity === 'critical' || f.severity === 'high') && !f.accepted)
console.log(`\n${blocking.length} high or critical advisories in production packages not accepted${floating.length ? `; ${floating.length} floating ranges` : ''}`)
process.exit(blocking.length || floating.length ? 1 : 0)
