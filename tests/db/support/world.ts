/**
 * A small, valid tenant world written with plain SQL, for tests that need
 * rows in the user tables of a fresh database. Two accounts, one project with
 * a member, two cases with a five-level tree each and a flow on each leaf.
 * Everything hangs off the project and the two accounts, so cleanup() removes
 * it all (cascades), leaving the reference tables untouched.
 */
import { randomBytes } from 'node:crypto';
import type { connect } from './db';

type Conn = Awaited<ReturnType<typeof connect>>;

export interface World {
  mark: string;
  ownerId: number;
  memberId: number;
  projectId: number;
  cases: { caseId: number; componentIds: number[]; leafId: number; flowId: number }[];
  cleanup: () => Promise<void>;
}

async function insert(conn: Conn, sql: string, params: unknown[]): Promise<number> {
  const [r] = await conn.query(sql, params);
  return (r as { insertId: number }).insertId;
}

export async function substanceId(conn: Conn, name: string): Promise<number> {
  const [r] = await conn.query('SELECT substance_id FROM substances WHERE substance_name = ?', [name]);
  const row = (r as { substance_id: number }[])[0];
  if (!row) throw new Error(`Seed substance "${name}" is missing`);
  return row.substance_id;
}

export async function createAccount(conn: Conn, label: string): Promise<number> {
  const tag = `${label}-${randomBytes(4).toString('hex')}`;
  // '!' is not a bcrypt hash, so nobody can sign in as a test account.
  return insert(
    conn,
    `INSERT INTO account (username, email, password_hash, account_type, is_active) VALUES (?, ?, '!', 'user', 1)`,
    [tag, `${tag}@example.test`],
  );
}

const LEVELS = ['product', 'machine_line', 'subprocess', 'operation', 'elemental_task'] as const;

export async function seedWorld(conn: Conn): Promise<World> {
  const mark = `dbtest-${randomBytes(4).toString('hex')}`;
  const ownerId = await createAccount(conn, `${mark}-owner`);
  const memberId = await createAccount(conn, `${mark}-member`);
  const projectId = await insert(
    conn,
    `INSERT INTO project (project_name, description, owner_id, lcia_method, region_code) VALUES (?, 'db test world', ?, 'CML 2001', 'US')`,
    [mark, ownerId],
  );
  const [[owner], [editor]] = await Promise.all([
    conn.query(`SELECT permission_id FROM permissions WHERE permission_name = 'owner'`),
    conn.query(`SELECT permission_id FROM permissions WHERE permission_name = 'editor'`),
  ]).then((rs) => rs.map(([r]) => r as { permission_id: number }[]));
  await conn.query(`INSERT INTO project_members (project_id, user_id, permission_id) VALUES (?, ?, ?), (?, ?, ?)`, [
    projectId, ownerId, owner.permission_id,
    projectId, memberId, editor.permission_id,
  ]);

  const electricity = await substanceId(conn, 'Electricity');
  const cases: World['cases'] = [];
  for (const [i, caseType] of (['base', 'comparative'] as const).entries()) {
    const caseId = await insert(
      conn,
      `INSERT INTO case_table (project_id, case_name, case_type, region_code, is_final) VALUES (?, ?, ?, 'US', ?)`,
      [projectId, `${mark} case ${i + 1}`, caseType, i === 0 ? 1 : 0],
    );
    const componentIds: number[] = [];
    let parent: number | null = null;
    for (const [level, type] of LEVELS.entries()) {
      parent = await insert(
        conn,
        `INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level)
         VALUES (?, ?, ?, ?, ?)`,
        [caseId, parent, `${mark} ${type}`, type, level + 1],
      );
      componentIds.push(parent);
    }
    const leafId = componentIds[componentIds.length - 1];
    const flowId = await insert(
      conn,
      `INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit) VALUES (?, ?, 'input', 2.5, 'kWh')`,
      [leafId, electricity],
    );
    cases.push({ caseId, componentIds, leafId, flowId });
  }

  return {
    mark,
    ownerId,
    memberId,
    projectId,
    cases,
    cleanup: async () => {
      // Runs reference the account with ON DELETE RESTRICT, so the project
      // (and with it cases, steps, flows, runs, results, members) goes first.
      await conn.query('DELETE FROM project WHERE project_id = ?', [projectId]);
      await conn.query('DELETE FROM account WHERE id IN (?, ?)', [ownerId, memberId]);
    },
  };
}
