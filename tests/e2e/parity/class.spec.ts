/**
 * Class rows that moved onto People and Cases, including the hand-in a
 * student sets and an instructor reads.
 */
import { expect, storagePath, test } from '../support/fixtures';
import { note, row } from '../support/parity';
import { open } from '../support/ui';

test('C01 C02 C04 C10 P32 P33 P34 P35 P36 P42 P44 P128 P132 people, access, and the hand-in', async ({ api, newUser, signIn }) => {
  test.setTimeout(180_000);
  const owner = await newUser('parity-class');
  const student = await newUser('parity-student');
  const as = api.as(owner.token);
  const projectId = (await as.post<{ project: { project_id: number } }>('/api/projects', { project_name: 'Parity class', description: 'A class' })).project
    .project_id;
  await as.post(`/api/projects/${projectId}/cases`, { case_name: 'Base case', case_type: 'base', description: 'The brief' });
  await as.post(`/api/projects/${projectId}/members`, { email: student.email, role: 'editor' });
  await api.as(student.token).post(`/api/projects/${projectId}/cases`, {
    case_name: 'Sam answer',
    case_type: 'comparative',
    description: 'The student case',
  });

  const ownerSession = await signIn(owner);
  await open(ownerSession.page, `/project/${projectId}/people`, { ready: 'People' });
  const page = ownerSession.page;
  await row(page.getByRole('heading', { name: 'Add people' }), 'C01', 'Add students by email or CSV');
  await row(page.getByLabel('Email addresses'), 'P33', 'Add one person by email with role (admin only if owner)');
  await row(page.getByText('Or drop a CSV of the class'), 'C01', 'Add students by email or CSV');
  await row(page.getByRole('region', { name: 'People table' }), 'P32', 'Members list (owner, name, email, access)');
  await row(page.getByText(student.email), 'P128', 'Members and roles');
  await row(page.getByLabel(`Access for ${student.name ?? 'Jordan Journey'}`), 'P34', "Change someone's access");
  await page.getByRole('button', { name: /More for/ }).click();
  await row(page.getByRole('menuitem', { name: 'Remove from project' }), 'P35', 'Remove member');
  await page.keyboard.press('Escape');
  await row(page.getByRole('switch', { name: /see only their own case/ }), 'C02', 'Students see only their own case');
  await row(page.getByRole('switch', { name: /see only their own case/ }), 'P36', '"Students see only their own case" switch');
  // C1: the project is its Cases page now; the sidebar's Cases is the way back.
  await row(page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: /^Cases/ }), 'P44', 'Back to the project');

  await open(page, `/project/${projectId}/cases`, { ready: 'Cases' });
  await page.getByRole('radio', { name: 'Table' }).click();
  await row(page.getByRole('columnheader', { name: 'Hand-in' }), 'C04', 'Hand-in tick, visible to the instructor');
  await row(page.getByText('Not handed in').first(), 'P42', 'Hand-in column');

  const studentSession = await signIn(student);
  const studentCase = (
    await api.as(student.token).get<{ cases: Array<{ case_id: number; case_name: string }> }>(`/api/projects/${projectId}/cases`)
  ).cases.find((c) => c.case_name === 'Sam answer')!;
  await open(studentSession.page, `/project/${projectId}/case/${studentCase.case_id}?tab=writeup`, { ready: 'Write-up' });
  await row(studentSession.page.getByRole('checkbox', { name: /hand-in/ }), 'P132', 'Case hand-in status');
});

