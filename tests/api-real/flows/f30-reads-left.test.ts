/**
 * F30. Reads left this hour (F2.2): the document-read allowance is readable
 * without using it, and each read reports what is left.
 */
import { describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { createUser } from '../support/users';

describe('F30 reads left', () => {
  it('starts at 10, a read uses one and says so, looking uses none', async () => {
    const u = await createUser('f30reads');
    const first = await api.get('/api/ingest/reads-left', { token: u.token });
    expect(first.status).toBe(200);
    expect(first.json).toEqual({ success: true, limit: 10, remaining: 10, resets_in_seconds: null });
    expect((await api.get('/api/ingest/reads-left', { token: u.token })).json.remaining).toBe(10);

    const fd = new FormData();
    fd.append('file', new File(['Part,Material,Mass (kg)\nBody,Steel,0.35\n'], 'bom.csv', { type: 'text/csv' }));
    fd.append('connector', 'bom');
    const read = await api.post('/api/ingest/preview', { token: u.token, form: fd });
    expect(read.status, read.text).toBe(200);
    expect(read.json.reads_left).toBe(9);
    expect((await api.get('/api/ingest/reads-left', { token: u.token })).json.remaining).toBe(9);
    expect((await api.get('/api/ingest/reads-left')).status).toBe(401);
  });
});
