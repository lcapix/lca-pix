import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { readSheet, workbookText, limitedRange, SHEET_LIMITS } from '@/lib/ingest/sheet-reader';

const isBomHeader = (h: string) => /^(part|material|mass|qty)/i.test(h);

function book(rows: unknown[][], sheets = 1): Buffer {
  const wb = XLSX.utils.book_new();
  for (let i = 0; i < sheets; i++) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), `S${i + 1}`);
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

describe('sheet-reader limits (M6)', () => {
  it('ships bounded defaults', () => {
    expect(SHEET_LIMITS.maxRows).toBeGreaterThanOrEqual(20_000); // the ITAC ASSESS sheet fits
    expect(SHEET_LIMITS.maxRows).toBeLessThanOrEqual(100_000);
    expect(SHEET_LIMITS.maxCols).toBeLessThanOrEqual(512);
    expect(SHEET_LIMITS.maxCells).toBeLessThanOrEqual(2_000_000);
    expect(SHEET_LIMITS.maxSheets).toBeLessThanOrEqual(50);
  });

  it('clamps a declared range to the row, column and cell caps', () => {
    const ws = XLSX.utils.aoa_to_sheet([['a']]);
    ws['!ref'] = 'A1:XFD1048576'; // a tiny file can claim the whole grid
    const r = limitedRange(ws, { maxSheets: 5, maxRows: 1000, maxCols: 10, maxCells: 5000 });
    expect(r.truncated).toBe(true);
    const range = XLSX.utils.decode_range(r.range!);
    expect(range.e.c - range.s.c + 1).toBe(10);
    expect(range.e.r - range.s.r + 1).toBe(500);
  });

  it('leaves a normal range alone', () => {
    const ws = XLSX.utils.aoa_to_sheet([['Part', 'Mass'], ['Frame', 2]]);
    expect(limitedRange(ws)).toEqual({ range: 'A1:B2', truncated: false });
  });

  it('reads only up to the row cap and says so', () => {
    const rows: unknown[][] = [['Part', 'Material', 'Mass (kg)']];
    for (let i = 0; i < 40; i++) rows.push([`P${i}`, 'Steel', i + 1]);
    const read = readSheet(book(rows), 'bom.xlsx', isBomHeader, { maxSheets: 5, maxRows: 10, maxCols: 50, maxCells: 10_000 });
    expect(read).not.toBeNull();
    expect(read!.rows.length).toBeLessThanOrEqual(10);
    expect(read!.notes.join(' ')).toMatch(/first/i);
  });

  it('scans at most maxSheets sheets', () => {
    const buf = book([['nothing', 'here']], 3);
    const text = workbookText(buf, 'x.xlsx', { maxSheets: 2, maxRows: 100, maxCols: 10, maxCells: 1000 });
    expect(text).toContain('Sheet: S1');
    expect(text).toContain('Sheet: S2');
    expect(text).not.toContain('Sheet: S3');
  });
});

describe('workbookText clamps each sheet', () => {
  it('stops at the column cap', () => {
    const row = Array.from({ length: 30 }, (_, i) => `c${i}`);
    const text = workbookText(book([row]), 'x.xlsx', { maxSheets: 5, maxRows: 100, maxCols: 5, maxCells: 1000 });
    expect(text).toContain('c4');
    expect(text).not.toContain('c5');
  });
});