test('C03 C05 C06 C07 C08 C09 C11 P31 P37 P38 P39 P40 P41 an assignment from set to handed in, the board, and the student\'s view', async ({ api, newUser, signIn }) => {
  test.setTimeout(300_000);
  const owner = await newUser('class-owner');
  const ana = await newUser('class-ana');
  const ben = await newUser('class-ben');
  const as = api.as(owner.token);
  const projectId = (await as.post<{ project: { project_id: number } }>('/api/projects', { project_name: 'Assignment class', description: 'Week by week' })).project
    .project_id;
  const base = (await as.post<{ case: { case_id: number } }>(`/api/projects/${projectId}/cases`, { case_name: 'Bracket base', case_type: 'base', description: 'The brief' }))
    .case.case_id;
  await as.post(`/api/cases/${base}/components`, { component_name: 'Bracket', component_type: 'product', parent_component_id: null, quantity: 1, unit: 'unit' });
  for (const u of [ana, ben]) await as.post(`/api/projects/${projectId}/members`, { email: u.email, role: 'editor' });
  await as.put(`/api/projects/${projectId}`, { members_see_own_cases: true });

  // C06: the instructor sets it, on the page.
  const o = await signIn(owner);
  await open(o.page, `/project/${projectId}/assignments`, { ready: 'Assignments' });
  await o.page.getByRole('button', { name: '+ New assignment' }).click();
  const form = o.page.getByRole('form', { name: 'New assignment' });
  await form.getByLabel('Title').fill('Week 1: lighter blank');
  await form.getByLabel('Instructions').fill('Copy the base, make the blank lighter, run it, and write what changed.');
  await form.getByLabel('Due').fill('2030-01-15T17:00');
  await form.getByLabel('Students start from').selectOption({ label: 'Bracket base (base case)' });
  await form.getByRole('button', { name: 'Create assignment' }).click();
  await row(o.page.getByRole('heading', { name: 'Week 1: lighter blank' }), 'C06', 'Assignments with instructions, due date and template');

  // C05, C07: the student starts, sees the instructions while working, and hands in.
  const a = await signIn(ana);
  await open(a.page, `/project/${projectId}/assignments`, { ready: 'Week 1: lighter blank' });
  await a.page.getByRole('button', { name: 'Start' }).click();
  await a.page.waitForURL(/\/case\/\d+$/, { timeout: 90_000 });
  await row(a.page.getByRole('region', { name: 'Instructions' }).getByText(/make the blank lighter/), 'C05', 'Instructions shown to the student');
  await open(a.page, `/project/${projectId}/assignments`, { ready: 'Week 1: lighter blank' });
  await a.page.getByRole('button', { name: 'Hand in' }).click();
  await a.page.getByRole('alertdialog', { name: 'Hand in this case?' }).getByRole('button', { name: 'Hand in' }).click();
  await row(a.page.getByText(/^Handed in /), 'C07', 'Hand-in frozen as a copy');
  await a.page.getByRole('link', { name: 'Open what you handed in' }).click();
  await row(a.page.getByText(/Handed in, read-only/), 'C07', 'the hand-in is read-only and says so');

  // C08: the student's Home lists it.
  await open(a.page, '/home', { ready: 'Assigned to you' });
  await row(a.page.getByRole('region', { name: /Assigned to you/ }).getByText('Week 1: lighter blank'), 'C08', 'Assigned to you on Home');

  // C07: the instructor reads who started and who handed in.
  await open(o.page, `/project/${projectId}/assignments`, { ready: 'Week 1: lighter blank' });
  await o.page.getByRole('button', { name: 'Hand-ins' }).click();
  const handins = o.page.getByRole('table', { name: 'Hand-ins' });
  await row(handins.getByRole('row').filter({ hasText: ana.email }).getByText('handed in'), 'C07', 'Instructor\'s submissions list');
  await row(handins.getByRole('row').filter({ hasText: ben.email }).getByText('not started'), 'C07', 'and who has not started');

  // G4: lessons show once one is taken; Ana answers the first.
  const anaCase = (await api.as(ana.token).get<{ cases: Array<{ case_id: number; created_by: number; read_only: number }> }>(`/api/projects/${projectId}/cases`)).cases.find(
    (c) => c.created_by === ana.id && !Number(c.read_only),
  )!;
  await api.as(ana.token).put(`/api/cases/${anaCase.case_id}`, { learning_state: { version: 1, lessons: { scope: { correct: true } } } });
  // P31: the old address lands on Cases. P38 to P41, C03: progress on the board.
  await o.page.goto(`/project/${projectId}/class`);
  await o.page.waitForURL(/\/cases$/, { timeout: 90_000 });
  await row(o.page.getByText('Your cases'), 'P31', '/class redirects to /cases');
  await row(o.page.getByText(/\d+ steps · \d+ flows · \d+ runs/).first(), 'P39', 'Steps, flows and run count per case');
  await o.page.getByRole('radio', { name: 'Table' }).click();
  await row(o.page.getByRole('columnheader', { name: 'Lessons' }), 'P40', 'Lessons N of M, predicted, lesson titles');
  await row(o.page.getByRole('columnheader', { name: 'Write-up' }), 'P41', 'Write-up column with assumptions');
  await row(o.page.getByRole('columnheader', { name: 'Steps · flows · runs' }), 'P38', 'Progress for every case');
  await row(o.page.getByRole('cell', { name: /^Lessons \d+ of \d+/ }).first(), 'C03', 'Per-student lesson progress');

  // P37: a student is told they see only their own cases. C11 (2.5): on the instructor's base, a way to start their own copy.
  const b = await signIn(ben);
  await open(b.page, `/project/${projectId}/people`, { ready: 'People' });
  await row(b.page.getByRole('note').getByText(/you see only your own cases/), 'P37', 'Non-managers see the own-only notice');
  await open(b.page, `/project/${projectId}/case/${base}`, { ready: 'Bracket base' });
  await row(b.page.getByRole('button', { name: 'Make my own copy' }), 'C11', 'A student on the instructor\'s base case can start their own copy');

  // C09 (2.2): an email with no account is said once, in words.
  await open(o.page, `/project/${projectId}/people`, { ready: 'People' });
  await o.page.getByLabel('Email addresses').fill('nobody-here@lcapix.test');
  await o.page.getByRole('button', { name: 'Add to this project' }).click();
  await row(o.page.getByText('nobody-here@lcapix.test has no account yet. They need to sign up first, then add them again.'), 'C09', 'Adding an email with no account says so');
});

test('P43 editors and viewers can open People: the sidebar shows it, and the list is read-only', async ({ api, newUser, signIn }) => {
  // A shared project (the sample is never shared): its owner adds a viewer.
  const owner = await newUser('class-p43-owner');
  const viewer = await newUser('class-p43-viewer');
  const as = api.as(owner.token);
  const projectId = (await as.post('/api/projects', { project_name: 'Shared study', description: 'Read by a viewer' })).project.project_id as number;
  await as.post(`/api/projects/${projectId}/members`, { email: viewer.email, role: 'viewer' });
  const { page } = await signIn(viewer);
  await open(page, `/project/${projectId}`, { ready: 'Shared study' });
  const people = page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: /^People/ });
  await row(people, 'P43', 'Editors/viewers can open the page');
  await people.click();
  await row(page.getByRole('region', { name: 'People table' }), 'P43', 'Editors/viewers can open the page');
  await row(page.getByText('Only the owner and people who can share add or remove people here.'), 'P43', 'read-only for a viewer');
  await expect.soft(page.getByRole('combobox', { name: /^Access for / }), note('P43', 'no access control for a viewer')).toHaveCount(0);
});
