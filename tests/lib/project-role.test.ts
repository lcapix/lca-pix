import { describe, expect, it } from 'vitest'

import { isProjectRole, projectCapabilities, roleAtLeast } from '@/lib/project-role'

describe('what each project role may do', () => {
  it('matches the levels the server enforces', () => {
    expect(projectCapabilities('owner')).toMatchObject({ canEdit: true, canManage: true, canDeleteProject: true, readOnly: false })
    expect(projectCapabilities('admin')).toMatchObject({ canEdit: true, canManage: true, canDeleteProject: false, readOnly: false })
    expect(projectCapabilities('editor')).toMatchObject({ canEdit: true, canManage: false, canDeleteProject: false, readOnly: false })
    expect(projectCapabilities('viewer')).toMatchObject({ canEdit: false, canManage: false, canDeleteProject: false, readOnly: true })
  })

  it('treats an unknown role as not read-only but never as a manager', () => {
    for (const role of [null, undefined, '', 'superuser', 7] as unknown[]) {
      const caps = projectCapabilities(role as never)
      expect(caps.role).toBeNull()
      expect(caps.readOnly).toBe(false)
      expect(caps.canManage).toBe(false)
      expect(caps.canDeleteProject).toBe(false)
    }
  })

  it('compares roles by level and refuses anything it does not know', () => {
    expect(roleAtLeast('admin', 'editor')).toBe(true)
    expect(roleAtLeast('editor', 'admin')).toBe(false)
    expect(roleAtLeast(null, 'viewer')).toBe(false)
    expect(isProjectRole('viewer')).toBe(true)
    expect(isProjectRole('Viewer')).toBe(false)
  })
})
