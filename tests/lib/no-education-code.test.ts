/**
 * The commercial version keeps the education columns in the shared schema
 * (the education version still uses them) but never reads or writes them,
 * calls the education routes, or brings back an education module
 * (EDUCATION_ONLY.md, decided 2026-10-22). This scans every source file the
 * app ships.
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const SHIPPED = ['app', 'components', 'lib', 'hooks']

function sources(dir: string, out: string[] = []): string[] {
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return out
  }
  for (const name of names) {
    const full = path.join(dir, name)
    if (statSync(full).isDirectory()) sources(full, out)
    else if (/\.(ts|tsx)$/.test(name)) out.push(full)
  }
  return out
}

const files = SHIPPED.flatMap((d) => sources(path.join(ROOT, d)))

function hits(pattern: RegExp): string[] {
  return files.filter((f) => pattern.test(readFileSync(f, 'utf8'))).map((f) => path.relative(ROOT, f))
}

describe('no education code in the commercial version', () => {
  it('scans the shipped source', () => {
    expect(files.length).toBeGreaterThan(300)
  })

  it.each([
    ['is_sample'],
    ['read_only'],
    ['is_final'],
    ['finalized_at'],
    ['members_see_own_cases'],
    ['hidden_from_members'],
    ['learning_state'],
  ])('never names the column %s', (column) => {
    expect(hits(new RegExp(`\\b${column}\\b`))).toEqual([])
  })

  it('never calls an education route', () => {
    expect(hits(/\/api\/example-project|\/api\/projects\/[^'"`\s]*\/(progress|empty-flows)\b/)).toEqual([])
  })

  it('has no education module or setting', () => {
    expect(hits(/useGuidedMode|turnOnGuidedMode|LMS_NAME|guide-slot|exercise-card|lesson-rail|lib\/lessons|sample-overview|make-copy|sample-docs/)).toEqual([])
  })
})
