import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth'
import { query, queryOne, insert, execute, transaction } from '@/lib/db-helpers'
import { isAuthError, projectAccessDenied } from '@/lib/route-guard'
import { parseId } from '@/lib/ids'
import { readJson } from '@/lib/http'
import { copyCaseInventory, copyCaseReferenceFields } from '@/lib/case-copy'

async function loadAssignment(id: number) {
  return queryOne<any>(`SELECT * FROM assignment WHERE assignment_id = ?`, [id])
}

export async function listAssignments(request: NextRequest, projectId: number) {
  const userId = await requireAuth(request)
  const denied = await projectAccessDenied(userId, projectId, 'viewer', { notFound: 'Project not found' })
  if (denied) return denied
  const rows = await query(`SELECT * FROM assignment WHERE project_id = ? ORDER BY assignment_id`, [projectId])
  return NextResponse.json({ success: true, assignments: rows })
}

export async function createAssignment(request: NextRequest, projectId: number) {
  const userId = await requireAuth(request)
  const denied = await projectAccessDenied(userId, projectId, 'admin', { notFound: 'Project not found' })
  if (denied) return denied
  const json = await readJson(request)
  if (!json.ok) return json.response
  const title = String(json.body.title ?? '').trim()
  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  const assignmentId = await insert(
    `INSERT INTO assignment (project_id, title, instructions, due_at, template_case_id, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [projectId, title.slice(0, 200), json.body.instructions ?? null, json.body.due_at ?? null, json.body.template_case_id ?? null, userId],
  )
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
  await execute(
    `UPDATE assignment SET title = COALESCE(?, title), instructions = COALESCE(?, instructions), due_at = COALESCE(?, due_at), updated_at = now() WHERE assignment_id = ?`,
    [json.body.title ?? null, json.body.instructions ?? null, json.body.due_at ?? null, assignmentId],
  )
  return NextResponse.json({ success: true })
}

export async function deleteAssignment(request: NextRequest, assignmentId: number) {
  const userId = await requireAuth(request)
  const row = await loadAssignment(assignmentId)
  if (!row) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  const denied = await projectAccessDenied(userId, row.project_id, 'admin', { notFound: 'Assignment not found' })
  if (denied) return denied
  await execute(`DELETE FROM assignment WHERE assignment_id = ?`, [assignmentId])
  return NextResponse.json({ success: true })
}

async function copyFor(userId: number, source: any, name: string, assignmentId: number, readOnly: boolean) {
  return transaction(async (conn) => {
    const [ins]: any = await conn.query(
      `INSERT INTO case_table (project_id, created_by, hidden_from_members, parent_case_id, case_name, case_type, description, region_code, assignment_id, read_only)
       VALUES (?, ?, 0, ?, ?, 'comparative', ?, ?, ?, ?)`,
      [source.project_id, userId, source.case_id, name.slice(0, 100), source.description ?? null, source.region_code ?? null, assignmentId, readOnly ? 1 : 0],
    )
    const id = Number(ins.insertId)
    await copyCaseReferenceFields(conn, source, id)
    await copyCaseInventory(conn, source.case_id, id)
    return id
  })
}

export async function startAssignment(request: NextRequest, assignmentId: number) {
  const userId = await requireAuth(request)
  const row = await loadAssignment(assignmentId)
  if (!row) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  const denied = await projectAccessDenied(userId, row.project_id, 'viewer', { notFound: 'Assignment not found' })
  if (denied) return denied
  const existing = await queryOne<any>(`SELECT working_case_id FROM submission WHERE assignment_id = ? AND account_id = ?`, [assignmentId, userId])
  if (existing?.working_case_id) return NextResponse.json({ success: true, case_id: existing.working_case_id })
  if (!row.template_case_id) return NextResponse.json({ error: 'This assignment has no template case' }, { status: 400 })
  const template = await queryOne<any>(`SELECT * FROM case_table WHERE case_id = ?`, [row.template_case_id])
  if (!template) return NextResponse.json({ error: 'Template case not found' }, { status: 404 })
  const caseId = await copyFor(userId, template, `${row.title}`.slice(0, 80), assignmentId, false)
  await execute(
    `INSERT INTO submission (assignment_id, account_id, working_case_id) VALUES (?, ?, ?)
     ON CONFLICT (assignment_id, account_id) DO UPDATE SET working_case_id = EXCLUDED.working_case_id`,
    [assignmentId, userId, caseId],
  )
  return NextResponse.json({ success: true, case_id: caseId }, { status: 201 })
}

export async function submitAssignment(request: NextRequest, assignmentId: number) {
  const userId = await requireAuth(request)
  const row = await loadAssignment(assignmentId)
  if (!row) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  const sub = await queryOne<any>(`SELECT * FROM submission WHERE assignment_id = ? AND account_id = ?`, [assignmentId, userId])
  if (!sub?.working_case_id) return NextResponse.json({ error: 'Start the assignment first' }, { status: 400 })
  const working = await queryOne<any>(`SELECT * FROM case_table WHERE case_id = ? AND created_by = ?`, [sub.working_case_id, userId])
  if (!working) return NextResponse.json({ error: 'Case not found' }, { status: 404 })
  if (sub.frozen_case_id && row.due_at && new Date(row.due_at).getTime() < Date.now()) {
    return NextResponse.json({ error: 'The due date has passed' }, { status: 400 })
  }
  const frozen = await copyFor(userId, working, `${working.case_name} hand-in`.slice(0, 100), assignmentId, true)
  const run = await queryOne<any>(
    `SELECT run_id FROM assessment_runs WHERE case_id = ? AND status = 'completed' ORDER BY run_id DESC LIMIT 1`,
    [working.case_id],
  )
  await execute(
    `UPDATE submission SET frozen_case_id = ?, run_id = ?, submitted_at = now() WHERE submission_id = ?`,
    [frozen, run?.run_id ?? null, sub.submission_id],
  )
  return NextResponse.json({ success: true, case_id: frozen })
}

export async function listSubmissions(request: NextRequest, assignmentId: number) {
  const userId = await requireAuth(request)
  const row = await loadAssignment(assignmentId)
  if (!row) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 })
  const denied = await projectAccessDenied(userId, row.project_id, 'admin', { notFound: 'Assignment not found' })
  if (denied) return denied
  const people = await query<any>(
    `SELECT a.id AS account_id, a.full_name, a.email, s.working_case_id, s.frozen_case_id, s.submitted_at
     FROM project_members pm
     JOIN account a ON a.id = pm.user_id
     LEFT JOIN submission s ON s.account_id = a.id AND s.assignment_id = ?
     WHERE pm.project_id = ?`,
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
