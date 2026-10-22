// What the People page (E08, E08b) says, from the members route and the
// progress route. Pure, so every sentence a teacher acts on is tested.

export type Access = 'editor' | 'viewer' | 'admin'

export const ACCESS_LABEL: Record<Access, string> = {
  editor: 'Can change',
  viewer: 'Can read',
  admin: 'Can share',
}

export interface Person {
  user_id: number
  full_name: string | null
  username: string | null
  email: string | null
  permission_name: string | null
}

export type AddOutcome = 'added' | 'changed' | 'unchanged' | 'no_account' | 'owner' | 'invalid' | 'admin_only' | 'limited'

export interface AddResult {
  outcome: AddOutcome
  email: string
  member?: { user_id: number; full_name: string | null; username: string | null; email: string; permission_name: string }
}

export function nameOf(p: { full_name?: string | null; username?: string | null; email?: string | null }): string {
  return p.full_name?.trim() || p.username?.trim() || p.email || 'Someone'
}

/** "Ana Ruiz", "Ana Ruiz and Jon Tan", "Ana Ruiz, Jon Tan and 3 others". */
export function namesList(names: string[], max = 3): string {
  if (names.length <= 1) return names[0] ?? ''
  if (names.length <= max) return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
  const rest = names.length - (max - 1)
  return `${names.slice(0, max - 1).join(', ')} and ${rest} others`
}

/** "31 people · You own it · 29 can change · 1 can read" (the owner counts as one). */
export function peopleHeader(members: Person[], owner: { name: string; isMe: boolean }): string {
  const total = members.length + 1
  const count = (a: Access) => members.filter((m) => m.permission_name === a).length
  const parts = [`${total} ${total === 1 ? 'person' : 'people'}`, owner.isMe ? 'You own it' : `${owner.name} owns it`]
  if (count('admin')) parts.push(`${count('admin')} can share`)
  if (count('editor')) parts.push(`${count('editor')} can change`)
  if (count('viewer')) parts.push(`${count('viewer')} can read`)
  return parts.join(' · ')
}

/** How many cases each person made in this project. */
export function casesBy(cases: Array<{ created_by: number | null }>): Map<number, number> {
  const by = new Map<number, number>()
  for (const c of cases) if (c.created_by != null) by.set(c.created_by, (by.get(c.created_by) ?? 0) + 1)
  return by
}

/** The Their cases cell: a count, "None yet" for someone who can make one, "None" for someone who can't. */
export function theirCases(n: number, access: string | null): string {
  if (n > 0) return String(n)
  return access === 'viewer' ? 'None' : 'None yet'
}

/** "28 members hold the 32 member cases": members (not the owner) who made at least one case. */
export function holdersLine(members: Person[], by: Map<number, number>): string | null {
  const holders = members.filter((m) => (by.get(m.user_id) ?? 0) > 0)
  if (!holders.length) return null
  const n = holders.reduce((s, m) => s + (by.get(m.user_id) ?? 0), 0)
  const who = holders.length === 1 ? 'member' : 'members'
  return `${holders.length} ${who} ${holders.length === 1 ? 'holds' : 'hold'} the ${n} member ${n === 1 ? 'case' : 'cases'}`
}

export function matchesPerson(p: { full_name?: string | null; username?: string | null; email?: string | null }, q: string): boolean {
  const t = q.trim().toLowerCase()
  if (!t) return true
  return [p.full_name, p.username, p.email].some((v) => (v ?? '').toLowerCase().includes(t))
}

// Any run of characters around an @ that holds no separator. Typed lists,
// pasted "Name <email>" lines and CSV cells all reduce to this; the server
// checks each address properly (an invalid one comes back as invalid).
const EMAIL_TOKEN = /[^\s,;<>"'()[\]]+@[^\s,;<>"'()[\]]+/g

/** The addresses in typed text or a CSV, lowercased, each once, in order. */
export function emailsIn(text: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of text.match(EMAIL_TOKEN) ?? []) {
    const e = m.replace(/[.:]+$/, '').toLowerCase()
    if (!seen.has(e)) {
      seen.add(e)
      out.push(e)
    }
  }
  return out
}

/** Lists longer than the route takes in one request go in several. */
export function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

export interface AddLine {
  kind: 'ok' | 'changed' | 'warn'
  text: string
}

/**
 * The Last add card (E08b): what happened to each email, grouped, in the
 * order a person acts on it. Nothing is claimed that the route did not
 * report for that email.
 */
export function lastAddLines(results: AddResult[], role: Access): AddLine[] {
  const of = (o: AddOutcome) => results.filter((r) => r.outcome === o)
  const lines: AddLine[] = []
  const added = of('added')
  if (added.length) lines.push({ kind: 'ok', text: `${added.length} added (${namesList(added.map((r) => nameOf(r.member ?? { email: r.email })))})` })
  const changed = of('changed')
  if (changed.length) {
    lines.push({
      kind: 'changed',
      text: `${changed.length} already here, access changed to ${ACCESS_LABEL[role]}${changed.length <= 3 ? ` (${namesList(changed.map((r) => nameOf(r.member ?? { email: r.email })))})` : ''}`,
    })
  }
  const same = of('unchanged')
  if (same.length) lines.push({ kind: 'ok', text: `${same.length} already here with ${ACCESS_LABEL[role]}` })
  const none = of('no_account')
  if (none.length) {
    const one = none.length === 1
    lines.push({
      kind: 'warn',
      text: `${none.length} ${one ? 'has' : 'have'} no account yet (${namesList(none.map((r) => r.email))}): ${one ? 'they need' : 'each needs'} to sign up first. No email is sent.`,
    })
  }
  const owner = of('owner')
  if (owner.length) lines.push({ kind: 'warn', text: `${owner[0].email} owns this project already` })
  const bad = of('invalid')
  if (bad.length) lines.push({ kind: 'warn', text: `${bad.length} ${bad.length === 1 ? 'is not an email address' : 'are not email addresses'} (${namesList(bad.map((r) => r.email))})` })
  const admin = of('admin_only')
  if (admin.length) lines.push({ kind: 'warn', text: `${admin.length} can share this project. Only the owner changes their access.` })
  const limited = of('limited')
  if (limited.length) {
    lines.push({ kind: 'warn', text: `${limited.length} not looked up: too many lookups this hour. Add ${limited.length === 1 ? 'it' : 'them'} again later.` })
  }
  return lines
}

