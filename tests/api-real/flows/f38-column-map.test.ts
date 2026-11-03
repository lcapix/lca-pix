/**
 * F38. Which column is which (F2.3, migrate-047). A bill of materials whose
 * headers the reader does not know is not guessed at (and no model is called):
 * the preview asks, the person says what each column holds, the file reads
 * with that choice, and the project keeps it, so the next file laid out the
 * same way (any column order) reads in without asking.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { sqlOne } from '../support/db';
import { buildWorld, type World } from '../support/world';

let w: World;
beforeAll(async () => {
  w = await buildWorld({ runs: false });
});

const HEADERS = ['Item text', 'Raw stock', 'Pieces needed', 'Each weighs (kg)'];
const ROWS = [
  ['Bracket body', 'Steel', '1', '0.35'],
  ['Clip', 'Steel', '4', '0.002'],
];
const csv = (headers: string[], rows: string[][]) => [headers, ...rows].map((r) => r.join(',')).join('\n') + '\n';

function preview(token: string, body: string, fields: Record<string, string>) {
  const fd = new FormData();
  fd.append('file', new File([body], 'parts.csv', { type: 'text/csv' }));
  fd.append('connector', 'bom');
  for (const [k, v] of Object.entries(fields)) fd.append(k, v);
  return api.post('/api/ingest/preview', { token, form: fd });
}

const CHOICE = { 'Item text': 'description', 'Raw stock': 'material', 'Pieces needed': 'quantity', 'Each weighs': 'weight' };

describe('F38 which column is which', () => {
  it('headers it does not know: the preview asks, with each column and its first value', async () => {
    const res = await preview(w.users.editor.token, csv(HEADERS, ROWS), { project_id: String(w.P.id) });
    expect(res.status, res.text).toBe(200);
    expect(res.json.needs_columns).toBe(true);
    expect(res.json.plan).toBeUndefined();
    expect(res.json.message).toMatch(/It needs a name, part number or material column, and a quantity or weight column/);
    expect(res.json.column_headers).toEqual([
      { name: 'Item text', sample: 'Bracket body' },
      { name: 'Raw stock', sample: 'Steel' },
      { name: 'Pieces needed', sample: '1' },
      { name: 'Each weighs', sample: '0.35' },
    ]);
    expect(res.json.column_fields.map((f: any) => f.id)).toContain('weight');
  });

  it('read with the person’s choice: the lines come out, and the project keeps the choice', async () => {
    const res = await preview(w.users.editor.token, csv(HEADERS, ROWS), { project_id: String(w.P.id), column_map: JSON.stringify(CHOICE) });
    expect(res.status, res.text).toBe(200);
    expect(res.json.needs_columns).toBeUndefined();
    expect(res.json.columns_source).toBe('yours');
    expect(res.json.columns).toMatchObject(CHOICE);
    const flows = res.json.plan.flows as any[];
    expect(flows).toHaveLength(2);
    for (const f of flows) expect(f).toMatchObject({ substance_id: w.substances.steel, unit: 'kg', direction: 'input' });
    expect(flows.map((f) => f.quantity).sort()).toEqual([0.008, 0.35]);
    const kept = await sqlOne<any>('SELECT columns FROM import_column_map WHERE project_id = ? AND connector = ?', [w.P.id, 'bom']);
    expect(kept?.columns).toMatchObject(CHOICE);
  });

  it('the next file laid out the same way, columns in another order, reads in without asking', async () => {
    const order = [3, 0, 2, 1];
    const body = csv(order.map((i) => HEADERS[i]), ROWS.map((r) => order.map((i) => r[i])));
    const res = await preview(w.users.editor.token, body, { project_id: String(w.P.id) });
    expect(res.status, res.text).toBe(200);
    expect(res.json.columns_source).toBe('saved');
    expect(res.json.plan.flows).toHaveLength(2);
    expect(res.json.plan.notes[0]).toMatch(/^Read with the columns chosen for this layout earlier in this project/);
  });

  it('a choice naming a column the file does not have, or a field that does not exist, is left out', async () => {
    const res = await preview(w.users.editor.token, csv(HEADERS, ROWS), {
      column_map: JSON.stringify({ 'Not a column': 'material', 'Raw stock': 'colour' }),
    });
    expect(res.status, res.text).toBe(200);
    expect(res.json.needs_columns).toBe(true);
  });
});
