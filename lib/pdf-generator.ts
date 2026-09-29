/**
 * PDF Report Generator for LCA Assessments
 *
 * Generates professional PDF reports from LCA assessment results.
 * Based on the LCAPIX v1 manual's reporting format:
 *   - Project & case overview
 *   - Process hierarchy summary
 *   - Environmental impact results by category
 *   - Component contribution breakdown
 *   - Flow-level details
 */

import PDFDocument from 'pdfkit';
import type { GoalScope } from './run-snapshot';
import { boundaryGaps, groupByStage, STAGE_IDS, stageLabel, stageOf } from './life-cycle';
import type { DataQualitySummary } from './lca-engine';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ReportData {
  project: {
    project_id: number;
    project_name: string;
    description: string | null;
    owner_username: string;
    created_at: string;
  };
  case_info: {
    case_id: number;
    case_name: string;
    case_type: string;
    case_description: string | null;
  };
  assessment: {
    run_id: number;
    run_name: string | null;
    run_at: string;
    calculation_method: string;
    executed_by_username: string;
  };
  components: Array<{
    component_id: number;
    component_name: string;
    component_type: string;
    hierarchy_level: number;
    quantity: string | number;
    unit: string;
    opex: number | null;
    capex: number | null;
    /** Life-cycle stage of this step (migrate-022); null reads as production. */
    life_cycle_stage?: string | null;
  }>;
  results: Array<{
    component_name: string;
    category_name: string;
    impact_value: string | number;
    unit: string;
  }>;
  total_impacts: Array<{
    category_name: string;
    total_value: number;
    unit: string;
  }>;
  flows: Array<{
    component_name: string;
    substance_name: string;
    direction: string;
    amount: string | number;
    unit: string;
  }>;
  dataSources?: {
    valuation_method: string;
    region_code: string;
    impact_factor_sources: string[];  // unique source_reference values
    cost_rate_sources: string[];      // unique cost_rates.source values
  };
  /** ISO 14044 goal & scope frozen with the run (4.2); null for runs made before it was stored. */
  goal_scope?: GoalScope | null;
  /** Data-quality statement frozen with the run (ISO 14044 4.2.3.6). */
  data_quality?: DataQualitySummary | null;
  /** The author's own reading of the result (ISO 14044 4.5 interpretation). */
  interpretation?: string | null;
  /** What the author assumed, and what they left out. */
  assumptions?: string | null;
}

export const BOUNDARY_LABEL: Record<string, string> = {
  'cradle-to-gate': 'Cradle-to-gate (raw materials to factory gate)',
  'gate-to-gate': 'Gate-to-gate (steps inside the plant)',
  'cradle-to-grave': 'Cradle-to-grave (including use and end of life)',
};

/** Label/value rows for the report's goal & scope block (PDF and PPTX share it). */
export function goalScopeRows(gs: GoalScope | null | undefined): [string, string][] {
  if (!gs) {
    return [
      ['Goal & scope', 'Not recorded for this run (made before goal & scope was stored). Re-run to record it.'],
    ];
  }
  const unit = gs.reference_flow_unit || 'unit';
  return [
    ['Functional unit', gs.functional_unit || 'Not set when this run was made'],
    ['Reference flow', `${gs.reference_flow} ${unit}`],
    ['Data basis', `${gs.modeled_output} ${unit} (the amount the entered data produce)`],
    ['System boundary', BOUNDARY_LABEL[gs.system_boundary] ?? gs.system_boundary],
    ['Exclusions & cut-off', gs.boundary_notes || 'None stated'],
    ['Goal', gs.goal_statement || 'None stated'],
  ];
}

// ============================================================================
// COLORS & STYLING
// ============================================================================

const COLORS = {
  primary: '#1a5632',      // Dark green
  secondary: '#2d8a4e',    // Medium green
  accent: '#4ade80',       // Light green
  headerBg: '#f0fdf4',     // Very light green
  tableBorder: '#d1d5db',  // Gray
  text: '#1f2937',         // Dark gray
  textLight: '#6b7280',    // Medium gray
  white: '#ffffff',
  lightGray: '#f9fafb',
  red: '#ef4444',
  blue: '#3b82f6',
};

// ============================================================================
// PDF GENERATION
// ============================================================================

