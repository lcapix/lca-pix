import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { query, queryOne, insert, execute, transaction } from '@/lib/db-helpers'
import { isAuthError, projectAccessDenied } from '@/lib/route-guard'
import { parseId } from '@/lib/ids'
import { readJson } from '@/lib/http'
import { copyCaseInventory, copyCaseReferenceFields } from '@/lib/case-copy'
import { parentFirstOrder } from '@/lib/component-tree'

// Assignments (C06, C07): an instructor names a task and a template case; each
// student starts their own working copy, and Hand in freezes a read-only copy
// of it with its write-up. Instructors (admin) create, change and read every
// submission; members with Can change start and hand in.

async function loadAssignment(id: number) {
  return queryOne<any>(`SELECT * FROM assignment WHERE assignment_id = ?`, [id])
}

/** A due date the client sent: null to clear, a parseable date, or an error. */
function dueAt(v: unknown): { ok: true; value: string | null } | { ok: false } {
  if (v === null || v === '' || v === undefined) return { ok: true, value: null }
  const d = new Date(String(v))
  return Number.isFinite(d.getTime()) ? { ok: true, value: d.toISOString() } : { ok: false }
}

/**
 * The template must be a case of this project (an admin of one project never
 * copies another's), and not a student's working or handed-in copy: one wrong
 * pick would copy one student's work to every student.
 */
async function templateIn(projectId: number, raw: unknown): Promise<{ ok: true; id: number | null } | { ok: false }> {
  if (raw === null || raw === undefined || raw === '') return { ok: true, id: null }
  const id = parseId(raw)
  if (!id) return { ok: false }
  const row = await queryOne<any>(
    `SELECT case_id FROM case_table WHERE case_id = ? AND project_id = ? AND assignment_id IS NULL AND coalesce(read_only, 0) = 0 AND coalesce(hidden_from_members, 0) = 0`,
    [id, projectId],
  )
  return row ? { ok: true, id } : { ok: false }
}

export async function listAssignments(request: NextRequest, projectId: number) {
  const userId = await requireAuth(request)
  const denied = await projectAccessDenied(userId, projectId, 'viewer', { notFound: 'Project not found' })
  if (denied) return denied
  const rows = await query<any>(
    `SELECT a.*, s.working_case_id AS my_case_id, s.frozen_case_id AS my_frozen_case_id, s.submitted_at AS my_submitted_at
       FROM assignment a
       LEFT JOIN submission s ON s.assignment_id = a.assignment_id AND s.account_id = ?
      WHERE a.project_id = ?
      ORDER BY a.assignment_id`,
    [userId, projectId],
  )
  return NextResponse.json({ success: true, assignments: rows })
}

