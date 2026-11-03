// Surface spreadsheet columns a connector did NOT map, so none is left out
// silently. A structured connector recognises a handful of columns by header;
// every other column becomes a review note (with a sample value) saying its
// values are not used, and the Columns card lets the person give it a field.

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
        `. Its values are not used; to read it in, say what it holds under Columns.`,
    );
  }
  return notes;
}