export function generateAssessmentPDF(data: ReportData): PDFKit.PDFDocument {
  const doc = new PDFDocument({
    size: 'A4',
    // Buffered, so the contents page can be filled in with the page numbers the
    // sections actually landed on, and every page can get a footer.
    bufferPages: true,
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    info: {
      Title: `LCA Report - ${data.project.project_name}`,
      Author: 'LCAPIX v3',
      Subject: `Assessment Report for ${data.case_info.case_name}`,
      Creator: 'LCAPIX Life Cycle Assessment Platform',
    },
  });

  // The order ISO 14044's reporting clause expects: what the study is, what it
  // covers, what went in, what came out, what it means, what it assumed, and
  // where every number came from.
  const contents: Array<{ number: string; title: string; page: number }> = [];
  const pageNow = () => doc.bufferedPageRange().count; // 1-based page the next draw lands on
  const section = (number: string, title: string, draw: (heading: string) => void) => {
    doc.addPage();
    contents.push({ number, title, page: pageNow() });
    draw(`${number}. ${title}`);
  };

  drawCoverPage(doc, data);

  // The contents page is drawn last, once the page numbers are known.
  doc.addPage();
  const tocPageIndex = doc.bufferedPageRange().count - 1;

  section('1', 'General information', (h) => drawGeneralInformation(doc, data, h));
  section('2', 'Goal and scope', (h) => drawGoalAndScope(doc, data, h));
  section('3', 'Inventory: the process tree', (h) => drawProcessHierarchy(doc, data, h));
  section('4', 'Inventory: every flow', (h) => drawEnvironmentalFlows(doc, data, h));
  section('5', 'Impact assessment: totals', (h) => drawImpactSummary(doc, data, h));
  section('6', 'Impact assessment: by process step', (h) => drawComponentBreakdown(doc, data, h));
  section('7', 'Interpretation', (h) => drawInterpretation(doc, data, h));
  section('8', 'Assumptions and limitations', (h) => drawAssumptionsAndLimits(doc, data, h));
  if (data.dataSources) section('9', 'Sources', (h) => drawDataSources(doc, data, h));

  doc.switchToPage(tocPageIndex);
  drawTableOfContents(doc, contents);

  addPageNumbers(doc);

  return doc;
}

// ============================================================================
// COVER PAGE
// ============================================================================

function drawCoverPage(doc: PDFKit.PDFDocument, data: ReportData) {
  // Green header band
  doc.rect(0, 0, 595.28, 200).fill(COLORS.primary);

  // Title
  doc.font('Helvetica-Bold').fontSize(28).fillColor(COLORS.white);
  doc.text('Life Cycle Assessment Report', 50, 70, { width: 495 });

  doc.font('Helvetica').fontSize(14).fillColor('#a7f3d0');
  doc.text('Environmental Impact Analysis', 50, 110);

  // LCAPIX branding
  doc.font('Helvetica-Bold').fontSize(12).fillColor('#86efac');
  doc.text('LCAPIX v3', 50, 160);

  // Project details box
  doc.roundedRect(50, 240, 495, 200, 8).fill(COLORS.headerBg).stroke(COLORS.tableBorder);

  let y = 260;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.primary);
  doc.text('PROJECT', 70, y);
  y += 20;
  doc.font('Helvetica-Bold').fontSize(18).fillColor(COLORS.text);
  doc.text(data.project.project_name, 70, y, { width: 455 });
  y += 30;

  if (data.project.description) {
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.textLight);
    doc.text(data.project.description, 70, y, { width: 455 });
    y += 30;
  }

  y += 10;
  doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.primary);
  doc.text('CASE', 70, y);
  y += 18;
  doc.font('Helvetica').fontSize(14).fillColor(COLORS.text);
  doc.text(`${data.case_info.case_name} (${data.case_info.case_type})`, 70, y, {
    width: 455,
    height: 18,
    ellipsis: true,
  });

  // Assessment metadata
  y = 480;
  const assessDate = fmtDate(data.assessment.run_at);
  const items = [
    ['Assessment Run', data.assessment.run_name || `Run #${data.assessment.run_id}`],
    ['Method', data.assessment.calculation_method],
    ['Date', assessDate],
    ['Executed By', data.assessment.executed_by_username],
    ['Prepared By', data.project.owner_username],
  ];

  for (const [label, value] of items) {
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.textLight);
    doc.text(label.toUpperCase(), 70, y, { continued: false });
    doc.font('Helvetica').fontSize(10).fillColor(COLORS.text);
    doc.text(value, 200, y, { width: 325, height: 14, ellipsis: true });
    y += 18;
  }

  // ISO compliance note
  y = 700;
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.textLight);
  doc.text(
    'This report is generated in accordance with the Life Cycle Assessment methodology ' +
    'as described in ISO 14040:2006 and ISO 14044:2006 standards.',
    50, y, { width: 495, align: 'center' }
  );
}

// ============================================================================
// TABLE OF CONTENTS
// ============================================================================

function drawTableOfContents(
  doc: PDFKit.PDFDocument,
  entries: Array<{ number: string; title: string; page: number }>,
) {
  drawSectionHeader(doc, 'Contents', 50);

  let y = 130;
  for (const { number, title, page } of entries) {
    const sub = number.includes('.');
    doc.font(sub ? 'Helvetica' : 'Helvetica-Bold').fontSize(sub ? 10.5 : 11.5).fillColor(
      sub ? COLORS.textLight : COLORS.primary,
    );
    doc.text(number, sub ? 82 : 60, y, { width: 34, lineBreak: false });
    doc.font('Helvetica').fontSize(sub ? 10.5 : 11.5).fillColor(COLORS.text);
    doc.text(title, sub ? 120 : 98, y, { width: 340, lineBreak: false, ellipsis: true });
    doc.font('Helvetica').fontSize(sub ? 10.5 : 11.5).fillColor(COLORS.textLight);
    doc.text(String(page), 470, y, { width: 60, align: 'right', lineBreak: false });
    y += sub ? 20 : 24;
  }

  doc.font('Helvetica').fontSize(9).fillColor(COLORS.textLight);
  doc.text(
    'Sections follow the reporting order of ISO 14044: what the study is, what it covers, what went in, what came out, what it means, what it assumed, and where every number came from.',
    50,
    y + 18,
    { width: 495, lineGap: 3 },
  );
}

