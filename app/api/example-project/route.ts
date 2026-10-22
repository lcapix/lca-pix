import { NextRequest, NextResponse } from 'next/server';
import { queryOne, transaction } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import { isAuthError } from '@/lib/route-guard';
import { enforceRateLimit, RATE_LIMITS } from '@/lib/rate-limit';
import { buildSampleStudy, SampleUnavailable } from '@/lib/sample/build-sample';

/** What the sample is meant to teach, shown once when it is built. */
const SAMPLE_POINTS = [
  'Read it in order: the question, the tree, what goes in, the answer.',
  'Then make your own copy and change one thing.',
];

/**
 * Build the sample study in the signed-in account (education F1.3, F1.4, E02):
 * the painted steel bracket, read-only, with its base case run and the
 * "Shorter cure cycle" what-if run (lib/sample/). One per account: a repeat
 * returns the one that exists. Everything is written in one transaction, so a
 * failure leaves nothing behind.
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth(request);

    const existing = await queryOne<any>(
      'SELECT project_id FROM project WHERE owner_id = ? AND is_sample = 1 ORDER BY project_id LIMIT 1',
      [userId],
    );
    if (existing) return NextResponse.json(await describe(Number(existing.project_id), true));

    const limited = await enforceRateLimit(RATE_LIMITS.sampleBuild, [userId]);
    if (limited) return limited;

    const built = await transaction(async (conn) => {
      // Two requests at once (a double click) must not build two samples: the
      // account row is the lock, and the check runs again under it.
      await conn.query('SELECT id FROM account WHERE id = ? FOR UPDATE', [userId]);
      const [[again]]: any = await conn.query(
        'SELECT project_id FROM project WHERE owner_id = ? AND is_sample = 1 LIMIT 1',
        [userId],
      );
      if (again) return { projectId: Number(again.project_id), existed: true };
      const sample = await buildSampleStudy(conn, userId);
      return { projectId: sample.projectId, existed: false };
    });

    return NextResponse.json(await describe(built.projectId, built.existed));
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error instanceof SampleUnavailable || error?.code === 'ER_BAD_FIELD_ERROR' || error?.code === 'ER_NO_SUCH_TABLE') {
      console.error('Sample study unavailable:', error);
      return NextResponse.json(
        { error: 'The sample study is not available on this database yet. Nothing was created.' },
        { status: 409 },
      );
    }
    console.error('Sample study error:', error);
    return NextResponse.json({ error: 'Could not build the sample study. Nothing was created.' }, { status: 500 });
  }
}

/** The sample's ids: the project, its base case and what-if, and their latest runs. */
async function describe(projectId: number, existed: boolean) {
  const base = await queryOne<any>(
    `SELECT case_id,
            (SELECT MAX(run_id) FROM assessment_runs ar WHERE ar.case_id = c.case_id AND ar.status = 'completed') AS run_id
       FROM case_table c WHERE c.project_id = ? AND c.case_type = 'base' ORDER BY c.case_id LIMIT 1`,
    [projectId],
  );
  const whatIf = await queryOne<any>(
    `SELECT case_id,
            (SELECT MAX(run_id) FROM assessment_runs ar WHERE ar.case_id = c.case_id AND ar.status = 'completed') AS run_id
       FROM case_table c WHERE c.project_id = ? AND c.case_type = 'comparative' ORDER BY c.case_id LIMIT 1`,
    [projectId],
  );
  return {
    success: true,
    existed,
    project_id: projectId,
    case_id: base ? Number(base.case_id) : null,
    run_id: base?.run_id != null ? Number(base.run_id) : null,
    what_if_case_id: whatIf ? Number(whatIf.case_id) : null,
    what_if_run_id: whatIf?.run_id != null ? Number(whatIf.run_id) : null,
    points: SAMPLE_POINTS,
  };
}
