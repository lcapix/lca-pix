/**
 * Deleting an account (Profile → Delete my account). The projects the person
 * owns go, with everything in them, other people's work there included (a
 * class's students' cases go with the teacher's class). What they did in other
 * people's projects stays with those projects, under "Deleted account".
 *
 * The account row itself is scrubbed, not removed: runs, hand-ins and the audit
 * log point at it, and the database refuses to lose those. Its name, email,
 * institution, role and country are wiped, the password can never match, and
 * it is inactive, so every token it signed stops working at once (lib/auth.ts
 * checks is_active and the password fingerprint on each request).
 */
import { randomBytes } from 'node:crypto'
import { query, queryOne, transaction } from '@/lib/db-helpers'

export interface OwnedProject {
  project_id: number
  project_name: string
  /** Other people in it, whose work there goes too. */
  others: number
}

/** What deleting would take: the projects the person owns, and who else is in each. */
export async function ownedProjects(userId: number): Promise<OwnedProject[]> {
  const rows = await query<any>(
    `SELECT p.project_id, p.project_name,
            (SELECT COUNT(*) FROM project_members m WHERE m.project_id = p.project_id AND m.user_id <> ?) AS others
       FROM project p
      WHERE p.owner_id = ?
      ORDER BY p.created_at`,
    [userId, userId],
  )
  return rows.map((r) => ({ project_id: Number(r.project_id), project_name: String(r.project_name), others: Number(r.others) }))
}

/** True when `typed` is the account's email, ignoring case and spaces at the ends. */
export function confirmsEmail(typed: unknown, email: string): boolean {
  return typeof typed === 'string' && typed.trim().toLowerCase() === email.trim().toLowerCase()
}

/** Delete the person's projects and scrub their account, in one transaction. */
export async function deleteAccount(userId: number): Promise<{ projects: number }> {
  return transaction(async (conn) => {
    const [owned] = (await conn.query(`SELECT project_id FROM project WHERE owner_id = ?`, [userId])) as any
    const ids: number[] = (owned as any[]).map((r) => Number(r.project_id))
    if (ids.length) await conn.query(`DELETE FROM project WHERE owner_id = ?`, [userId])
    await conn.query(`DELETE FROM project_members WHERE user_id = ?`, [userId])
    await conn.query(`DELETE FROM project_pins WHERE user_id = ?`, [userId])
    await conn.query(
      `UPDATE account
          SET username = ?, email = ?, full_name = 'Deleted account', company = NULL, role = NULL,
              use_case = NULL, country = NULL, password_hash = ?, is_active = 0, account_type = 'user'
        WHERE id = ?`,
      [`deleted-${userId}`, `deleted-${userId}@deleted.invalid`, `deleted:${randomBytes(24).toString('hex')}`, userId],
    )
    return { projects: ids.length }
  })
}

/** The account's email and type, or null when there is no such active account. */
export async function accountForDeletion(userId: number): Promise<{ email: string; admin: boolean } | null> {
  const row = await queryOne<any>(`SELECT email, account_type, is_active FROM account WHERE id = ?`, [userId])
  if (!row || !Number(row.is_active)) return null
  return { email: String(row.email), admin: row.account_type === 'admin' }
}