function drawGeneralInformation(doc: PDFKit.PDFDocument, data: ReportData, heading: string) {
  drawSectionHeader(doc, heading, 50);

  let y = 130;
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.textLight);
  doc.text('Who made this assessment, for what, and when.', 50, y, { width: 495, lineGap: 3 });
  y += 26;

  y = drawInfoTable(doc, [
    ['Study', data.project.project_name],
    ['Study description', data.project.description || 'Not recorded'],
    ['Case assessed', data.case_info.case_name],
    ['Case type', data.case_info.case_type.charAt(0).toUpperCase() + data.case_info.case_type.slice(1)],
    ['Prepared by', data.assessment.executed_by_username || data.project.owner_username],
    ['Run', `#${data.assessment.run_id}, ${fmtDate(data.assessment.run_at)}`],
    ['Impact method', data.assessment.calculation_method],
    ['Region', data.dataSources?.region_code || 'Global'],
    ['Software', 'LCAPIX v3'],
  ], y);

  y += 28;
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.primary);
  doc.text('What the model contains', 50, y);
  y += 22;
  drawInfoTable(doc, [
    ['Process steps', String(data.components.length)],
    ['Steps carrying flows', String(new Set(data.flows.map((f) => f.component_name)).size)],
    ['Flows (inputs and outputs)', String(data.flows.length)],
    ['Impact categories reported', String(data.total_impacts.length)],
  ], y);
}

// ============================================================================
// SECTION 2: GOAL AND SCOPE (ISO 14044 4.2)
// ============================================================================

function drawGoalAndScope(doc: PDFKit.PDFDocument, data: ReportData, heading: string) {
  drawSectionHeader(doc, heading, 50);

  let y = 130;
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.textLight);
  doc.text(
    'The question this study answers, the unit every result is measured per, and what the study covers. Frozen with the run, so this report states the scope the numbers were computed under.',
    50,
    y,
    { width: 495, lineGap: 3 },
  );
  y += 44;

  y = drawWrappedInfoTable(doc, goalScopeRows(data.goal_scope), y);

  if (data.data_quality) {
    y += 26;
    doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.primary);
    doc.text('Impact categories reported', 50, y);
    y += 22;
    const coverage = data.data_quality.category_coverage ?? [];
    const rows: [string, string][] = data.total_impacts.map((t) => {
      const cov = coverage.find((c) => c.category === t.category_name);
      return [
        t.category_name,
        cov && cov.covered < cov.total
          ? `Covers ${cov.covered} of ${cov.total} inputs; no factor for ${cov.missing_examples.join(', ')}`
          : 'Every input in this run has a factor',
      ];
    });
    drawWrappedInfoTable(doc, rows.length ? rows : [['None', 'No category was calculated']], y);
  }
}

// ============================================================================
// SECTION 2: PROCESS HIERARCHY
// ============================================================================

function drawProcessHierarchy(doc: PDFKit.PDFDocument, data: ReportData, heading: string) {
  drawSectionHeader(doc, heading, 50);

  let y = 120;
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.textLight);
  doc.text(
    'Every step of the product system, from the product down to the operations that ' +
    'make it and the tasks under them. Flows hang off these steps.',
    50, y, { width: 495 }
  );
  y += 35;

  const typeLabels: Record<string, string> = {
    product: 'Product',
    machine_line: 'Machine/Line',
    subprocess: 'Subprocess',
    operation: 'Operation',
    elemental_task: 'Task',
  };

  const typeColors: Record<string, string> = {
    product: COLORS.primary,
    machine_line: '#1d4ed8',
    subprocess: '#7c3aed',
    operation: '#c026d3',
    elemental_task: '#ea580c',
  };

  // Sort by hierarchy level
  const sorted = [...data.components].sort((a, b) => a.hierarchy_level - b.hierarchy_level);

  for (const comp of sorted) {
    if (y > 720) {
      doc.addPage();
      y = 50;
    }

    const indent = (comp.hierarchy_level - 1) * 25;
    const label = typeLabels[comp.component_type] || comp.component_type;
    const color = typeColors[comp.component_type] || COLORS.text;

    // Level indicator
    if (comp.hierarchy_level > 1) {
      doc.font('Helvetica').fontSize(8).fillColor(COLORS.textLight);
      for (let i = 1; i < comp.hierarchy_level; i++) {
        doc.text('|', 60 + (i - 1) * 25, y + 2, { width: 10 });
      }
      doc.text('--', 60 + (comp.hierarchy_level - 2) * 25 + 5, y + 2, { width: 20 });
    }

    // Component name
    doc.font('Helvetica-Bold').fontSize(10).fillColor(color);
    doc.text(comp.component_name, 70 + indent, y, { width: 250, lineBreak: false, ellipsis: true });

    // Type badge
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.textLight);
    doc.text(`[${label}]`, 350, y + 1, { width: 100, lineBreak: false, ellipsis: true });

    // Quantity
    if (comp.quantity) {
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.text);
      doc.text(`${comp.quantity} ${comp.unit || ''}`, 450, y + 1, { width: 100, lineBreak: false, ellipsis: true });
    }

    y += 22;
  }
}

