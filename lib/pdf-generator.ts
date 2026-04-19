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
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    info: {
      Title: `LCA Report - ${data.project.project_name}`,
      Author: 'LCAPIX v3',
      Subject: `Assessment Report for ${data.case_info.case_name}`,
      Creator: 'LCAPIX Life Cycle Assessment Platform',
    },
  });

  // ---- COVER PAGE ----
  drawCoverPage(doc, data);

  // ---- TABLE OF CONTENTS ----
  doc.addPage();
  drawTableOfContents(doc);

  // ---- SECTION 1: PROJECT OVERVIEW ----
  doc.addPage();
  drawProjectOverview(doc, data);

  // ---- SECTION 2: PROCESS HIERARCHY ----
  doc.addPage();
  drawProcessHierarchy(doc, data);

  // ---- SECTION 3: IMPACT RESULTS SUMMARY ----
  doc.addPage();
  drawImpactSummary(doc, data);

  // ---- SECTION 4: COMPONENT BREAKDOWN ----
  doc.addPage();
  drawComponentBreakdown(doc, data);

  // ---- SECTION 5: ENVIRONMENTAL FLOWS ----
  doc.addPage();
  drawEnvironmentalFlows(doc, data);

  // ---- SECTION 6: DATA SOURCES ----
  drawDataSources(doc, data);

  // ---- FOOTER ON ALL PAGES ----
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
  doc.text(`${data.case_info.case_name} (${data.case_info.case_type})`, 70, y);

  // Assessment metadata
  y = 480;
  const assessDate = new Date(data.assessment.run_at).toLocaleString();
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
    doc.text(value, 200, y);
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

function drawTableOfContents(doc: PDFKit.PDFDocument) {
  drawSectionHeader(doc, 'Table of Contents', 50);

  const entries = [
    ['1', 'Project Overview', '3'],
    ['2', 'Process Hierarchy', '4'],
    ['3', 'Impact Assessment Results', '5'],
    ['4', 'Component Contribution Breakdown', '6'],
    ['5', 'Environmental Flows Detail', '7'],
    ['6', 'Data Sources', '8'],
  ];

  let y = 120;
  for (const [num, title, page] of entries) {
    doc.font('Helvetica-Bold').fontSize(12).fillColor(COLORS.primary);
    doc.text(num + '.', 70, y, { width: 30 });
    doc.font('Helvetica').fontSize(12).fillColor(COLORS.text);
    doc.text(title, 100, y, { width: 350 });
    doc.font('Helvetica').fontSize(12).fillColor(COLORS.textLight);
    doc.text(page, 480, y, { width: 50, align: 'right' });
    y += 30;
  }
}

// ============================================================================
// SECTION 1: PROJECT OVERVIEW
// ============================================================================

function drawProjectOverview(doc: PDFKit.PDFDocument, data: ReportData) {
  drawSectionHeader(doc, '1. Project Overview', 50);

  let y = 120;

  // Project info table
  const projectRows = [
    ['Project Name', data.project.project_name],
    ['Description', data.project.description || 'N/A'],
    ['Owner', data.project.owner_username],
    ['Created', new Date(data.project.created_at).toLocaleDateString()],
    ['Case Name', data.case_info.case_name],
    ['Case Type', data.case_info.case_type.charAt(0).toUpperCase() + data.case_info.case_type.slice(1)],
    ['Assessment Method', data.assessment.calculation_method],
    ['Assessment Date', new Date(data.assessment.run_at).toLocaleString()],
  ];

  y = drawInfoTable(doc, projectRows, y);

  // Summary stats
  y += 30;
  doc.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.primary);
  doc.text('Assessment Summary', 50, y);
  y += 25;

  const stats = [
    ['Total Components', String(data.components.length)],
    ['Components with Flows', String(data.flows.length > 0 ? new Set(data.flows.map(f => f.component_name)).size : 0)],
    ['Total Flows', String(data.flows.length)],
    ['Impact Categories', String(data.total_impacts.length)],
  ];

  y = drawInfoTable(doc, stats, y);
}

// ============================================================================
// SECTION 2: PROCESS HIERARCHY
// ============================================================================

