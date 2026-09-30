/**
 * Integration item 17: flows.quantity must keep the amount the user typed.
 *
 * Run with:  set -a; source .env.local; set +a; LOCAL_DB=1 npx vitest run tests/e2e-local
 * Needs migrate-030-flow-quantity-double.sql applied to the local database
 * (node --env-file=.env.local scripts/db/migrate.mjs). Refuses any host but
 * 127.0.0.1 / localhost.
 *
 * DECIMAL(15,6) stored 4.2e-7 kg as 0.000000, so the flow contributed nothing
 * to any result, and 1.23456789e-5 lost its last digits. A transport leg's
 * mass (transport_mass_kg, DECIMAL(18,6)) had the same floor. DOUBLE keeps
 * about 15-17 significant digits at any magnitude.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import mysql from 'mysql2/promise'

const enabled = process.env.LOCAL_DB === '1'
const host = process.env.DATABASE_HOST || '127.0.0.1'
const isLocal = ['127.0.0.1', 'localhost', '::1'].includes(host.trim().toLowerCase())
const d = describe.skipIf(!enabled)

const FILE = path.resolve(__dirname, '../../migrate-030-flow-quantity-double.sql')
const MARK = `flowqty-e2e-${Date.now()}`

let conn: mysql.Connection
let projectId: number
let componentId: number
let substanceId: number

async function columnType(column: string) {
  const [[col]]: any = await conn.query(
    `SELECT DATA_TYPE, IS_NULLABLE FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'flows' AND COLUMN_NAME = ?`,
    [column],
  )
  return { type: String(col.DATA_TYPE).toLowerCase(), nullable: col.IS_NULLABLE }
}

d('flows quantity precision (local DB, post-migration-030)', () => {
  beforeAll(async () => {
    if (!isLocal) throw new Error(`refusing to run against non-local host ${host}`)
    conn = await mysql.createConnection({
      host,
      user: process.env.DATABASE_USER || 'root',
      password: process.env.DATABASE_PASSWORD || '',
      database: process.env.DATABASE_NAME || 'lca_v3',
      port: +(process.env.DATABASE_PORT || 3306),
    })
    const [[acct]]: any = await conn.query(`SELECT id FROM account ORDER BY id LIMIT 1`)
    const [p]: any = await conn.query(
      `INSERT INTO project (project_name, description, owner_id) VALUES (?, 'flow quantity e2e throwaway', ?)`,
      [MARK, acct.id],
    )
    projectId = p.insertId
    const [c]: any = await conn.query(
      `INSERT INTO case_table (project_id, case_name, case_type) VALUES (?, ?, 'base')`,
      [projectId, MARK],
    )
    const [k]: any = await conn.query(
      `INSERT INTO component (case_id, component_name, component_type, hierarchy_level)
       VALUES (?, ?, 'product', 1)`,
      [c.insertId, MARK],
    )
    componentId = k.insertId
    const [[sub]]: any = await conn.query(`SELECT substance_id FROM substances ORDER BY substance_id LIMIT 1`)
    substanceId = sub.substance_id
  })

  afterAll(async () => {
    if (projectId) await conn.query(`DELETE FROM project WHERE project_id = ?`, [projectId])
    await conn?.end()
  })

  it('stores flows.quantity as DOUBLE NOT NULL and transport_mass_kg as DOUBLE NULL', async () => {
    expect(await columnType('quantity')).toEqual({ type: 'double', nullable: 'NO' })
    expect(await columnType('transport_mass_kg')).toEqual({ type: 'double', nullable: 'YES' })
    // Distances below a metre are not a thing anyone models: left as DECIMAL.
    expect((await columnType('transport_distance_km')).type).toBe('decimal')
  })

  it.each([4.2e-7, 4.2e-12, 1.23456789012e-5, 0.0004, 88730.123456789, 0])(
    'round-trips quantity %s exactly',
    async (value) => {
      const [ins]: any = await conn.query(
        `INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit) VALUES (?, ?, 'input', ?, 'kg')`,
        [componentId, substanceId, value],
      )
      const [[row]]: any = await conn.query(`SELECT quantity FROM flows WHERE flow_id = ?`, [ins.insertId])
      expect(Number(row.quantity)).toBe(value)
    },
  )

  it('round-trips a sub-milligram transport leg mass', async () => {
    const [ins]: any = await conn.query(
      `INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, transport_mass_kg, transport_distance_km, transport_mode)
       VALUES (?, ?, 'input', ?, 'tkm', ?, 500, 'truck')`,
      [componentId, substanceId, 4.2e-7 / 1000 * 500, 4.2e-7],
    )
    const [[row]]: any = await conn.query(
      `SELECT quantity, transport_mass_kg FROM flows WHERE flow_id = ?`,
      [ins.insertId],
    )
    expect(Number(row.transport_mass_kg)).toBe(4.2e-7)
    expect(Number(row.quantity)).toBe(4.2e-7 / 1000 * 500)
  })

  it('is idempotent: applying the file again changes nothing', () => {
    const env = { ...process.env } as Record<string, string | undefined>
    if (process.env.DATABASE_PASSWORD) env.MYSQL_PWD = process.env.DATABASE_PASSWORD
    const r = spawnSync(
      'mysql',
      [
        `--host=${host}`,
        `--port=${process.env.DATABASE_PORT || '3306'}`,
        `--user=${process.env.DATABASE_USER || 'root'}`,
        process.env.DATABASE_NAME || 'lca_v3',
      ],
      { input: readFileSync(FILE, 'utf8'), encoding: 'utf8', env: env as NodeJS.ProcessEnv },
    )
    expect(r.status).toBe(0)
    expect(r.stdout).toMatch(/flows\.quantity already DOUBLE/)
    expect(r.stdout).toMatch(/flows\.transport_mass_kg already DOUBLE/)
  })
})