// ============================================================================
// SECTION 3: IMPACT RESULTS SUMMARY
// ============================================================================

function drawImpactSummary(doc: PDFKit.PDFDocument, data: ReportData, heading: string) {
  drawSectionHeader(doc, heading, 50);

  // Results per functional unit (ISO 14044 4.3.3.2) when the case models a
  // different amount of product than one functional unit needs.
  const scale = data.goal_scope?.per_fu_scale ?? 1;
  const perFu = scale !== 1;

  let y = 120;
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.textLight);
  doc.text(
    'What the inventory adds up to, one line per impact category.' +
    (perFu
      ? ' Per functional unit = case total x reference flow / data basis (ISO 14044 4.3.3.2).'
      : data.goal_scope
        ? ' The case totals are already per functional unit (reference flow equals the data basis).'
        : ''),
    50, y, { width: 495 }
  );
  y += perFu || data.goal_scope ? 50 : 35;

  if (data.total_impacts.length === 0) {
    doc.font('Helvetica').fontSize(11).fillColor(COLORS.textLight);
    doc.text('No impact results calculated. Ensure components have environmental flows with matching driver impact factors.', 50, y, { width: 495 });
    return;
  }

  // Table header
  const colWidths = perFu ? [180, 110, 120, 85] : [220, 150, 125];
  const headers = perFu
    ? ['Impact Category', 'Case total', 'Per functional unit', 'Unit']
    : ['Impact Category', 'Value', 'Unit'];

  doc.rect(50, y, 495, 25).fill(COLORS.primary);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.white);
  let x = 60;
  headers.forEach((header, i) => {
    doc.text(header, x, y + 7, { width: colWidths[i], lineBreak: false, ellipsis: true });
    x += colWidths[i];
  });
  y += 25;

  // Table rows
  const sorted = [...data.total_impacts].sort((a, b) => b.total_value - a.total_value);

  sorted.forEach((impact, index) => {
    if (y > 720) {
      doc.addPage();
      y = 50;
    }

    const bg = index % 2 === 0 ? COLORS.lightGray : COLORS.white;
    doc.rect(50, y, 495, 22).fill(bg);

    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.text);
    doc.text(impact.category_name, 60, y + 6, { width: colWidths[0], lineBreak: false, ellipsis: true });

    doc.font('Helvetica').fontSize(9).fillColor(COLORS.text);
    const value = num(impact.total_value);
    doc.text(value, 60 + colWidths[0], y + 6, { width: colWidths[1], lineBreak: false, ellipsis: true });
    let unitX = 60 + colWidths[0] + colWidths[1];
    if (perFu) {
      doc.text(num(Number(impact.total_value) * scale), unitX, y + 6, {
        width: colWidths[2],
      });
      unitX += colWidths[2];
    }

    doc.font('Helvetica').fontSize(9).fillColor(COLORS.textLight);
    doc.text(impact.unit, unitX, y + 6, { width: colWidths[colWidths.length - 1], lineBreak: false, ellipsis: true });

    y += 22;
  });

}

// ============================================================================
// SECTION 4: COMPONENT BREAKDOWN
// ============================================================================

function headlineSteps(data: ReportData) {
  const headline =
    data.total_impacts.find((t) => /global warming|climate/i.test(t.category_name)) ?? data.total_impacts[0];
  if (!headline) return null;

  const byStep = new Map<string, number>();
  for (const r of data.results) {
    if (r.category_name !== headline.category_name) continue;
    byStep.set(r.component_name, (byStep.get(r.component_name) ?? 0) + (Number(r.impact_value) || 0));
  }
  const steps = [...byStep.entries()]
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
  const total = steps.reduce((sum, st) => sum + st.value, 0);
  return steps.length ? { headline, steps, total } : null;
}

/**
 * The headline category split by life-cycle stage, with a line saying what the
 * split means. A cradle-to-gate study lands entirely in two stages, and saying
 * so is more honest than printing one bar and calling it a life cycle.
 */
