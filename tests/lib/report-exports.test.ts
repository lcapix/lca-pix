import { describe, it, expect, vi, afterEach } from 'vitest';
import { createRequire } from 'node:module';
import PDFDocument from 'pdfkit';

import {
  generateAssessmentPDF,
  pdfSafeText,
  headlineSteps,
  stageSplit,
  type ReportData,
} from '@/lib/pdf-generator';
import { generateAssessmentPPTX, topContributors } from '@/lib/pptx-generator';

// Two steps share the name "Assembly" (STAGE-2) and one of them is a credit.
// Units carry the subscripts migrate-fix-chemical-subscripts writes (EXP-4).
const data: ReportData = {
  project: { project_id: 1, project_name: 'Bike', description: null, owner_username: 'u', created_at: '2026-09-20' },
  case_info: { case_id: 2, case_name: 'Base', case_type: 'base', case_description: null },
  assessment: { run_id: 9, run_name: 'Run', run_at: '2026-09-29', calculation_method: 'TRACI 2.1', executed_by_username: 'u' },
  components: [
    { component_id: 1, component_name: 'Bike', component_type: 'product', hierarchy_level: 1, quantity: 1, unit: 'unit', opex: null, capex: 100 },
    { component_id: 2, component_name: 'Assembly', component_type: 'operation', hierarchy_level: 4, quantity: 1, unit: 'unit', opex: 10, capex: null, life_cycle_stage: 'materials' },
    { component_id: 3, component_name: 'Assembly', component_type: 'operation', hierarchy_level: 4, quantity: 1, unit: 'unit', opex: 5, capex: null, life_cycle_stage: 'end_of_life' },
    { component_id: 4, component_name: 'Paint', component_type: 'operation', hierarchy_level: 4, quantity: 1, unit: 'unit', opex: null, capex: null, life_cycle_stage: 'production' },
  ],
  results: [
    { component_id: 2, component_name: 'Assembly', category_name: 'Global Warming', impact_value: 30, unit: 'kg CO₂ eq' },
    { component_id: 3, component_name: 'Assembly', category_name: 'Global Warming', impact_value: -5, unit: 'kg CO₂ eq' },
    { component_id: 4, component_name: 'Paint', category_name: 'Global Warming', impact_value: 10, unit: 'kg CO₂ eq' },
    // A big number in another unit must not leak into the GW contributors.
    { component_id: 4, component_name: 'Paint', category_name: 'Smog', impact_value: 5000, unit: 'kg NOₓ eq' },
  ],
  total_impacts: [
    { category_name: 'Global Warming', total_value: 35, unit: 'kg CO₂ eq' },
    { category_name: 'Smog', total_value: 5000, unit: 'kg NOₓ eq' },
  ],
  flows: [
    { component_id: 4, component_name: 'Paint', substance_name: 'NOₓ', direction: 'output', amount: 0.2, unit: 'kg' },
  ],
  goal_scope: {
    goal_statement: 'Cut CO₂ → less',
    functional_unit: '1 bike',
    system_boundary: 'cradle-to-grave',
    boundary_notes: null,
    reference_flow: 1,
    reference_flow_unit: 'bike',
    modeled_output: 1,
    per_fu_scale: 1,
  },
};

// Characters PDFKit's built-in Helvetica can draw (WinAnsi, cp1252).
const WIN_ANSI_EXTRA = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';
const drawable = (s: string) =>
  [...s].every((ch) => {
    const c = ch.codePointAt(0)!;
    return (c >= 0x20 && c <= 0x7e) || (c >= 0xa0 && c <= 0xff) || c === 0x0a || WIN_ANSI_EXTRA.includes(ch);
  });

afterEach(() => vi.restoreAllMocks());