export async function createAssignment(request: NextRequest, projectId: number) {
  const userId = await requireAuth(request)
  const denied = await projectAccessDenied(userId, projectId, 'admin', { notFound: 'Project not found' })
  if (denied) return denied
  const json = await readJson(request)
  if (!json.ok) return json.response
  const title = String(json.body.title ?? '').trim()
  if (!title) return NextResponse.json({ error: 'Give the assignment a title.' }, { status: 400 })
  const due = dueAt(json.body.due_at)
  if (!due.ok) return NextResponse.json({ error: 'The due date is not a date.' }, { status: 400 })
  const template = await templateIn(projectId, json.body.template_case_id)
  if (!template.ok) return NextResponse.json({ error: 'The template must be a case of this project that students can see, not a student\'s copy.' }, { status: 400 })
  const assignmentId = await insert(
    `INSERT INTO assignment (project_id, title, instructions, due_at, template_case_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [projectId, title.slice(0, 200), String(json.body.instructions ?? '').trim() || null, due.value, template.id, userId],
  )
  // An assignment makes this a class: each student then sees only their own
  // case and the staff's, never a classmate's working case or hand-in.
  await execute(`UPDATE project SET members_see_own_cases = 1 WHERE project_id = ? AND coalesce(members_see_own_cases, 0) = 0`, [projectId])
  return NextResponse.json({ success: true, assignment_id: assignmentId }, { status: 201 })
}

export async function updateAssignment(request: NextRequest, assignmentId: number) {
  const userId = await requireAuth(request)
  const row = await loadAssignment(assignmentId)
  if (!row) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  const denied = await projectAccessDenied(userId, row.project_id, 'admin', { notFound: 'Assignment not found' })
  if (denied) return denied
  const json = await readJson(request)
  if (!json.ok) return json.response
  const body = json.body ?? {}
  const has = (k: string) => Object.prototype.hasOwnProperty.call(body, k)
  // A field that is sent is set, so a due date or the instructions can be cleared.
  const title = has('title') ? String(body.title ?? '').trim() : row.title
  if (!title) return NextResponse.json({ error: 'Give the assignment a title.' }, { status: 400 })
  const due = has('due_at') ? dueAt(body.due_at) : ({ ok: true, value: row.due_at } as const)
  if (!due.ok) return NextResponse.json({ error: 'The due date is not a date.' }, { status: 400 })
  const template = has('template_case_id') ? await templateIn(row.project_id, body.template_case_id) : ({ ok: true, id: row.template_case_id } as const)
  if (!template.ok) return NextResponse.json({ error: 'The template must be a case of this project that students can see, not a student\'s copy.' }, { status: 400 })
  const instructions = has('instructions') ? String(body.instructions ?? '').trim() || null : row.instructions
  await execute(`UPDATE assignment SET title = ?, instructions = ?, due_at = ?, template_case_id = ? WHERE assignment_id = ?`, [
    title.slice(0, 200),
    instructions,
    due.value,
    template.id,
    assignmentId,
  ])
  return NextResponse.json({ success: true })
}

export async function deleteAssignment(request: NextRequest, assignmentId: number) {
  const userId = await requireAuth(request)
  const row = await loadAssignment(assignmentId)
  if (!row) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  const denied = await projectAccessDenied(userId, row.project_id, 'admin', { notFound: 'Assignment not found' })
  if (denied) return denied
  await transaction(async (conn) => {
    // Handed-in copies are read-only, so nobody could delete them later. A
    // student's working case is theirs and stays.
    await conn.query(`DELETE FROM case_table WHERE assignment_id = ? AND read_only = 1`, [assignmentId])
    await conn.query(`DELETE FROM assignment WHERE assignment_id = ?`, [assignmentId])
  })
  return NextResponse.json({ success: true })
}

/**
 * A copy of `source` in the assignment's own project, inside `conn`'s
 * transaction. A frozen hand-in also keeps the write-up and the lesson answers,
 * so the instructor reads what the student handed in.
 */
async function copyInto(conn: any, userId: number, projectId: number, source: any, name: string, assignmentId: number, frozen: boolean) {
  const [ins]: any = await conn.query(
    `INSERT INTO case_table (project_id, created_by, hidden_from_members, parent_case_id, case_name, case_type, description, region_code, assignment_id, read_only)
     VALUES (?, ?, 0, ?, ?, 'comparative', ?, ?, ?, ?)`,
    [projectId, userId, source.case_id, name.slice(0, 100), source.description ?? null, source.region_code ?? null, assignmentId, frozen ? 1 : 0],
  )
  const id = Number(ins.insertId)
  await copyCaseReferenceFields(conn, source, id)
  await copyCaseInventory(conn, source.case_id, id)
  if (frozen) {
    await conn.query(`UPDATE case_table SET interpretation = ?, assumptions = ?, learning_state = ? WHERE case_id = ?`, [
      source.interpretation ?? null,
      source.assumptions ?? null,
      source.learning_state == null ? null : typeof source.learning_state === 'string' ? source.learning_state : JSON.stringify(source.learning_state),
      id,
    ])
  }
  return id
}

/** Pairs two equal-length id lists in order; null when they do not line up. */
function zipIds(from: number[], to: number[]): Map<number, number> | null {
  if (from.length !== to.length) return null
  return new Map(from.map((id, i) => [id, to[i]]))
}

/**
 * D1: the frozen copy carries the run it was handed in with. After copyInto,
 * the copy's steps and flows are the working case's in the same order
 * (copyCaseInventory inserts steps parent first and flows by id), so the two
 * line up one to one. The run row, its frozen snapshot and its stored results
 * are copied onto the copy with the ids moved across, and each copied step,
 * flow and own factor keeps the working row's last-edited time, so "Edited
 * after this run" reads on the copy exactly as it read on the working case
 * when it was handed in. Returns the copy's run id.
 */
async function copyRunInto(conn: any, workingCaseId: number, frozenCaseId: number, runId: number): Promise<number | null> {
  const [runs]: any = await conn.query(`SELECT * FROM assessment_runs WHERE run_id = ? AND case_id = ?`, [runId, workingCaseId])
  const run = runs?.[0]
  if (!run) return null
  const [srcSteps]: any = await conn.query(`SELECT * FROM component WHERE case_id = ? ORDER BY component_id`, [workingCaseId])
  const [dstSteps]: any = await conn.query(`SELECT component_id FROM component WHERE case_id = ? ORDER BY component_id`, [frozenCaseId])
  const stepMap = zipIds(
    parentFirstOrder(srcSteps as any[]).map((r: any) => Number(r.component_id)),
    (dstSteps as any[]).map((r) => Number(r.component_id)),
  )
  if (!stepMap) return null
  const srcIds = [...stepMap.keys()]
  const dstIds = [...stepMap.values()]
  const flowsOf = async (ids: number[]) =>
    ids.length
      ? ((await conn.query(`SELECT flow_id, updated_at FROM flows WHERE component_id IN (${ids.map(() => '?').join(', ')}) ORDER BY flow_id`, ids))[0] as any[])
      : []
  const srcFlows = await flowsOf(srcIds)
  const dstFlows = await flowsOf(dstIds)
  const flowMap = zipIds(
    srcFlows.map((f) => Number(f.flow_id)),
    dstFlows.map((f) => Number(f.flow_id)),
  )
  if (!flowMap) return null

  // The last-edited times, step by step and flow by flow.
  const stepEdited = new Map((srcSteps as any[]).map((r) => [Number(r.component_id), r.updated_at]))
  for (const [from, to] of stepMap) {
    if (stepEdited.get(from)) await conn.query(`UPDATE component SET updated_at = ? WHERE component_id = ?`, [stepEdited.get(from), to])
  }
  for (const f of srcFlows) {
    const to = flowMap.get(Number(f.flow_id))
    if (to && f.updated_at) await conn.query(`UPDATE flows SET updated_at = ? WHERE flow_id = ?`, [f.updated_at, to])
  }
  try {
    for (const [from, to] of flowMap) {
      await conn.query(
        `UPDATE flow_factor_overrides SET updated_at = (SELECT MAX(o.updated_at) FROM flow_factor_overrides o WHERE o.flow_id = ?)
          WHERE flow_id = ? AND EXISTS (SELECT 1 FROM flow_factor_overrides o2 WHERE o2.flow_id = ?)`,
        [from, to, from],
      )
    }
  } catch (err: any) {
    // A database without own factors (migrate-034) has nothing to carry.
    if (err?.code !== 'ER_NO_SUCH_TABLE') throw err
  }

  const step = (id: unknown) => (id == null ? id : stepMap.get(Number(id)) ?? id)
  const flow = (id: unknown) => (id == null ? id : flowMap.get(Number(id)) ?? id)
  const snap = run.run_snapshot == null ? null : typeof run.run_snapshot === 'string' ? JSON.parse(run.run_snapshot) : run.run_snapshot
  if (snap && typeof snap === 'object') {
    for (const s of Array.isArray(snap.steps) ? snap.steps : []) {
      s.component_id = step(s.component_id)
      s.parent_id = step(s.parent_id)
    }
    for (const r of Array.isArray(snap.flow_detail) ? snap.flow_detail : []) {
      r.flow_id = flow(r.flow_id)
      if ('component_id' in r) r.component_id = step(r.component_id)
    }
    for (const r of Array.isArray(snap.inventory) ? snap.inventory : []) {
      r.flow_id = flow(r.flow_id)
      r.component_id = step(r.component_id)
    }
  }
  const [ins]: any = await conn.query(
    `INSERT INTO assessment_runs (case_id, run_name, run_date, calculation_method, region_code, status, error_log, executed_by, run_snapshot)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      frozenCaseId,
      run.run_name ?? null,
      run.run_date,
      run.calculation_method ?? null,
      run.region_code ?? null,
      run.status ?? 'completed',
      run.error_log ?? null,
      run.executed_by,
      snap ? JSON.stringify(snap) : null,
    ],
  )
  const newRunId = Number(ins.insertId)
  const [results]: any = await conn.query(
    `SELECT component_id, category_id, impact_value, unit, contribution_percentage, calculated_at FROM assessment_results WHERE run_id = ? ORDER BY result_id`,
    [runId],
  )
  const rows = (results as any[]) ?? []
  for (let i = 0; i < rows.length; i += 200) {
    const chunk = rows.slice(i, i + 200)
    await conn.query(
      `INSERT INTO assessment_results (run_id, component_id, category_id, impact_value, unit, contribution_percentage, calculated_at)
       VALUES ${chunk.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(', ')}`,
      chunk.flatMap((r) => [
        newRunId,
        // A step the working case no longer had when it was handed in has no copy: its row keeps no step.
        r.component_id == null ? null : stepMap.get(Number(r.component_id)) ?? null,
        r.category_id,
        r.impact_value,
        r.unit,
        r.contribution_percentage ?? null,
        r.calculated_at ?? null,
      ]),
    )
  }
  return newRunId
}