function stageSplit(data: ReportData) {
  const hot = headlineSteps(data);
  if (!hot) return null;

  const stageByStep = new Map<string, string | null>();
  for (const c of data.components) stageByStep.set(c.component_name, c.life_cycle_stage ?? null);

  const rows = groupByStage(
    hot.steps.map((s) => ({ stage: stageByStep.get(s.name) ?? null, value: s.value })),
  );
  if (!rows.length) return null;

  const declared = data.goal_scope?.system_boundary ?? null;
  const gaps = boundaryGaps(
    declared,
    STAGE_IDS.map((id) => ({
      stage: id,
      steps: [...stageByStep.values()].filter((v) => stageOf(v) === id).length,
      flows: rows.find((r) => r.stage === id) ? 1 : 0,
    })),
  );

  const note =
    rows.length === 1
      ? `Every step in this study sits in one stage: ${rows[0].label}.`
      : 'Each step counts in the stage set on it.';
  const gapNote = gaps.missing.length
    ? ` The declared boundary also covers ${gaps.missing
        .map((g) => stageLabel(g).toLowerCase())
        .join(', ')}, which this study does not model.`
    : '';

  return { headline: hot.headline, rows, note: note + gapNote };
}

function drawComponentBreakdown(doc: PDFKit.PDFDocument, data: ReportData, heading: string) {
  drawSectionHeader(doc, heading, 50);

  let y = 120;
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.textLight);
  doc.text(
    'The same totals split by process step, so it is clear where the impact is made ' +
    'and which step is worth changing.',
    50, y, { width: 495 }
  );
  y += 35;

  // What the study covers, before where the impact comes from inside it.
  const stages = stageSplit(data);
  if (stages) {
    doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.primary);
    doc.text(`${stages.headline.category_name} by life-cycle stage`, 50, y);
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.textLight);
    doc.text(stages.note, 50, y + 16, { width: 495 });
    y += 38;

    stages.rows.forEach((row) => {
      doc.font('Helvetica').fontSize(8).fillColor(COLORS.text);
      doc.text(row.label, 50, y + 4, { width: 150, lineBreak: false, ellipsis: true });
      doc.rect(205, y, 300, 14).fill(COLORS.tableBorder);
      if (row.share > 0) doc.rect(205, y, Math.max(1, 300 * row.share), 14).fill(COLORS.secondary);
      doc.font('Helvetica').fontSize(7).fillColor(COLORS.text);
      doc.text(`${num(row.value)} (${(row.share * 100).toFixed(1)}%)`, 511, y + 4, {
        width: 90,
        lineBreak: false,
      });
      y += 20;
    });
    y += 14;
  }

  // The hotspot picture before the table: it answers "which step" at a glance.
  const hot = headlineSteps(data);
  if (hot) {
    drawStepShareChart(
      doc,
      hot.headline.category_name,
      hot.steps,
      hot.headline.unit,
      Number(hot.headline.total_value) || 0,
      y,
    );
    y += 38 + Math.min(hot.steps.length, 8) * 22 + 20;
  }

  if (data.results.length === 0) {
    doc.font('Helvetica').fontSize(11).fillColor(COLORS.textLight);
    doc.text('No component-level results available.', 50, y);
    return;
  }

  // Table
  const colWidths = [140, 140, 110, 105];
  const headers = ['Component', 'Category', 'Impact Value', 'Unit'];

  if (y > 640) {
    doc.addPage();
    y = 50;
  }
  doc.rect(50, y, 495, 25).fill(COLORS.primary);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.white);
  let x = 60;
  headers.forEach((header, i) => {
    doc.text(header, x, y + 7, { width: colWidths[i], lineBreak: false, ellipsis: true });
    x += colWidths[i];
  });
  y += 25;

  data.results.forEach((result, index) => {
    if (y > 720) {
      doc.addPage();
      y = 50;
    }

    const bg = index % 2 === 0 ? COLORS.lightGray : COLORS.white;
    doc.rect(50, y, 495, 20).fill(bg);

    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.text);
    doc.text(result.component_name, 60, y + 5, { width: colWidths[0] - 10, lineBreak: false, ellipsis: true });

    doc.font('Helvetica').fontSize(8).fillColor(COLORS.text);
    doc.text(result.category_name, 60 + colWidths[0], y + 5, { width: colWidths[1] - 10, lineBreak: false, ellipsis: true });

    const val = num(result.impact_value as number | string);
    doc.text(val, 60 + colWidths[0] + colWidths[1], y + 5, { width: colWidths[2] - 10, lineBreak: false, ellipsis: true });

    doc.font('Helvetica').fontSize(8).fillColor(COLORS.textLight);
    doc.text(result.unit, 60 + colWidths[0] + colWidths[1] + colWidths[2], y + 5, { width: colWidths[3], lineBreak: false, ellipsis: true });

    y += 20;
  });
}

// ============================================================================
// SECTION 5: ENVIRONMENTAL FLOWS
// ============================================================================

