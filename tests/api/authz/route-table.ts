/**
 * Every project-scoped API handler, with what the authz tests need to call it:
 * a request that reaches the access check, the role it requires, and the body
 * it sends for a missing resource (a non-member must get exactly that).
 *
 * `owner: 'other'` marks route files another agent is editing on a parallel
 * branch; this branch does not change them. Tests for those use `it.fails`
 * where the route does not follow the policy yet, so the suite goes red (as a
 * reminder to flip `it.fails` to `it`) once the one-line change lands.
 */
import { NextRequest } from 'next/server';

export type Level = 'viewer' | 'editor' | 'admin' | 'owner';
type Handler = (req: any, ctx: any) => Promise<Response>;

export interface RouteCase {
  name: string;
  load: () => Promise<Handler>;
  method: string;
  url: string;
  params?: Record<string, string>;
  json?: unknown;
  form?: () => FormData;
  /** Required project role; undefined = any member. */
  level?: Level;
  /** error text for a missing resource (and so for a non-member). */
  notFound: string;
  /** Another agent owns the file. */
  owner?: 'other';
  /** The file does not follow the 404 policy yet (other agent to change it). */
  pending404?: boolean;
  /**
   * The file answers 500 instead of 401 for some auth failures (other agent to
   * change it): 'account' = unknown or deactivated account, 'all' = every one.
   */
  pending401?: 'account' | 'all';
}

const nodes = [
  { name: 'Bike', tier: 'product', parent: null, quantity: 1, unit: 'unit' },
  { name: 'Weld', tier: 'operation', parent: 'Bike', description: '', quantity: null, unit: null },
];

export function equipmentForm(): FormData {
  const fd = new FormData();
  fd.append('file', new File(['Work center,Machine,kW\nWC1,Lathe,5\n'], 'machines.csv', { type: 'text/csv' }));
  fd.append('connector', 'equipment');
  fd.append('target_case_id', '3');
  return fd;
}

