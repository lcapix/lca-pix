/**
 * What a member may do in a project, from their role.
 *
 * The server enforces every rule here (lib/route-guard.ts: editing and running
 * need 'editor', deleting a case or managing the project needs 'admin',
 * deleting the project needs 'owner'). The client reads the same table only to
 * hide controls a member cannot use, so a "Can read" member never meets a
 * button that would answer 403.
 */
export type ProjectRole = 'owner' | 'admin' | 'editor' | 'viewer'

const LEVEL: Record<ProjectRole, number> = { viewer: 1, editor: 2, admin: 3, owner: 4 }

export function isProjectRole(value: unknown): value is ProjectRole {
  return value === 'owner' || value === 'admin' || value === 'editor' || value === 'viewer'
}

/** True when `role` is `need` or above. An unknown role is never enough. */
export function roleAtLeast(role: ProjectRole | null | undefined, need: ProjectRole): boolean {
  return isProjectRole(role) && LEVEL[role] >= LEVEL[need]
}

export interface ProjectCapabilities {
  role: ProjectRole | null
  /** Edit steps, flows, costs and goal and scope; run; import; copy a case. */
  canEdit: boolean
  /** Delete a case, change project settings, manage people. */
  canManage: boolean
  /** Delete the whole project. */
  canDeleteProject: boolean
  /**
   * True only for a known "Can read" member. An unknown role (still loading,
   * or an older server that does not send one) is not read-only: the server
   * still refuses what the member may not do.
   */
  readOnly: boolean
}

export function projectCapabilities(role: ProjectRole | null | undefined): ProjectCapabilities {
  const known = isProjectRole(role) ? role : null
  return {
    role: known,
    canEdit: known === null ? true : roleAtLeast(known, 'editor'),
    canManage: roleAtLeast(known, 'admin'),
    canDeleteProject: roleAtLeast(known, 'owner'),
    readOnly: known === 'viewer',
  }
}
