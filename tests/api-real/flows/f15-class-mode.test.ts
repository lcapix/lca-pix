/**
 * F15. Class mode, setup B: each student owns a project and adds the
 * instructor as a viewer. Lessons, write-up and hand-in are case fields; the
 * instructor reads progress and cannot change the work.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { sqlOne } from '../support/db';
import { LESSONS } from '@/lib/lessons';
import { addFlow, addMember, createCase, createComponent, createProject, runAssessment, substanceId } from '../support/world';
import { createUser, type TestUser } from '../support/users';

let student: TestUser;
let other: TestUser;
let instructor: TestUser;
let pid: number;
let caseId: number;
beforeAll(async () => {
  [student, other, instructor] = await Promise.all(['f15student', 'f15other', 'f15instructor'].map((l) => createUser(l)));
  pid = await createProject(student, `Lab 3 ${student.id}`, { functional_unit: '1 mug', lcia_method: 'CML 2001', region_code: 'US' });
  caseId = await createCase(student, pid, 'My mug');
  const product = await createComponent(student, caseId, { component_name: 'Mug', component_type: 'product' });
  const firing = await createComponent(student, caseId, { component_name: 'Firing', component_type: 'operation', parent_component_id: product });
  await addFlow(student, firing, { substance_id: await substanceId('Electricity'), flow_type: 'input', quantity: 2.5, unit: 'kWh' });
  await addMember(student, pid, instructor, 'viewer');
});

describe('F15 class mode', () => {
  it('F15.2-F15.5 lessons, prediction, write-up and hand-in are saved on the case', async () => {
    const t = student.token;
    const [first, second] = LESSONS;
    const learning = {
      version: 1,
      lessons: {
        [first.id]: { answer: 'a', correct: true, doneAt: '2026-09-30T10:00:00Z' },
        [second.id]: { answer: 'b', correct: false, doneAt: '2026-09-30T10:05:00Z' },
      },
      prediction: { stepId: 'Firing' },
    };
    expect((await api.put(`/api/cases/${caseId}`, { token: t, json: { learning_state: learning } })).status).toBe(200);
    await runAssessment(student, caseId);
    const writeup = await api.put(`/api/cases/${caseId}`, {
      token: t,
      json: { interpretation: 'Firing dominates the result.', assumptions: 'x'.repeat(25_000) },
    });
    expect(writeup.status).toBe(200);
    expect(writeup.json.case.assumptions).toHaveLength(20_000);
    const handin = await api.put(`/api/cases/${caseId}`, { token: t, json: { is_final: true } });
    expect(handin.status).toBe(200);
    const row = await sqlOne('SELECT is_final, finalized_at, interpretation FROM case_table WHERE case_id = ?', [caseId]);
    expect(row.is_final).toBe(1);
    expect(row.finalized_at).not.toBeNull();
  });

  it('F15.6-F15.7 the instructor (viewer) reads progress and the members list, and cannot change the work', async () => {
    const t = instructor.token;
    const progress = await api.get(`/api/projects/${pid}/progress`, { token: t });
    expect(progress.status).toBe(200);
    const [c] = progress.json.cases;
    expect(c).toMatchObject({
      case_id: caseId,
      steps: 2,
      flows: 1,
      runs: 1,
      has_interpretation: true,
      has_assumptions: true,
      lessons_total: LESSONS.length,
      lessons_answered: [LESSONS[0].id],
      prediction_made: true,
      is_final: true,
    });
    // Presence, not content: the text itself is not in the progress view.
    expect(progress.text).not.toContain('Firing dominates');

    const members = await api.get(`/api/projects/${pid}/members`, { token: t });
    expect(members.json).toMatchObject({ canManage: false });
    for (const json of [{ interpretation: 'graded: C' }, { is_final: false }, { learning_state: { version: 1, lessons: {} } }]) {
      expect((await api.put(`/api/cases/${caseId}`, { token: t, json })).status, JSON.stringify(json)).toBe(403);
    }
    expect((await api.post(`/api/cases/${caseId}/assessments`, { token: t, json: {} })).status).toBe(403);
    // Read-only access to the work itself.
    expect((await api.get(`/api/cases/${caseId}`, { token: t })).json.case.interpretation).toBe('Firing dominates the result.');
  });

  it('in setup B no other student sees the work (404)', async () => {
    expect((await api.get(`/api/projects/${pid}/progress`, { token: other.token })).status).toBe(404);
    expect((await api.get(`/api/cases/${caseId}`, { token: other.token })).status).toBe(404);
  });

  it('un-ticking the hand-in clears finalized_at', async () => {
    await api.put(`/api/cases/${caseId}`, { token: student.token, json: { is_final: false } });
    expect(await sqlOne('SELECT is_final, finalized_at FROM case_table WHERE case_id = ?', [caseId])).toEqual({ is_final: 0, finalized_at: null });
  });

  // BUG WRITE-1 (app/api/cases/[caseId]/route.ts:139-147: is_final is set on one case
  // with no regard for the project's other cases): marking a second case as
  // the hand-in leaves the first one marked too, so a project can hold two
  // hand-ins and the instructor cannot tell which one counts.
  it.fails('a second hand-in in the same project replaces the first (WRITE-1)', async () => {
    const second = await createCase(student, pid, 'Second attempt', 'comparative');
    await api.put(`/api/cases/${caseId}`, { token: student.token, json: { is_final: true } });
    await api.put(`/api/cases/${second}`, { token: student.token, json: { is_final: true } });
    const finals = await sqlOne('SELECT COUNT(*) AS n FROM case_table WHERE project_id = ? AND is_final = 1', [pid]);
    expect(Number(finals.n)).toBe(1);
  });
});