function drawEnvironmentalFlows(doc: PDFKit.PDFDocument, data: ReportData, heading: string) {
  drawSectionHeader(doc, heading, 50);

  let y = 120;
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.textLight);
  doc.text(
    'Every input and output entered against a step: the data the result is computed from. ' +
    'Each row is a quantity from this case multiplied by a factor from the method.',
    50, y, { width: 495 }
  );
  y += 35;

  if (data.flows.length === 0) {
    doc.font('Helvetica').fontSize(11).fillColor(COLORS.textLight);
    doc.text('No environmental flows recorded for this assessment.', 50, y);
    return;
  }

  const colWidths = [120, 120, 70, 100, 85];
  const headers = ['Component', 'Substance', 'Direction', 'Amount', 'Unit'];

  doc.rect(50, y, 495, 25).fill(COLORS.primary);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.white);
  let x = 60;
  headers.forEach((header, i) => {
    doc.text(header, x, y + 7, { width: colWidths[i], lineBreak: false, ellipsis: true });
    x += colWidths[i];
  });
  y += 25;

  data.flows.forEach((flow, index) => {
    if (y > 720) {
      doc.addPage();
      y = 50;
    }

    const bg = index % 2 === 0 ? COLORS.lightGray : COLORS.white;
    doc.rect(50, y, 495, 20).fill(bg);

    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.text);
    doc.text(flow.component_name, 60, y + 5, { width: colWidths[0] - 10, lineBreak: false, ellipsis: true });

    doc.font('Helvetica').fontSize(8).fillColor(COLORS.text);
    doc.text(flow.substance_name, 60 + colWidths[0], y + 5, { width: colWidths[1] - 10, lineBreak: false, ellipsis: true });

    const dirColor = flow.direction === 'input' ? COLORS.blue : COLORS.red;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(dirColor);
    doc.text(flow.direction.toUpperCase(), 60 + colWidths[0] + colWidths[1], y + 5, { width: colWidths[2], lineBreak: false, ellipsis: true });

    doc.font('Helvetica').fontSize(8).fillColor(COLORS.text);
    const amount = num(flow.amount as number | string);
    doc.text(String(amount), 60 + colWidths[0] + colWidths[1] + colWidths[2], y + 5, { width: colWidths[3], lineBreak: false, ellipsis: true });

    doc.font('Helvetica').fontSize(8).fillColor(COLORS.textLight);
    doc.text(flow.unit, 60 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], y + 5, { width: colWidths[4], lineBreak: false, ellipsis: true });

    y += 20;
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/** Info table whose rows grow to fit long values (goal statements, notes). */
function drawWrappedInfoTable(
  doc: PDFKit.PDFDocument,
  rows: [string, string][],
  startY: number,
): number {
  let y = startY;
  rows.forEach(([label, value], index) => {
    doc.font('Helvetica').fontSize(9);
    const h = Math.max(22, doc.heightOfString(value, { width: 315 }) + 12);
    if (y + h > 740) {
      doc.addPage();
      y = 50;
    }
    const bg = index % 2 === 0 ? COLORS.lightGray : COLORS.white;
    doc.rect(50, y, 495, h).fill(bg);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.textLight);
    doc.text(label, 60, y + 6, { width: 160 });
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.text);
    doc.text(value, 220, y + 6, { width: 315 });
    y += h;
  });
  return y;
}

/**
 * Four significant figures, never scientific notation, no trailing zeros: a
 * number a reader can repeat with a calculator. 0.000006 stays readable and
 * 88.730000 stops pretending to six decimals of precision it does not have.
 */
function num(value: number | string): string {
  const n = typeof value === 'number' ? value : parseFloat(value);
  if (!isFinite(n)) return String(value);
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 1000) return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
  if (abs >= 1) return String(Number(n.toFixed(2)));
  return String(Number(n.toPrecision(4)));
}

/** One date format everywhere in the report. */
function fmtDate(value: string | Date): string {
  const d = new Date(value);
  if (isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function drawSectionHeader(doc: PDFKit.PDFDocument, title: string, y: number) {
  doc.rect(0, y - 10, 595.28, 45).fill(COLORS.headerBg);
  doc.moveTo(50, y + 35).lineTo(545, y + 35).stroke(COLORS.secondary);
  doc.font('Helvetica-Bold').fontSize(18).fillColor(COLORS.primary);
  doc.text(title, 50, y);
}

function drawInfoTable(
  doc: PDFKit.PDFDocument,
  rows: string[][],
  startY: number,
): number {
  let y = startY;

  rows.forEach(([label, value], index) => {
    const bg = index % 2 === 0 ? COLORS.lightGray : COLORS.white;
    doc.rect(50, y, 495, 22).fill(bg);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.textLight);
    doc.text(label, 60, y + 6, { width: 160 });
    doc.font('Helvetica').fontSize(9).fillColor(COLORS.text);
    doc.text(value, 220, y + 6, { width: 315 });
    y += 22;
  });

  return y;
}

/**
 * Shares of a single impact category by process step. One category only: two
 * categories on one axis would mean comparing kg CO2 eq with kg SO2 eq, which
 * is not a comparison, and the smaller bar is always a sliver.
 */
function drawStepShareChart(
  doc: PDFKit.PDFDocument,
  headline: string,
  steps: Array<{ name: string; value: number }>,
  unit: string,
  reportedTotal: number,
  startY: number,
) {
  const total = steps.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0 || steps.length === 0) return;

  // The per-step rows should add up to the category total. When they do not,
  // say so instead of printing a share of a number the reader cannot find.
  const covered = reportedTotal > 0 && Math.abs(total - reportedTotal) / reportedTotal > 0.005
    ? `The steps below carry ${num(total)} of the ${num(reportedTotal)} ${unit} total; the rest is not attributed to a step.`
    : `Each bar is that step's part of the ${num(total)} ${unit} total.`;

  const chartWidth = 300;
  const barHeight = 16;
  const shown = steps.slice(0, 8);

  doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.primary);
  doc.text(`Share of ${headline} by step`, 50, startY);

  doc.font('Helvetica').fontSize(8).fillColor(COLORS.textLight);
  doc.text(
    covered + (steps.length > shown.length ? ` Top ${shown.length} of ${steps.length} steps.` : ''),
    50,
    startY + 16,
    { width: 495 },
  );

  let y = startY + 38;
  shown.forEach((step) => {
    const share = step.value / total;

    doc.font('Helvetica').fontSize(8).fillColor(COLORS.text);
    doc.text(step.name, 50, y + 4, { width: 150, lineBreak: false, ellipsis: true });

    doc.rect(205, y, chartWidth, barHeight).fill(COLORS.tableBorder);
    if (share > 0) doc.rect(205, y, Math.max(1, chartWidth * share), barHeight).fill(COLORS.secondary);

    doc.font('Helvetica').fontSize(7).fillColor(COLORS.text);
    doc.text(`${(share * 100).toFixed(1)}%`, 205 + chartWidth + 6, y + 5, {
      width: 60,
      lineBreak: false,
    });

    y += barHeight + 6;
  });
}