/** "Week 1: lighter blank · Ana Ruiz": the assignment and whose case it is (D5). */
export function assignmentCaseName(title: string, person: { full_name?: string | null; username?: string | null; email?: string | null } | null): string {
  const who = String(person?.full_name ?? '').trim() || String(person?.username ?? '').trim() || String(person?.email ?? '').split('@')[0]
  const name = who ? `${title} · ${who}` : title
  return name.slice(0, 100)
}

export async function startAssignment(request: NextRequest, assignmentId: number) {
  const userId = await requireAuth(request)
  const row = await loadAssignment(assignmentId)
  if (!row) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  const denied = await projectAccessDenied(userId, row.project_id, 'editor', {
    notFound: 'Assignment not found',
    forbidden: 'You can read this project. Its owner can give you Can change to start the assignment.',
  })
  if (denied) return denied
  if (!row.template_case_id) return NextResponse.json({ error: 'This assignment has no template case yet.' }, { status: 400 })
  const template = await queryOne<any>(`SELECT * FROM case_table WHERE case_id = ? AND project_id = ?`, [row.template_case_id, row.project_id])
  if (!template) return NextResponse.json({ error: 'The template case is gone. Ask your instructor to choose another.' }, { status: 400 })
  const result = await transaction(async (conn) => {
    // One start at a time per assignment, so two clicks never make two copies.
    await conn.query(`SELECT assignment_id FROM assignment WHERE assignment_id = ? FOR UPDATE`, [assignmentId])
    const [had]: any = await conn.query(`SELECT working_case_id FROM submission WHERE assignment_id = ? AND account_id = ?`, [assignmentId, userId])
    const existing = had?.[0]?.working_case_id
    if (existing) return { caseId: Number(existing), created: false }
    const [who]: any = await conn.query(`SELECT full_name, username, email FROM account WHERE id = ?`, [userId])
    const caseId = await copyInto(conn, userId, row.project_id, template, assignmentCaseName(row.title, who?.[0] ?? null), assignmentId, false)
    await conn.query(
      `INSERT INTO submission (assignment_id, account_id, working_case_id) VALUES (?, ?, ?)
       ON CONFLICT (assignment_id, account_id) DO UPDATE SET working_case_id = EXCLUDED.working_case_id`,
      [assignmentId, userId, caseId],
    )
    return { caseId, created: true }
  })
  return NextResponse.json({ success: true, case_id: result.caseId }, { status: result.created ? 201 : 200 })
}

