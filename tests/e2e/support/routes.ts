/**
 * Typed access to tests/e2e/routes.json, the one route list shared by the
 * visual and accessibility baselines, the warm-up and capture-review.mjs.
 */
import { expect, type Page } from '@playwright/test';
import data from '../routes.json';
import type { Seed } from './seed';
import { open, settle } from './ui';

export type Actor = 'owner' | 'viewer' | 'empty' | 'newcomer' | 'anon';
export type RouteDef = { slug: string; path: string; as?: Actor; ready?: string; landsOn?: string; brief: string };
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

/** Open a route and wait until it is ready (and has redirected, if it does). */
export async function openRoute(page: Page, route: RouteDef, seed: Seed): Promise<void> {
  await open(page, resolvePath(route.path, idsFromSeed(seed)), { ready: route.ready });
  if (route.landsOn) {
    await expect(page).toHaveURL(new RegExp(`${route.landsOn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
    await settle(page);
  }
}

export function routeBySlug(slug: string): RouteDef {
  const r = ROUTES.find((x) => x.slug === slug);
  if (!r) throw new Error(`No route "${slug}" in routes.json`);
  return r;
}
