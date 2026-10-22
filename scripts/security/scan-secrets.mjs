#!/usr/bin/env node
/**
 * Stage 10.5: secret scan over every file git tracks (and the staged ones).
 * Looks for the shapes real credentials take: cloud keys, private keys, API
 * tokens, signed JWTs, passwords in connection strings. Placeholders the code
 * documents (ci-dummy-not-a-secret, example.test, <...>) are not findings.
 *
 *   node scripts/security/scan-secrets.mjs      exits 1 on any finding
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'

const files = execFileSync('git', ['ls-files', '--cached'], { encoding: 'utf8' }).split('\n').filter(Boolean)
const PATTERNS = [
  ['AWS access key', /\bAKIA[0-9A-Z]{16}\b/],
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['GitHub token', /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ['Slack token', /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ['OpenAI or Anthropic key', /\bsk-(?:ant-)?[A-Za-z0-9_-]{24,}\b/],
  ['Hugging Face token', /\bhf_[A-Za-z0-9]{30,}\b/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}\b/],
  ['Stripe live key', /\b[rs]k_live_[0-9a-zA-Z]{20,}\b/],
  ['password in a URL', /\b(?:mysql|postgres(?:ql)?|mongodb(?:\+srv)?|redis):\/\/[^:\s/]+:([^@\s]{4,})@/],
  ['signed JWT', /\beyJ[A-Za-z0-9_-]{15,}\.eyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{20,}/],
]
const ALLOW = /ci-dummy-not-a-secret|example\.test|<[^>]+>|\$\{|your[-_]?(?:password|key|token)|changeme|placeholder/i

const findings = []
for (const f of files) {
  if (/\.(png|jpg|jpeg|gif|webp|ico|pdf|zip|woff2?|ttf|mp4|bundle)$/i.test(f)) continue
  let text
  try {
    if (statSync(f).size > 3_000_000) continue
    text = readFileSync(f, 'utf8')
  } catch {
    continue
  }
  const lines = text.split('\n')
  lines.forEach((line, i) => {
    for (const [what, re] of PATTERNS) {
      const m = re.exec(line)
      // An all-caps word in the password slot (PASSWORD, DB_PASS) is a documented placeholder.
      if (m && !ALLOW.test(line) && !(m[1] && /^[A-Z_]+$/.test(m[1]))) findings.push(`${f}:${i + 1}  ${what}  ${line.trim().slice(0, 120).replace(m[0], m[0].slice(0, 6) + '…')}`)
    }
  })
}
console.log(`${files.length} tracked files scanned, ${findings.length} findings`)
for (const f of findings) console.log(f)
process.exit(findings.length ? 1 : 0)
