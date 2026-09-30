/**
 * Keeps the matrix honest: every exported handler in app/api/**\/route.ts has
 * a row in docs/flows/flows.yaml `permissions:`, and every row names a
 * handler that exists. A new route (or method) fails here until someone
 * decides who may call it.
 */
import { describe, expect, it } from 'vitest';
import { listRoutes } from '../support/routes';
import { loadPermissions } from '../support/permissions';

describe('route coverage', () => {
  const routes = listRoutes();
  const { rows } = loadPermissions();
  const inCode = new Set(routes.flatMap((r) => r.methods.map((m) => `${m} ${r.template}`)));
  const inMatrix = new Set(rows.map((r) => `${r.method} ${r.path.split('?')[0]}`));

  it('finds the 45 route files', () => {
    expect(routes).toHaveLength(45);
  });

  it('every route x method in the code has a permissions row', () => {
    expect([...inCode].filter((k) => !inMatrix.has(k)).sort()).toEqual([]);
  });

  it('every permissions row names a route x method the code exports', () => {
    expect([...inMatrix].filter((k) => !inCode.has(k)).sort()).toEqual([]);
  });
});
