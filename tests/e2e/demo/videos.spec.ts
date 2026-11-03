/**
 * The demo videos: one per journey, recorded by Playwright (project "demo":
 * video on, slowed down so a person can follow). Not part of the gate; run
 *
 *   E2E_PORT=3176 npx playwright test --project=demo
 *
 * Each test is its own video. Real data only: the bundled sample documents
 * (a touring bike frame from a small US shop), the sample study, and DOE ITAC
 * plant WV0661's real record. Each scene puts a caption on screen; a scene
 * that fails is named at the end and the video goes on.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import type { Page } from '@playwright/test';
import { expect, test } from '../support/fixtures';
import type { Api, ApiUser } from '../support/api';
import { E2E_DIR } from '../support/paths';
import { SAMPLE_DOCS } from '../../../lib/ingest/sample-docs';

const NAV = { timeout: 90_000 };
const failed: string[] = [];

async function caption(page: Page, text: string, ms = 2800) {
  await page.evaluate((t) => {
    let el = document.getElementById('demo-caption');
    if (!el) {
      el = document.createElement('div');
      el.id = 'demo-caption';
      el.setAttribute('aria-hidden', 'true');
      el.style.cssText =
        'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483647;max-width:900px;' +
        'padding:12px 20px;border-radius:12px;background:rgba(23,32,27,0.92);color:#fff;font:600 18px/1.4 Arial,sans-serif;' +
        'box-shadow:0 10px 30px rgba(0,0,0,0.25);pointer-events:none;text-align:center';
      document.body.appendChild(el);
    }
    el.textContent = t;
  }, text);
  await page.waitForTimeout(ms);
}

async function scene(page: Page, video: string, name: string, fn: () => Promise<void>) {
  try {
    await fn();
  } catch (e: any) {
    failed.push(`${video} / ${name}: ${String(e?.message ?? e).split('\n')[0]}`);
    await caption(page, `(${name}: skipped)`, 800).catch(() => {});
  }
}

const tree = (page: Page, name: string) => page.getByRole('treeitem', { name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, `) });

/** Sign in through the real form, so the recorded page is the signed-in one. */
async function logIn(page: Page, user: ApiUser) {
  await page.goto('/auth/login');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Log in', exact: true }).click();
  await page.waitForURL(/\/home|\/auth\/onboarding/, NAV);
}

