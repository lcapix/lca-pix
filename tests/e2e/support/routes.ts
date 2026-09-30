/**
 * Typed access to tests/e2e/routes.json, the one route list shared by the
 * visual and accessibility baselines, the warm-up and capture-review.mjs.
 */
import data from '../routes.json';
import type { Seed } from './seed';

export type Actor = 'owner' | 'viewer' | 'empty' | 'newcomer' | 'anon';
export type RouteDef = { slug: string; path: string; as?: Actor; ready?: string; brief: string };
export type Viewport = { name: string; width: number; height: number };

export const ROUTES = data.routes as RouteDef[];
export const VIEWPORTS = data.viewports as Viewport[];

export function idsFromSeed(seed: Seed): Record<string, number> {
  return {
    exampleProject: seed.example.projectId,
    baseCase: seed.example.baseCaseId,
    compCase: seed.example.compCaseId,
    baseRun: seed.example.baseRunId,
    cutBlank: seed.example.cutBlankId,
    fiveTierProject: seed.fiveTier.projectId,
    fiveTierCase: seed.fiveTier.caseId,
  };
}

/** Fill {placeholders} in a route path. */
export function resolvePath(template: string, ids: Record<string, number | string>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    if (ids[key] === undefined || ids[key] === null) throw new Error(`No id for {${key}} in ${template}`);
    return String(ids[key]);
  });
}

export function routeBySlug(slug: string): RouteDef {
  const r = ROUTES.find((x) => x.slug === slug);
  if (!r) throw new Error(`No route "${slug}" in routes.json`);
  return r;
}
