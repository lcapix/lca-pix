/**
 * F42. Class privacy (the release security pass): an assignment makes the
 * project a class, so each student sees only their own case and the staff's;
 * the project's own GET never lists a classmate's name or email there; an
 * assignment case is changed only by the student who owns it (the instructor
 * and the TA read it, as the screens show); a case kept from students is never
 * what an assignment starts them from.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { api } from '../support/api'
import { sqlOne } from '../support/db'
import { createUser, type TestUser } from '../support/users'
import { addMember, createCase, createProject } from '../support/world'

// A class of its own: the instructor (owner), a TA (admin), two students.
let instructor: TestUser, ta: TestUser, student: TestUser, classmate: TestUser
let projectId: number
let baseCase: number
let assignmentId: number
let workingCase: number

beforeAll(async () => {
  ;[instructor, ta, student, classmate] = await Promise.all(['f42inst', 'f42ta', 'f42stu', 'f42mate'].map((l) => createUser(l)))
  projectId = await createProject(instructor, `F42 class ${Date.now()}`)
  baseCase = await createCase(instructor, projectId, 'Base case')
  await addMember(instructor, projectId, ta, 'admin')
  await addMember(instructor, projectId, student, 'editor')
  await addMember(instructor, projectId, classmate, 'editor')
})

const ownCases = async () => Number((await sqlOne('SELECT members_see_own_cases AS v FROM project WHERE project_id = ?', [projectId]))!.v)

describe('F42 class privacy', () => {
  it('creating an assignment turns on "each student sees only their own case"', async () => {
    expect(await ownCases()).toBe(0)
    const made = await api.post(`/api/projects/${projectId}/assignments`, { token: instructor.token, json: { title: 'Week 1', template_case_id: baseCase } })
    expect(made.status, made.text).toBe(201)
    assignmentId = Number(made.json.assignment_id)
    expect(await ownCases()).toBe(1)
  })

  it("the project's GET lists the staff and yourself, never a classmate's email", async () => {
    const asStudent = await api.get(`/api/projects/${projectId}`, { token: classmate.token })
    expect(asStudent.status, asStudent.text).toBe(200)
    const emails = (asStudent.json.project.members ?? []).map((m: any) => m.email)
    expect(emails).toEqual(expect.arrayContaining([classmate.email, ta.email]))
    expect(emails).not.toContain(student.email)
    // The instructor still sees every member.
    const asInstructor = await api.get(`/api/projects/${projectId}`, { token: instructor.token })
    expect((asInstructor.json.project.members ?? []).map((m: any) => m.email)).toEqual(expect.arrayContaining([student.email, classmate.email, ta.email]))
  })

  it('a working case is changed only by its student; the instructor and the TA read it', async () => {
    const started = await api.post(`/api/assignments/${assignmentId}/start`, { token: student.token })
    expect([200, 201], started.text).toContain(started.status)
    workingCase = Number(started.json.case_id)
    expect((await api.put(`/api/cases/${workingCase}`, { token: student.token, json: { interpretation: 'My reading.' } })).status).toBe(200)
    for (const staff of [instructor, ta]) {
      expect((await api.get(`/api/cases/${workingCase}`, { token: staff.token })).status).toBe(200)
      const put = await api.put(`/api/cases/${workingCase}`, { token: staff.token, json: { interpretation: 'Changed by staff.' } })
      expect(put.status).toBe(403)
      expect(put.json.error).toMatch(/only the student who owns it changes it/)
    }
    expect((await sqlOne('SELECT interpretation FROM case_table WHERE case_id = ?', [workingCase]))!.interpretation).toBe('My reading.')
    // A classmate cannot reach it at all.
    expect((await api.get(`/api/cases/${workingCase}`, { token: classmate.token })).status).toBe(404)
  })

  it('a case kept from students is never the template', async () => {
    const hiddenId = await createCase(instructor, projectId, 'Answer key')
    expect((await api.put(`/api/cases/${hiddenId}`, { token: instructor.token, json: { hidden_from_members: true } })).status).toBe(200)
    const refused = await api.post(`/api/projects/${projectId}/assignments`, { token: instructor.token, json: { title: 'Week 2', template_case_id: hiddenId } })
    expect(refused.status).toBe(400)
  })
})
