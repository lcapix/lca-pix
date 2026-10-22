/**
 * F31. Pinned projects (migrate-041, E19): a member pins a project for
 * themselves only; pin and unpin are idempotent; at most 20; leaving a
 * project drops the pin; an outsider cannot pin.
 */
import { beforeAll, describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { sql } from '../support/db';
import { buildWorld, createProject, type World } from '../support/world';
import { createUser } from '../support/users';

let w: World;
beforeAll(async () => {
  w = await buildWorld({ runs: false });
});

const pinnedIn = async (token: string, projectId: number) =>
  (await api.get('/api/projects', { token })).json.projects.find((p: any) => p.project_id === projectId)?.pinned;

describe('F31 pins', () => {
  it("pinning is the caller's own and idempotent; unpin likewise", async () => {
    const t = w.users.viewer.token;
    expect((await api.put(`/api/projects/${w.P.id}/pin`, { token: t })).status).toBe(200);
    expect((await api.put(`/api/projects/${w.P.id}/pin`, { token: t })).status).toBe(200);
    expect(await pinnedIn(t, w.P.id)).toBe(true);
    expect(await pinnedIn(w.users.owner.token, w.P.id)).toBe(false);
    expect((await sql('SELECT COUNT(*) AS n FROM project_pins WHERE user_id = ?', [w.users.viewer.id]))[0].n).toBe(1);
    expect((await api.delete(`/api/projects/${w.P.id}/pin`, { token: t })).status).toBe(200);
    expect((await api.delete(`/api/projects/${w.P.id}/pin`, { token: t })).status).toBe(200);
    expect(await pinnedIn(t, w.P.id)).toBe(false);
  });

  it('an outsider gets 404 and pins nothing', async () => {
    expect((await api.put(`/api/projects/${w.P.id}/pin`, { token: w.users.nonmem.token })).status).toBe(404);
    expect((await api.put(`/api/projects/${w.Q.id}/pin`, { token: w.users.editor.token })).status).toBe(404);
    expect(await sql('SELECT * FROM project_pins WHERE user_id IN (?, ?)', [w.users.nonmem.id, w.users.editor.id])).toEqual([]);
  });

  it('at most 20 pins', async () => {
    const u = await createUser('f31many');
    const ids: number[] = [];
    for (let i = 0; i < 21; i++) ids.push(await createProject(u, `Pin ${i} ${w.tag}`));
    for (const id of ids.slice(0, 20)) expect((await api.put(`/api/projects/${id}/pin`, { token: u.token })).status).toBe(200);
    const over = await api.put(`/api/projects/${ids[20]}/pin`, { token: u.token });
    expect(over.status).toBe(409);
    expect(over.json.error).toBe('You can pin up to 20 projects. Unpin one first.');
    // Re-pinning one already pinned is still fine at the cap.
    expect((await api.put(`/api/projects/${ids[0]}/pin`, { token: u.token })).status).toBe(200);
  });

  it('leaving a project drops the pin', async () => {
    const t = w.users.editor.token;
    expect((await api.put(`/api/projects/${w.P.id}/pin`, { token: t })).status).toBe(200);
    const removed = await api.delete(`/api/projects/${w.P.id}/members?user_id=${w.users.editor.id}`, { token: w.users.owner.token });
    expect(removed.status, removed.text).toBe(200);
    expect(await sql('SELECT * FROM project_pins WHERE user_id = ? AND project_id = ?', [w.users.editor.id, w.P.id])).toEqual([]);
  });
});
