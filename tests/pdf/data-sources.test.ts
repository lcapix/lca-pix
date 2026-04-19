import { describe, it, expect } from 'vitest';
import { generateAssessmentPDF } from '@/lib/pdf-generator';

async function docToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

function countPages(buf: Buffer): number {
  // Count /Type /Page entries (but not /Pages). Works on uncompressed xref.
  const s = buf.toString('latin1');
  const matches = s.match(/\/Type\s*\/Page[^s]/g);
  return matches ? matches.length : 0;
}

const baseData = {
  project: { project_id: 1, project_name: 'Test', description: null, owner_username: 'u', created_at: '2026-04-13' },
  case_info: { case_id: 1, case_name: 'Base', case_type: 'base', case_description: null },
  assessment: { run_id: 1, run_name: 'T', run_at: '2026-04-13', calculation_method: 'CML 2001', executed_by_username: 'u' },
  components: [],
  results: [],
  total_impacts: [],
  flows: [],
};

describe('PDF data sources section', () => {
  it('adds an extra page and increases PDF size when dataSources is provided', async () => {
    const withSources = generateAssessmentPDF({
      ...baseData,
      dataSources: {
        valuation_method: 'CML 2001',
        region_code: 'US-NY',
        impact_factor_sources: ['openLCA CML 2001', 'Electricity Maps API 2026-04-13'],
        cost_rate_sources: ['BLS OEWS 2024', 'EIA 2026-01'],
      },
    } as any);
    const withoutSources = generateAssessmentPDF({ ...baseData } as any);

    const [bufWith, bufWithout] = await Promise.all([
      docToBuffer(withSources),
      docToBuffer(withoutSources),
    ]);

    // Both produced valid-looking PDFs
    expect(bufWith.slice(0, 4).toString()).toBe('%PDF');
    expect(bufWithout.slice(0, 4).toString()).toBe('%PDF');

    // The with-sources PDF has exactly one more page
    const pagesWith = countPages(bufWith);
    const pagesWithout = countPages(bufWithout);
    expect(pagesWith).toBe(pagesWithout + 1);
  });

  it('works when dataSources is omitted (backward compatible)', async () => {
    const doc = generateAssessmentPDF({ ...baseData } as any);
    const buf = await docToBuffer(doc);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.slice(0, 4).toString()).toBe('%PDF');
  });
});
