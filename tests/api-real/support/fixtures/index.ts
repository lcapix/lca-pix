/**
 * Build the bracket study (a test fixture) in `user`'s account, in one
 * transaction, and return the ids the flow suites use.
 */
import { transaction } from '@/lib/db-helpers';
import type { TestUser } from '../users';
import { buildSampleStudy } from './build-bracket';

export async function buildBracket(user: TestUser) {
  const b = await transaction((conn) => buildSampleStudy(conn as any, user.id));
  return {
    project_id: b.projectId,
    case_id: b.baseCaseId,
    run_id: b.baseRunId,
    what_if_case_id: b.whatIfCaseId,
    what_if_run_id: b.whatIfRunId,
  };
}
