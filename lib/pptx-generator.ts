/**
 * PowerPoint Report Generator for LCA Assessments
 *
 * Builds a committee-ready .pptx deck from the same ReportData the PDF report
 * uses. Users present LCA results to committees; PDFs are hard to edit, so a
 * native PowerPoint export lets them drop slides straight into a presentation.
 *
 * Slides:
 *   1. Title — project / case / method / date
 *   2. Total environmental impact by category (table)
 *   3. Top component contributors (table)
 *   4. Cost summary (opex / capex / total)
 *   5. Methodology & data sources (ISO 14040/14044 attribution)
 */

import PptxGenJS from 'pptxgenjs';
import type { ReportData } from './pdf-generator';

const BRAND = {
  primary: '1A5632',
  secondary: '2D8A4E',
  text: '1F2937',
  textLight: '6B7280',
  headerBg: 'F0FDF4',
  white: 'FFFFFF',
  border: 'D1D5DB',
}

function fmtNum(v: number, dp = 2): string {
  if (!isFinite(v)) return '0'
  if (v !== 0 && Math.abs(v) < 0.01) return v.toExponential(2)
  return v.toLocaleString(undefined, { maximumFractionDigits: dp })
}

function fmtMoney(v: number): string {
  return `$${v.toLocaleString(undefined, { maximumFractionDigits: v >= 1000 ? 0 : 2 })}`
}

