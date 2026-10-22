/**
 * The case opened last on this device (E12 "Continue", "last open: …"). Kept
 * in the browser only: it names nothing another person can read, and a case
 * that is gone or no longer shared is simply forgotten when Home finds it 404.
 */

const KEY = 'lcapix-last-case'

export interface LastCase {
  project_id: number
  case_id: number
  project_name: string | null
  case_name: string
  /** ISO time it was opened. */
  at: string
}

export function rememberCase(c: Omit<LastCase, 'at'>): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...c, at: new Date().toISOString() }))
  } catch {}
}

export function readLastCase(): LastCase | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null')
    if (!v || !Number.isInteger(v.project_id) || !Number.isInteger(v.case_id) || typeof v.case_name !== 'string') return null
    return v as LastCase
  } catch {
    return null
  }
}

export function forgetLastCase(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {}
}

/** "yesterday", "3 days ago", "just now": the day-level words Home uses. */
export function whenWords(iso: string, now = new Date()): string {
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return ''
  const mins = Math.round((now.getTime() - t.getTime()) / 60000)
  if (mins < 2) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOf(now) - startOf(t)) / 86400000)
  if (days <= 0) return `${Math.round(mins / 60)} h ago`
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return t.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}