export const PROJECT_ROUTES: RouteCase[] = [
  // ── project ────────────────────────────────────────────────────────────────
  { name: 'GET /api/projects/:id', load: async () => (await import('@/app/api/projects/[projectId]/route')).GET,
    method: 'GET', url: '/api/projects/7', params: { projectId: '7' }, notFound: 'Project not found' },
  { name: 'PUT /api/projects/:id', load: async () => (await import('@/app/api/projects/[projectId]/route')).PUT,
    method: 'PUT', url: '/api/projects/7', params: { projectId: '7' }, json: { project_name: 'x' }, level: 'admin', notFound: 'Project not found' },
  { name: 'DELETE /api/projects/:id', load: async () => (await import('@/app/api/projects/[projectId]/route')).DELETE,
    method: 'DELETE', url: '/api/projects/7', params: { projectId: '7' }, level: 'owner', notFound: 'Project not found' },
  { name: 'GET /api/projects/:id/cases', load: async () => (await import('@/app/api/projects/[projectId]/cases/route')).GET,
    method: 'GET', url: '/api/projects/7/cases', params: { projectId: '7' }, notFound: 'Project not found' },
  { name: 'POST /api/projects/:id/cases', load: async () => (await import('@/app/api/projects/[projectId]/cases/route')).POST,
    method: 'POST', url: '/api/projects/7/cases', params: { projectId: '7' }, json: { case_name: 'x', case_type: 'base' }, level: 'editor', notFound: 'Project not found' },
  { name: 'GET /api/projects/:id/progress', load: async () => (await import('@/app/api/projects/[projectId]/progress/route')).GET,
    method: 'GET', url: '/api/projects/7/progress', params: { projectId: '7' }, notFound: 'Project not found' },
  { name: 'GET /api/projects/:id/members', load: async () => (await import('@/app/api/projects/[projectId]/members/route')).GET,
    method: 'GET', url: '/api/projects/7/members', params: { projectId: '7' }, notFound: 'Project not found', owner: 'other', pending404: true, pending401: 'account' },
  { name: 'POST /api/projects/:id/members', load: async () => (await import('@/app/api/projects/[projectId]/members/route')).POST,
    method: 'POST', url: '/api/projects/7/members', params: { projectId: '7' }, json: { email: 'b@corp.com', role: 'viewer' }, level: 'admin', notFound: 'Project not found', owner: 'other', pending404: true, pending401: 'account' },
  { name: 'DELETE /api/projects/:id/members', load: async () => (await import('@/app/api/projects/[projectId]/members/route')).DELETE,
    method: 'DELETE', url: '/api/projects/7/members?user_id=12', params: { projectId: '7' }, level: 'admin', notFound: 'Project not found', owner: 'other', pending404: true, pending401: 'account' },

  // ── case ───────────────────────────────────────────────────────────────────
  { name: 'GET /api/cases/:id', load: async () => (await import('@/app/api/cases/[caseId]/route')).GET,
    method: 'GET', url: '/api/cases/3', params: { caseId: '3' }, notFound: 'Case not found' },
  { name: 'PUT /api/cases/:id', load: async () => (await import('@/app/api/cases/[caseId]/route')).PUT,
    method: 'PUT', url: '/api/cases/3', params: { caseId: '3' }, json: { case_name: 'x' }, level: 'editor', notFound: 'Case not found' },
  { name: 'DELETE /api/cases/:id', load: async () => (await import('@/app/api/cases/[caseId]/route')).DELETE,
    method: 'DELETE', url: '/api/cases/3', params: { caseId: '3' }, level: 'admin', notFound: 'Case not found' },
  { name: 'GET /api/cases/:id/completeness', load: async () => (await import('@/app/api/cases/[caseId]/completeness/route')).GET,
    method: 'GET', url: '/api/cases/3/completeness', params: { caseId: '3' }, notFound: 'Case not found' },
  { name: 'GET /api/cases/:id/components', load: async () => (await import('@/app/api/cases/[caseId]/components/route')).GET,
    method: 'GET', url: '/api/cases/3/components', params: { caseId: '3' }, notFound: 'Case not found' },
  { name: 'POST /api/cases/:id/components', load: async () => (await import('@/app/api/cases/[caseId]/components/route')).POST,
    method: 'POST', url: '/api/cases/3/components', params: { caseId: '3' }, json: { component_name: 'x', component_type: 'operation' }, level: 'editor', notFound: 'Case not found' },
  { name: 'POST /api/cases/:id/duplicate', load: async () => (await import('@/app/api/cases/[caseId]/duplicate/route')).POST,
    method: 'POST', url: '/api/cases/3/duplicate', params: { caseId: '3' }, json: {}, level: 'editor', notFound: 'Case not found' },
  { name: 'POST /api/cases/:id/scale', load: async () => (await import('@/app/api/cases/[caseId]/scale/route')).POST,
    method: 'POST', url: '/api/cases/3/scale', params: { caseId: '3' }, json: { from: 1, to: 2, mode: 'scale-inputs' }, level: 'editor', notFound: 'Case not found' },
  { name: 'POST /api/cases/:id/clone-from', load: async () => (await import('@/app/api/cases/[caseId]/clone-from/route')).POST,
    method: 'POST', url: '/api/cases/3/clone-from', params: { caseId: '3' }, json: { sourceCaseId: 4 }, level: 'editor', notFound: 'Case not found' },

  // ── document ───────────────────────────────────────────────────────────────
  { name: 'GET /api/cases/:id/documents', load: async () => (await import('@/app/api/cases/[caseId]/documents/route')).GET,
    method: 'GET', url: '/api/cases/3/documents', params: { caseId: '3' }, notFound: 'Case not found', owner: 'other', pending404: true, pending401: 'account' },
  { name: 'DELETE /api/cases/:id/documents', load: async () => (await import('@/app/api/cases/[caseId]/documents/route')).DELETE,
    method: 'DELETE', url: '/api/cases/3/documents?id=2', params: { caseId: '3' }, level: 'editor', notFound: 'Case not found', owner: 'other', pending404: true, pending401: 'account' },

  // ── component ──────────────────────────────────────────────────────────────
  { name: 'GET /api/components/:id', load: async () => (await import('@/app/api/components/[componentId]/route')).GET,
    method: 'GET', url: '/api/components/5', params: { componentId: '5' }, notFound: 'Component not found' },
  { name: 'PUT /api/components/:id', load: async () => (await import('@/app/api/components/[componentId]/route')).PUT,
    method: 'PUT', url: '/api/components/5', params: { componentId: '5' }, json: { component_name: 'x' }, level: 'editor', notFound: 'Component not found' },
  { name: 'DELETE /api/components/:id', load: async () => (await import('@/app/api/components/[componentId]/route')).DELETE,
    method: 'DELETE', url: '/api/components/5', params: { componentId: '5' }, level: 'editor', notFound: 'Component not found' },
  { name: 'GET /api/components/:id/flows', load: async () => (await import('@/app/api/components/[componentId]/flows/route')).GET,
    method: 'GET', url: '/api/components/5/flows', params: { componentId: '5' }, notFound: 'Component not found' },
  { name: 'POST /api/components/:id/flows', load: async () => (await import('@/app/api/components/[componentId]/flows/route')).POST,
    method: 'POST', url: '/api/components/5/flows', params: { componentId: '5' }, json: { substance_id: 1, flow_type: 'input', quantity: 1, unit: 'kg' }, level: 'editor', notFound: 'Component not found' },
  { name: 'POST /api/components/:id/auto-costs', load: async () => (await import('@/app/api/components/[componentId]/auto-costs/route')).POST,
    method: 'POST', url: '/api/components/5/auto-costs', params: { componentId: '5' }, level: 'editor', notFound: 'Component not found' },

  // ── flow ───────────────────────────────────────────────────────────────────
  { name: 'PUT /api/flows/:id', load: async () => (await import('@/app/api/flows/[flowId]/route')).PUT,
    method: 'PUT', url: '/api/flows/6', params: { flowId: '6' }, json: { quantity: 2 }, level: 'editor', notFound: 'Flow not found' },
  { name: 'DELETE /api/flows/:id', load: async () => (await import('@/app/api/flows/[flowId]/route')).DELETE,
    method: 'DELETE', url: '/api/flows/6', params: { flowId: '6' }, level: 'editor', notFound: 'Flow not found' },

  // ── run ────────────────────────────────────────────────────────────────────
  { name: 'GET /api/assessments/:runId', load: async () => (await import('@/app/api/assessments/[runId]/route')).GET,
    method: 'GET', url: '/api/assessments/8', params: { runId: '8' }, notFound: 'Assessment not found' },
  { name: 'GET /api/assessments/:runId/export', load: async () => (await import('@/app/api/assessments/[runId]/export/route')).GET,
    method: 'GET', url: '/api/assessments/8/export?format=csv', params: { runId: '8' }, notFound: 'Assessment not found' },
  { name: 'GET /api/cases/:id/assessments', load: async () => (await import('@/app/api/cases/[caseId]/assessments/route')).GET,
    method: 'GET', url: '/api/cases/3/assessments', params: { caseId: '3' }, notFound: 'Case not found' },
  { name: 'POST /api/cases/:id/assessments', load: async () => (await import('@/app/api/cases/[caseId]/assessments/route')).POST,
    method: 'POST', url: '/api/cases/3/assessments', params: { caseId: '3' }, json: {}, level: 'editor', notFound: 'Case not found' },

  // ── comparison ─────────────────────────────────────────────────────────────
  { name: 'GET /api/projects/:id/compare', load: async () => (await import('@/app/api/projects/[projectId]/compare/route')).GET,
    method: 'GET', url: '/api/projects/7/compare?cases=3', params: { projectId: '7' }, notFound: 'Project not found' },
  { name: 'GET /api/comparisons/:id', load: async () => (await import('@/app/api/comparisons/[comparisonId]/route')).GET,
    method: 'GET', url: '/api/comparisons/1', params: { comparisonId: '1' }, notFound: 'Comparison not found' },
  { name: 'DELETE /api/comparisons/:id', load: async () => (await import('@/app/api/comparisons/[comparisonId]/route')).DELETE,
    method: 'DELETE', url: '/api/comparisons/1', params: { comparisonId: '1' }, level: 'admin', notFound: 'Comparison not found' },
  { name: 'GET /api/comparisons?project_id', load: async () => (await import('@/app/api/comparisons/route')).GET,
    method: 'GET', url: '/api/comparisons?project_id=7', notFound: 'Project not found' },

  // ── ingest (writes into a case or project) ─────────────────────────────────
  { name: 'POST /api/ingest/apply (append)', load: async () => (await import('@/app/api/ingest/apply/route')).POST,
    method: 'POST', url: '/api/ingest/apply', json: { target_case_id: 3, attach_component_id: 100, flows: [], costs: [], notes: [] }, level: 'editor', notFound: 'Target case not found' },
  { name: 'POST /api/ingest/apply (create)', load: async () => (await import('@/app/api/ingest/apply/route')).POST,
    method: 'POST', url: '/api/ingest/apply', json: { project_id: 7, case_name: 'Ingested', nodes, flows: [], costs: [], notes: [] }, level: 'editor', notFound: 'Project not found' },
  { name: 'POST /api/ingest/preview (equipment)', load: async () => (await import('@/app/api/ingest/preview/route')).POST,
    method: 'POST', url: '/api/ingest/preview', form: equipmentForm, level: 'editor', notFound: 'Case not found' },
];

