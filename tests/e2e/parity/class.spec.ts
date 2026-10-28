/**
 * Class rows that moved onto People and Cases, including the hand-in a
 * student sets and an instructor reads.
 */
import { test } from '../support/fixtures';
import { row } from '../support/parity';
import { open } from '../support/ui';

test('C01 C02 C04 P32 P33 P34 P35 P36 P42 P44 P128 P132 people, access, and the hand-in', async ({ api, newUser, signIn }) => {
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
  await row(page.getByRole('link', { name: 'Overview' }), 'P44', 'Back to the project');

  await open(page, `/project/${projectId}/cases`, { ready: 'Cases' });
  await page.getByRole('radio', { name: 'Table' }).click();
  await row(page.getByRole('columnheader', { name: 'Hand-in' }), 'C04', 'Hand-in tick, visible to the instructor');
  await row(page.getByText('Not ticked').first(), 'P42', 'Hand-in column');

  const studentSession = await signIn(student);
  const studentCase = (
    await api.as(student.token).get<{ cases: Array<{ case_id: number; case_name: string }> }>(`/api/projects/${projectId}/cases`)
  ).cases.find((c) => c.case_name === 'Sam answer')!;
  await open(studentSession.page, `/project/${projectId}/case/${studentCase.case_id}?tab=writeup`, { ready: 'Write-up' });
  await row(studentSession.page.getByRole('checkbox', { name: /hand-in/ }), 'P132', 'Case hand-in status');
});
