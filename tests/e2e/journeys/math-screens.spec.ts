/**
 * The math audit, on the screens (F41 proves the engine against plain
 * arithmetic; this proves the screens against the run). Two real cases: the
 * sample bracket (its inventory is per 1 bracket) and DOE ITAC plant WV0661
 * (its inventory covers the plant's year, 5,200 units). Every number a
 * student reads must be the run's number for one functional unit at 3
 * significant figures: the Results answer and "what builds this number", the
 * Cases board, the full results page and its per-unit table, and each
 * Inventory row's amount × factor = impact.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import * as XLSX from 'xlsx';
import { expect, test } from '../support/fixtures';
import { open } from '../support/ui';
import { workedExample } from '../support/editor';
import { E2E_DIR } from '../support/paths';
import { answer, result3 } from '../../../lib/ui/format';

const NAV = { timeout: 90_000 };

type Run = {
  run_id: number;
  impacts: Record<string, { value: number; unit: string }>;
  componentBreakdown: Array<{ component_id: number; component_name: string; impacts: Array<{ category_name: string; impact_value: number }> }>;
  run_steps?: Array<{ component_id: number; name: string; parent_id: number | null; type: string }>;
  goal_scope?: { per_fu_scale: number; modeled_output: number };
};

const climateOf = (r: Run) => Object.entries(r.impacts).find(([k]) => /global warming|climate/i.test(k))![1].value;

/** Each step's value summed over the steps under it, from the run's own tree. */
function subtreeSums(r: Run): Map<number, number> {
  const own = new Map<number, number>();
  for (const c of r.componentBreakdown) {
    const v = c.impacts.find((i) => /global warming|climate/i.test(i.category_name))?.impact_value;
    if (v) own.set(Number(c.component_id), Number(v));
  }
  const kids = new Map<number | null, number[]>();
  for (const s of r.run_steps ?? []) kids.set(s.parent_id, [...(kids.get(s.parent_id) ?? []), s.component_id]);
  const sum = (id: number): number => (own.get(id) ?? 0) + (kids.get(id) ?? []).reduce((t, k) => t + sum(k), 0);
  return new Map((r.run_steps ?? []).map((s) => [s.component_id, sum(s.component_id)]));
}

test('the screens print the run, per functional unit, at 3 significant figures', async ({ api, newUser, signIn }) => {
  test.setTimeout(600_000);
  const user = await newUser('math-screens');
  const as = api.as(user.token);
  const { projectId, caseId } = await workedExample(api, user, 'Audit bracket');
  await as.post(`/api/cases/${caseId}/assessments`, { calculation_method: 'TRACI 2.1', region_code: 'US' });

  // ITAC WV0661: its real ASSESS row, imported into the same project.
  const fixture = JSON.parse(readFileSync(path.join(E2E_DIR, '..', 'fixtures', 'itac', 'assess-rows.json'), 'utf8'));
  const row = fixture.rows.find((x: any) => x.row.ID === 'WV0661').row as Record<string, unknown>;
  const header = Object.keys(row);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([header, header.map((k) => row[k])]), 'ASSESS');
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  const pre = await api.request.fetch(`${api.baseURL}/api/ingest/preview`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${user.token}`, Connection: 'close' },
    multipart: {
      file: { name: fixture.source.file, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: buf },
      connector: 'itac',
      plant_id: 'WV0661',
    },
    timeout: 120_000,
  });
  expect(pre.status(), await pre.text()).toBe(200);
  const plan = (await pre.json()).plan;
  const itac = await as.post<{ case_id: number }>('/api/ingest/apply', { project_id: projectId, case_name: 'ITAC WV0661', nodes: plan.nodes, flows: plan.flows, costs: plan.costs, notes: plan.notes });
  await as.post(`/api/cases/${itac.case_id}/assessments`, { calculation_method: 'TRACI 2.1', region_code: 'US' });

  const { page } = await signIn(user);
  for (const [name, id] of [['Audit bracket', caseId], ['ITAC WV0661', itac.case_id]] as const) {
    const latest = (await as.get<{ assessments: Run[] }>(`/api/cases/${id}/assessments?latest=1`)).assessments[0];
    const scale = Number(latest.goal_scope?.per_fu_scale ?? 1);
    const perUnit = climateOf(latest) * scale;
    const where = `${name} (scale ${scale})`;

    // Results tab: the answer, the line when the inventory covers more, and what builds it.
    await open(page, `/project/${projectId}/case/${id}?tab=results`, { ready: 'What builds this number' });
    await expect(page.locator('.ws-answer-num'), `${where}: Results answer`).toHaveText(answer(perUnit));
    const basis = page.locator('.ws-basis-line');
    if (scale !== 1) await expect(basis, `${where}: the data basis line`).toContainText(/The inventory covers [\d,]+ units/);
    else await expect(basis).toHaveCount(0);
    const sums = subtreeSums(latest);
    const ops = (latest.run_steps ?? []).filter((s) => s.type === 'operation');
    for (const op of ops.slice(0, 6)) {
      const v = (sums.get(op.component_id) ?? 0) * scale;
      const li = page.locator('li').filter({ hasText: op.name }).first();
      await expect(li, `${where}: what builds, ${op.name}`).toContainText(v ? result3(v) : '0');
    }

    // The Cases board reads the same number.
    await open(page, `/project/${projectId}/cases`, { ready: 'Your cases' });
    await expect(page.locator('.pc-mine-card').filter({ hasText: name }).first(), `${where}: Cases board`).toContainText(answer(perUnit));

    // The full results page: the answer, and the table from per unit to the whole inventory.
    await open(page, `/project/${projectId}/case/${id}/results?run=${latest.run_id}`, { ready: /Goal and scope/ });
    await expect(page.getByRole('region', { name: 'Total' }), `${where}: full results total`).toContainText(answer(perUnit));
    if (scale !== 1) {
      const iso = page.getByRole('region', { name: 'ISO summary' });
      await expect(iso, `${where}: per unit and whole inventory`).toContainText(result3(perUnit));
      await expect(iso).toContainText(result3(climateOf(latest)));
    }

    // The Inventory: each row's amount × factor = impact, as the case holds it (the documents' amounts).
    const inv = await as.get<{ rows: Array<{ substance: string; amount: number | null; climate: { factor: number; impact: number; conversion: string | null } | null }> }>(`/api/cases/${id}/inventory`);
    await open(page, `/project/${projectId}/case/${id}?tab=inventory`, { ready: 'Show flows' });
    if (scale !== 1) await expect(page.getByRole('note').filter({ hasText: 'The inventory covers' }), `${where}: Inventory basis line`).toBeVisible();
    // Rows with no unit conversion, where the amount shown is the amount multiplied.
    for (const r of inv.rows.filter((x) => x.climate && x.amount != null && !x.climate.conversion).slice(0, 8)) {
      expect(Math.abs(r.amount! * r.climate!.factor - r.climate!.impact), `${where}: ${r.substance} amount × factor = impact`).toBeLessThan(1e-9 * Math.max(1, Math.abs(r.climate!.impact)));
      const cell = page.getByRole('row').filter({ hasText: r.substance }).first();
      await expect(cell, `${where}: Inventory row ${r.substance}`).toContainText(`= ${result3(r.climate!.impact)}`);
    }
  }
});
