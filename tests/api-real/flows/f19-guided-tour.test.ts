/**
 * F19. Guided tour. The tour itself is client-only (callouts, anchors,
 * localStorage progress: no API call), so it is covered by the E2E suite,
 * not here. What the API owes it: every read the tour's pages make
 * (home -> project -> case editor -> results) answers for a brand-new user
 * who opens the sample study (education 2.9: read-only, with its runs already
 * made), and for the copy they make of it to work in.
 */
import { describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { createUser } from '../support/users';

describe('F19 guided tour (API reads behind the tour pages)', () => {
  it('home, project, case editor and results all load for a new user with the sample study', async () => {
    const u = await createUser('f19');
    const t = u.token;
    for (const url of ['/api/auth/profile', '/api/projects', '/api/integrations/status']) {
      expect((await api.get(url, { token: t })).status, url).toBe(200);
    }
    const example = await api.post('/api/example-project', { token: t });
    expect(example.status, example.text).toBe(200);
    const pid = example.json.project_id;
    const cid = example.json.case_id;
    // The sample is read-only: its run is already there, and running it again is refused.
    expect((await api.post(`/api/cases/${cid}/assessments`, { token: t, json: {} })).status).toBe(403);
    for (const url of [
      `/api/projects/${pid}`,
      `/api/projects/${pid}/cases`,
      `/api/projects/${pid}/progress`,
      `/api/cases/${cid}`,
      `/api/cases/${cid}/components`,
      `/api/cases/${cid}/completeness`,
      `/api/cases/${cid}/assessments`,
      `/api/assessments/${example.json.run_id}`,
    ]) {
      expect((await api.get(url, { token: t })).status, url).toBe(200);
    }
    // "Make my own copy": the copy runs.
    const copy = await api.post(`/api/cases/${cid}/duplicate`, { token: t, json: { case_name: 'My bracket' } });
    expect(copy.status, copy.text).toBe(201);
    expect((await api.post(`/api/cases/${copy.json.case_id}/assessments`, { token: t, json: {} })).status).toBe(201);
  });
});
