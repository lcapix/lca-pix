/**
 * Task 12 guard: the classic screens are gone and stay gone. No source file
 * imports a deleted classic path or reads the old screen flags, and the
 * deleted paths do not come back.
 */
import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '..', '..')
const SCAN = ['app', 'components', 'lib', 'hooks', 'tests', 'scripts']
const SELF = path.join('tests', 'lib', 'no-classic.test.ts')

/** Deleted in Task 12: the classic components, pages and the flags that chose them. */
const DELETED = [
  'lib/ui-flags.ts',
  'components/lcapix/case',
  'components/lcapix/results',
  'components/component-form',
  'components/lcapix/app-top-bar.tsx',
  'components/lcapix/marketing-nav.tsx',
  'components/lcapix/project/project-overview-page.tsx',
  'components/lcapix/project/project-header.tsx',
  'components/lcapix/project/case-tabs.tsx',
  'components/lcapix/project/case-tree-panel.tsx',
  'components/lcapix/project/case-actions.tsx',
  'components/lcapix/project/comparison-banner.tsx',
  'components/global/global-tour.tsx',
  'components/global/guided-tour.tsx',
  'components/global/command-palette.tsx',
  'app/home/_components',
]

const IMPORT = /(?:from\s*|import\(\s*|require\(\s*|vi\.mock\(\s*)['"]([^'"]+)['"]/g
const FORBIDDEN_SPEC = [
  /(^|\/)ui-flags$/,
  /components\/lcapix\/(case|results)(\/|$)/,
  /components\/component-form(\/|$)/,
  /components\/lcapix\/(app-top-bar|marketing-nav)$/,
  /components\/lcapix\/project\/(project-overview-page|project-header|case-tabs|case-tree-panel|case-actions|comparison-banner)$/,
  /components\/global\/(global-tour|guided-tour|command-palette)$/,
  /_components\/classic-/,
]
const FLAGS = /NEXT_PUBLIC_LCAPIX_(SHELL|WORKSPACE)\b|\bEDU_(SHELL|WORKSPACE)\b/

function files(dir: string, out: string[] = []): string[] {
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue
    const p = path.join(dir, name)
    if (statSync(p).isDirectory()) files(p, out)
    else if (/\.(ts|tsx|js|mjs)$/.test(name)) out.push(p)
  }
  return out
}

const sources = SCAN.flatMap((d) => files(path.join(ROOT, d))).filter((f) => path.relative(ROOT, f) !== SELF)

describe('no classic screens (Task 12)', () => {
  it('the deleted classic paths do not exist', () => {
    expect(DELETED.filter((p) => existsSync(path.join(ROOT, p)))).toEqual([])
    const classicFiles = files(path.join(ROOT, 'app')).filter((f) => /_components\/classic-/.test(f))
    expect(classicFiles.map((f) => path.relative(ROOT, f))).toEqual([])
  })

  it('no file imports a deleted classic path', () => {
    const hits: string[] = []
    for (const f of sources) {
      const text = readFileSync(f, 'utf8')
      for (const m of text.matchAll(IMPORT)) {
        if (FORBIDDEN_SPEC.some((re) => re.test(m[1]))) hits.push(`${path.relative(ROOT, f)}: ${m[1]}`)
      }
    }
    expect(hits).toEqual([])
  })

  it('no file reads the old screen flags', () => {
    const hits = sources.filter((f) => FLAGS.test(readFileSync(f, 'utf8'))).map((f) => path.relative(ROOT, f))
    expect(hits).toEqual([])
  })
})
