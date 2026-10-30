import { beforeAll, describe, expect, it } from 'vitest'
import { api } from '../support/api'
import { sql, sqlOne } from '../support/db'
import { buildWorld, type World } from '../support/world'

// C06, C07: assignments with a template case, a working copy per student, and a
// frozen hand-in. Authorization per role is in docs/flows/flows.yaml R79 to R85.

let w: World
beforeAll(async () => {
  w = await buildWorld({ runs: false })
})

const make = (json: Record<string, unknown>, token = w.users.owner.token) => api.post(`/api/projects/${w.P.id}/assignments`, { token, json })

describe('assignments', () => {
  it('C06 owner creates with instructions, due date and template; viewer lists; editor cannot create', async () => {
    const made = await make({ title: 'Week 1', instructions: 'Copy the base case.', due_at: '2030-01-01T00:00:00Z', template_case_id: w.P.base.id })
    expect(made.status, made.text).toBe(201)
    const listed = await api.get(`/api/projects/${w.P.id}/assignments`, { token: w.users.viewer.token })
    expect(listed.status).toBe(200)
    const row = listed.json.assignments.find((a: any) => a.title === 'Week 1')
    expect(row).toMatchObject({ instructions: 'Copy the base case.', template_case_id: w.P.base.id })
    expect(new Date(row.due_at).toISOString()).toBe('2030-01-01T00:00:00.000Z')
    expect((await make({ title: 'No' }, w.users.editor.token)).status).toBe(403)
    expect((await api.get(`/api/projects/${w.P.id}/assignments`, { token: w.users.nonmem.token })).status).toBe(404)
    expect((await api.get(`/api/projects/${w.P.id}/assignments`, {})).status).toBe(401)
    expect((await api.get(`/api/projects/${w.Q.id}/assignments`, { token: w.users.owner.token })).status).toBe(404)
  })

  it('C06 a template from another project, a bad date or no title is refused; PUT clears a field', async () => {
    expect((await make({ title: 'Cross', template_case_id: w.Q.caseId })).status).toBe(400)
    expect((await make({ title: 'Bad date', due_at: 'next tuesday' })).status).toBe(400)
    expect((await make({ title: '  ' })).status).toBe(400)
    const id = Number((await make({ title: 'Clear me', instructions: 'Old', due_at: '2030-01-01' })).json.assignment_id)
    const put = await api.put(`/api/assignments/${id}`, { token: w.users.owner.token, json: { instructions: '', due_at: null } })
    expect(put.status, put.text).toBe(200)
    expect(await sqlOne('SELECT instructions, due_at FROM assignment WHERE assignment_id = ?', [id])).toEqual({ instructions: null, due_at: null })
    expect((await api.put(`/api/assignments/${id}`, { token: w.users.owner.token, json: { template_case_id: w.Q.caseId } })).status).toBe(400)
  })

  it('C07 start is stable and stays in the project; a viewer cannot start; hand-in freezes the write-up', async () => {
    const id = Number((await make({ title: 'Week 2', template_case_id: w.P.base.id })).json.assignment_id)
    expect((await api.post(`/api/assignments/${id}/start`, { token: w.users.viewer.token })).status).toBe(403)
    const [a, b] = await Promise.all([
      api.post(`/api/assignments/${id}/start`, { token: w.users.editor.token }),
      api.post(`/api/assignments/${id}/start`, { token: w.users.editor.token }),
    ])
    expect([a.status, b.status].sort()).toEqual([200, 201])
    expect(a.json.case_id).toBe(b.json.case_id)
    const working = Number(a.json.case_id)
    expect(await sqlOne('SELECT project_id, read_only FROM case_table WHERE case_id = ?', [working])).toEqual({ project_id: w.P.id, read_only: 0 })
    await api.put(`/api/cases/${working}`, { token: w.users.editor.token, json: { interpretation: 'Steel drives it.', assumptions: 'One shift.' } })

    expect((await api.post(`/api/assignments/${id}/submit`, { token: w.users.nonmem.token })).status).toBe(404)
    const handed = await api.post(`/api/assignments/${id}/submit`, { token: w.users.editor.token })
    expect(handed.status, handed.text).toBe(200)
    const frozen = Number(handed.json.case_id)
    expect(await sqlOne('SELECT read_only, interpretation, assumptions FROM case_table WHERE case_id = ?', [frozen])).toEqual({
      read_only: 1,
      interpretation: 'Steel drives it.',
      assumptions: 'One shift.',
    })
    // Frozen means frozen: nobody changes it, the instructor included.
    expect((await api.put(`/api/cases/${frozen}`, { token: w.users.owner.token, json: { case_name: 'Changed' } })).status).toBe(403)

    // A second hand-in replaces the first: one frozen copy, the newest.
    const again = await api.post(`/api/assignments/${id}/submit`, { token: w.users.editor.token })
    expect(again.status, again.text).toBe(200)
    expect(await sql('SELECT case_id FROM case_table WHERE assignment_id = ? AND read_only = 1', [id])).toEqual([{ case_id: Number(again.json.case_id) }])

    const list = await api.get(`/api/assignments/${id}/submissions`, { token: w.users.owner.token })
    expect(list.status).toBe(200)
    expect(list.json.submissions.find((s: any) => s.account_id === w.users.editor.id)).toMatchObject({ status: 'handed in', frozen_case_id: Number(again.json.case_id) })
    // The students only: the admin member is an instructor, not a student.
    expect(list.json.submissions.some((s: any) => s.account_id === w.users.adminm.id)).toBe(false)
    expect((await api.get(`/api/assignments/${id}/submissions`, { token: w.users.editor.token })).status).toBe(403)
  })

  it('C07 a student\'s copy cannot be a template; two hand-ins at once leave one copy; deleting the assignment removes its hand-ins', async () => {
    const id = Number((await make({ title: 'Week 3', template_case_id: w.P.base.id })).json.assignment_id)
    const working = Number((await api.post(`/api/assignments/${id}/start`, { token: w.users.editor.token })).json.case_id)
    // Review finding: one wrong pick would copy one student's work to every student.
    expect((await make({ title: 'From a student', template_case_id: working })).status).toBe(400)
    expect((await api.put(`/api/assignments/${id}`, { token: w.users.owner.token, json: { template_case_id: working } })).status).toBe(400)

    // Two hand-ins at once: one handed-in copy remains, the one the submission names.
    const [h1, h2] = await Promise.all([
      api.post(`/api/assignments/${id}/submit`, { token: w.users.editor.token }),
      api.post(`/api/assignments/${id}/submit`, { token: w.users.editor.token }),
    ])
    expect([h1.status, h2.status]).toEqual([200, 200])
    const copies = await sql<{ case_id: number }>('SELECT case_id FROM case_table WHERE assignment_id = ? AND read_only = 1', [id])
    const sub = await sqlOne('SELECT frozen_case_id FROM submission WHERE assignment_id = ?', [id])
    expect(copies.map((c) => Number(c.case_id))).toEqual([Number(sub.frozen_case_id)])

    // Deleting the assignment removes the read-only hand-in (nobody could delete it later); the working case stays.
    expect((await api.delete(`/api/assignments/${id}`, { token: w.users.owner.token })).status).toBe(200)
    expect(await sql('SELECT case_id FROM case_table WHERE assignment_id = ? AND read_only = 1', [id])).toEqual([])
    expect(await sqlOne('SELECT read_only FROM case_table WHERE case_id = ?', [working])).toEqual({ read_only: 0 })
  })
})
