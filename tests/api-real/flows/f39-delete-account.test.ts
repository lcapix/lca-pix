/**
 * F39. Deleting an account (Profile → Delete my account). The person types
 * their email; the projects they own go with everything in them; their work
 * in other people's projects (a hand-in to a teacher) stays there under
 * "Deleted account"; the account is scrubbed and every token it signed stops.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { sqlOne } from '../support/db';
import { createUser, type TestUser } from '../support/users';
import { addFlow, addMember, createCase, createComponent, createProject, runAssessment, substanceId } from '../support/world';

let teacher: TestUser;
let student: TestUser;
let classId: number;
let studentOwn: number;
let frozen: number;

async function caseWithRun(user: TestUser, projectId: number, name: string) {
  const caseId = await createCase(user, projectId, name);
  const step = await createComponent(user, caseId, { component_name: 'Weld', component_type: 'operation', parent_component_id: null, quantity: 1, unit: 'unit' });
  await addFlow(user, step, { substance_id: await substanceId('Steel'), flow_type: 'input', quantity: 0.5, unit: 'kg' });
  await runAssessment(user, caseId);
  return caseId;
}

beforeAll(async () => {
  teacher = await createUser('del-teacher');
  student = await createUser('del-student');
  classId = await createProject(teacher, 'Class to delete');
  const template = await caseWithRun(teacher, classId, 'Template');
  await addMember(teacher, classId, student, 'editor');
  const made = await api.post(`/api/projects/${classId}/assignments`, { token: teacher.token, json: { title: 'Week 1', template_case_id: template } });
  const id = Number(made.json.assignment_id);
  const started = await api.post(`/api/assignments/${id}/start`, { token: student.token });
  await runAssessment(student, Number(started.json.case_id));
  const handed = await api.post(`/api/assignments/${id}/submit`, { token: student.token });
  expect(handed.status, handed.text).toBe(200);
  frozen = Number(handed.json.case_id);
  studentOwn = await createProject(student, 'My own study');
  await caseWithRun(student, studentOwn, 'Mine');
});

describe('F39 delete my account', () => {
  it('says first what goes: each project the person owns, and who else is in it', async () => {
    const res = await api.get('/api/auth/account', { token: teacher.token });
    expect(res.status, res.text).toBe(200);
    expect(res.json.projects).toContainEqual({ project_id: classId, project_name: 'Class to delete', others: 1 });
  });

  it('a wrong or missing email deletes nothing', async () => {
    for (const json of [{}, { confirm_email: 'someone@else.test' }]) {
      const res = await api.delete('/api/auth/account', { token: student.token, json });
      expect(res.status).toBe(400);
    }
    expect((await api.get('/api/auth/me', { token: student.token })).status).toBe(200);
  });

  it('the student deletes: their project goes, the hand-in stays with the teacher, the account is scrubbed and signed out', async () => {
    const res = await api.delete('/api/auth/account', { token: student.token, json: { confirm_email: ` ${student.email.toUpperCase()} ` } });
    expect(res.status, res.text).toBe(200);
    expect(res.json.projects_deleted).toBe(1);
    expect(await sqlOne('SELECT project_id FROM project WHERE project_id = ?', [studentOwn])).toBeUndefined();
    expect(await sqlOne<any>('SELECT case_id FROM case_table WHERE case_id = ?', [frozen])).toEqual({ case_id: frozen });
    const row = await sqlOne<any>('SELECT email, full_name, company, is_active FROM account WHERE id = ?', [student.id]);
    expect(row).toEqual({ email: `deleted-${student.id}@deleted.invalid`, full_name: 'Deleted account', company: null, is_active: 0 });
    expect((await api.get('/api/auth/me', { token: student.token })).status).toBe(401);
    expect((await api.post('/api/auth/login', { json: { email: student.email, password: student.password } })).status).toBe(401);
    expect((await api.get(`/api/projects/${classId}/cases`, { token: teacher.token })).status).toBe(200);
  });

  it('the teacher deletes: the class goes, the hand-in in it too', async () => {
    const res = await api.delete('/api/auth/account', { token: teacher.token, json: { confirm_email: teacher.email } });
    expect(res.status, res.text).toBe(200);
    expect(await sqlOne('SELECT project_id FROM project WHERE project_id = ?', [classId])).toBeUndefined();
    expect(await sqlOne('SELECT case_id FROM case_table WHERE case_id = ?', [frozen])).toBeUndefined();
  });
});