/** A file read and saved through the import API, as the import screen does. */
async function importDoc(api: Api, user: ApiUser, kind: string, file: { name: string; mime: string; buffer: Buffer }, into: { projectId: number; caseId?: number; caseName?: string }, extra: Record<string, string> = {}) {
  const pre = await api.request.fetch(`${api.baseURL}/api/ingest/preview`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user.token}`, Connection: 'close' },
    multipart: { file: { name: file.name, mimeType: file.mime, buffer: file.buffer }, connector: kind, ...(into.caseId ? { target_case_id: String(into.caseId) } : {}), ...extra },
    timeout: 120_000,
  });
  expect(pre.status(), await pre.text()).toBe(200);
  const plan = (await pre.json()).plan;
  const body = into.caseId
    ? { target_case_id: into.caseId, nodes: plan.nodes, flows: plan.flows, costs: plan.costs, notes: plan.notes }
    : { project_id: into.projectId, case_name: into.caseName, nodes: plan.nodes, flows: plan.flows, costs: plan.costs, notes: plan.notes };
  const done = await api.as(user.token).post<{ case_id: number }>('/api/ingest/apply', body);
  return Number(done.case_id ?? into.caseId);
}

const csv = (kind: string) => ({ name: SAMPLE_DOCS[kind].filename, mime: 'text/csv', buffer: Buffer.from(SAMPLE_DOCS[kind].content) });

/** A class the way a teacher sets one up: the touring bike from its three documents, run, one assignment, students added. */
async function bikeClass(api: Api, teacher: ApiUser, students: ApiUser[]) {
  const as = api.as(teacher.token);
  const projectId = (await as.post<{ project: { project_id: number } }>('/api/projects', { project_name: 'Touring bike frame', description: 'Which step of a touring bike frame drives its climate impact?' })).project.project_id;
  await as.put(`/api/projects/${projectId}`, { functional_unit: '1 bike frame', lcia_method: 'TRACI 2.1', region_code: 'US' });
  const baseId = await importDoc(api, teacher, 'routing', csv('routing'), { projectId, caseName: 'Touring bike' });
  await importDoc(api, teacher, 'bom', csv('bom'), { projectId, caseId: baseId });
  await importDoc(api, teacher, 'equipment', csv('equipment'), { projectId, caseId: baseId });
  await as.post(`/api/cases/${baseId}/assessments`, {});
  for (const s of students) await as.post(`/api/projects/${projectId}/members`, { email: s.email, role: 'editor' });
  await as.post(`/api/projects/${projectId}/assignments`, {
    title: 'Week 3: lighter frame',
    instructions: 'Swap one tube to a lighter alloy, run it, and explain the change in your write-up.',
    template_case_id: baseId,
  });
  return { projectId, baseId };
}

const named = async (api: Api, u: ApiUser, fullName: string, useCase: string) =>
  api.as(u.token).put('/api/auth/profile', { fullName, company: 'State University', role: useCase === 'student' ? 'Student' : 'Instructor', useCase, country: 'United States' });

test.afterAll(() => {
  // eslint-disable-next-line no-console
  console.log(failed.length ? `Demo scenes skipped:\n- ${failed.join('\n- ')}` : 'Demo: every scene ran.');
});

test('1. A student: start the assignment, change the inventory, run, write up, hand in', async ({ page, api, newUser }) => {
  test.setTimeout(20 * 60_000);
  const V = 'student';
  const teacher = await newUser('video-teacher');
  const sam = await newUser('video-sam');
  await named(api, teacher, 'Uma Walker', 'teaching');
  await named(api, sam, 'Sam Student', 'student');
  const { projectId } = await bikeClass(api, teacher, [sam]);

  await scene(page, V, 'Home', async () => {
    await logIn(page, sam);
    await expect(page.getByRole('region', { name: /Assigned to you/ })).toBeVisible(NAV);
    await caption(page, 'A student signs in. Home shows what the instructor assigned.');
    await page.getByRole('region', { name: /Assigned to you/ }).getByRole('button', { name: /^Start\b/ }).click();
    await expect(page.getByRole('tree')).toBeVisible(NAV);
  });

  await scene(page, V, 'Guided mode and the step bar', async () => {
    await caption(page, 'Their own copy of the case. Guided mode is on for a first case, and says so once.');
    await caption(page, 'The step bar follows ISO 14044: goal and scope, inventory, impact assessment, interpretation, hand in.');
    await page.getByRole('button', { name: 'Keep it on' }).click().catch(() => {});
  });

  await scene(page, V, 'A step and its flows', async () => {
    await tree(page, '10. Cut & miter frame tubes').click();
    await caption(page, 'Click a step: the panel beside the tree shows its flows, each as amount × factor = impact.');
    const box = page.getByRole('textbox', { name: 'Aluminum, amount in kg', exact: true });
    await box.fill('1.8');
    await caption(page, 'A lighter tube set: 1.8 kg. Nothing is saved until Save; Enter never saves.', 2200);
    await page.getByRole('button', { name: /^Save Aluminum on 10\. Cut/ }).click();
    await expect(page.getByText(/^Saved · Aluminum 1\.8/).first()).toBeVisible(NAV);
  });

  await scene(page, V, 'Documents beside the tree', async () => {
    await page.getByRole('tab', { name: 'Documents panel' }).click();
    await page.getByRole('button', { name: 'Open the sample sample-bom.csv' }).click();
    await caption(page, 'Documents is the panel\'s other tab: read the bill of materials while you model.');
    await page.getByRole('tab', { name: /panel$/ }).first().click();
  });

  await scene(page, V, 'Run', async () => {
    await page.getByRole('button', { name: 'Run the case', exact: true }).click();
    await caption(page, 'Run the case with the class\'s method and region.', 1800);
    await page.getByRole('dialog', { name: 'Run the case' }).getByRole('button', { name: 'Run', exact: true }).click();
    await expect(page).toHaveURL(/tab=results/, NAV);
    await caption(page, 'Results: the answer per bike frame at 3 significant figures, what builds it, and the change from the base case.');
  });

  await scene(page, V, 'Write-up', async () => {
    const bar = page.getByRole('navigation', { name: 'Where this case stands' });
    await bar.getByRole('button', { name: 'Next: Write the interpretation' }).click();
    await page.getByRole('textbox', { name: 'Interpretation' }).fill('The lighter tube set lowers the frame\'s climate impact, because aluminum dominates the inventory.');
    await page.getByRole('button', { name: 'Save the write-up' }).click();
    await caption(page, 'The interpretation is the student\'s own words; the step bar moves on to Hand in.');
  });

  await scene(page, V, 'Hand in', async () => {
    const bar = page.getByRole('navigation', { name: 'Where this case stands' });
    await bar.getByRole('button', { name: 'Next: Hand it in' }).click();
    await page.getByRole('button', { name: 'Hand in', exact: true }).click();
    await page.getByRole('alertdialog', { name: 'Hand in this case?' }).getByRole('button', { name: 'Hand in' }).click();
    await caption(page, 'Handed in: the instructor gets a read-only copy, frozen with its run.');
  });
  void projectId;
});

test('2. A teacher: the class, an assignment, the hand-ins, Analytics and Reports', async ({ page, api, newUser }) => {
  test.setTimeout(20 * 60_000);
  const V = 'teacher';
  const teacher = await newUser('video-uma');
  const ana = await newUser('video-ana');
  await named(api, teacher, 'Uma Walker', 'teaching');
  await named(api, ana, 'Ana Ruiz', 'student');
  const { projectId } = await bikeClass(api, teacher, [ana]);
  // Ana starts, runs and hands in, so the teacher has something to read.
  const assignment = (await api.as(ana.token).get<{ assignments: Array<{ assignment_id: number }> }>(`/api/projects/${projectId}/assignments`)).assignments[0];
  const working = await api.as(ana.token).post<{ case_id: number }>(`/api/assignments/${assignment.assignment_id}/start`);
  await api.as(ana.token).post(`/api/cases/${working.case_id}/assessments`, {});
  await api.as(ana.token).put(`/api/cases/${working.case_id}`, { interpretation: 'Aluminum is most of the frame\'s impact.' });
  await api.as(ana.token).post(`/api/assignments/${assignment.assignment_id}/submit`);

  await scene(page, V, 'Home', async () => {
    await logIn(page, teacher);
    await caption(page, 'The instructor\'s Home: projects, the sample, and what needs attention.');
  });

  await scene(page, V, 'People', async () => {
    await page.goto(`/project/${projectId}/people`);
    await expect(page.getByRole('heading', { name: 'People', level: 1 })).toBeVisible(NAV);
    await caption(page, 'People: add a class by email and set what each person can do. Each student sees only their own case.');
  });

  await scene(page, V, 'An assignment', async () => {
    await page.goto(`/project/${projectId}/assignments`);
    await page.getByRole('button', { name: '+ New assignment' }).click();
    const form = page.getByRole('form', { name: 'New assignment' });
    await form.getByLabel('Title').fill('Week 4: recycled content');
    await form.getByLabel('Instructions').fill('Change one material to its recycled version, run it, and compare with the base case.');
    await form.getByLabel('Students start from').selectOption({ index: 1 });
    await caption(page, 'A new assignment: instructions, a due date, and the case students start from.');
    await form.getByRole('button', { name: 'Create assignment' }).click();
    await expect(page.getByText(/is set for your students/)).toBeVisible(NAV);
  });

  await scene(page, V, 'Hand-ins', async () => {
    await page.getByRole('button', { name: 'Hand-ins' }).first().click();
    await caption(page, 'Hand-ins: who handed in, when, the frozen run, and the working case still changing.');
    await page.getByRole('link', { name: /^Working case/ }).first().click();
    await expect(page.getByText("A student's case.")).toBeVisible(NAV);
    await caption(page, 'A student\'s case reads only: the instructor reads it, only the student changes it.');
  });

  await scene(page, V, 'Analytics', async () => {
    await page.goto(`/project/${projectId}/analytics`);
    await expect(page.getByText('How far the class got')).toBeVisible(NAV);
    await caption(page, 'Analytics: how far the class got, where the results landed, and the flows most often left empty.');
    await page.mouse.wheel(0, 700);
    await caption(page, 'Nothing here grades: it reads each case as it stands.', 2000);
  });

  await scene(page, V, 'Reports', async () => {
    await page.goto(`/reports?project=${projectId}`);
    await expect(page.getByText('Build a report')).toBeVisible(NAV);
    await caption(page, 'Reports: a run as a PDF, slides or a CSV with every digit kept.');
    const pdf = page.waitForEvent('download', NAV);
    await page.getByRole('button', { name: 'Export PDF' }).click();
    await pdf;
  });
});

test('3. Import: a routing, a bill of materials, an equipment list, the column mapper, and a plant per unit', async ({ page, api, newUser }) => {
  test.setTimeout(20 * 60_000);
  const V = 'import';
  const user = await newUser('video-import');
  await named(api, user, 'Rae Lab', 'lab');
  const projectId = (await api.as(user.token).post<{ project: { project_id: number } }>('/api/projects', { project_name: 'Touring bike study', description: 'From the shop\'s own files.' })).project.project_id;

  await scene(page, V, 'A routing makes the case', async () => {
    await logIn(page, user);
    await page.goto(`/project/${projectId}/import`);
    await page.getByRole('radio', { name: 'Routing' }).click();
    await caption(page, 'Import: pick what kind of file it is. Spreadsheets and CSV files are read by fixed rules, no AI.');
    await page.getByRole('button', { name: 'Try it with a sample file' }).click();
    await page.getByRole('button', { name: /^Check what we read/ }).click();
    await expect(page.getByRole('heading', { name: 'Check what we read' })).toBeVisible(NAV);
    await caption(page, 'Check what we read: every step with its tier, hours and labour cost, editable before anything is saved.');
    await page.getByLabel('Case name').fill('Touring bike');
    await page.getByRole('button', { name: /^Save \d+ steps to a new case$/ }).click();
    await expect(page.getByRole('heading', { name: 'Where this case stands' })).toBeVisible(NAV);
    await caption(page, 'Saved. The Done card says where the case stands and what to add next.');
  });

  await scene(page, V, 'The bill of materials', async () => {
    await page.getByRole('button', { name: 'Add the bill of materials →' }).click();
    await page.getByRole('button', { name: 'Try it with a sample file' }).click();
    await page.getByRole('button', { name: /^Check what we read/ }).click();
    await expect(page.getByRole('heading', { name: 'Check what we read' })).toBeVisible(NAV);
    await caption(page, 'Each line is matched to the library with its score and factor; a line with no match is held, never guessed.');
    await page.getByRole('button', { name: /^Save \d+ lines? to Touring bike$/ }).click();
    await expect(page.getByRole('heading', { name: 'Where this case stands' })).toBeVisible(NAV);
  });

  await scene(page, V, 'The column mapper', async () => {
    // The sample bill of materials with its own column names, as another ERP would export it.
    const respelled = SAMPLE_DOCS.bom.content.replace(
      'Item,Description,Material,Qty Per,UOM,Unit Weight (kg),Unit Cost,Op Seq',
      'Part Ref,Part Text,Alloy,Per Assy,Measure,Mass Each,Each USD,Routing Step',
    );
    await page.goto(`/project/${projectId}/import`);
    await page.getByRole('radio', { name: 'Bill of materials' }).click();
    await page.getByLabel(/Drop a file here/).setInputFiles({ name: 'erp-export.csv', mimeType: 'text/csv', buffer: Buffer.from(respelled) });
    await page.getByRole('button', { name: /^Check what we read/ }).click();
    await expect(page.getByRole('heading', { name: 'Which column is which?' })).toBeVisible(NAV);
    await caption(page, 'Headers it does not know: say what each column holds. The project remembers it for the next file laid out the same way.');
    const pick = (col: string, label: string) => page.getByLabel(`What column ${col} holds`).selectOption({ label });
    await pick('Part Ref', 'Part number');
    await pick('Part Text', 'Name or description');
    await pick('Alloy', 'Material');
    await pick('Per Assy', 'Quantity');
    await pick('Measure', 'Unit of the quantity');
    await pick('Mass Each', 'Weight of one');
    await pick('Each USD', 'Cost of one');
    await pick('Routing Step', 'Step it is used at');
    await page.getByRole('button', { name: 'Read it with these columns →' }).click();
    await expect(page.getByRole('heading', { name: 'Check what we read' })).toBeVisible(NAV);
    await caption(page, 'Read with those columns: the same lines as the original export.');
  });

  await scene(page, V, 'A plant\'s year, answered per unit', async () => {
    const fixture = JSON.parse(readFileSync(path.join(E2E_DIR, '..', 'fixtures', 'itac', 'assess-rows.json'), 'utf8'));
    const row = fixture.rows.find((x: any) => x.row.ID === 'WV0661').row as Record<string, unknown>;
    const header = Object.keys(row);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, header.map((k) => row[k])]), 'ASSESS');
    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
    const itac = await importDoc(api, user, 'itac', { name: fixture.source.file, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer }, { projectId, caseName: 'ITAC plant WV0661' }, { plant_id: 'WV0661' });
    await api.as(user.token).post(`/api/cases/${itac}/assessments`, { calculation_method: 'TRACI 2.1', region_code: 'US' });
    await page.goto(`/project/${projectId}/case/${itac}?tab=results`);
    await expect(page.locator('.ws-answer-num')).toBeVisible(NAV);
    await caption(page, 'A DOE ITAC plant record: the inventory is the plant\'s year, and every answer is per unit, said in one line.', 3600);
  });
});

test('4. Editing: the tree, the inventory, your own factor, costs and documents', async ({ page, api, newUser }) => {
  test.setTimeout(20 * 60_000);
  const V = 'editing';
  const user = await newUser('video-edit');
  await named(api, user, 'Rae Lab', 'lab');
  const as = api.as(user.token);
  const r = await as.post<{ project_id: number; case_id: number }>('/api/example-project');
  const copy = await as.post<{ case_id: number }>(`/api/cases/${r.case_id}/duplicate`, { case_name: 'My bracket' });
  const url = `/project/${r.project_id}/case/${copy.case_id}`;

  await scene(page, V, 'The tree', async () => {
    await logIn(page, user);
    await page.goto(url);
    await expect(page.getByRole('tree')).toBeVisible(NAV);
    await caption(page, 'The sample bracket, your own copy: a tree from the product down to elemental tasks, one lane per tier.');
    await tree(page, 'Cutting').click({ button: 'right' });
    await caption(page, 'Each step has a menu: rename, move, add a step below, delete.', 2200);
    await page.getByRole('menuitem', { name: /^Add an? .* below$/ }).click();
    const form = page.getByRole('dialog', { name: 'Add a step' });
    await caption(page, 'The tier is suggested from the parent, with the reason under it.', 2400);
    await form.getByLabel('Name').fill('15. Deburr');
    await form.getByRole('button', { name: 'Add the step' }).click();
    await expect(tree(page, '15. Deburr')).toBeVisible(NAV);
  });

  await scene(page, V, 'Rename and delete', async () => {
    await tree(page, '15. Deburr').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Rename' }).click();
    const rename = page.getByRole('dialog', { name: 'Rename step' });
    await rename.getByLabel('Name').fill('15. Deburr edges');
    await rename.getByRole('button', { name: 'Save', exact: true }).click();
    await tree(page, '15. Deburr edges').click({ button: 'right' });
    await page.getByRole('menuitem', { name: 'Delete step' }).click();
    await caption(page, 'Deleting asks first, and says what goes with it.', 2200);
    await page.getByRole('alertdialog').getByRole('button', { name: /^Delete/ }).click();
  });

  await scene(page, V, 'The inventory', async () => {
    await page.getByRole('tab', { name: /^Inventory/ }).click();
    await caption(page, 'The Inventory: every flow, its amount, unit, factor and source; one line says which use the Global average.');
    await page.getByRole('combobox', { name: 'Unit for Steel' }).selectOption('g');
    await caption(page, 'Change the unit: the amount converts, and nothing is saved until Save.', 2400);
    await page.getByRole('button', { name: /^Save Steel/ }).first().click();
  });

  await scene(page, V, 'Your own factor', async () => {
    await page.getByRole('button', { name: 'Edit more of Steel' }).click();
    await page.getByRole('button', { name: 'Use my own factor' }).first().click();
    await caption(page, 'Your own factor, from an EPD or a paper: its value, what it is per, and where it comes from.', 3000);
    await page.getByRole('button', { name: 'Cancel' }).first().click().catch(() => {});
  });

  await scene(page, V, 'Costs', async () => {
    await page.getByRole('tab', { name: /^Tree/ }).click();
    await page.getByRole('radio', { name: 'Cost', exact: true }).click();
    await caption(page, 'The same tree in cost: labour, energy and material per step, from rates with their source.');
    await page.getByRole('radio', { name: 'Impact', exact: true }).click();
  });

  await scene(page, V, 'Documents', async () => {
    await page.getByRole('tab', { name: /^Inventory/ }).click();
    await page.getByRole('button', { name: 'Documents', exact: true }).click();
    await caption(page, 'Documents open beside the Inventory: read an amount off the file and type it in.');
  });
});

test('5. Analysis: results, a what-if, Compare, Magic Insights and exports', async ({ page, api, newUser }) => {
  test.setTimeout(20 * 60_000);
  const V = 'analysis';
  const user = await newUser('video-analysis');
  await named(api, user, 'Rae Lab', 'lab');
  const as = api.as(user.token);
  const r = await as.post<{ project_id: number; case_id: number }>('/api/example-project');
  const copy = await as.post<{ case_id: number }>(`/api/cases/${r.case_id}/duplicate`, { case_name: 'My bracket' });
  await as.post(`/api/cases/${copy.case_id}/assessments`, {});

  await scene(page, V, 'Results', async () => {
    await logIn(page, user);
    await page.goto(`/project/${r.project_id}/case/${copy.case_id}?tab=results`);
    await expect(page.locator('.ws-answer-num')).toBeVisible(NAV);
    await caption(page, 'Results: the climate answer, what builds it step by step, how sure it is, and the cost beside it.');
  });

  await scene(page, V, 'The full results page', async () => {
    await page.getByRole('link', { name: 'Open full page' }).click();
    await expect(page.getByRole('region', { name: 'Total' })).toBeVisible(NAV);
    await caption(page, 'The full page: every category, by life-cycle stage, and per flow, with goal and scope frozen with the run.');
    await page.mouse.wheel(0, 900);
    await caption(page, 'What is not counted is named, never shown as zero.', 2200);
  });

  await scene(page, V, 'A what-if', async () => {
    await page.goto(`/project/${r.project_id}/case/${copy.case_id}?tab=results`);
    await page.getByRole('button', { name: 'Try a what-if' }).click();
    await expect(page.getByRole('tree')).toBeVisible(NAV);
    await caption(page, 'A what-if: a copy with one thing changed, measured against the case it came from.');
  });

  await scene(page, V, 'Compare', async () => {
    await page.goto(`/project/${r.project_id}/comparison`);
    await expect(page.getByRole('group', { name: 'Cases to compare' })).toBeVisible(NAV);
    await caption(page, 'Compare: four checks say whether two cases are fair to compare, then the change by step and material.');
    await page.mouse.wheel(0, 700);
  });

  await scene(page, V, 'Magic Insights', async () => {
    await page.goto(`/project/${r.project_id}/case/${copy.case_id}?tab=results`);
    await page.getByRole('button', { name: 'Magic Insights' }).first().click();
    await caption(page, 'Magic Insights: what drives the answer and what to try next; every number comes from the run.');
    await page.keyboard.press('Escape');
  });

  await scene(page, V, 'Exports', async () => {
    await page.goto(`/reports?project=${r.project_id}&case=${copy.case_id}`);
    await expect(page.getByText('Build a report')).toBeVisible(NAV);
    await caption(page, 'Reports: the run as a PDF, slides, or a CSV that keeps every digit for Excel.');
  });
});
