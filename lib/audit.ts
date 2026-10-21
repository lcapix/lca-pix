/**
 * The audit trail for actions that change who can see what, or remove work:
 * the privacy switch, adding, removing or re-roling a member, and deleting a
 * case or a project. Written to the existing `audit_log` table (who, what,
 * which record, the values before and after, and the client address).
 *
 * A failed audit write never undoes the action it records (the action has
 * already happened), but it is logged as an error, never swallowed.
 */
import { execute } from '@/lib/db-helpers'

export type AuditAction = 'create' | 'update' | 'delete'
export type AuditTable = 'project' | 'project_members' | 'case_table'

export interface AuditEntry {
  userId: number
  action: AuditAction
  table: AuditTable
  recordId: number
  before?: Record<string, unknown> | null
  after?: Record<string, unknown> | null
  request?: { headers: { get(name: string): string | null } }
}

/** The client address behind the platform's proxy, or null. Capped to the column (45). */
export function clientAddress(request?: AuditEntry['request']): string | null {
  const forwarded = request?.headers.get('x-forwarded-for')
  const first = forwarded?.split(',')[0]?.trim()
  const address = first || request?.headers.get('x-real-ip')?.trim() || null
  return address ? address.slice(0, 45) : null
}

export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    await execute(
      `INSERT INTO audit_log (user_id, action_type, table_name, record_id, old_values, new_values, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        entry.userId,
        entry.action,
        entry.table,
        entry.recordId,
        entry.before ? JSON.stringify(entry.before) : null,
        entry.after ? JSON.stringify(entry.after) : null,
        clientAddress(entry.request),
      ],
    )
  } catch (error: any) {
    console.error(
      `[audit] could not record ${entry.action} on ${entry.table} #${entry.recordId} by user ${entry.userId}: ${error?.message ?? error}`,
    )
  }
}
