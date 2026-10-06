/**
 * The class page's "Students see only their own case" switch (B-A1,
 * project.members_see_own_cases; migrate-032-case-ownership.sql).
 *
 * An instructor's project has two students, both editors, each with a case of
 * their own. Before the switch a student can open the other's case; the
 * instructor turns it on from the class page; after it the second student gets
 * "Case not found" on the first student's case and still opens their own.
 */
import { ApiError } from '../support/api.ts';
import { outlineRow, toasts } from '../support/editor.ts';
import { expect, test } from '../support/fixtures.ts';

test('“Students see only their own case”: a second student cannot open the first student’s case', async ({ app, screen, api, newUser, signIn }) => {
  const instructor = await newUser('instructor', { fullName: 'Ingrid Instructor' });
  const ana = await newUser('student-a', { fullName: 'Ana Student' });
  const ben = await newUser('student-b', { fullName: 'Ben Student' });
  const owner = api.as(instructor.token);

  const projectId = (await owner.post<{ project: { project_id: number } }>('/api/projects', {
    project_name: 'Class LCA lab',
    description: 'One case per student.',
  })).project.project_id;
  for (const student of [ana, ben]) await owner.post(`/api/projects/${projectId}/members`, { email: student.email, role: 'editor' });
  // Each student makes a case with a product in it, as themselves (case_table.created_by).
  const newCase = async (token: string, name: string, product: string) => {
    const caseId = (await api.as(token).post<{ case: { case_id: number } }>(`/api/projects/${projectId}/cases`, { case_name: name, case_type: 'base' })).case.case_id;
    await api.as(token).post(`/api/cases/${caseId}/components`, { component_name: product, component_type: 'product', parent_component_id: null, quantity: 1, unit: 'unit' });
    return caseId;
  };
  const anaCase = await newCase(ana.token, 'Ana’s bottle study', 'Glass bottle');
  const benCase = await newCase(ben.token, 'Ben’s bottle study', 'PET bottle');

  // Off (the default): every member reaches every case.
  expect((await api.as(ben.token).get<{ case: { case_name: string } }>(`/api/cases/${anaCase}`)).case.case_name).toBe('Ana’s bottle study');

  // The instructor turns it on from the class page.
  await signIn(instructor, `/project/${projectId}/class`);
  await expect(screen.getByRole('heading', 'Class', { level: 1 })).toBeVisible({ timeout: 60_000 });
  const ownOnly = screen.getByRole('switch', 'Students see only their own case');
  await expect(ownOnly).not.toBeChecked();
  await expect(ownOnly).toBeEnabled();
  // A controlled switch: it flips once the server has saved the setting, so
  // tap and then wait for the state (check() wants it flipped at once).
  await ownOnly.tap();
  await expect(toasts(screen).getByText('Students now see only their own case')).toBeVisible();
  await expect(ownOnly).toBeChecked();
  expect((await owner.get<{ project: { members_see_own_cases: boolean } }>(`/api/projects/${projectId}`)).project.members_see_own_cases).toBe(true);
  // Each row names its author, so the instructor can tell the two apart.
  await expect(screen.getByText('Ana’s bottle study')).toBeVisible();
  await expect(screen.getByText('Ben’s bottle study')).toBeVisible();

  // The second student: the first student's case is "not found", in the API and in the editor.
  const refused = await api.as(ben.token).get(`/api/cases/${anaCase}`).catch((e: unknown) => e);
  expect(refused instanceof ApiError).toBe(true);
  expect((refused as ApiError).status).toBe(404);
  await app.clearState();
  await signIn(ben, `/project/${projectId}/case/${anaCase}`);
  // The editor's not-found state (a toast says it too, hence first(): the page's own line comes first).
  await expect(screen.getByRole('button', 'Return to Home')).toBeVisible({ timeout: 60_000 });
  await expect(screen.getByText('Case not found').first()).toBeVisible();
  await expect(screen.getByText('Ana’s bottle study')).toHaveCount(0);
  await expect(screen.getByText('Glass bottle')).toHaveCount(0);

  // …and still opens their own.
  await app.open(`/project/${projectId}/case/${benCase}`);
  await expect(screen.getByTestId('tree-canvas-viewport')).toBeVisible({ timeout: 60_000 });
  await expect(screen.getByText('Ben’s bottle study').first()).toBeVisible();
  await expect(outlineRow(screen, 'PET bottle')).toBeVisible();
  await expect(screen.getByRole('button', 'Return to Home')).toHaveCount(0);
});
