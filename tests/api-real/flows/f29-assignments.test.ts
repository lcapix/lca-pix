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

  it('D1 D5 the working case is named for the student; the hand-in carries the run it was handed in with, its ids moved to the copy and not out of date', async () => {
    const id = Number((await make({ title: 'Week 4', template_case_id: w.P.base.id })).json.assignment_id)
    const started = await api.post(`/api/assignments/${id}/start`, { token: w.users.editor.token })
    const working = Number(started.json.case_id)
    const who = await sqlOne<any>('SELECT full_name, username FROM account WHERE id = ?', [w.users.editor.id])
    expect((await sqlOne<any>('SELECT case_name FROM case_table WHERE case_id = ?', [working])).case_name).toBe(`Week 4 · ${String(who.full_name ?? '').trim() || who.username}`)

    // No run yet: the hand-in says so (run_id null).
    const none = await api.post(`/api/assignments/${id}/submit`, { token: w.users.editor.token })
    expect(none.status, none.text).toBe(200)
    expect(none.json.run_id).toBeNull()

    expect((await api.post(`/api/cases/${working}/assessments`, { token: w.users.editor.token, json: {} })).status).toBe(201)
    const handed = await api.post(`/api/assignments/${id}/submit`, { token: w.users.editor.token })
    expect(handed.status, handed.text).toBe(200)
    const frozen = Number(handed.json.case_id)
    const runId = Number(handed.json.run_id)
    const run = await sqlOne<any>('SELECT case_id, status, run_snapshot FROM assessment_runs WHERE run_id = ?', [runId])
    expect(Number(run.case_id)).toBe(frozen)
    expect(run.status).toBe('completed')
    expect(Number((await sqlOne<any>('SELECT run_id FROM submission WHERE assignment_id = ?', [id])).run_id)).toBe(runId)
    // Its snapshot names the copy's own steps and flows.
    const steps = (await sql<any>('SELECT component_id FROM component WHERE case_id = ?', [frozen])).map((r) => Number(r.component_id)).sort()
    const snap = typeof run.run_snapshot === 'string' ? JSON.parse(run.run_snapshot) : run.run_snapshot
    expect(snap.steps.map((s: any) => Number(s.component_id)).sort()).toEqual(steps)
    const flows = (await sql<any>('SELECT f.flow_id FROM flows f JOIN component c ON c.component_id = f.component_id WHERE c.case_id = ?', [frozen])).map((r) => Number(r.flow_id))
    for (const f of snap.inventory ?? []) expect(flows).toContain(Number(f.flow_id))
    // Its stored results are the working run's, on the copy's steps.
    const [workingRun] = await sql<any>(`SELECT run_id FROM assessment_runs WHERE case_id = ? AND status = 'completed' ORDER BY run_id DESC LIMIT 1`, [working])
    const count = async (r: number) => Number((await sqlOne<any>('SELECT COUNT(*) AS n FROM assessment_results WHERE run_id = ?', [r])).n)
    expect(await count(runId)).toBe(await count(Number(workingRun.run_id)))
    const placed = await sql<any>('SELECT DISTINCT component_id FROM assessment_results WHERE run_id = ? AND component_id IS NOT NULL', [runId])
    for (const p of placed) expect(steps).toContain(Number(p.component_id))
    // The teacher reads it as handed in: the copy's run is not "edited after this run".
    const inv = await api.get(`/api/cases/${frozen}/inventory`, { token: w.users.owner.token })
    expect(inv.status).toBe(200)
    expect(inv.json.latest_run).toMatchObject({ run_id: runId, changed_after_run: false })
    // And its report exports.
    expect((await api.get(`/api/assessments/${runId}/export?format=csv`, { token: w.users.owner.token })).status).toBe(200)
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