// ============================================================================
// SECTION 6: DATA SOURCES
// ============================================================================

function drawDataSources(doc: PDFKit.PDFDocument, data: ReportData, heading: string) {
  if (!data.dataSources) return;

  drawSectionHeader(doc, heading, 50);

  let y = 120;
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.textLight);
  doc.text(
    'Where the factors and rates came from. The method and region chosen for the run ' +
    'decide which of them were applied.',
    50, y, { width: 495 }
  );
  y += 40;

  // Method + region
  const infoRows: [string, string][] = [
    ['Valuation method', data.dataSources.valuation_method],
    ['Region', data.dataSources.region_code],
  ];
  y = drawInfoTable(doc, infoRows, y);

  // Impact factor sources
  y += 25;
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.primary);
  doc.text('Characterization factor sources', 50, y);
  y += 18;
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.text);
  if (data.dataSources.impact_factor_sources.length === 0) {
    doc.text('(none recorded)', 60, y);
    y += 14;
  } else {
    for (const src of data.dataSources.impact_factor_sources) {
      if (y > 720) { doc.addPage(); y = 50; }
      doc.circle(60, y + 4, 1.5).fill(COLORS.text);
      doc.text(src, 70, y, { width: 470 });
      y += 14;
    }
  }

  // Cost rate sources
  y += 15;
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.primary);
  doc.text('Cost rate sources', 50, y);
  y += 18;
  doc.font('Helvetica').fontSize(9).fillColor(COLORS.text);
  if (data.dataSources.cost_rate_sources.length === 0) {
    doc.text('(no cost data fetched)', 60, y);
    y += 14;
  } else {
    for (const src of data.dataSources.cost_rate_sources) {
      if (y > 720) { doc.addPage(); y = 50; }
      doc.circle(60, y + 4, 1.5).fill(COLORS.text);
      doc.text(src, 70, y, { width: 470 });
      y += 14;
    }
  }

}

// ============================================================================
// SECTION 5: INTERPRETATION (ISO 14044 4.5)
// ============================================================================

/** Paragraph with sane line spacing; returns the y below it. */
function drawParagraph(doc: PDFKit.PDFDocument, text: string, y: number, opts: { muted?: boolean } = {}): number {
  if (y > 700) {
    doc.addPage();
    y = 50;
  }
  doc.font('Helvetica').fontSize(10).fillColor(opts.muted ? COLORS.textLight : COLORS.text);
  const h = doc.heightOfString(text, { width: 495, lineGap: 3 });
  doc.text(text, 50, y, { width: 495, lineGap: 3 });
  return y + h + 12;
}

function drawBullets(doc: PDFKit.PDFDocument, lines: string[], y: number): number {
  doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.text);
  for (const line of lines) {
    const h = doc.heightOfString(line, { width: 470, lineGap: 2 });
    if (y + h > 740) {
      doc.addPage();
      y = 50;
    }
    doc.circle(60, y + 5, 1.6).fill(COLORS.text);
    doc.fillColor(COLORS.text).text(line, 70, y, { width: 470, lineGap: 2 });
    y += h + 7;
  }
  return y;
}