/** Generate a .pptx and return it as a Node Buffer. */
export async function generateAssessmentPPTX(data: ReportData): Promise<Buffer> {
  const pptx = new PptxGenJS()
  pptx.author = 'LCAPIX'
  pptx.company = 'LCAPIX'
  pptx.title = `${data.project.project_name} — LCA Report`
  pptx.layout = 'LAYOUT_WIDE' // 13.33 × 7.5 in

  const runDate = data.assessment.run_at
    ? new Date(data.assessment.run_at).toLocaleDateString()
    : '—'

  // ─── Slide 1: Title ────────────────────────────────────────────────────────
  const title = pptx.addSlide()
  title.background = { color: BRAND.headerBg }
  title.addText('Life Cycle Assessment Report', {
    x: 0.6, y: 1.6, w: 12.1, h: 0.6,
    fontSize: 14, color: BRAND.secondary, bold: true, charSpacing: 2,
  })
  title.addText(data.project.project_name, {
    x: 0.6, y: 2.2, w: 12.1, h: 1.0,
    fontSize: 40, color: BRAND.primary, bold: true,
  })
  title.addText(
    [
      { text: `Case: `, options: { color: BRAND.textLight } },
      { text: `${data.case_info.case_name}  (${data.case_info.case_type})`, options: { color: BRAND.text, bold: true } },
    ],
    { x: 0.6, y: 3.4, w: 12.1, h: 0.5, fontSize: 18 },
  )
  title.addText(
    `Method: ${data.assessment.calculation_method}   ·   Run: ${data.assessment.run_name ?? `#${data.assessment.run_id}`}   ·   ${runDate}`,
    { x: 0.6, y: 4.0, w: 12.1, h: 0.5, fontSize: 14, color: BRAND.textLight },
  )
  title.addText(
    `Prepared by ${data.assessment.executed_by_username}  ·  Generated with LCAPIX`,
    { x: 0.6, y: 6.7, w: 12.1, h: 0.4, fontSize: 11, color: BRAND.textLight, italic: true },
  )

  // ─── Slide 2: Impact by category ────────────────────────────────────────────
  const impactSlide = pptx.addSlide()
  slideHeader(impactSlide, 'Environmental load by impact category')
  const impactRows: PptxGenJS.TableRow[] = [
    headerRow(['Impact category', 'Total value', 'Unit']),
  ]
  const sortedImpacts = [...data.total_impacts].sort((a, b) => b.total_value - a.total_value)
  if (sortedImpacts.length === 0) {
    impactRows.push([cell('No impact results in this run.', { colspan: 3, italic: true })])
  } else {
    sortedImpacts.forEach((imp, i) => {
      impactRows.push([
        cell(imp.category_name),
        cell(fmtNum(imp.total_value, 4), { align: 'right' }),
        cell(imp.unit, { color: BRAND.textLight }),
      ], i)
    })
  }
  impactSlide.addTable(impactRows, {
    x: 0.6, y: 1.5, w: 12.1, colW: [6.6, 3.0, 2.5],
    border: { type: 'solid', color: BRAND.border, pt: 0.5 },
    fontSize: 13, valign: 'middle',
  })

  // ─── Slide 3: Top contributors ──────────────────────────────────────────────
  const contribSlide = pptx.addSlide()
  slideHeader(contribSlide, 'Top component contributors')
  // Aggregate each component's total impact across categories.
  const compTotals = new Map<string, number>()
  for (const r of data.results) {
    const v = typeof r.impact_value === 'string' ? parseFloat(r.impact_value) : r.impact_value
    compTotals.set(r.component_name, (compTotals.get(r.component_name) ?? 0) + (v || 0))
  }
  const ranked = Array.from(compTotals.entries())
    .map(([name, value]) => ({ name, value }))
    .filter((c) => c.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)
  const grand = ranked.reduce((s, c) => s + c.value, 0) || 1
  const contribRows: PptxGenJS.TableRow[] = [
    headerRow(['#', 'Component', 'Impact', 'Share']),
  ]
  if (ranked.length === 0) {
    contribRows.push([cell('No component impacts in this run.', { colspan: 4, italic: true })])
  } else {
    ranked.forEach((c, i) => {
      contribRows.push([
        cell(String(i + 1), { color: BRAND.textLight }),
        cell(c.name),
        cell(fmtNum(c.value, 3), { align: 'right' }),
        cell(`${((c.value / grand) * 100).toFixed(1)}%`, { align: 'right', bold: true, color: BRAND.secondary }),
      ], i)
    })
  }
  contribSlide.addTable(contribRows, {
    x: 0.6, y: 1.5, w: 12.1, colW: [0.8, 7.3, 2.0, 2.0],
    border: { type: 'solid', color: BRAND.border, pt: 0.5 },
    fontSize: 13, valign: 'middle',
  })

  // ─── Slide 4: Cost summary ──────────────────────────────────────────────────
  const costSlide = pptx.addSlide()
  slideHeader(costSlide, 'Cost summary')
  const totalOpex = data.components.reduce((s, c) => s + (Number(c.opex) || 0), 0)
  const totalCapex = data.components.reduce((s, c) => s + (Number(c.capex) || 0), 0)
  const totalCost = totalOpex + totalCapex
  // Three KPI cards.
  const cards: Array<[string, string]> = [
    ['Operational (OPEX)', fmtMoney(totalOpex)],
    ['Capital (CAPEX)', fmtMoney(totalCapex)],
    ['Total cost', fmtMoney(totalCost)],
  ]
  cards.forEach(([label, value], i) => {
    const x = 0.6 + i * 4.13
    costSlide.addShape('roundRect', {
      x, y: 1.8, w: 3.8, h: 2.0, fill: { color: BRAND.headerBg },
      line: { color: BRAND.border, width: 0.5 }, rectRadius: 0.1,
    })
    costSlide.addText(label, {
      x: x + 0.2, y: 2.0, w: 3.4, h: 0.5, fontSize: 13, color: BRAND.textLight, bold: true,
    })
    costSlide.addText(value, {
      x: x + 0.2, y: 2.6, w: 3.4, h: 0.9, fontSize: 30, color: BRAND.primary, bold: true,
    })
  })
  costSlide.addText(
    'Activity-based costs aggregated across all components in the case. Pair with the impact slide to weigh the cost ↔ environmental-load trade-off.',
    { x: 0.6, y: 4.2, w: 12.1, h: 0.8, fontSize: 12, color: BRAND.textLight, italic: true },
  )

  // ─── Slide 5: Methodology & data sources ────────────────────────────────────
  const methodSlide = pptx.addSlide()
  slideHeader(methodSlide, 'Methodology & data sources')
  const ds = data.dataSources
  const lines: string[] = [
    `Valuation method: ${ds?.valuation_method ?? data.assessment.calculation_method}`,
    `Geographic scope: ${ds?.region_code ?? 'Global'}`,
  ]
  if (ds?.impact_factor_sources?.length) {
    lines.push(`Impact factor sources: ${ds.impact_factor_sources.join(', ')}`)
  }
  if (ds?.cost_rate_sources?.length) {
    lines.push(`Cost rate sources: ${ds.cost_rate_sources.join(', ')}`)
  }
  methodSlide.addText(
    lines.map((t) => ({ text: t, options: { bullet: true, color: BRAND.text } })),
    { x: 0.6, y: 1.5, w: 12.1, h: 3.0, fontSize: 15, lineSpacingMultiple: 1.4 },
  )
  methodSlide.addText(
    'This assessment follows ISO 14040 / 14044 life-cycle-assessment principles. Results are indicative and depend on the inventory data and characterization factors of the selected method and region.',
    { x: 0.6, y: 5.8, w: 12.1, h: 1.0, fontSize: 11, color: BRAND.textLight, italic: true },
  )

  // pptxgenjs returns ArrayBuffer/Uint8Array with nodebuffer; coerce to Buffer.
  const out = (await pptx.write({ outputType: 'nodebuffer' })) as unknown as Buffer
  return out
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slideHeader(slide: PptxGenJS.Slide, text: string) {
  slide.addText(text, {
    x: 0.6, y: 0.5, w: 12.1, h: 0.7, fontSize: 24, bold: true, color: BRAND.primary,
  })
  slide.addShape('line', {
    x: 0.6, y: 1.3, w: 12.1, h: 0, line: { color: BRAND.secondary, width: 1.5 },
  })
}

function headerRow(labels: string[]): PptxGenJS.TableRow {
  return labels.map((l) => ({
    text: l,
    options: {
      bold: true,
      color: BRAND.white,
      fill: { color: BRAND.primary },
      fontSize: 13,
      align: 'left' as const,
      valign: 'middle' as const,
    },
  }))
}

function cell(
  text: string,
  opts: { align?: 'left' | 'right' | 'center'; bold?: boolean; color?: string; italic?: boolean; colspan?: number } = {},
  rowIndex?: number,
): PptxGenJS.TableCell {
  return {
    text,
    options: {
      align: opts.align ?? 'left',
      bold: opts.bold ?? false,
      italic: opts.italic ?? false,
      color: opts.color ?? BRAND.text,
      colspan: opts.colspan,
      fontSize: 12,
      valign: 'middle',
      fill: { color: rowIndex !== undefined && rowIndex % 2 === 1 ? 'F9FAFB' : BRAND.white },
    },
  }
}