describe('EXP-4: PDF text is folded to what Helvetica can draw', () => {
  it('folds subscripts, superscripts and symbols to ASCII', () => {
    expect(pdfSafeText('kg CO₂ eq')).toBe('kg CO2 eq');
    expect(pdfSafeText('kg NOₓ-eq')).toBe('kg NOx-eq');
    expect(pdfSafeText('CH₄ and N₂O')).toBe('CH4 and N2O');
    expect(pdfSafeText('10⁻⁶ m³')).toBe('10-6 m³');
    expect(pdfSafeText('−4.3 → 2 ≤ 3 ≥ 1 ≈ 2')).toBe('-4.3 -> 2 <= 3 >= 1 ~ 2');
  });

  it('keeps characters WinAnsi already has', () => {
    expect(pdfSafeText('µg · 5 × 2 — “ok” m² 1½')).toBe('µg · 5 × 2 — “ok” m² 1½');
  });

  it('never hands Helvetica a character it cannot draw', () => {
    expect(drawable(pdfSafeText('Ω ∑ ₐ ✓ 漢'))).toBe(true);
  });

  it('the generated report draws only WinAnsi text', () => {
    const spy = vi.spyOn(PDFDocument.prototype, 'text');
    const doc = generateAssessmentPDF(data);
    doc.end();
    const drawn = spy.mock.calls.map((c) => c[0]).filter((t): t is string => typeof t === 'string');
    expect(drawn.some((t) => t.includes('kg CO2 eq'))).toBe(true);
    const bad = drawn.filter((t) => !drawable(t));
    expect(bad).toEqual([]);
  });
});

describe('STAGE-2: steps are keyed by id, not name', () => {
  it('keeps two same-named steps apart in the headline category', () => {
    const hot = headlineSteps(data)!;
    expect(hot.headline.category_name).toBe('Global Warming');
    expect(hot.steps.map((s) => [s.id, s.name, s.value])).toEqual([
      [2, 'Assembly', 30],
      [4, 'Paint', 10],
      [3, 'Assembly', -5],
    ]);
  });

  it('puts each same-named step in its own stage', () => {
    const split = stageSplit(data)!;
    const byStage = Object.fromEntries(split.rows.map((r) => [r.stage, r.value]));
    expect(byStage).toEqual({ materials: 30, production: 10, end_of_life: -5 });
  });
});

describe('EXP-1: a legacy report says its inventory is current data', () => {
  it('prints the inventory note in the tree and flow sections', () => {
    const spy = vi.spyOn(PDFDocument.prototype, 'text');
    const doc = generateAssessmentPDF({ ...data, inventory_note: 'Recomputed from current data: the case may have changed since this run.' });
    doc.end();
    const drawn = spy.mock.calls.map((c) => String(c[0]));
    expect(drawn.filter((t) => t.includes('Recomputed from current data')).length).toBe(2);
  });

  it('prints no note for a frozen run', () => {
    const spy = vi.spyOn(PDFDocument.prototype, 'text');
    const doc = generateAssessmentPDF(data);
    doc.end();
    expect(spy.mock.calls.some((c) => String(c[0]).includes('current data'))).toBe(false);
  });
});

describe('EXP-2: PPTX top contributors use the headline category only', () => {
  it('ranks steps within the headline category, in its unit', () => {
    const top = topContributors(data)!;
    expect(top.category).toBe('Global Warming');
    expect(top.unit).toBe('kg CO₂ eq');
    expect(top.rows.map((r) => [r.name, r.value])).toEqual([
      ['Assembly', 30],
      ['Paint', 10],
      ['Assembly', -5],
    ]);
    // Shares are of the sum of absolute step values (credits included).
    expect(top.rows.map((r) => Math.round(r.share * 1000) / 10)).toEqual([66.7, 22.2, 11.1]);
  });

  it('writes the unit on the slide and never the cross-category sum', async () => {
    const buf = await generateAssessmentPPTX(data);
    const req = createRequire(require.resolve('pptxgenjs'));
    const JSZip = req('jszip');
    const zip = await JSZip.loadAsync(buf);
    const slides = await Promise.all(
      Object.keys(zip.files)
        .filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
        .map((n) => zip.file(n).async('string')),
    );
    const slide = slides.find((x: string) => x.includes('Top component contributors'))!;
    expect(slide).toBeTruthy();
    expect(slide).toContain('Global Warming');
    expect(slide).toContain('kg CO₂ eq');
    expect(slide).not.toContain('5,010'); // Paint GW 10 + Smog 5000
    expect(slide).not.toContain('5,000');
  });
});
