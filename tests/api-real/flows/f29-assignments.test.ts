import { beforeAll, describe, expect, it } from 'vitest'
import { api } from '../support/api'
import { buildWorld, type World } from '../support/world'

let w: World
beforeAll(async () => {
  w = await buildWorld({ runs: false })
})

describe('assignments', () => {
  it('owner creates, viewer lists, editor cannot create, start is stable, hand-in freezes', async () => {
    const made = await api.post(`/api/projects/${w.P.id}/assignments`, {
      token: w.users.owner.token,
      json: { title: 'Week 1', instructions: 'Copy the base case.', template_case_id: w.P.base.id },
    })
    expect(made.status, made.text).toBe(201)
    const id = Number(made.json.assignment_id)
    const listed = await api.get(`/api/projects/${w.P.id}/assignments`, { token: w.users.viewer.token })
    expect(listed.status).toBe(200)
    expect(listed.json.assignments.map((a: any) => a.title)).toContain('Week 1')
    expect((await api.post(`/api/projects/${w.P.id}/assignments`, { token: w.users.editor.token, json: { title: 'No' } })).status).toBe(403)
    expect((await api.get(`/api/projects/${w.P.id}/assignments`, { token: w.users.nonmem.token })).status).toBe(404)
    expect((await api.get(`/api/projects/${w.P.id}/assignments`, {})).status).toBe(401)
    expect((await api.get(`/api/projects/${w.Q.id}/assignments`, { token: w.users.owner.token })).status).toBe(404)
    const first = await api.post(`/api/assignments/${id}/start`, { token: w.users.editor.token })
    expect(first.status, first.text).toBe(201)
    const again = await api.post(`/api/assignments/${id}/start`, { token: w.users.editor.token })
    expect(again.status, again.text).toBe(200)
    expect(again.json.case_id).toBe(first.json.case_id)
    const handed = await api.post(`/api/assignments/${id}/submit`, { token: w.users.editor.token })
    expect(handed.status, handed.text).toBe(200)
    const list = await api.get(`/api/assignments/${id}/submissions`, { token: w.users.owner.token })
    expect(list.status).toBe(200)
    expect(list.json.submissions.some((s: any) => s.status === 'handed in')).toBe(true)
  })
})
