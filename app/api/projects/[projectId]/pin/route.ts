import { NextRequest, NextResponse } from 'next/server';
import { execute, queryOne } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import { isAuthError, projectAccessDenied } from '@/lib/route-guard';
import { parseId } from '@/lib/ids';

// PUT    /api/projects/[projectId]/pin   pin a project for the caller (E19)
// DELETE /api/projects/[projectId]/pin   unpin it
// Any member may pin a project for themselves; a pin is the caller's own and
// changes nothing for anyone else (migrate-041).

const MAX_PINS = 20;
const NOT_FOUND = { notFound: 'Project not found' };
const NEEDS_MIGRATION = 'Pinning needs migration 041 on this database. Nothing was changed.';

function routeError(error: any, what: string) {
  if (isAuthError(error)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (error?.code === 'ER_NO_SUCH_TABLE') return NextResponse.json({ error: NEEDS_MIGRATION }, { status: 409 });
  console.error(`Project ${what} error:`, error);
  return NextResponse.json({ error: `Failed to ${what} the project` }, { status: 500 });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const userId = await requireAuth(request);
    const projectId = parseId((await params).projectId);
    const denied = await projectAccessDenied(userId, projectId, undefined, NOT_FOUND);
    if (denied) return denied;

    const already = await queryOne<any>(`SELECT 1 AS ok FROM project_pins WHERE user_id = ? AND project_id = ?`, [userId, projectId]);
    if (!already) {
      const count = await queryOne<any>(`SELECT COUNT(*) AS n FROM project_pins WHERE user_id = ?`, [userId]);
      if (Number(count?.n ?? 0) >= MAX_PINS) {
        return NextResponse.json({ error: `You can pin up to ${MAX_PINS} projects. Unpin one first.` }, { status: 409 });
      }
      await execute(`INSERT INTO project_pins (user_id, project_id) VALUES (?, ?) ON CONFLICT DO NOTHING`, [userId, projectId]);
    }
    return NextResponse.json({ success: true, project_id: projectId, pinned: true });
  } catch (error: any) {
    return routeError(error, 'pin');
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  try {
    const userId = await requireAuth(request);
    const projectId = parseId((await params).projectId);
    const denied = await projectAccessDenied(userId, projectId, undefined, NOT_FOUND);
    if (denied) return denied;
    await execute(`DELETE FROM project_pins WHERE user_id = ? AND project_id = ?`, [userId, projectId]);
    return NextResponse.json({ success: true, project_id: projectId, pinned: false });
  } catch (error: any) {
    return routeError(error, 'unpin');
  }
}