export async function submitAssignment(request: NextRequest, assignmentId: number) {
  const userId = await requireAuth(request)
  const row = await loadAssignment(assignmentId)
  if (!row) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  const denied = await projectAccessDenied(userId, row.project_id, 'editor', { notFound: 'Assignment not found' })
  if (denied) return denied
  const sub = await queryOne<any>(`SELECT * FROM submission WHERE assignment_id = ? AND account_id = ?`, [assignmentId, userId])
  if (!sub?.working_case_id) return NextResponse.json({ error: 'Start the assignment first.' }, { status: 400 })
  const working = await queryOne<any>(`SELECT * FROM case_table WHERE case_id = ? AND created_by = ? AND project_id = ?`, [sub.working_case_id, userId, row.project_id])
  if (!working) return NextResponse.json({ error: 'Your working case is gone. Start the assignment again.' }, { status: 404 })
  if (sub.frozen_case_id && row.due_at && new Date(row.due_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'The due date has passed, so the hand-in cannot be replaced.' }, { status: 400 })
  }
  const run = await queryOne<any>(
    `SELECT run_id FROM assessment_runs WHERE case_id = ? AND status = 'completed' ORDER BY run_id DESC LIMIT 1`,
    [working.case_id],
  )
  const frozen = await transaction(async (conn) => {
    // One hand-in at a time per student: two at once would leave a copy behind.
    const [locked]: any = await conn.query(`SELECT frozen_case_id FROM submission WHERE submission_id = ? FOR UPDATE`, [sub.submission_id])
    const earlier = locked?.[0]?.frozen_case_id ?? null
    const id = await copyInto(conn, userId, row.project_id, working, `${working.case_name} (handed in)`, assignmentId, true)
    // D1: the copy carries its run; submission.run_id is that copy's run, so the
    // instructor opens the answer as it was handed in, never the live case's.
    const frozenRun = run?.run_id ? await copyRunInto(conn, Number(working.case_id), id, Number(run.run_id)) : null
    await conn.query(`UPDATE submission SET frozen_case_id = ?, run_id = ?, submitted_at = now() WHERE submission_id = ?`, [id, frozenRun, sub.submission_id])
    // A second hand-in replaces the first: the old frozen copy goes.
    if (earlier) await conn.query(`DELETE FROM case_table WHERE case_id = ? AND assignment_id = ? AND read_only = 1`, [earlier, assignmentId])
    return { caseId: id, runId: frozenRun }
  })
  return NextResponse.json({ success: true, case_id: frozen.caseId, run_id: frozen.runId })
}

