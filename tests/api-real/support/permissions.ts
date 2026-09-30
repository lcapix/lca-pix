/**
 * The `permissions:` section of docs/flows/flows.yaml, and how to turn one
 * row into a real request for a given caller of the standard world.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { freshIp, type CallOptions } from './http';
import { newPassword } from './users';
import { ROOT, pathParams } from './routes';
import type { Caller, World } from './world';

export interface PermissionRow {
  id: string;
  method: string;
  path: string;
  rule: string;
  params?: Record<string, string>;
  body?: unknown;
  multipart?: 'notes_txt' | 'bom_csv' | 'equipment_csv';
  expect: Record<string, number>;
  callers?: Record<string, number>;
  fresh?: keyof World['fresh'];
  not_found?: string;
  primary?: string;
  env?: Record<string, string>;
  now?: Record<string, number>;
  bug?: string;
  legacy?: boolean;
  mode?: string;
  /** Run with project.members_see_own_cases = 1 on $P (B-A1 student isolation). */
  own_cases?: boolean;
  assert?: string;
  note?: string;
}

export const FLOWS_YAML = path.join(ROOT, 'docs', 'flows', 'flows.yaml');

export function loadFlowsYaml(): any {
  return yaml.load(readFileSync(FLOWS_YAML, 'utf8'));
}

export function loadPermissions(): { rows: PermissionRow[]; authFailures: Record<string, number> } {
  const doc = loadFlowsYaml();
  return { rows: doc.permissions as PermissionRow[], authFailures: doc.x_expect.auth_failures as Record<string, number> };
}

/** Public rows (no token needed) get no automatic deactivated/revoked/tampered callers. */
export function isPublic(row: PermissionRow): boolean {
  return row.rule === 'public' || row.rule === 'hand-off cookie';
}

/** An id that exists in no table of the fresh database. */
export const MISSING_ID = 2147480000;

export interface BuiltRequest {
  url: string;
  template: string;
  opts: CallOptions;
}

export interface BuildContext {
  w: World;
  caller: Caller;
  fresh: Record<string, number>;
  /** Replace the primary id with MISSING_ID (the "missing resource" twin of the request). */
  missing?: boolean;
  /** Handle -> id overrides (e.g. P's handles pointed at Q's resources). */
  overrides?: Record<string, string | number>;
}

let runSeq = 0;

function resolveHandle(ref: string, ctx: BuildContext): string | number {
  const { w } = ctx;
  if (ctx.overrides && Object.prototype.hasOwnProperty.call(ctx.overrides, ref)) return ctx.overrides[ref];
  const u = w.user(ctx.caller);
  const table: Record<string, () => string | number> = {
    $P: () => w.P.id,
    '$P.base': () => w.P.base.id,
    '$P.base.product': () => w.P.base.product,
    '$P.base.machine': () => w.P.base.machine,
    '$P.base.subprocess': () => w.P.base.subprocess,
    '$P.base.op': () => w.P.base.op,
    '$P.base.task': () => w.P.base.task,
    '$P.base.flow': () => w.P.base.flow,
    '$P.base.run': () => w.P.base.run,
    '$P.comp': () => w.P.comp.id,
    '$legacy.comparison': () => w.legacyComparison,
    '$substance.electricity': () => w.substances.electricity,
    '$user.invitee.email': () => w.users.invitee.email,
    // anon logs in with a real address and a wrong password.
    '$caller.email': () => (u ?? w.users.nonmem).email,
    '$caller.password': () => (u ? u.password : 'Wrong-password-123'),
    $password: () => newPassword(),
  };
  if (ref.startsWith('$fresh.')) {
    const v = ctx.fresh[ref.slice('$fresh.'.length)];
    if (v === undefined) throw new Error(`${ref} was not built`);
    return v;
  }
  const f = table[ref];
  if (!f) throw new Error(`Unknown handle ${ref}`);
  return f();
}

function fill(value: unknown, ctx: BuildContext, run: string): unknown {
  if (typeof value === 'string') {
    if (value.startsWith('$')) return resolveHandle(value, ctx);
    return value.replace(/\{run\}/g, run).replace(/\{role\}/g, ctx.caller);
  }
  if (Array.isArray(value)) return value.map((v) => fill(v, ctx, run));
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, fill(v, ctx, run)]));
  }
  return value;
}

function multipart(name: NonNullable<PermissionRow['multipart']>, ctx: BuildContext): FormData {
  const fd = new FormData();
  if (name === 'notes_txt') {
    fd.append('file', new File([`Kiln log ${ctx.caller}\nfiring at 1200 C for 8 h\n`], 'notes.txt', { type: 'text/plain' }));
    fd.append('doc_type', 'other');
  } else if (name === 'bom_csv') {
    fd.append('file', new File(['Part,Material,Mass (kg)\nBody,Steel,0.35\nHandle,Steel,0.05\n'], 'bom.csv', { type: 'text/csv' }));
    fd.append('connector', 'bom');
  } else {
    fd.append('file', new File(['Work center,Machine,kW\nWC1,Kiln,5\n'], 'equipment.csv', { type: 'text/csv' }));
    fd.append('connector', 'equipment');
    fd.append('target_case_id', String(ctx.missing ? MISSING_ID : resolveHandle('$P.base', ctx)));
  }
  return fd;
}

/** The request one caller makes for one row. */
export function buildRowRequest(row: PermissionRow, ctx: BuildContext): BuiltRequest {
  const run = `${ctx.w.tag}${++runSeq}`;
  const template = row.path;
  const primary = row.primary ?? `path.${pathParams(template)[0] ?? ''}`;
  const values: Record<string, string> = {};
  for (const [name, ref] of Object.entries(row.params ?? {})) values[name] = String(resolveHandle(ref, ctx));
  if (ctx.missing) {
    const [where, key] = primary.split('.');
    if (where === 'path' || where === 'query') values[key] = String(MISSING_ID);
  }
  const url = template.replace(/\{(\w+)\}/g, (_m, n) => values[n] ?? `{${n}}`);
  const params: Record<string, string> = {};
  for (const n of pathParams(template)) params[n] = values[n];

  const opts: CallOptions = { params, token: ctx.w.token(ctx.caller), ip: freshIp() };
  if (row.multipart) opts.form = multipart(row.multipart, ctx);
  else if (row.body !== undefined) {
    const body = fill(row.body, ctx, run) as Record<string, unknown>;
    if (ctx.missing && primary.startsWith('body.')) body[primary.slice(5)] = MISSING_ID;
    opts.json = body;
  }
  return { url, template, opts };
}