function drawInterpretation(doc: PDFKit.PDFDocument, data: ReportData, heading: string) {
  drawSectionHeader(doc, heading, 50);

  let y = 130;
  y = drawParagraph(
    doc,
    'What the result means: what drives it, how far it can be trusted, and what would change it. The reading below is the author\'s; the figures under it are computed from this run.',
    y,
    { muted: true },
  );

  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.primary);
  doc.text("The author's reading", 50, y);
  y += 20;
  y = data.interpretation?.trim()
    ? drawParagraph(doc, data.interpretation.trim(), y)
    : drawParagraph(
        doc,
        'Not written yet. Interpretation is the part only a person can do: name what drives the result, say how far the data can be trusted, and say what you would change first.',
        y,
        { muted: true },
      );

  // What the run itself says: the steps carrying the headline category.
  const hot = headlineSteps(data);
  if (hot) {
    const { headline, total } = hot;
    y += 6;
    doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.primary);
    doc.text(`What carries ${headline.category_name}`, 50, y);
    y += 20;
    y = drawBullets(
      doc,
      hot.steps
        .slice(0, 5)
        .map(
          (st) =>
            `${st.name}: ${num(st.value)} ${headline.unit}${total > 0 ? ` (${((st.value / total) * 100).toFixed(1)}% of the total)` : ''}`,
        ),
      y,
    );
  }

  // The data-quality statement belongs to interpretation: it says how far to trust the number.
  y += 6;
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.primary);
  if (y > 700) {
    doc.addPage();
    y = 50;
  }
  doc.text('How far to trust it (ISO 14044 4.2.3.6)', 50, y);
  y += 20;
  drawBullets(
    doc,
    data.data_quality?.statement ?? [
      'Not recorded for this run (made before the data-quality statement was stored). Re-run to record it.',
    ],
    y,
  );
}

// ============================================================================
// SECTION 6: ASSUMPTIONS AND LIMITATIONS
// ============================================================================

function drawAssumptionsAndLimits(doc: PDFKit.PDFDocument, data: ReportData, heading: string) {
  drawSectionHeader(doc, heading, 50);

  let y = 130;
  y = drawParagraph(
    doc,
    'What was assumed, what was left out, and what the model cannot say. A result without this section cannot be checked by a reader.',
    y,
    { muted: true },
  );

  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.primary);
  doc.text("The author's assumptions", 50, y);
  y += 20;
  y = data.assumptions?.trim()
    ? drawParagraph(doc, data.assumptions.trim(), y)
    : drawParagraph(
        doc,
        'Not written yet. Name the amounts you estimated, the materials you modelled with a stand-in, and anything you left out on purpose.',
        y,
        { muted: true },
      );

  const limits: string[] = [];
  const gs = data.goal_scope;
  if (gs) limits.push(`Boundary: ${BOUNDARY_LABEL[gs.system_boundary] ?? gs.system_boundary}. Anything outside it is not counted.`);
  const dq = data.data_quality;
  if (dq) {
    for (const c of dq.category_coverage ?? []) {
      if (c.covered < c.total) {
        limits.push(
          `${c.category} covers ${c.covered} of ${c.total} inputs: no factor for ${c.missing_examples.join(', ')}, so that total is incomplete.`,
        );
      }
    }
    if (dq.uncharacterized_flows > 0) {
      limits.push(
        `${dq.uncharacterized_flows} flow(s) have no factor in this method and add nothing: ${dq.uncharacterized_examples.join(', ')}.`,
      );
    }
    if (dq.excluded_flows > 0) {
      limits.push(`${dq.excluded_flows} flow-category pair(s) were left out because the unit could not be converted.`);
    }
    if (dq.regional_fallbacks > 0) {
      limits.push(
        `${dq.regional_fallbacks} of ${dq.contributions} contributions used a Global factor because no regional one exists.`,
      );
    }
    const industry = dq.gw_share_by_tier?.industry_average ?? 0;
    if (industry > 0) {
      limits.push(
        `${Math.round(industry * 100)}% of the climate result rests on industry-average factors, not on this supply chain's own data.`,
      );
    }
  }
  if (!limits.length) limits.push('No limitation was recorded automatically for this run.');

  y += 6;
  if (y > 700) {
    doc.addPage();
    y = 50;
  }
  doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.primary);
  doc.text('What the model itself reports', 50, y);
  y += 20;
  drawBullets(doc, limits, y);
}

function addPageNumbers(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();
  const total = range.count; // fixed up front: writing must not grow the document
  for (let i = range.start; i < range.start + total; i++) {
    doc.switchToPage(i);

    // The footer sits below the text margin. Without this, PDFKit treats it as
    // overflow and starts a fresh page for every line, which is how an 11-page
    // report turned into 44.
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    doc.moveTo(50, doc.page.height - 45)
      .lineTo(545, doc.page.height - 45)
      .stroke(COLORS.tableBorder);

    doc.font('Helvetica').fontSize(8).fillColor(COLORS.textLight);
    doc.text(`Page ${i + 1} of ${total}`, 50, doc.page.height - 35, {
      width: 495,
      align: 'center',
      lineBreak: false,
    });

    doc.font('Helvetica').fontSize(7).fillColor(COLORS.textLight);
    doc.text('Generated by LCAPIX v3 - Life Cycle Assessment Platform', 50, doc.page.height - 22, {
      width: 300,
      lineBreak: false,
    });
    doc.text(fmtDate(new Date()), 400, doc.page.height - 22, {
      width: 145,
      align: 'right',
      lineBreak: false,
    });

    doc.page.margins.bottom = bottom;
  }
}