/** Handlers that authenticate but are not project-scoped (for the 401 table). */
export const OTHER_AUTHED_ROUTES: Array<Pick<RouteCase, 'name' | 'load' | 'method' | 'url' | 'json' | 'owner' | 'params' | 'pending401'>> = [
  { name: 'GET /api/auth/me', load: async () => (await import('@/app/api/auth/me/route')).GET, method: 'GET', url: '/api/auth/me' },
  { name: 'GET /api/auth/profile', load: async () => (await import('@/app/api/auth/profile/route')).GET, method: 'GET', url: '/api/auth/profile' },
  { name: 'PUT /api/auth/profile', load: async () => (await import('@/app/api/auth/profile/route')).PUT, method: 'PUT', url: '/api/auth/profile', json: { fullName: 'x', company: 'y' } },
  { name: 'GET /api/projects', load: async () => (await import('@/app/api/projects/route')).GET, method: 'GET', url: '/api/projects' },
  { name: 'POST /api/projects', load: async () => (await import('@/app/api/projects/route')).POST, method: 'POST', url: '/api/projects', json: { project_name: 'x' } },
  { name: 'GET /api/substances', load: async () => (await import('@/app/api/substances/route')).GET, method: 'GET', url: '/api/substances' },
  { name: 'POST /api/substances', load: async () => (await import('@/app/api/substances/route')).POST, method: 'POST', url: '/api/substances', json: {} },
  { name: 'GET /api/driver-factors', load: async () => (await import('@/app/api/driver-factors/route')).GET, method: 'GET', url: '/api/driver-factors' },
  { name: 'GET /api/impact-categories', load: async () => (await import('@/app/api/impact-categories/route')).GET, method: 'GET', url: '/api/impact-categories' },
  { name: 'GET /api/process-templates', load: async () => (await import('@/app/api/process-templates/route')).GET, method: 'GET', url: '/api/process-templates' },
  { name: 'POST /api/example-project', load: async () => (await import('@/app/api/example-project/route')).POST, method: 'POST', url: '/api/example-project', json: {} },
  { name: 'POST /api/insights', load: async () => (await import('@/app/api/insights/route')).POST, method: 'POST', url: '/api/insights', json: {} },
  { name: 'POST /api/comparisons', load: async () => (await import('@/app/api/comparisons/route')).POST, method: 'POST', url: '/api/comparisons', json: { comparison_name: 'x', case_ids: [3, 4], project_id: 7 } },
  { name: 'GET /api/integrations/status', load: async () => (await import('@/app/api/integrations/status/route')).GET, method: 'GET', url: '/api/integrations/status' },
  { name: 'GET /api/integrations/log', load: async () => (await import('@/app/api/integrations/log/route')).GET, method: 'GET', url: '/api/integrations/log' },
  { name: 'GET /api/integrations/openlca/import', load: async () => (await import('@/app/api/integrations/openlca/import/route')).GET, method: 'GET', url: '/api/integrations/openlca/import' },
  { name: 'POST /api/integrations/openlca/import', load: async () => (await import('@/app/api/integrations/openlca/import/route')).POST, method: 'POST', url: '/api/integrations/openlca/import', json: { method: 'TRACI 2.1' } },
  { name: 'POST /api/integrations/electricity/sync', load: async () => (await import('@/app/api/integrations/electricity/sync/route')).POST, method: 'POST', url: '/api/integrations/electricity/sync', json: { zone: 'US-CAL-CISO' } },
  { name: 'POST /api/integrations/bls/fetch-wage', load: async () => (await import('@/app/api/integrations/bls/fetch-wage/route')).POST, method: 'POST', url: '/api/integrations/bls/fetch-wage', json: {}, owner: 'other' },
  { name: 'POST /api/integrations/eia/fetch-energy-price', load: async () => (await import('@/app/api/integrations/eia/fetch-energy-price/route')).POST, method: 'POST', url: '/api/integrations/eia/fetch-energy-price', json: {}, owner: 'other' },
  { name: 'POST /api/integrations/metals/fetch-price', load: async () => (await import('@/app/api/integrations/metals/fetch-price/route')).POST, method: 'POST', url: '/api/integrations/metals/fetch-price', json: {}, owner: 'other' },
  { name: 'POST /api/integrations/pubchem/enrich', load: async () => (await import('@/app/api/integrations/pubchem/enrich/route')).POST, method: 'POST', url: '/api/integrations/pubchem/enrich', json: {}, owner: 'other' },
];

/** Build the request for a route case with the given bearer token. */
export function requestFor(rc: { method: string; url: string; json?: unknown; form?: () => FormData }, token: string) {
  const headers: Record<string, string> = { authorization: `Bearer ${token}`, 'x-forwarded-for': '203.0.113.77' };
  let body: BodyInit | undefined;
  if (rc.form) body = rc.form();
  else if (rc.json !== undefined) {
    body = JSON.stringify(rc.json);
    headers['content-type'] = 'application/json';
  }
  return new NextRequest(`http://localhost${rc.url}`, { method: rc.method, headers, body });
}

/** Next 15 passes params as a Promise; one legacy handler reads them directly. */
export function contextFor(params?: Record<string, string>) {
  const p = params ?? {};
  return { params: Object.assign(Promise.resolve(p), p) };
}
