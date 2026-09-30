/**
 * F19. Guided tour. The tour itself is client-only (callouts, anchors,
 * localStorage progress: no API call), so it is covered by the E2E suite,
 * not here. What the API owes it: every read the tour's pages make
 * (home -> project -> case editor -> results) answers for a brand-new user
 * who opens the worked example, which is how the tour starts from an empty
 * dashboard.
 */
import { describe, expect, it } from 'vitest';
import { api } from '../support/api';
import { createUser } from '../support/users';

describe('F19 guided tour (API reads behind the tour pages)', () => {
  it('home, project, case editor and results all load for a new user with the worked example', async () => {
    const u = await createUser('f19');
    const t = u.token;
    for (const url of ['/api/auth/profile', '/api/projects', '/api/integrations/status']) {
      expect((await api.get(url, { token: t })).status, url).toBe(200);
    }
    const example = await api.post('/api/example-project', { token: t });
    const pid = example.json.project_id;
    const cid = example.json.case_id;
    const run = await api.post(`/api/cases/${cid}/assessments`, { token: t, json: {} });
    expect(run.status).toBe(201);
    for (const url of [
      `/api/projects/${pid}`,
      `/api/projects/${pid}/cases`,
      `/api/cases/${cid}`,
      `/api/cases/${cid}/components`,
      `/api/cases/${cid}/completeness`,
      `/api/cases/${cid}/assessments`,
      `/api/assessments/${run.json.run_id}`,
    ]) {
      expect((await api.get(url, { token: t })).status, url).toBe(200);
    }
  });
});