function drawProcessHierarchy(doc: PDFKit.PDFDocument, data: ReportData) {
  drawSectionHeader(doc, '2. Process Hierarchy', 50);

  let y = 120;
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.textLight);
  doc.text(
    'The process hierarchy below shows the 5-tier structure of the assessed product system, ' +
    'from the top-level product down to elemental tasks.',
    50, y, { width: 495 }
  );
  y += 35;

  const typeLabels: Record<string, string> = {
    product: 'Product',
    machine_line: 'Machine/Line',
    subprocess: 'Subprocess',
    operation: 'Operation',
    elemental_task: 'Elemental Task',
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
    doc.text(comp.component_name, 70 + indent, y, { width: 250 });

    // Type badge
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.textLight);
    doc.text(`[${label}]`, 350, y + 1, { width: 100 });

    // Quantity
    if (comp.quantity) {
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.text);
      doc.text(`${comp.quantity} ${comp.unit || ''}`, 450, y + 1, { width: 100 });
    }

    y += 22;
  }
}

// ============================================================================
// SECTION 3: IMPACT RESULTS SUMMARY
// ============================================================================

function drawImpactSummary(doc: PDFKit.PDFDocument, data: ReportData) {
  drawSectionHeader(doc, '3. Impact Assessment Results', 50);

  let y = 120;
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.textLight);
  doc.text(
    'Total environmental impacts aggregated across all components in the product system. ' +
    'Values represent the sum of all characterization factor calculations.',
    50, y, { width: 495 }
  );
  y += 35;

  if (data.total_impacts.length === 0) {
    doc.font('Helvetica').fontSize(11).fillColor(COLORS.textLight);
    doc.text('No impact results calculated. Ensure components have environmental flows with matching driver impact factors.', 50, y, { width: 495 });
    return;
  }

  // Table header
  const colWidths = [220, 150, 125];
  const headers = ['Impact Category', 'Value', 'Unit'];

  doc.rect(50, y, 495, 25).fill(COLORS.primary);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.white);
  let x = 60;
  headers.forEach((header, i) => {
    doc.text(header, x, y + 7, { width: colWidths[i] });
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
    doc.text(impact.category_name, 60, y + 6, { width: colWidths[0] });

    doc.font('Helvetica').fontSize(9).fillColor(COLORS.text);
    const value = typeof impact.total_value === 'number'
      ? impact.total_value.toFixed(6)
      : String(impact.total_value);
    doc.text(value, 60 + colWidths[0], y + 6, { width: colWidths[1] });

    doc.font('Helvetica').fontSize(9).fillColor(COLORS.textLight);
    doc.text(impact.unit, 60 + colWidths[0] + colWidths[1], y + 6, { width: colWidths[2] });

    y += 22;
  });

  // Draw bar chart visualization
  y += 20;
  if (y < 500 && sorted.length > 0) {
    drawImpactBarChart(doc, sorted, y);
  }
}

// ============================================================================
// SECTION 4: COMPONENT BREAKDOWN
// ============================================================================

function drawComponentBreakdown(doc: PDFKit.PDFDocument, data: ReportData) {
  drawSectionHeader(doc, '4. Component Contribution Breakdown', 50);

  let y = 120;
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.textLight);
  doc.text(
    'Impact values broken down by component and impact category, showing each component\'s ' +
    'contribution to the total environmental impact.',
    50, y, { width: 495 }
  );
  y += 35;

  if (data.results.length === 0) {
    doc.font('Helvetica').fontSize(11).fillColor(COLORS.textLight);
    doc.text('No component-level results available.', 50, y);
    return;
  }

  // Table
  const colWidths = [140, 140, 110, 105];
  const headers = ['Component', 'Category', 'Impact Value', 'Unit'];

  doc.rect(50, y, 495, 25).fill(COLORS.primary);
  doc.font('Helvetica-Bold').fontSize(9).fillColor(COLORS.white);
  let x = 60;
  headers.forEach((header, i) => {
    doc.text(header, x, y + 7, { width: colWidths[i] });
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
    doc.text(result.component_name, 60, y + 5, { width: colWidths[0] - 10 });

    doc.font('Helvetica').fontSize(8).fillColor(COLORS.text);
    doc.text(result.category_name, 60 + colWidths[0], y + 5, { width: colWidths[1] - 10 });

    const val = typeof result.impact_value === 'number'
      ? result.impact_value.toFixed(6)
      : parseFloat(result.impact_value as string).toFixed(6);
    doc.text(val, 60 + colWidths[0] + colWidths[1], y + 5, { width: colWidths[2] - 10 });

    doc.font('Helvetica').fontSize(8).fillColor(COLORS.textLight);
    doc.text(result.unit, 60 + colWidths[0] + colWidths[1] + colWidths[2], y + 5, { width: colWidths[3] });

    y += 20;
  });
}