export async function listSubmissions(request: NextRequest, assignmentId: number) {
  const userId = await requireAuth(request)
  const row = await loadAssignment(assignmentId)
  if (!row) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  const denied = await projectAccessDenied(userId, row.project_id, 'admin', { notFound: 'Assignment not found' })
  if (denied) return denied
  // The students: members who can change or read, not the other instructors.
  const people = await query<any>(
    `SELECT a.id AS account_id, a.full_name, a.email, s.working_case_id, s.frozen_case_id, s.run_id, s.submitted_at
       FROM project_members pm
       JOIN account a ON a.id = pm.user_id
       JOIN permissions p ON p.permission_id = pm.permission_id
       LEFT JOIN submission s ON s.account_id = a.id AND s.assignment_id = ?
      WHERE pm.project_id = ? AND p.permission_name IN ('editor', 'viewer')
      ORDER BY a.full_name, a.email`,
    [assignmentId, row.project_id],
  )
  const due = row.due_at ? new Date(row.due_at).getTime() : null
  const submissions = people.map((p) => {
    let status = 'not started'
    if (p.working_case_id && !p.submitted_at) status = 'in progress'
    else if (p.submitted_at) status = due && new Date(p.submitted_at).getTime() > due ? 'late' : 'handed in'
    return { ...p, status }
  })
  return NextResponse.json({ success: true, submissions })
}

export function authFail(error: any) {
  if (isAuthError(error)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  console.error(error)
  return NextResponse.json({ error: 'Failed' }, { status: 500 })
}
