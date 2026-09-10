// scripts/seed-reference-rates.mjs
//
// Seeds the cost_rates "super database" with the static reference dataset so
// the cost/costing flow works in the MVP with ZERO live API hits. Values mirror
// lib/integrations/reference-rates.ts (curated public averages, vintage below).
// Idempotent: upserts on (rate_type, rate_key, region_code, effective_date).
//
//   node scripts/seed-reference-rates.mjs            # uses .env.local
//   DOTENV=/tmp/rds.env node scripts/seed-reference-rates.mjs   # prod RDS
//
import mysql from 'mysql2/promise';
import { config } from 'dotenv';
config({ path: process.env.DOTENV || '.env.local' });

const VINTAGE = '2026-06';
const EFF = `${VINTAGE}-01`;
const REGION = 'US';

// Labor: USD/hour (BLS OEWS national mean), keyed by SOC code (matches
// component.labor_occupation used by auto-populate).
const LABOR = [
  ['51-4121', 25.83, 'Welders/cutters'],
  ['51-4041', 24.40, 'Machinists'],
  ['51-2090', 18.60, 'Assemblers'],
  ['51-9161', 22.10, 'CNC operators'],
  ['51-0000', 21.00, 'Production worker (avg)'],
];
// Energy: USD/kWh (EIA average retail)
const ENERGY = [
  ['electricity', 'grid', 0.08, '$/kWh', 'EIA industrial avg'],
  ['natural_gas', 'industrial', 0.04, '$/kWh', 'EIA industrial avg'],
];
// Material: USD/kg (USGS + public market averages)
const MATERIAL = [
  ['aluminum', 2.10], ['steel', 0.95], ['stainless', 3.50], ['copper', 9.50],
  ['zinc', 2.80], ['nickel', 18.0], ['pet', 1.50], ['hdpe', 1.40], ['pvc', 1.20],
  ['plastic', 1.45], ['glass', 0.50], ['cardboard', 0.60], ['wood', 0.45],
];

const rows = [
  ...LABOR.map(([soc, rate]) => ['labor', soc, REGION, rate, '$/hr', `BLS OEWS reference ${VINTAGE}`]),
  ...ENERGY.map(([type, key, rate, unit, src]) => [type, key, REGION, rate, unit, `${src} reference ${VINTAGE}`]),
  ...MATERIAL.map(([key, rate]) => ['material', key, REGION, rate, '$/kg', `USGS/market reference ${VINTAGE}`]),
];

const c = await mysql.createConnection({
  host: process.env.DATABASE_HOST, port: +(process.env.DATABASE_PORT || 3306),
  user: process.env.DATABASE_USER, password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
});

let n = 0;
for (const [type, key, region, value, unit, source] of rows) {
  await c.query(
    `INSERT INTO cost_rates (rate_type, rate_key, region_code, rate_value, rate_unit, effective_date, source)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE rate_value = VALUES(rate_value), rate_unit = VALUES(rate_unit),
       source = VALUES(source), fetched_at = CURRENT_TIMESTAMP`,
    [type, key, region, value, unit, EFF, source],
  );
  n++;
}
const [[{ total }]] = await c.query('SELECT COUNT(*) total FROM cost_rates');
console.log(`seeded/updated ${n} reference rates; cost_rates now has ${total} rows`);
await c.end();