// ============================================================================
// SECTION 5: ENVIRONMENTAL FLOWS
// ============================================================================

function drawEnvironmentalFlows(doc: PDFKit.PDFDocument, data: ReportData) {
  drawSectionHeader(doc, '5. Environmental Flows Detail', 50);

  let y = 120;
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.textLight);
  doc.text(
    'Detailed listing of all environmental flows (inputs and outputs) associated with each component. ' +
    'These flows represent the inventory data used for impact calculation.',
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
    doc.text(header, x, y + 7, { width: colWidths[i] });
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
    doc.text(flow.component_name, 60, y + 5, { width: colWidths[0] - 10 });

    doc.font('Helvetica').fontSize(8).fillColor(COLORS.text);
    doc.text(flow.substance_name, 60 + colWidths[0], y + 5, { width: colWidths[1] - 10 });

    const dirColor = flow.direction === 'input' ? COLORS.blue : COLORS.red;
    doc.font('Helvetica-Bold').fontSize(8).fillColor(dirColor);
    doc.text(flow.direction.toUpperCase(), 60 + colWidths[0] + colWidths[1], y + 5, { width: colWidths[2] });

    doc.font('Helvetica').fontSize(8).fillColor(COLORS.text);
    const amount = typeof flow.amount === 'number' ? flow.amount.toFixed(4) : flow.amount;
    doc.text(String(amount), 60 + colWidths[0] + colWidths[1] + colWidths[2], y + 5, { width: colWidths[3] });

    doc.font('Helvetica').fontSize(8).fillColor(COLORS.textLight);
    doc.text(flow.unit, 60 + colWidths[0] + colWidths[1] + colWidths[2] + colWidths[3], y + 5, { width: colWidths[4] });

    y += 20;
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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

function drawImpactBarChart(
  doc: PDFKit.PDFDocument,
  impacts: Array<{ category_name: string; total_value: number; unit: string }>,
  startY: number,
) {
  const chartWidth = 400;
  const barHeight = 20;
  const maxValue = Math.max(...impacts.map(i => i.total_value));
  const chartHeight = impacts.length * (barHeight + 8) + 30;

  doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.primary);
  doc.text('Impact Distribution', 50, startY);
  let y = startY + 25;

  impacts.forEach((impact) => {
    const barWidth = maxValue > 0 ? (impact.total_value / maxValue) * chartWidth : 0;

    // Label
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.text);
    const shortName = impact.category_name.length > 25
      ? impact.category_name.substring(0, 22) + '...'
      : impact.category_name;
    doc.text(shortName, 50, y + 4, { width: 130 });

    // Bar
    if (barWidth > 0) {
      doc.rect(185, y, barWidth * 0.75, barHeight).fill(COLORS.secondary);
    }

    // Value
    doc.font('Helvetica').fontSize(7).fillColor(COLORS.text);
    doc.text(impact.total_value.toFixed(4), 185 + barWidth * 0.75 + 5, y + 5, { width: 100 });

    y += barHeight + 8;
  });
}

// ============================================================================
// SECTION 6: DATA SOURCES
// ============================================================================

function drawDataSources(doc: PDFKit.PDFDocument, data: ReportData) {
  if (!data.dataSources) return;

  doc.addPage();
  drawSectionHeader(doc, '6. Data Sources', 50);

  let y = 120;
  doc.font('Helvetica').fontSize(10).fillColor(COLORS.textLight);
  doc.text(
    'The following external data sources were used to compute the results in this report. ' +
    'Method and region selection affect which characterization factors and cost rates were applied.',
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

function addPageNumbers(doc: PDFKit.PDFDocument) {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.textLight);
    doc.text(
      `Page ${i + 1} of ${range.count}`,
      50,
      doc.page.height - 35,
      { width: 495, align: 'center' }
    );

    // Footer line
    doc.moveTo(50, doc.page.height - 45)
      .lineTo(545, doc.page.height - 45)
      .stroke(COLORS.tableBorder);

    // Footer branding
    doc.font('Helvetica').fontSize(7).fillColor(COLORS.textLight);
    doc.text('Generated by LCAPIX v3 - Life Cycle Assessment Platform', 50, doc.page.height - 25, { width: 300 });
    doc.text(new Date().toISOString().split('T')[0], 400, doc.page.height - 25, { width: 145, align: 'right' });
  }
}
