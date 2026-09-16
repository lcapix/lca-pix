// Surface spreadsheet columns a connector did NOT map, so no data is silently
// lost. A structured connector recognises a handful of columns by header; every
// other column becomes a review note (with a sample value) telling the user
// exactly what was left on the table, so they can ask us to map it.

export function unmappedColumnNotes(
  rows: Array<Record<string, unknown>>,
  usedHeaders: Array<string | undefined>,
): string[] {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const used = new Set(usedHeaders.filter(Boolean) as string[]);
  const notes: string[] = [];
  for (const h of headers) {
    if (used.has(h) || h.startsWith('__')) continue; // __row etc. are reader bookkeeping
    // First non-empty sample value, so the user sees what the column holds.
    let sample = '';
    for (const r of rows) {
      const v = r[h];
      if (v !== null && v !== undefined && String(v).trim() !== '') {
        sample = String(v).trim();
        break;
      }
    }
    notes.push(
      `Column "${h}" was read but not mapped${sample ? ` (e.g. "${sample.slice(0, 40)}")` : ''}` +
        ` — if it holds material, quantity, unit, cost, or sub-assembly data we should use, say so; it is not lost.`,
    );
  }
  return notes;
}
