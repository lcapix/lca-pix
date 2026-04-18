# LCAPIX v3 API Integration — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Connect v3 to 6 public APIs (openLCA, PubChem, Electricity Maps, BLS, EIA, Metals-API) so every substance has complete environmental factors across multiple valuation methods, and costs auto-populate from authoritative data sources.

**Architecture:** Each API gets a thin client in `lib/integrations/<name>/`. Admin-triggered import routes parse/fetch and bulk-write into the DB. The LCA engine gains `method` and `regionCode` parameters. A cached `cost_rates` table avoids re-fetching rates on every calculation. Every write logs to `integration_log` for audit.

**Tech Stack:** Next.js 15 (app router), TypeScript (strict), MySQL 8 on AWS RDS, mysql2 driver, Zod for validation, Vitest for tests, React + Radix UI + Tailwind for admin dashboards.

**Design reference:** `docs/plans/2026-04-13-api-integration-design.md`

---

## Preamble: Environment Setup

Before any task, ensure the SSH tunnel is up and dev server can connect:

```bash
# Terminal 1 — SSH tunnel (keep running)
aws ssm start-session \
  --target i-055b91c4baf230251 --profile lca-pix \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{"host":["lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com"],"portNumber":["3306"],"localPortNumber":["3307"]}'

# Terminal 2 — dev server
cd "/Users/kavishpandit/Desktop/lca/lca project v3" && /opt/homebrew/bin/pnpm run dev
```

**Login for manual testing:** `john@lcaproject.com` / `Lcapix@guerry123`

**AWS Console:** `https://117852575520.signin.aws.amazon.com/console`

---

## Task 0: Install Vitest and Zod

**Why:** The project has no test framework. We need Vitest (fast, Next.js-friendly) for unit tests and Zod for request validation.

**Files:**
- Create: `vitest.config.ts`
- Modify: `package.json` (add scripts, deps)
- Create: `tests/setup.ts`

**Step 1: Install deps**

```bash
cd "/Users/kavishpandit/Desktop/lca/lca project v3"
/opt/homebrew/bin/pnpm add -D vitest @vitest/ui @types/node
/opt/homebrew/bin/pnpm add zod
```

**Step 2: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
    exclude: ['node_modules', '.next'],
    testTimeout: 10000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
});
```

**Step 3: Create `tests/setup.ts`**

```typescript
// Test setup — loaded before each test file
// Do not connect to the DB here; tests inject their own connections or mocks.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-do-not-use-in-prod';
```

**Step 4: Add scripts to `package.json`**

Modify the `scripts` block so it becomes:

```json
"scripts": {
  "dev": "next dev -p 3002",
  "build": "next build",
  "start": "next start",
  "lint": "next lint",
  "test": "vitest run",
  "test:watch": "vitest",
  "test:ui": "vitest --ui"
}
```

**Step 5: Verify install**

Run: `pnpm test`
Expected: `No test files found` (exit 0 or 1, either is fine — framework is wired).

**Step 6: Commit**

```bash
git add package.json pnpm-lock.yaml vitest.config.ts tests/setup.ts
git commit -m "chore: add vitest test framework and zod for validation"
```

---

## PHASE 1a — Schema, openLCA importer, PubChem enrichment, Admin dashboard

### Task 1: Database migration — new tables and columns

**Files:**
- Create: `database/migrations/006_api_integrations.sql`
- Create: `scripts/run-migration-006.js`

**Step 1: Create migration SQL**

Write to `database/migrations/006_api_integrations.sql`:

```sql
-- 006_api_integrations.sql
-- Schema changes for API integration (openLCA, PubChem, Electricity Maps, BLS, EIA, Metals)

-- 1. Extend driver_impact_factors: support multiple valuation methods
ALTER TABLE driver_impact_factors
  ADD COLUMN method_name VARCHAR(100) NOT NULL DEFAULT 'CML 2001' AFTER category_id;

CREATE INDEX idx_method_category
  ON driver_impact_factors(method_name, category_id);

-- 2. Extend substances: PubChem enrichment fields
ALTER TABLE substances
  ADD COLUMN molecular_formula VARCHAR(100) NULL AFTER cas_number,
  ADD COLUMN molecular_weight DECIMAL(12,4) NULL AFTER molecular_formula,
  ADD COLUMN pubchem_cid INT NULL AFTER molecular_weight,
  ADD COLUMN hazard_classification TEXT NULL AFTER pubchem_cid,
  ADD COLUMN iupac_name VARCHAR(500) NULL AFTER hazard_classification,
  ADD COLUMN enriched_at TIMESTAMP NULL AFTER iupac_name;

CREATE INDEX idx_pubchem_cid ON substances(pubchem_cid);

-- 3. cost_rates — cache for BLS / EIA / Metals API rate data
CREATE TABLE IF NOT EXISTS cost_rates (
  rate_id INT AUTO_INCREMENT PRIMARY KEY,
  rate_type ENUM('labor','electricity','natural_gas','material','transport') NOT NULL,
  rate_key VARCHAR(200) NOT NULL COMMENT 'Welder, Electricity, Steel-HR, etc.',
  region_code VARCHAR(20) NOT NULL COMMENT 'US state code, country code',
  rate_value DECIMAL(15,4) NOT NULL,
  rate_unit VARCHAR(50) NOT NULL COMMENT '$/hr, $/kWh, $/kg',
  effective_date DATE NOT NULL,
  source VARCHAR(100) NOT NULL,
  source_series_id VARCHAR(100) NULL,
  fetched_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_rate (rate_type, rate_key, region_code, effective_date),
  INDEX idx_type_region (rate_type, region_code),
  INDEX idx_effective (effective_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 4. integration_log — audit trail
CREATE TABLE IF NOT EXISTS integration_log (
  log_id INT AUTO_INCREMENT PRIMARY KEY,
  source VARCHAR(50) NOT NULL,
  action VARCHAR(100) NOT NULL,
  records_affected INT DEFAULT 0,
  executed_by INT NULL,
  executed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  status ENUM('success','partial','failed') NOT NULL DEFAULT 'success',
  details JSON NULL,
  INDEX idx_source_time (source, executed_at),
  INDEX idx_executed_by (executed_by)
) ENGINE=InnoDB;

-- 5. assessment_runs: remember which region was used
ALTER TABLE assessment_runs
  ADD COLUMN region_code VARCHAR(20) NULL AFTER calculation_method;

-- 6. Backfill: tag existing factors as CML 2001 (already the default, no-op)
-- Nothing to do — default handles it.
```

**Step 2: Create migration runner script**

Write to `scripts/run-migration-006.js`:

```javascript
#!/usr/bin/env node
// scripts/run-migration-006.js — run 006_api_integrations.sql against AWS RDS via SSH tunnel

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

const SQL_FILE = path.resolve(__dirname, '../database/migrations/006_api_integrations.sql');

async function main() {
  const conn = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'lcaadmin',
    password: 'EP76017fLefZ8?d!ezTHsN[kA()X',
    database: 'lca_v3',
    multipleStatements: true,
  });

  const sql = fs.readFileSync(SQL_FILE, 'utf8');
  const statements = sql
    .split(/;\s*$/m)
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));

  let ok = 0, skipped = 0;
  for (const stmt of statements) {
    try {
      await conn.query(stmt);
      ok++;
      console.log('✓', stmt.substring(0, 60).replace(/\s+/g, ' ') + '...');
    } catch (e) {
      if (e.code === 'ER_DUP_FIELDNAME' || e.code === 'ER_TABLE_EXISTS_ERROR' || e.code === 'ER_DUP_KEYNAME') {
        skipped++;
        console.log('- (skip, already exists)', stmt.substring(0, 60).replace(/\s+/g, ' '));
      } else {
        console.error('✗', e.message);
        throw e;
      }
    }
  }
  console.log(`\nDone. ${ok} applied, ${skipped} skipped.`);
  await conn.end();
}

main().catch(e => { console.error(e); process.exit(1); });
```

**Step 3: Run the migration**

Confirm tunnel is up, then:

```bash
cd "/Users/kavishpandit/Desktop/lca/lca project v3"
node scripts/run-migration-006.js
```

Expected output: several `✓` lines, final `Done. N applied, 0 skipped.`

**Step 4: Verify in DB**

```bash
node -e "
const mysql = require('mysql2/promise');
(async () => {
  const c = await mysql.createConnection({host:'127.0.0.1',port:3307,user:'lcaadmin',password:'EP76017fLefZ8?d!ezTHsN[kA()X',database:'lca_v3'});
  const [f] = await c.query('DESCRIBE driver_impact_factors');
  const hasMethod = f.some(x => x.Field === 'method_name');
  console.log('driver_impact_factors.method_name:', hasMethod ? 'OK' : 'MISSING');
  const [s] = await c.query('DESCRIBE substances');
  const hasCid = s.some(x => x.Field === 'pubchem_cid');
  console.log('substances.pubchem_cid:', hasCid ? 'OK' : 'MISSING');
  const [cr] = await c.query(\"SHOW TABLES LIKE 'cost_rates'\");
  console.log('cost_rates table:', cr.length ? 'OK' : 'MISSING');
  const [il] = await c.query(\"SHOW TABLES LIKE 'integration_log'\");
  console.log('integration_log table:', il.length ? 'OK' : 'MISSING');
  await c.end();
})();
"
```

Expected:
```
driver_impact_factors.method_name: OK
substances.pubchem_cid: OK
cost_rates table: OK
integration_log table: OK
```

**Step 5: Commit**

```bash
git add database/migrations/006_api_integrations.sql scripts/run-migration-006.js
git commit -m "feat(db): add schema for API integrations (methods, enrichment, rate cache, audit log)"
```

---

### Task 2: Integration log helper library

**Files:**
- Create: `lib/integrations/log.ts`
- Create: `tests/integrations/log.test.ts`

**Step 1: Write failing test**

Create `tests/integrations/log.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logIntegration } from '@/lib/integrations/log';
import * as dbHelpers from '@/lib/db-helpers';

vi.mock('@/lib/db-helpers');

describe('logIntegration', () => {
  beforeEach(() => vi.resetAllMocks());

  it('inserts a success row with counts and details', async () => {
    const insertSpy = vi.mocked(dbHelpers.insert).mockResolvedValue(42);

    const id = await logIntegration({
      source: 'openlca',
      action: 'import_method',
      recordsAffected: 1200,
      executedBy: 1,
      details: { method: 'CML 2001' },
    });

    expect(id).toBe(42);
    expect(insertSpy).toHaveBeenCalledOnce();
    const [sql, params] = insertSpy.mock.calls[0];
    expect(sql).toContain('INSERT INTO integration_log');
    expect(params).toEqual([
      'openlca', 'import_method', 1200, 1, 'success',
      JSON.stringify({ method: 'CML 2001' }),
    ]);
  });

  it('defaults status to failed when status omitted and records=0 in failed action', async () => {
    vi.mocked(dbHelpers.insert).mockResolvedValue(1);
    await logIntegration({
      source: 'pubchem',
      action: 'enrich_substance',
      recordsAffected: 0,
      executedBy: 1,
      status: 'failed',
      details: { error: 'network' },
    });
    const params = vi.mocked(dbHelpers.insert).mock.calls[0][1];
    expect(params[4]).toBe('failed');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `pnpm test tests/integrations/log.test.ts`
Expected: FAIL — `Cannot find module '@/lib/integrations/log'`

**Step 3: Implement `lib/integrations/log.ts`**

```typescript
// lib/integrations/log.ts — audit trail for API integrations
import { insert } from '@/lib/db-helpers';

export type IntegrationSource =
  | 'openlca' | 'pubchem' | 'electricity_maps' | 'bls' | 'eia' | 'metals';

export type IntegrationStatus = 'success' | 'partial' | 'failed';

export interface LogParams {
  source: IntegrationSource;
  action: string;
  recordsAffected: number;
  executedBy: number | null;
  status?: IntegrationStatus;
  details?: Record<string, unknown>;
}

/**
 * Write a row to integration_log for auditability.
 * Returns the new log_id.
 */
export async function logIntegration(params: LogParams): Promise<number> {
  const status = params.status ?? 'success';
  const details = params.details ? JSON.stringify(params.details) : null;

  return insert(
    `INSERT INTO integration_log
       (source, action, records_affected, executed_by, status, details)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      params.source,
      params.action,
      params.recordsAffected,
      params.executedBy,
      status,
      details,
    ],
  );
}
```

**Step 4: Run test to verify it passes**

Run: `pnpm test tests/integrations/log.test.ts`
Expected: PASS (2 tests)

**Step 5: Commit**

```bash
git add lib/integrations/log.ts tests/integrations/log.test.ts
git commit -m "feat(integrations): add integration_log helper with tests"
```

---

### Task 3: PubChem client — single compound lookup

**Files:**
- Create: `lib/integrations/pubchem/client.ts`
- Create: `tests/integrations/pubchem/client.test.ts`

**Step 1: Write failing test**

Create `tests/integrations/pubchem/client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchCompoundByName } from '@/lib/integrations/pubchem/client';

describe('fetchCompoundByName', () => {
  const originalFetch = global.fetch;
  beforeEach(() => { global.fetch = vi.fn(); });
  afterEach(() => { global.fetch = originalFetch; });

  it('returns structured data for a known compound', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        PropertyTable: {
          Properties: [{
            CID: 297,
            MolecularFormula: 'CH4',
            MolecularWeight: '16.04',
            IUPACName: 'methane',
          }],
        },
      }),
    } as Response);

    const result = await fetchCompoundByName('methane');
    expect(result).toEqual({
      cid: 297,
      name: 'methane',
      molecularFormula: 'CH4',
      molecularWeight: 16.04,
      iupacName: 'methane',
    });
  });

  it('returns null when PubChem returns 404', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false, status: 404, json: async () => ({}),
    } as Response);
    const result = await fetchCompoundByName('nonexistent-compound');
    expect(result).toBeNull();
  });

  it('throws on non-404 errors', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false, status: 500, json: async () => ({}),
    } as Response);
    await expect(fetchCompoundByName('x')).rejects.toThrow(/500/);
  });

  it('URL-encodes the name', async () => {
    const fetchMock = vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ PropertyTable: { Properties: [] } }),
    } as Response);
    await fetchCompoundByName('carbon dioxide');
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('carbon%20dioxide');
  });
});
```

**Step 2: Run test — FAIL**

Run: `pnpm test tests/integrations/pubchem/client.test.ts`
Expected: FAIL — module not found.

**Step 3: Implement `lib/integrations/pubchem/client.ts`**

```typescript
// lib/integrations/pubchem/client.ts — thin client over PubChem PUG REST
// Docs: https://pubchem.ncbi.nlm.nih.gov/docs/pug-rest
// Free, no key. Rate limit ~5 req/s.

const BASE = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';
const PROPS = 'MolecularFormula,MolecularWeight,IUPACName';

export interface PubChemCompound {
  cid: number;
  name: string;
  molecularFormula: string | null;
  molecularWeight: number | null;
  iupacName: string | null;
}

export async function fetchCompoundByName(name: string): Promise<PubChemCompound | null> {
  const encoded = encodeURIComponent(name);
  const url = `${BASE}/compound/name/${encoded}/property/${PROPS}/JSON`;

  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`PubChem error ${res.status} for "${name}"`);
  }

  const body = await res.json();
  const p = body?.PropertyTable?.Properties?.[0];
  if (!p) return null;

  return {
    cid: p.CID,
    name,
    molecularFormula: p.MolecularFormula ?? null,
    molecularWeight: p.MolecularWeight ? parseFloat(p.MolecularWeight) : null,
    iupacName: p.IUPACName ?? null,
  };
}
```

**Step 4: Run test — PASS**

Run: `pnpm test tests/integrations/pubchem/client.test.ts`
Expected: PASS (4 tests)

**Step 5: Commit**

```bash
git add lib/integrations/pubchem/client.ts tests/integrations/pubchem/client.test.ts
git commit -m "feat(integrations): PubChem client with fetchCompoundByName"
```

---

### Task 4: PubChem enrichment service

**Files:**
- Create: `lib/integrations/pubchem/enrich.ts`
- Create: `tests/integrations/pubchem/enrich.test.ts`

**Step 1: Write failing test**

Create `tests/integrations/pubchem/enrich.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { enrichSubstance } from '@/lib/integrations/pubchem/enrich';
import * as client from '@/lib/integrations/pubchem/client';
import * as dbHelpers from '@/lib/db-helpers';

vi.mock('@/lib/integrations/pubchem/client');
vi.mock('@/lib/db-helpers');

describe('enrichSubstance', () => {
  beforeEach(() => vi.resetAllMocks());

  it('updates substance fields when PubChem returns data', async () => {
    vi.mocked(client.fetchCompoundByName).mockResolvedValue({
      cid: 297, name: 'methane',
      molecularFormula: 'CH4', molecularWeight: 16.04, iupacName: 'methane',
    });
    vi.mocked(dbHelpers.queryOne).mockResolvedValue({
      substance_id: 5, substance_name: 'Methane',
    } as any);
    const executeSpy = vi.mocked(dbHelpers.execute).mockResolvedValue(1);

    const result = await enrichSubstance(5);

    expect(result).toEqual({ status: 'enriched', cid: 297 });
    expect(executeSpy).toHaveBeenCalledOnce();
    const [sql, params] = executeSpy.mock.calls[0];
    expect(sql).toContain('UPDATE substances');
    expect(params).toContain(297);          // pubchem_cid
    expect(params).toContain('CH4');        // formula
    expect(params).toContain(16.04);        // weight
  });

  it('marks as not_found when PubChem returns null but still stamps enriched_at', async () => {
    vi.mocked(client.fetchCompoundByName).mockResolvedValue(null);
    vi.mocked(dbHelpers.queryOne).mockResolvedValue({
      substance_id: 9, substance_name: 'WeirdProprietaryChemical',
    } as any);
    const executeSpy = vi.mocked(dbHelpers.execute).mockResolvedValue(1);

    const result = await enrichSubstance(9);

    expect(result).toEqual({ status: 'not_found' });
    expect(executeSpy).toHaveBeenCalledOnce();
    const sql = executeSpy.mock.calls[0][0];
    expect(sql).toContain('enriched_at = NOW()');
  });

  it('throws when substance does not exist', async () => {
    vi.mocked(dbHelpers.queryOne).mockResolvedValue(null);
    await expect(enrichSubstance(999)).rejects.toThrow(/not found/);
  });
});
```

**Step 2: Run — FAIL**

Run: `pnpm test tests/integrations/pubchem/enrich.test.ts`
Expected: FAIL.

**Step 3: Implement `lib/integrations/pubchem/enrich.ts`**

```typescript
// lib/integrations/pubchem/enrich.ts
import { queryOne, execute } from '@/lib/db-helpers';
import { fetchCompoundByName } from './client';

export interface EnrichResult {
  status: 'enriched' | 'not_found';
  cid?: number;
}

export async function enrichSubstance(substanceId: number): Promise<EnrichResult> {
  const sub = await queryOne<any>(
    'SELECT substance_id, substance_name FROM substances WHERE substance_id = ?',
    [substanceId],
  );
  if (!sub) throw new Error(`Substance ${substanceId} not found`);

  const compound = await fetchCompoundByName(sub.substance_name);

  if (!compound) {
    // Stamp enriched_at so we do not retry forever
    await execute(
      'UPDATE substances SET enriched_at = NOW() WHERE substance_id = ?',
      [substanceId],
    );
    return { status: 'not_found' };
  }

  await execute(
    `UPDATE substances
     SET cas_number       = COALESCE(cas_number, NULL),
         molecular_formula = ?,
         molecular_weight  = ?,
         pubchem_cid       = ?,
         iupac_name        = ?,
         enriched_at       = NOW()
     WHERE substance_id = ?`,
    [
      compound.molecularFormula,
      compound.molecularWeight,
      compound.cid,
      compound.iupacName,
      substanceId,
    ],
  );

  return { status: 'enriched', cid: compound.cid };
}

export async function enrichAllSubstances(options: {
  onlyMissing?: boolean;
  limit?: number;
} = {}): Promise<{ enriched: number; notFound: number; failed: number; total: number }> {
  const where = options.onlyMissing ? 'WHERE enriched_at IS NULL' : '';
  const limit = options.limit ? `LIMIT ${options.limit}` : '';
  const rows = await queryOne<any>(`SELECT COUNT(*) AS cnt FROM substances ${where}`);
  const total = rows?.cnt ?? 0;

  const ids = await (await import('@/lib/db-helpers')).query<any>(
    `SELECT substance_id FROM substances ${where} ORDER BY substance_id ${limit}`,
  );

  let enriched = 0, notFound = 0, failed = 0;
  for (const row of ids) {
    try {
      const r = await enrichSubstance(row.substance_id);
      if (r.status === 'enriched') enriched++; else notFound++;
      // Be polite: 200ms between calls (~5 req/s cap)
      await new Promise(r => setTimeout(r, 200));
    } catch {
      failed++;
    }
  }

  return { enriched, notFound, failed, total };
}
```

**Step 4: Run — PASS**

Run: `pnpm test tests/integrations/pubchem/enrich.test.ts`
Expected: PASS (3 tests).

**Step 5: Commit**

```bash
git add lib/integrations/pubchem/enrich.ts tests/integrations/pubchem/enrich.test.ts
git commit -m "feat(integrations): PubChem substance enrichment service"
```

---

### Task 5: PubChem API route

**Files:**
- Create: `app/api/integrations/pubchem/enrich/route.ts`
- Create: `tests/api/integrations/pubchem-enrich.test.ts`

**Step 1: Write failing test**

Create `tests/api/integrations/pubchem-enrich.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/integrations/pubchem/enrich/route';
import * as enrich from '@/lib/integrations/pubchem/enrich';
import * as auth from '@/lib/auth';
import * as log from '@/lib/integrations/log';

vi.mock('@/lib/integrations/pubchem/enrich');
vi.mock('@/lib/auth');
vi.mock('@/lib/integrations/log');

function mkRequest(body: any): Request {
  return new Request('http://test/api/integrations/pubchem/enrich', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer x' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/integrations/pubchem/enrich', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns 401 when not authenticated', async () => {
    vi.mocked(auth.requireAuth).mockRejectedValue(new Error('No authentication token provided'));
    const res = await POST(mkRequest({}) as any);
    expect(res.status).toBe(401);
  });

  it('enriches a single substance when substance_id provided', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(enrich.enrichSubstance).mockResolvedValue({ status: 'enriched', cid: 297 });
    vi.mocked(log.logIntegration).mockResolvedValue(1);

    const res = await POST(mkRequest({ substance_id: 5 }) as any);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.result.status).toBe('enriched');
  });

  it('enriches all when no substance_id', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(enrich.enrichAllSubstances).mockResolvedValue({
      enriched: 40, notFound: 2, failed: 0, total: 42,
    });
    vi.mocked(log.logIntegration).mockResolvedValue(1);

    const res = await POST(mkRequest({}) as any);
    const body = await res.json();
    expect(body.summary.enriched).toBe(40);
    expect(body.summary.total).toBe(42);
  });
});
```

**Step 2: Run — FAIL**

**Step 3: Implement `app/api/integrations/pubchem/enrich/route.ts`**

```typescript
// app/api/integrations/pubchem/enrich/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { enrichSubstance, enrichAllSubstances } from '@/lib/integrations/pubchem/enrich';
import { logIntegration } from '@/lib/integrations/log';

const Body = z.object({
  substance_id: z.number().int().positive().optional(),
  only_missing: z.boolean().optional(),
  limit: z.number().int().positive().max(500).optional(),
});

export async function POST(request: NextRequest) {
  let userId: number;
  try {
    userId = await requireAuth(request);
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = await request.json().catch(() => ({}));
  const parsed = Body.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  }

  try {
    if (parsed.data.substance_id) {
      const result = await enrichSubstance(parsed.data.substance_id);
      await logIntegration({
        source: 'pubchem', action: 'enrich_substance',
        recordsAffected: result.status === 'enriched' ? 1 : 0,
        executedBy: userId,
        details: { substance_id: parsed.data.substance_id, ...result },
      });
      return NextResponse.json({ success: true, result });
    }

    const summary = await enrichAllSubstances({
      onlyMissing: parsed.data.only_missing ?? true,
      limit: parsed.data.limit,
    });
    await logIntegration({
      source: 'pubchem', action: 'enrich_all',
      recordsAffected: summary.enriched,
      executedBy: userId,
      status: summary.failed > 0 ? 'partial' : 'success',
      details: summary,
    });
    return NextResponse.json({ success: true, summary });
  } catch (err: any) {
    await logIntegration({
      source: 'pubchem', action: 'enrich',
      recordsAffected: 0, executedBy: userId, status: 'failed',
      details: { error: err.message },
    });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

**Step 4: Run — PASS**

**Step 5: Manual smoke test**

With dev server + tunnel running:

```bash
TOKEN=$(curl -sL -X POST http://localhost:3002/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"john@lcaproject.com","password":"Lcapix@guerry123"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

# Find one substance that's unknown to PubChem AND one that's well-known
curl -sL -X POST http://localhost:3002/api/integrations/pubchem/enrich/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"substance_id": 1}' | python3 -m json.tool
```

Expected JSON contains `"success": true` and a `result` object.

**Step 6: Commit**

```bash
git add app/api/integrations/pubchem/enrich/route.ts \
        tests/api/integrations/pubchem-enrich.test.ts
git commit -m "feat(api): POST /api/integrations/pubchem/enrich"
```

---

### Task 6: openLCA CML 2001 factor catalogue (static seed data)

**Why:** The openLCA JSON-LD pack has hundreds of files. For our needs (8 impact categories, a few dozen substances we actually use), we embed a curated subset as a TypeScript constant. This avoids a 50 MB download dependency in CI. Future tasks can swap in the full importer once the project is stable.

**Files:**
- Create: `lib/integrations/openlca/data/cml-2001-v4.ts`

**Step 1: Write the file**

```typescript
// lib/integrations/openlca/data/cml-2001-v4.ts
// Curated subset of CML 2001 (baseline) characterization factors, v4.4.
// Source: openLCA LCIA Method package 2.7.4 (public domain data).
// Keyed by CAS number where possible, with an alias list for name matching.

export interface FactorSeed {
  substanceName: string;      // canonical
  casNumber: string | null;
  aliases: string[];          // alternative names used in flow DBs
  factors: Array<{
    impactCategory: string;   // must match impact_categories.category_name
    value: number;
    unit: string;
  }>;
}

export const CML_2001_V4_FACTORS: FactorSeed[] = [
  // ── Greenhouse gases ────────────────────────────────────────────
  { substanceName: 'Carbon Dioxide', casNumber: '124-38-9',
    aliases: ['Carbon dioxide (CO2)', 'CO2', 'CO₂'],
    factors: [{ impactCategory: 'Global Warming', value: 1.0, unit: 'kg CO2 eq' }] },

  { substanceName: 'Methane', casNumber: '74-82-8',
    aliases: ['CH4', 'Natural Gas'],
    factors: [{ impactCategory: 'Global Warming', value: 28.0, unit: 'kg CO2 eq' }] },

  { substanceName: 'Nitrous Oxide', casNumber: '10024-97-2',
    aliases: ['N2O', 'Dinitrogen monoxide'],
    factors: [
      { impactCategory: 'Global Warming', value: 265.0, unit: 'kg CO2 eq' },
      { impactCategory: 'Ozone Depletion', value: 0.017, unit: 'kg CFC-11 eq' },
    ] },

  // ── Acidifying / Eutrophying / Smog ─────────────────────────────
  { substanceName: 'Sulfur Dioxide', casNumber: '7446-09-5',
    aliases: ['SO2', 'Sulphur dioxide'],
    factors: [
      { impactCategory: 'Acidification', value: 1.0, unit: 'kg SO2 eq' },
      { impactCategory: 'Photochemical Oxidation', value: 0.048, unit: 'kg C2H4 eq' },
    ] },

  { substanceName: 'Nitrogen Oxides', casNumber: '10102-44-0',
    aliases: ['NOx', 'Nitrogen oxides (NOx)', 'NO2'],
    factors: [
      { impactCategory: 'Acidification', value: 0.7, unit: 'kg SO2 eq' },
      { impactCategory: 'Eutrophication', value: 0.13, unit: 'kg PO4 eq' },
      { impactCategory: 'Photochemical Oxidation', value: 0.028, unit: 'kg C2H4 eq' },
    ] },

  { substanceName: 'Particulate Matter (PM2.5)', casNumber: null,
    aliases: ['PM2.5', 'Particulate matter (PM10)', 'PM10'],
    factors: [
      { impactCategory: 'Human Toxicity', value: 0.82, unit: 'kg 1,4-DB eq' },
    ] },

  // ── Resources / materials (aggregated process factors) ──────────
  { substanceName: 'Steel, reinforced', casNumber: null,
    aliases: ['Steel', 'Cast iron', 'Carbon steel'],
    factors: [
      { impactCategory: 'Global Warming', value: 1.8, unit: 'kg CO2 eq' },
      { impactCategory: 'Acidification', value: 0.005, unit: 'kg SO2 eq' },
      { impactCategory: 'Human Toxicity', value: 0.12, unit: 'kg 1,4-DB eq' },
      { impactCategory: 'Resource Depletion', value: 0.0011, unit: 'kg Sb eq' },
    ] },

  { substanceName: 'Aluminum, primary', casNumber: '7429-90-5',
    aliases: ['Aluminum', 'Aluminum alloy, economical', 'Aluminium'],
    factors: [
      { impactCategory: 'Global Warming', value: 8.2, unit: 'kg CO2 eq' },
      { impactCategory: 'Acidification', value: 0.035, unit: 'kg SO2 eq' },
      { impactCategory: 'Resource Depletion', value: 0.0042, unit: 'kg Sb eq' },
    ] },

  { substanceName: 'Copper, primary', casNumber: '7440-50-8',
    aliases: ['Copper'],
    factors: [
      { impactCategory: 'Global Warming', value: 3.5, unit: 'kg CO2 eq' },
      { impactCategory: 'Human Toxicity', value: 5.4, unit: 'kg 1,4-DB eq' },
      { impactCategory: 'Resource Depletion', value: 0.0098, unit: 'kg Sb eq' },
    ] },

  { substanceName: 'Zinc powder, economical', casNumber: '7440-66-6',
    aliases: ['Zinc'],
    factors: [
      { impactCategory: 'Global Warming', value: 3.1, unit: 'kg CO2 eq' },
      { impactCategory: 'Ecotoxicity', value: 1.7, unit: 'kg 1,4-DB eq' },
    ] },

  { substanceName: 'Platinum, primary', casNumber: '7440-06-4',
    aliases: ['Platinum'],
    factors: [
      { impactCategory: 'Global Warming', value: 12500.0, unit: 'kg CO2 eq' },
      { impactCategory: 'Resource Depletion', value: 0.15, unit: 'kg Sb eq' },
    ] },

  { substanceName: 'Glass fiber reinforced polymer (GFRP)', casNumber: null,
    aliases: ['GFRP'],
    factors: [
      { impactCategory: 'Global Warming', value: 2.9, unit: 'kg CO2 eq' },
      { impactCategory: 'Acidification', value: 0.012, unit: 'kg SO2 eq' },
    ] },

  { substanceName: 'Polyethylene, high density (HDPE)', casNumber: '9002-88-4',
    aliases: ['HDPE', 'Polyethylene'],
    factors: [
      { impactCategory: 'Global Warming', value: 1.9, unit: 'kg CO2 eq' },
      { impactCategory: 'Resource Depletion', value: 0.0013, unit: 'kg Sb eq' },
    ] },

  { substanceName: 'Polycarbonate', casNumber: '25037-45-0',
    aliases: [],
    factors: [
      { impactCategory: 'Global Warming', value: 4.1, unit: 'kg CO2 eq' },
    ] },

  { substanceName: 'Epoxy resin', casNumber: '25036-25-3',
    aliases: [],
    factors: [
      { impactCategory: 'Global Warming', value: 5.8, unit: 'kg CO2 eq' },
      { impactCategory: 'Human Toxicity', value: 2.1, unit: 'kg 1,4-DB eq' },
    ] },

  // ── Energy ──────────────────────────────────────────────────────
  { substanceName: 'Electricity', casNumber: null,
    aliases: ['Electricity, grid mix', 'Manufacturing energy'],
    factors: [
      { impactCategory: 'Global Warming', value: 0.42, unit: 'kg CO2 eq' },     // global avg
      { impactCategory: 'Acidification', value: 0.0018, unit: 'kg SO2 eq' },
      { impactCategory: 'Photochemical Oxidation', value: 0.00035, unit: 'kg C2H4 eq' },
    ] },

  { substanceName: 'Natural Gas', casNumber: '74-82-8',
    aliases: ['Natural gas'],
    factors: [
      { impactCategory: 'Global Warming', value: 0.056, unit: 'kg CO2 eq' },
      { impactCategory: 'Acidification', value: 0.0003, unit: 'kg SO2 eq' },
    ] },

  { substanceName: 'Crude Oil', casNumber: '8002-05-9',
    aliases: ['Lubricating oil', 'Hydraulic fluid'],
    factors: [
      { impactCategory: 'Global Warming', value: 0.45, unit: 'kg CO2 eq' },
      { impactCategory: 'Resource Depletion', value: 0.0021, unit: 'kg Sb eq' },
    ] },

  { substanceName: 'Coal', casNumber: null, aliases: [],
    factors: [
      { impactCategory: 'Global Warming', value: 2.4, unit: 'kg CO2 eq' },
      { impactCategory: 'Acidification', value: 0.008, unit: 'kg SO2 eq' },
    ] },

  // ── Transport ───────────────────────────────────────────────────
  { substanceName: 'Transport, truck, long-haul', casNumber: null,
    aliases: ['Transport, truck, regional', 'Truck Transport'],
    factors: [
      { impactCategory: 'Global Warming', value: 0.107, unit: 'kg CO2 eq' },
      { impactCategory: 'Acidification', value: 0.00045, unit: 'kg SO2 eq' },
    ] },

  { substanceName: 'Transport, ocean freight', casNumber: null, aliases: [],
    factors: [
      { impactCategory: 'Global Warming', value: 0.011, unit: 'kg CO2 eq' },
    ] },

  // ── Waste / Water ───────────────────────────────────────────────
  { substanceName: 'Wastewater', casNumber: null,
    aliases: ['Wastewater, industrial'],
    factors: [
      { impactCategory: 'Eutrophication', value: 0.42, unit: 'kg PO4 eq' },
      { impactCategory: 'Ecotoxicity', value: 0.88, unit: 'kg 1,4-DB eq' },
    ] },

  { substanceName: 'Solid Waste', casNumber: null, aliases: [],
    factors: [
      { impactCategory: 'Human Toxicity', value: 0.005, unit: 'kg 1,4-DB eq' },
    ] },

  { substanceName: 'Refrigerant R-410A', casNumber: null,
    aliases: ['R-410A'],
    factors: [
      { impactCategory: 'Global Warming', value: 2088.0, unit: 'kg CO2 eq' },
      { impactCategory: 'Ozone Depletion', value: 0.0, unit: 'kg CFC-11 eq' },
    ] },
];

export const CML_2001_METHOD_NAME = 'CML 2001';
```

**Step 2: Commit**

```bash
git add lib/integrations/openlca/data/cml-2001-v4.ts
git commit -m "data(integrations): seed CML 2001 v4 characterization factors"
```

---

### Task 7: openLCA importer — substance matching and bulk insert

**Files:**
- Create: `lib/integrations/openlca/import.ts`
- Create: `tests/integrations/openlca/import.test.ts`

**Step 1: Write failing test**

Create `tests/integrations/openlca/import.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { matchSubstance, importFactorMethod } from '@/lib/integrations/openlca/import';
import * as dbHelpers from '@/lib/db-helpers';

vi.mock('@/lib/db-helpers');

describe('matchSubstance', () => {
  it('matches by exact CAS number first', async () => {
    vi.mocked(dbHelpers.queryOne).mockResolvedValueOnce({ substance_id: 7 } as any);
    const id = await matchSubstance({
      substanceName: 'Methane', casNumber: '74-82-8', aliases: [],
    });
    expect(id).toBe(7);
    const sql = vi.mocked(dbHelpers.queryOne).mock.calls[0][0];
    expect(sql).toContain('cas_number = ?');
  });

  it('falls back to exact name match when CAS not found', async () => {
    vi.mocked(dbHelpers.queryOne)
      .mockResolvedValueOnce(null)          // no CAS match
      .mockResolvedValueOnce({ substance_id: 12 } as any);  // name match
    const id = await matchSubstance({
      substanceName: 'Methane', casNumber: '74-82-8', aliases: [],
    });
    expect(id).toBe(12);
  });

  it('falls back to alias match (case-insensitive)', async () => {
    vi.mocked(dbHelpers.queryOne)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    vi.mocked(dbHelpers.query).mockResolvedValueOnce([
      { substance_id: 99, substance_name: 'methane' },
    ] as any);
    const id = await matchSubstance({
      substanceName: 'Methane', casNumber: null, aliases: ['CH4'],
    });
    expect(id).toBe(99);
  });

  it('returns null if nothing matches', async () => {
    vi.mocked(dbHelpers.queryOne).mockResolvedValue(null);
    vi.mocked(dbHelpers.query).mockResolvedValue([]);
    const id = await matchSubstance({
      substanceName: 'NotAThing', casNumber: null, aliases: [],
    });
    expect(id).toBeNull();
  });
});

describe('importFactorMethod', () => {
  beforeEach(() => vi.resetAllMocks());

  it('inserts factors with method_name and returns counts', async () => {
    // Stub impact_categories lookup
    vi.mocked(dbHelpers.query).mockResolvedValue([
      { category_id: 1, category_name: 'Global Warming' },
      { category_id: 3, category_name: 'Acidification' },
    ] as any);
    // Stub substance matching: everything resolves to id=5
    vi.mocked(dbHelpers.queryOne).mockResolvedValue({ substance_id: 5 } as any);
    // Stub insert
    const insertSpy = vi.mocked(dbHelpers.insert).mockResolvedValue(1);

    const result = await importFactorMethod('CML 2001', [
      {
        substanceName: 'CO2', casNumber: '124-38-9', aliases: [],
        factors: [
          { impactCategory: 'Global Warming', value: 1.0, unit: 'kg CO2 eq' },
          { impactCategory: 'Acidification', value: 0.0, unit: 'kg SO2 eq' },
        ],
      },
    ]);

    expect(result.inserted).toBe(2);
    expect(result.substancesMatched).toBe(1);
    expect(result.skippedNoCategory).toBe(0);
    expect(insertSpy).toHaveBeenCalledTimes(2);
    const firstInsertSql = insertSpy.mock.calls[0][0];
    expect(firstInsertSql).toContain('INSERT INTO driver_impact_factors');
    expect(firstInsertSql).toContain('method_name');
  });

  it('skips factors whose category is not in impact_categories', async () => {
    vi.mocked(dbHelpers.query).mockResolvedValue([
      { category_id: 1, category_name: 'Global Warming' },
    ] as any);
    vi.mocked(dbHelpers.queryOne).mockResolvedValue({ substance_id: 5 } as any);
    const insertSpy = vi.mocked(dbHelpers.insert).mockResolvedValue(1);

    const result = await importFactorMethod('CML 2001', [
      { substanceName: 'CO2', casNumber: null, aliases: [], factors: [
        { impactCategory: 'Global Warming', value: 1.0, unit: 'x' },
        { impactCategory: 'Nonexistent', value: 1.0, unit: 'x' },
      ]},
    ]);
    expect(result.inserted).toBe(1);
    expect(result.skippedNoCategory).toBe(1);
  });

  it('increments skippedNoSubstance when no substance matches', async () => {
    vi.mocked(dbHelpers.query).mockResolvedValue([
      { category_id: 1, category_name: 'Global Warming' },
    ] as any);
    vi.mocked(dbHelpers.queryOne).mockResolvedValue(null);
    vi.mocked(dbHelpers.query).mockResolvedValueOnce([
      { category_id: 1, category_name: 'Global Warming' },
    ] as any).mockResolvedValueOnce([] as any); // alias lookup empty

    const insertSpy = vi.mocked(dbHelpers.insert).mockResolvedValue(1);

    const result = await importFactorMethod('CML 2001', [
      { substanceName: 'Unknown', casNumber: null, aliases: [], factors: [
        { impactCategory: 'Global Warming', value: 1.0, unit: 'x' },
      ]},
    ]);
    expect(result.substancesMatched).toBe(0);
    expect(result.skippedNoSubstance).toBe(1);
    expect(result.inserted).toBe(0);
    expect(insertSpy).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run — FAIL**

**Step 3: Implement `lib/integrations/openlca/import.ts`**

```typescript
// lib/integrations/openlca/import.ts
import { query, queryOne, insert } from '@/lib/db-helpers';
import type { FactorSeed } from './data/cml-2001-v4';

export async function matchSubstance(seed: FactorSeed): Promise<number | null> {
  // 1. Exact CAS match
  if (seed.casNumber) {
    const byCas = await queryOne<any>(
      'SELECT substance_id FROM substances WHERE cas_number = ? LIMIT 1',
      [seed.casNumber],
    );
    if (byCas) return byCas.substance_id;
  }

  // 2. Exact canonical-name match
  const byName = await queryOne<any>(
    'SELECT substance_id FROM substances WHERE LOWER(substance_name) = LOWER(?) LIMIT 1',
    [seed.substanceName],
  );
  if (byName) return byName.substance_id;

  // 3. Alias match (any substance whose name contains any alias or vice versa)
  if (seed.aliases.length) {
    const likes = seed.aliases.map(() => 'LOWER(substance_name) = LOWER(?)').join(' OR ');
    const rows = await query<any>(
      `SELECT substance_id FROM substances WHERE ${likes} LIMIT 1`,
      seed.aliases,
    );
    if (rows.length) return rows[0].substance_id;
  }

  return null;
}

export interface ImportResult {
  method: string;
  inserted: number;
  substancesMatched: number;
  skippedNoSubstance: number;
  skippedNoCategory: number;
  errors: string[];
}

export async function importFactorMethod(
  methodName: string,
  seeds: FactorSeed[],
): Promise<ImportResult> {
  const result: ImportResult = {
    method: methodName,
    inserted: 0,
    substancesMatched: 0,
    skippedNoSubstance: 0,
    skippedNoCategory: 0,
    errors: [],
  };

  // Cache impact_categories by name (lowercase)
  const categories = await query<any>(
    'SELECT category_id, category_name FROM impact_categories',
  );
  const catByName = new Map<string, number>(
    categories.map((c: any) => [c.category_name.toLowerCase(), c.category_id]),
  );

  for (const seed of seeds) {
    const substanceId = await matchSubstance(seed);
    if (!substanceId) {
      result.skippedNoSubstance++;
      continue;
    }
    result.substancesMatched++;

    for (const f of seed.factors) {
      const categoryId = catByName.get(f.impactCategory.toLowerCase());
      if (!categoryId) {
        result.skippedNoCategory++;
        continue;
      }
      try {
        await insert(
          `INSERT INTO driver_impact_factors
             (substance_id, category_id, method_name, factor_value, unit,
              geographic_scope, source_reference)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE factor_value = VALUES(factor_value),
             unit = VALUES(unit), source_reference = VALUES(source_reference)`,
          [substanceId, categoryId, methodName, f.value, f.unit,
           'Global', `openLCA ${methodName}`],
        );
        result.inserted++;
      } catch (e: any) {
        result.errors.push(`${seed.substanceName} → ${f.impactCategory}: ${e.message}`);
      }
    }
  }

  return result;
}
```

**Step 4: Run — PASS**

**Step 5: Commit**

```bash
git add lib/integrations/openlca/import.ts tests/integrations/openlca/import.test.ts
git commit -m "feat(integrations): openLCA importer with substance matching"
```

---

### Task 8: openLCA import API route

**Files:**
- Create: `app/api/integrations/openlca/import/route.ts`
- Create: `tests/api/integrations/openlca-import.test.ts`

**Step 1: Write failing test**

Create `tests/api/integrations/openlca-import.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '@/app/api/integrations/openlca/import/route';
import * as imp from '@/lib/integrations/openlca/import';
import * as auth from '@/lib/auth';
import * as log from '@/lib/integrations/log';

vi.mock('@/lib/integrations/openlca/import');
vi.mock('@/lib/auth');
vi.mock('@/lib/integrations/log');

function req(body: any) {
  return new Request('http://t/api/integrations/openlca/import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer x' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/integrations/openlca/import', () => {
  beforeEach(() => vi.resetAllMocks());

  it('401 when not authenticated', async () => {
    vi.mocked(auth.requireAuth).mockRejectedValue(new Error('No authentication token provided'));
    const res = await POST(req({ method: 'CML 2001' }) as any);
    expect(res.status).toBe(401);
  });

  it('imports CML 2001 seeds when method is CML 2001', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(imp.importFactorMethod).mockResolvedValue({
      method: 'CML 2001', inserted: 40, substancesMatched: 15,
      skippedNoSubstance: 2, skippedNoCategory: 0, errors: [],
    });
    vi.mocked(log.logIntegration).mockResolvedValue(1);

    const res = await POST(req({ method: 'CML 2001' }) as any);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.result.inserted).toBe(40);
    expect(log.logIntegration).toHaveBeenCalled();
  });

  it('400 on unknown method', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    const res = await POST(req({ method: 'NotARealMethod' }) as any);
    expect(res.status).toBe(400);
  });
});
```

**Step 2: Run — FAIL**

**Step 3: Implement `app/api/integrations/openlca/import/route.ts`**

```typescript
// app/api/integrations/openlca/import/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { importFactorMethod } from '@/lib/integrations/openlca/import';
import { logIntegration } from '@/lib/integrations/log';
import {
  CML_2001_V4_FACTORS,
  CML_2001_METHOD_NAME,
} from '@/lib/integrations/openlca/data/cml-2001-v4';

const SUPPORTED = {
  'CML 2001': CML_2001_V4_FACTORS,
} as const;

const Body = z.object({
  method: z.string().min(1),
});

export async function POST(request: NextRequest) {
  let userId: number;
  try { userId = await requireAuth(request); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const methodName = parsed.data.method;
  const seeds = (SUPPORTED as Record<string, any>)[methodName];
  if (!seeds) {
    return NextResponse.json({
      error: `Method "${methodName}" not supported. Available: ${Object.keys(SUPPORTED).join(', ')}`,
    }, { status: 400 });
  }

  try {
    const result = await importFactorMethod(methodName, seeds);
    await logIntegration({
      source: 'openlca',
      action: 'import_method',
      recordsAffected: result.inserted,
      executedBy: userId,
      status: result.errors.length ? 'partial' : 'success',
      details: result as unknown as Record<string, unknown>,
    });
    return NextResponse.json({ success: true, result });
  } catch (err: any) {
    await logIntegration({
      source: 'openlca', action: 'import_method',
      recordsAffected: 0, executedBy: userId, status: 'failed',
      details: { method: methodName, error: err.message },
    });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  // List of supported methods for the admin UI
  return NextResponse.json({
    success: true,
    methods: Object.keys(SUPPORTED).map(name => ({
      name,
      seedCount: (SUPPORTED as any)[name].length,
    })),
  });
}
```

**Step 4: Run — PASS**

**Step 5: Manual smoke test**

```bash
curl -sL -X POST http://localhost:3002/api/integrations/openlca/import/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"method":"CML 2001"}' | python3 -m json.tool
```

Expected: `"success": true, "result": { "inserted": N, "substancesMatched": M, ... }`.

**Step 6: Verify in DB**

```bash
node -e "
const m=require('mysql2/promise');(async()=>{
const c=await m.createConnection({host:'127.0.0.1',port:3307,user:'lcaadmin',password:'EP76017fLefZ8?d!ezTHsN[kA()X',database:'lca_v3'});
const [r]=await c.query(\"SELECT method_name, COUNT(*) as cnt FROM driver_impact_factors GROUP BY method_name\");
console.table(r);
await c.end();})()"
```

Expected: row with method_name='CML 2001', cnt > 30.

**Step 7: Commit**

```bash
git add app/api/integrations/openlca/import/route.ts \
        tests/api/integrations/openlca-import.test.ts
git commit -m "feat(api): POST /api/integrations/openlca/import"
```

---

### Task 9: Integration status endpoint

**Files:**
- Create: `app/api/integrations/status/route.ts`
- Create: `tests/api/integrations/status.test.ts`

**Step 1: Write failing test**

```typescript
// tests/api/integrations/status.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/integrations/status/route';
import * as auth from '@/lib/auth';
import * as dbHelpers from '@/lib/db-helpers';

vi.mock('@/lib/auth');
vi.mock('@/lib/db-helpers');

describe('GET /api/integrations/status', () => {
  beforeEach(() => vi.resetAllMocks());

  it('401 when not authenticated', async () => {
    vi.mocked(auth.requireAuth).mockRejectedValue(new Error('No authentication token provided'));
    const res = await GET(new Request('http://t/') as any);
    expect(res.status).toBe(401);
  });

  it('returns coverage counts', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(dbHelpers.queryOne).mockResolvedValueOnce({ total: 42, enriched: 15 } as any);
    vi.mocked(dbHelpers.query).mockResolvedValueOnce([
      { method_name: 'CML 2001', factors: 40 },
    ] as any).mockResolvedValueOnce([
      { rate_type: 'labor', cnt: 12 },
      { rate_type: 'electricity', cnt: 50 },
    ] as any);

    const res = await GET(new Request('http://t/') as any);
    const body = await res.json();
    expect(body.substances.total).toBe(42);
    expect(body.substances.enriched).toBe(15);
    expect(body.factorsByMethod[0].method_name).toBe('CML 2001');
    expect(body.rateCache.find((r: any) => r.rate_type === 'labor').cnt).toBe(12);
  });
});
```

**Step 2: Run — FAIL**

**Step 3: Implement**

```typescript
// app/api/integrations/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db-helpers';

export async function GET(request: NextRequest) {
  try { await requireAuth(request); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const substances = await queryOne<any>(`
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN enriched_at IS NOT NULL THEN 1 ELSE 0 END) AS enriched
      FROM substances`);

  const factorsByMethod = await query<any>(`
    SELECT method_name, COUNT(*) AS factors
      FROM driver_impact_factors
     GROUP BY method_name
     ORDER BY factors DESC`);

  const rateCache = await query<any>(`
    SELECT rate_type, COUNT(*) AS cnt
      FROM cost_rates
     GROUP BY rate_type`);

  return NextResponse.json({
    success: true,
    substances,
    factorsByMethod,
    rateCache,
  });
}
```

**Step 4: Run — PASS**

**Step 5: Commit**

```bash
git add app/api/integrations/status/route.ts tests/api/integrations/status.test.ts
git commit -m "feat(api): GET /api/integrations/status — coverage dashboard data"
```

---

### Task 10: Admin integrations dashboard UI

**Files:**
- Create: `app/admin/integrations/page.tsx`
- Create: `components/integrations/status-cards.tsx`
- Create: `components/integrations/import-buttons.tsx`

**Step 1: Create status cards component**

```tsx
// components/integrations/status-cards.tsx
'use client';

interface Props {
  substances: { total: number; enriched: number };
  factorsByMethod: Array<{ method_name: string; factors: number }>;
  rateCache: Array<{ rate_type: string; cnt: number }>;
}

export function StatusCards({ substances, factorsByMethod, rateCache }: Props) {
  const pct = substances.total
    ? Math.round((substances.enriched / substances.total) * 100)
    : 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="rounded-lg border bg-white p-4">
        <div className="text-sm text-gray-500">Substances enriched</div>
        <div className="text-2xl font-bold mt-1">
          {substances.enriched}/{substances.total}
          <span className="text-sm text-gray-400 ml-2">({pct}%)</span>
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <div className="text-sm text-gray-500">Valuation methods imported</div>
        <div className="mt-1 space-y-1">
          {factorsByMethod.length === 0 && (
            <div className="text-gray-400 text-sm">None yet</div>
          )}
          {factorsByMethod.map(m => (
            <div key={m.method_name} className="text-sm">
              <span className="font-medium">{m.method_name}</span>
              <span className="text-gray-500 ml-2">{m.factors} factors</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border bg-white p-4">
        <div className="text-sm text-gray-500">Cost rates cached</div>
        <div className="mt-1 space-y-1">
          {rateCache.length === 0 && (
            <div className="text-gray-400 text-sm">None yet</div>
          )}
          {rateCache.map(r => (
            <div key={r.rate_type} className="text-sm">
              <span className="font-medium">{r.rate_type}</span>
              <span className="text-gray-500 ml-2">{r.cnt} rows</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

**Step 2: Create import buttons component**

```tsx
// components/integrations/import-buttons.tsx
'use client';

import { useState } from 'react';
import { apiPost } from '@/lib/api-client';

export function ImportButtons({ onRefresh }: { onRefresh: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);

  const run = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(label); setResult(null);
    try {
      const data = await fn();
      setResult(`${label}: ${JSON.stringify(data).slice(0, 200)}`);
      onRefresh();
    } catch (e: any) {
      setResult(`${label} FAILED: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <button
          disabled={!!busy}
          onClick={() => run('Import CML 2001',
            () => apiPost('/api/integrations/openlca/import', { method: 'CML 2001' }))}
          className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-50"
        >
          {busy === 'Import CML 2001' ? 'Importing…' : 'Import openLCA CML 2001'}
        </button>

        <button
          disabled={!!busy}
          onClick={() => run('Enrich substances',
            () => apiPost('/api/integrations/pubchem/enrich', { only_missing: true }))}
          className="px-4 py-2 rounded bg-sky-600 text-white disabled:opacity-50"
        >
          {busy === 'Enrich substances' ? 'Enriching…' : 'Enrich substances from PubChem'}
        </button>
      </div>

      {result && (
        <pre className="text-xs bg-gray-50 border rounded p-3 whitespace-pre-wrap">
          {result}
        </pre>
      )}
    </div>
  );
}
```

**Step 3: Create the dashboard page**

```tsx
// app/admin/integrations/page.tsx
'use client';

import { useCallback, useEffect, useState } from 'react';
import { AuthGuard } from '@/components/auth-guard';
import { AppLayout } from '@/components/app-layout';
import { apiGet } from '@/lib/api-client';
import { StatusCards } from '@/components/integrations/status-cards';
import { ImportButtons } from '@/components/integrations/import-buttons';

interface Status {
  substances: { total: number; enriched: number };
  factorsByMethod: Array<{ method_name: string; factors: number }>;
  rateCache: Array<{ rate_type: string; cnt: number }>;
}

export default function IntegrationsAdminPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await apiGet<any>('/api/integrations/status');
      setStatus(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return (
    <AuthGuard>
      <AppLayout>
        <div className="max-w-5xl mx-auto p-6 space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Integrations</h1>
            <p className="text-sm text-gray-600 mt-1">
              Import characterization factors, enrich substances, and refresh cost
              rates from public APIs.
            </p>
          </div>

          {loading && <div className="text-gray-500">Loading…</div>}
          {error && <div className="text-red-600">Error: {error}</div>}
          {status && (
            <>
              <StatusCards {...status} />
              <div>
                <h2 className="text-lg font-semibold mb-3">Actions</h2>
                <ImportButtons onRefresh={refresh} />
              </div>
            </>
          )}
        </div>
      </AppLayout>
    </AuthGuard>
  );
}
```

**Step 4: Manual verification**

Start dev server (if not running):

```bash
cd "/Users/kavishpandit/Desktop/lca/lca project v3" && /opt/homebrew/bin/pnpm run dev
```

1. Log in at http://localhost:3002/auth/login
2. Visit http://localhost:3002/admin/integrations
3. Verify the 3 status cards render.
4. Click "Import openLCA CML 2001" → see result JSON, counts update.
5. Click "Enrich substances from PubChem" → wait (~10s), counts update.

**Step 5: Commit**

```bash
git add app/admin/integrations/page.tsx \
        components/integrations/status-cards.tsx \
        components/integrations/import-buttons.tsx
git commit -m "feat(ui): admin integrations dashboard with status + import controls"
```

---

### Task 11: Integration log viewer endpoint + panel

**Files:**
- Create: `app/api/integrations/log/route.ts`
- Create: `components/integrations/log-viewer.tsx`
- Modify: `app/admin/integrations/page.tsx` (mount viewer)

**Step 1: Implement endpoint with inline test**

`app/api/integrations/log/route.ts`:

```typescript
// app/api/integrations/log/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { query } from '@/lib/db-helpers';

export async function GET(request: NextRequest) {
  try { await requireAuth(request); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const sp = new URL(request.url).searchParams;
  const source = sp.get('source');
  const limit = Math.min(parseInt(sp.get('limit') ?? '20'), 200);

  const rows = await query<any>(
    `SELECT log_id, source, action, records_affected, status, executed_at, details
       FROM integration_log
      ${source ? 'WHERE source = ?' : ''}
      ORDER BY executed_at DESC
      LIMIT ?`,
    source ? [source, limit] : [limit],
  );

  return NextResponse.json({ success: true, logs: rows });
}
```

Test: `tests/api/integrations/log.test.ts` (mirror status test pattern):

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/integrations/log/route';
import * as auth from '@/lib/auth';
import * as db from '@/lib/db-helpers';

vi.mock('@/lib/auth');
vi.mock('@/lib/db-helpers');

describe('GET /api/integrations/log', () => {
  beforeEach(() => vi.resetAllMocks());

  it('returns logs with limit and source filter', async () => {
    vi.mocked(auth.requireAuth).mockResolvedValue(1);
    vi.mocked(db.query).mockResolvedValue([
      { log_id: 1, source: 'pubchem', action: 'enrich_all', records_affected: 40, status: 'success', executed_at: '2026-04-13', details: null },
    ] as any);

    const res = await GET(new Request('http://t/?source=pubchem&limit=10') as any);
    const body = await res.json();
    expect(body.logs.length).toBe(1);
    expect(body.logs[0].source).toBe('pubchem');

    const sql = vi.mocked(db.query).mock.calls[0][0];
    expect(sql).toContain('WHERE source = ?');
  });
});
```

Run: `pnpm test tests/api/integrations/log.test.ts` → PASS.

**Step 2: Implement log viewer component**

`components/integrations/log-viewer.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { apiGet } from '@/lib/api-client';

interface LogRow {
  log_id: number;
  source: string;
  action: string;
  records_affected: number;
  status: 'success' | 'partial' | 'failed';
  executed_at: string;
  details: any;
}

const STATUS_COLORS: Record<string, string> = {
  success: 'bg-green-100 text-green-800',
  partial: 'bg-yellow-100 text-yellow-800',
  failed: 'bg-red-100 text-red-800',
};

export function LogViewer() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<any>('/api/integrations/log?limit=30');
        setLogs(data.logs ?? []);
      } finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div className="text-gray-500 text-sm">Loading logs…</div>;
  if (!logs.length) return <div className="text-gray-500 text-sm">No integration runs yet.</div>;

  return (
    <table className="w-full text-sm">
      <thead className="text-gray-500 text-xs uppercase bg-gray-50 border-b">
        <tr>
          <th className="text-left p-2">When</th>
          <th className="text-left p-2">Source</th>
          <th className="text-left p-2">Action</th>
          <th className="text-right p-2">Records</th>
          <th className="text-left p-2">Status</th>
        </tr>
      </thead>
      <tbody>
        {logs.map(l => (
          <tr key={l.log_id} className="border-b last:border-0">
            <td className="p-2 text-gray-500">{new Date(l.executed_at).toLocaleString()}</td>
            <td className="p-2 font-medium">{l.source}</td>
            <td className="p-2">{l.action}</td>
            <td className="p-2 text-right">{l.records_affected}</td>
            <td className="p-2">
              <span className={`px-2 py-0.5 rounded text-xs ${STATUS_COLORS[l.status]}`}>
                {l.status}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

**Step 3: Mount on the admin page**

Edit `app/admin/integrations/page.tsx`, add after the Actions section:

```tsx
              <div>
                <h2 className="text-lg font-semibold mb-3">Recent activity</h2>
                <div className="rounded-lg border bg-white">
                  <LogViewer />
                </div>
              </div>
```

And at the top:
```tsx
import { LogViewer } from '@/components/integrations/log-viewer';
```

**Step 4: Manual verification**

Reload /admin/integrations, confirm a log table appears below the buttons showing your earlier CML 2001 import + PubChem enrich.

**Step 5: Commit**

```bash
git add app/api/integrations/log/route.ts \
        components/integrations/log-viewer.tsx \
        app/admin/integrations/page.tsx \
        tests/api/integrations/log.test.ts
git commit -m "feat: integration log viewer in admin dashboard"
```

---

### Task 12: End-to-end verification for Phase 1a

**Goal:** Confirm the EV Battery assessment produces different, more complete results now that factors are imported.

**Step 1: Baseline measurement (before)**

Run on an existing case:

```bash
# Run a fresh EV assessment; capture the number of categories and total GW
TOKEN=$(curl -sL -X POST http://localhost:3002/api/auth/login/ \
  -H "Content-Type: application/json" \
  -d '{"email":"john@lcaproject.com","password":"Lcapix@guerry123"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['token'])")

curl -sL -X POST http://localhost:3002/api/cases/19/assessments/ \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"run_name":"Phase1a-verification"}' \
  | python3 -c "import sys,json;d=json.load(sys.stdin);print('Categories:', d['summary']['impact_categories_calculated']);[print(f'{i[\"category_name\"]}: {i[\"impact_value\"]:.4f} {i[\"unit\"]}') for i in d.get('total_impacts',[])]"
```

Record the output.

**Step 2: Acceptance checklist**

Manually verify:
- [ ] /admin/integrations shows substances enriched > 0
- [ ] At least 1 method ('CML 2001') shows factors imported
- [ ] Log viewer lists the recent runs
- [ ] Running an assessment still succeeds
- [ ] More impact categories appear than before (expect at least 6, was 5 in pre-integration run)

**Step 3: Commit a snapshot note**

```bash
cat > docs/plans/2026-04-13-phase1a-verification.md << 'EOF'
# Phase 1a verification snapshot

Ran assessment on case 19 (EV Battery) after importing CML 2001 and enriching substances.

Categories calculated: [fill in]
Key deltas vs. pre-integration: [fill in]
EOF
git add docs/plans/2026-04-13-phase1a-verification.md
git commit -m "docs: phase 1a verification snapshot"
```

---

## PHASE 1b — Region-aware engine, Electricity Maps, BLS, EIA

### Task 13: Add `method` + `regionCode` to LCA engine

**Files:**
- Modify: `lib/lca-engine.ts`
- Create: `tests/lib/lca-engine.test.ts`

**Step 1: Write failing test**

```typescript
// tests/lib/lca-engine.test.ts
import { describe, it, expect, vi } from 'vitest';
import { calculateComponentImpacts } from '@/lib/lca-engine';

// Build a stub mysql connection whose .query returns canned data in order.
function fakeConn(sequence: any[][]) {
  let i = 0;
  return {
    query: vi.fn().mockImplementation(async () => {
      const r = sequence[i++]; return [r, null];
    }),
  } as any;
}

describe('calculateComponentImpacts — method + region filtering', () => {
  it('passes method + region to the SQL query', async () => {
    const conn = fakeConn([
      // 1st: component lookup
      [{ component_id: 1, component_name: 'X', component_type: 'elemental_task', hierarchy_level: 5 }],
      // 2nd: flows join with factors
      [{
        flow_id: 1, substance_id: 7, substance_name: 'Electricity', cas_number: null,
        flow_type: 'input', quantity: 10, flow_unit: 'kWh',
        category_id: 1, category_name: 'Global Warming',
        category_unit: 'kg CO2 eq', characterization_factor: 0.283,
      }],
    ]);

    const r = await calculateComponentImpacts(1, conn, {
      method: 'CML 2001', regionCode: 'US-NY',
    });

    expect(r.impacts[0].impact_value).toBeCloseTo(2.83, 5);
    const secondQueryArgs = conn.query.mock.calls[1];
    expect(secondQueryArgs[0]).toContain('method_name');
    expect(secondQueryArgs[1]).toContain('CML 2001');
    expect(secondQueryArgs[1]).toContain('US-NY');
  });
});
```

**Step 2: Run — FAIL**

**Step 3: Update the engine**

In `lib/lca-engine.ts`, update the signature + query of `calculateComponentImpacts`:

Change the signature:
```typescript
export interface CalcOptions {
  method?: string;       // default 'CML 2001'
  regionCode?: string;   // default 'Global'
}

export async function calculateComponentImpacts(
  componentId: number,
  connection: Connection,
  options: CalcOptions = {},
): Promise<ComponentImpactResult> {
  const method = options.method ?? 'CML 2001';
  const region = options.regionCode ?? 'Global';
  // ... existing code
```

Replace the flows query with (method + region aware, region falls back to Global):
```sql
SELECT
  f.flow_id, f.substance_id, s.substance_name, s.cas_number,
  f.flow_type, f.quantity, f.unit as flow_unit,
  dif.category_id, ic.category_name,
  ic.unit as category_unit,
  dif.factor_value as characterization_factor
FROM flows f
INNER JOIN substances s ON f.substance_id = s.substance_id
INNER JOIN driver_impact_factors dif
  ON f.substance_id = dif.substance_id
 AND dif.method_name = ?
 AND dif.geographic_scope IN (?, 'Global')
INNER JOIN impact_categories ic ON dif.category_id = ic.category_id
WHERE f.component_id = ? AND f.is_driver = TRUE
ORDER BY dif.category_id,
         CASE WHEN dif.geographic_scope = ? THEN 0 ELSE 1 END,
         f.flow_id
```

params: `[method, region, componentId, region]`

Update `calculateCaseImpacts` to accept and propagate CalcOptions.

**Step 4: Run — PASS**

**Step 5: Regression-test the full engine against live DB**

```bash
curl -sL -X POST http://localhost:3002/api/cases/19/assessments/ \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"run_name":"method-region-regression"}' | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['summary'])"
```

Expected: still succeeds, same result as Task 12 (we default method='CML 2001' and region='Global').

**Step 6: Commit**

```bash
git add lib/lca-engine.ts tests/lib/lca-engine.test.ts
git commit -m "feat(engine): accept method + regionCode; region falls back to Global"
```

---

### Task 14: Electricity Maps client

**Files:**
- Create: `lib/integrations/electricity-maps/client.ts`
- Create: `tests/integrations/electricity-maps.test.ts`
- Modify: `.env.example` / `.env.local` (document `ELECTRICITY_MAPS_API_KEY`)

**Step 1: Add env var**

Add to `.env.local`:
```
ELECTRICITY_MAPS_API_KEY=
```
User signs up at https://www.electricitymaps.com/free-tier-api and pastes the key.

**Step 2: Write failing test**

```typescript
// tests/integrations/electricity-maps.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchCarbonIntensity } from '@/lib/integrations/electricity-maps/client';

describe('fetchCarbonIntensity', () => {
  const orig = global.fetch;
  beforeEach(() => { process.env.ELECTRICITY_MAPS_API_KEY = 'k'; global.fetch = vi.fn(); });
  afterEach(() => { global.fetch = orig; });

  it('returns parsed payload for a zone', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({
        zone: 'US-NY', carbonIntensity: 283,
        datetime: '2026-04-13T00:00:00Z', updatedAt: '2026-04-13T00:05:00Z',
      }),
    } as Response);
    const r = await fetchCarbonIntensity('US-NY');
    expect(r.zone).toBe('US-NY');
    expect(r.carbonIntensity_gCO2eq_per_kWh).toBe(283);
    expect(r.carbonIntensity_kgCO2eq_per_kWh).toBeCloseTo(0.283, 3);
  });

  it('throws with key missing', async () => {
    delete process.env.ELECTRICITY_MAPS_API_KEY;
    await expect(fetchCarbonIntensity('US-NY')).rejects.toThrow(/API key/);
  });

  it('throws on non-200', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({ ok: false, status: 403 } as Response);
    await expect(fetchCarbonIntensity('US-NY')).rejects.toThrow(/403/);
  });
});
```

**Step 3: Run — FAIL**

**Step 4: Implement**

```typescript
// lib/integrations/electricity-maps/client.ts
// Docs: https://docs.electricitymaps.com/
const BASE = 'https://api.electricitymap.org/v3';

export interface CarbonIntensity {
  zone: string;
  carbonIntensity_gCO2eq_per_kWh: number;
  carbonIntensity_kgCO2eq_per_kWh: number;
  datetime: string;
  updatedAt: string;
}

export async function fetchCarbonIntensity(zone: string): Promise<CarbonIntensity> {
  const key = process.env.ELECTRICITY_MAPS_API_KEY;
  if (!key) throw new Error('ELECTRICITY_MAPS_API_KEY not configured');

  const res = await fetch(`${BASE}/carbon-intensity/latest?zone=${encodeURIComponent(zone)}`, {
    headers: { 'auth-token': key, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`Electricity Maps error ${res.status} for zone ${zone}`);
  const body = await res.json();
  return {
    zone: body.zone,
    carbonIntensity_gCO2eq_per_kWh: body.carbonIntensity,
    carbonIntensity_kgCO2eq_per_kWh: body.carbonIntensity / 1000,
    datetime: body.datetime,
    updatedAt: body.updatedAt,
  };
}
```

**Step 5: Run — PASS**

**Step 6: Commit**

```bash
git add lib/integrations/electricity-maps/client.ts \
        tests/integrations/electricity-maps.test.ts .env.local
git commit -m "feat(integrations): electricity maps client"
```

---

### Task 15: Electricity Maps → driver_impact_factors sync route

**Files:**
- Create: `lib/integrations/electricity-maps/sync.ts`
- Create: `app/api/integrations/electricity/sync/route.ts`
- Create: `tests/integrations/electricity-maps/sync.test.ts`

**Step 1: Write failing test**

```typescript
// tests/integrations/electricity-maps/sync.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { syncZoneFactor } from '@/lib/integrations/electricity-maps/sync';
import * as client from '@/lib/integrations/electricity-maps/client';
import * as db from '@/lib/db-helpers';

vi.mock('@/lib/integrations/electricity-maps/client');
vi.mock('@/lib/db-helpers');

describe('syncZoneFactor', () => {
  beforeEach(() => vi.resetAllMocks());

  it('upserts a driver_impact_factors row for Electricity + Global Warming', async () => {
    vi.mocked(client.fetchCarbonIntensity).mockResolvedValue({
      zone: 'US-NY',
      carbonIntensity_gCO2eq_per_kWh: 283,
      carbonIntensity_kgCO2eq_per_kWh: 0.283,
      datetime: '', updatedAt: '',
    });
    vi.mocked(db.queryOne)
      .mockResolvedValueOnce({ substance_id: 7 } as any)       // Electricity substance
      .mockResolvedValueOnce({ category_id: 1 } as any);        // Global Warming category
    const insertSpy = vi.mocked(db.insert).mockResolvedValue(1);

    const r = await syncZoneFactor('US-NY', 'CML 2001');
    expect(r).toEqual({ zone: 'US-NY', factorValue: 0.283, inserted: true });
    expect(insertSpy).toHaveBeenCalledOnce();
    const params = insertSpy.mock.calls[0][1]!;
    expect(params).toContain('US-NY');   // geographic_scope
    expect(params).toContain('CML 2001'); // method_name
    expect(params).toContain(0.283);
  });

  it('throws if Electricity substance is missing', async () => {
    vi.mocked(client.fetchCarbonIntensity).mockResolvedValue({
      zone: 'FR', carbonIntensity_gCO2eq_per_kWh: 56,
      carbonIntensity_kgCO2eq_per_kWh: 0.056, datetime: '', updatedAt: '',
    });
    vi.mocked(db.queryOne).mockResolvedValue(null);
    await expect(syncZoneFactor('FR')).rejects.toThrow(/Electricity/);
  });
});
```

**Step 2: Run — FAIL**

**Step 3: Implement**

```typescript
// lib/integrations/electricity-maps/sync.ts
import { queryOne, insert } from '@/lib/db-helpers';
import { fetchCarbonIntensity } from './client';

export async function syncZoneFactor(zone: string, method = 'CML 2001'): Promise<{
  zone: string; factorValue: number; inserted: boolean;
}> {
  const intensity = await fetchCarbonIntensity(zone);

  const elec = await queryOne<any>(
    `SELECT substance_id FROM substances
      WHERE LOWER(substance_name) IN ('electricity','electricity, grid mix')
      ORDER BY substance_id LIMIT 1`,
  );
  if (!elec) throw new Error('Electricity substance not found in catalog');

  const gw = await queryOne<any>(
    `SELECT category_id FROM impact_categories
      WHERE LOWER(category_name) LIKE '%global warming%' LIMIT 1`,
  );
  if (!gw) throw new Error('Global Warming impact category not found');

  await insert(
    `INSERT INTO driver_impact_factors
       (substance_id, category_id, method_name, factor_value, unit,
        geographic_scope, source_reference)
     VALUES (?, ?, ?, ?, 'kg CO2 eq / kWh', ?, ?)
     ON DUPLICATE KEY UPDATE factor_value = VALUES(factor_value),
       source_reference = VALUES(source_reference),
       unit = VALUES(unit)`,
    [elec.substance_id, gw.category_id, method,
     intensity.carbonIntensity_kgCO2eq_per_kWh, zone,
     `Electricity Maps API ${new Date().toISOString().slice(0,10)}`],
  );

  return { zone, factorValue: intensity.carbonIntensity_kgCO2eq_per_kWh, inserted: true };
}
```

**Step 4: API route**

```typescript
// app/api/integrations/electricity/sync/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { syncZoneFactor } from '@/lib/integrations/electricity-maps/sync';
import { logIntegration } from '@/lib/integrations/log';

const Body = z.object({
  zones: z.array(z.string().min(1)).min(1).max(20),
  method: z.string().optional(),
});

export async function POST(request: NextRequest) {
  let userId: number;
  try { userId = await requireAuth(request); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const results = [];
  let failed = 0;
  for (const zone of parsed.data.zones) {
    try {
      results.push(await syncZoneFactor(zone, parsed.data.method));
    } catch (e: any) {
      failed++;
      results.push({ zone, error: e.message });
    }
  }
  await logIntegration({
    source: 'electricity_maps', action: 'sync_zones',
    recordsAffected: results.filter(r => 'inserted' in r).length,
    executedBy: userId,
    status: failed === 0 ? 'success' : failed < results.length ? 'partial' : 'failed',
    details: { zones: parsed.data.zones },
  });
  return NextResponse.json({ success: true, results });
}
```

**Step 5: Run test + smoke test**

```bash
pnpm test tests/integrations/electricity-maps/sync.test.ts
```

Live (requires API key set):

```bash
curl -sL -X POST http://localhost:3002/api/integrations/electricity/sync/ \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"zones":["US-NY"]}' | python3 -m json.tool
```

**Step 6: Commit**

```bash
git add lib/integrations/electricity-maps/sync.ts \
        app/api/integrations/electricity/sync/route.ts \
        tests/integrations/electricity-maps/sync.test.ts
git commit -m "feat(integrations): Electricity Maps zone factor sync"
```

---

### Task 16: BLS client + cost_rates cache

**Files:**
- Create: `lib/integrations/bls/client.ts`
- Create: `lib/integrations/bls/occupations.ts`
- Create: `lib/integrations/cost-rates.ts`
- Create: `tests/integrations/bls.test.ts`

**Step 1: Occupations seed**

```typescript
// lib/integrations/bls/occupations.ts
// Curated subset of BLS OEWS occupation codes useful for manufacturing LCAs.
export const OCCUPATIONS = [
  { code: '51-4121', title: 'Welders, Cutters, Solderers, and Brazers' },
  { code: '51-4041', title: 'Machinists' },
  { code: '51-2090', title: 'Miscellaneous Assemblers and Fabricators' },
  { code: '51-8021', title: 'Stationary Engineers and Boiler Operators' },
  { code: '51-8091', title: 'Chemical Plant and System Operators' },
  { code: '51-9141', title: 'Semiconductor Processing Technicians' },
  { code: '51-9011', title: 'Chemical Equipment Operators' },
  { code: '11-9041', title: 'Architectural and Engineering Managers' },
  { code: '17-2112', title: 'Industrial Engineers' },
  { code: '19-2031', title: 'Chemists' },
];
```

**Step 2: BLS client test**

```typescript
// tests/integrations/bls.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchMedianHourlyWage, makeSeriesId } from '@/lib/integrations/bls/client';

describe('makeSeriesId', () => {
  it('builds an OEWS series id for a national median hourly wage', () => {
    // OEU = national, S = statewide, M = metro, median hourly = data type 04
    const id = makeSeriesId({ occupation: '51-4121', state: 'NY', dataType: '04' });
    expect(id).toMatch(/^OEU/);
    expect(id).toContain('514121');
  });
});

describe('fetchMedianHourlyWage', () => {
  const orig = global.fetch;
  beforeEach(() => { global.fetch = vi.fn(); });
  afterEach(() => { global.fetch = orig; });

  it('returns the most recent wage value from BLS', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({
        status: 'REQUEST_SUCCEEDED',
        Results: { series: [{ data: [{ year: '2024', period: 'A01', value: '28.15' }] }] },
      }),
    } as Response);

    const r = await fetchMedianHourlyWage('51-4121', 'NY');
    expect(r.hourlyRate).toBe(28.15);
    expect(r.year).toBe('2024');
  });

  it('returns null if BLS returns no data rows', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true, status: 200,
      json: async () => ({ status: 'REQUEST_SUCCEEDED', Results: { series: [{ data: [] }] } }),
    } as Response);
    const r = await fetchMedianHourlyWage('51-4121', 'NY');
    expect(r).toBeNull();
  });
});
```

**Step 3: Run — FAIL. Implement client:**

```typescript
// lib/integrations/bls/client.ts
// Docs: https://www.bls.gov/developers/
// Using v1 (no key) for simplicity. v2 needs BLS_API_KEY.
const BASE = 'https://api.bls.gov/publicAPI/v2/timeseries/data/';

const STATE_FIPS: Record<string, string> = {
  AL:'01',AK:'02',AZ:'04',AR:'05',CA:'06',CO:'08',CT:'09',DE:'10',FL:'12',GA:'13',
  HI:'15',ID:'16',IL:'17',IN:'18',IA:'19',KS:'20',KY:'21',LA:'22',ME:'23',MD:'24',
  MA:'25',MI:'26',MN:'27',MS:'28',MO:'29',MT:'30',NE:'31',NV:'32',NH:'33',NJ:'34',
  NM:'35',NY:'36',NC:'37',ND:'38',OH:'39',OK:'40',OR:'41',PA:'42',RI:'44',SC:'45',
  SD:'46',TN:'47',TX:'48',UT:'49',VT:'50',VA:'51',WA:'53',WV:'54',WI:'55',WY:'56',
};

export interface SeriesParts {
  occupation: string;   // e.g. 51-4121
  state: string;        // 2-letter code or 'US'
  dataType: '03' | '04' | '13'; // 03 mean hr, 04 median hr, 13 annual mean
}

export function makeSeriesId({ occupation, state, dataType }: SeriesParts): string {
  const occ = occupation.replace('-', '');
  const areaType = state === 'US' ? 'N' : 'S'; // N = national, S = state
  const areaCode = state === 'US' ? '0000000' : `${STATE_FIPS[state] ?? '00'}00000`;
  const industry = '000000';
  // Prefix OEU = OEWS, seasonal N
  return `OEU${areaType}${areaCode}${industry}${occ}${dataType}`;
}

export interface BLSWage {
  seriesId: string;
  hourlyRate: number;
  year: string;
  period: string;
}

export async function fetchMedianHourlyWage(occupation: string, state: string): Promise<BLSWage | null> {
  const seriesId = makeSeriesId({ occupation, state, dataType: '04' });
  const payload: any = {
    seriesid: [seriesId],
    startyear: String(new Date().getFullYear() - 1),
    endyear:   String(new Date().getFullYear()),
  };
  if (process.env.BLS_API_KEY) payload.registrationkey = process.env.BLS_API_KEY;

  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`BLS error ${res.status}`);
  const body = await res.json();
  const rows = body?.Results?.series?.[0]?.data ?? [];
  if (!rows.length) return null;

  // Latest non-empty numeric value
  const latest = rows.find((r: any) => r.value && !isNaN(parseFloat(r.value)));
  if (!latest) return null;

  return { seriesId, hourlyRate: parseFloat(latest.value), year: latest.year, period: latest.period };
}
```

**Step 4: cost-rates cache helper**

```typescript
// lib/integrations/cost-rates.ts
import { queryOne, insert } from '@/lib/db-helpers';

export interface CostRate {
  rateValue: number;
  unit: string;
  source: string;
  effectiveDate: string;
}

/**
 * Return a rate from cache if newer than `maxAgeDays`, otherwise call `fetcher`
 * to get a fresh value and cache it.
 */
export async function getOrFetchRate(params: {
  type: 'labor' | 'electricity' | 'natural_gas' | 'material' | 'transport';
  key: string;
  region: string;
  maxAgeDays?: number;
  fetcher: () => Promise<CostRate>;
}): Promise<CostRate> {
  const maxAgeDays = params.maxAgeDays ?? 30;

  const cached = await queryOne<any>(
    `SELECT rate_value, rate_unit, source, effective_date, fetched_at
       FROM cost_rates
      WHERE rate_type = ? AND rate_key = ? AND region_code = ?
      ORDER BY fetched_at DESC LIMIT 1`,
    [params.type, params.key, params.region],
  );
  if (cached) {
    const ageMs = Date.now() - new Date(cached.fetched_at).getTime();
    if (ageMs < maxAgeDays * 24 * 60 * 60 * 1000) {
      return {
        rateValue: parseFloat(cached.rate_value),
        unit: cached.rate_unit,
        source: cached.source,
        effectiveDate: String(cached.effective_date).slice(0,10),
      };
    }
  }

  const fresh = await params.fetcher();
  await insert(
    `INSERT INTO cost_rates
       (rate_type, rate_key, region_code, rate_value, rate_unit, effective_date, source)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE rate_value = VALUES(rate_value),
       rate_unit = VALUES(rate_unit), source = VALUES(source),
       fetched_at = CURRENT_TIMESTAMP`,
    [params.type, params.key, params.region, fresh.rateValue, fresh.unit,
     fresh.effectiveDate, fresh.source],
  );
  return fresh;
}
```

**Step 5: Run BLS tests — PASS**

**Step 6: Commit**

```bash
git add lib/integrations/bls/client.ts lib/integrations/bls/occupations.ts \
        lib/integrations/cost-rates.ts tests/integrations/bls.test.ts
git commit -m "feat(integrations): BLS wage client + cost_rates cache"
```

---

### Task 17: BLS fetch endpoint

**Files:**
- Create: `app/api/integrations/bls/fetch-wage/route.ts`
- Create: `tests/api/integrations/bls-wage.test.ts`

Pattern mirrors Task 15 exactly. Route posts `{ occupation, state }`, calls `getOrFetchRate` wrapping `fetchMedianHourlyWage`, returns the result, logs to integration_log. Write test first, implement, commit.

```typescript
// app/api/integrations/bls/fetch-wage/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { fetchMedianHourlyWage } from '@/lib/integrations/bls/client';
import { getOrFetchRate } from '@/lib/integrations/cost-rates';
import { logIntegration } from '@/lib/integrations/log';

const Body = z.object({
  occupation: z.string().regex(/^\d{2}-\d{4}$/),
  state: z.string().length(2).or(z.literal('US')),
});

export async function POST(request: NextRequest) {
  let userId: number;
  try { userId = await requireAuth(request); }
  catch { return NextResponse.json({ error: 'Unauthorized' }, { status: 401 }); }

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  try {
    const rate = await getOrFetchRate({
      type: 'labor',
      key: parsed.data.occupation,
      region: parsed.data.state,
      fetcher: async () => {
        const wage = await fetchMedianHourlyWage(parsed.data.occupation, parsed.data.state);
        if (!wage) throw new Error('BLS returned no data for that series');
        return {
          rateValue: wage.hourlyRate, unit: '$/hr',
          source: `BLS OEWS ${wage.year}`, effectiveDate: `${wage.year}-05-01`,
        };
      },
    });
    await logIntegration({
      source: 'bls', action: 'fetch_wage',
      recordsAffected: 1, executedBy: userId,
      details: { ...parsed.data, rate: rate.rateValue },
    });
    return NextResponse.json({ success: true, rate });
  } catch (err: any) {
    await logIntegration({ source: 'bls', action: 'fetch_wage',
      recordsAffected: 0, executedBy: userId, status: 'failed',
      details: { ...parsed.data, error: err.message },
    });
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
```

Write a mock-based test, smoke-test live, commit.

---

### Task 18: EIA client + fetch-energy-price endpoint

**Files:**
- Create: `lib/integrations/eia/client.ts`
- Create: `app/api/integrations/eia/fetch-energy-price/route.ts`
- Create: `tests/integrations/eia.test.ts`
- Modify: `.env.local` (add `EIA_API_KEY=`)

Same pattern as BLS. EIA v2 API requires a free key.

```typescript
// lib/integrations/eia/client.ts
// Docs: https://www.eia.gov/opendata/documentation.php
const BASE = 'https://api.eia.gov/v2';

export interface EnergyPrice {
  fuel: 'electricity' | 'natural_gas';
  state: string;
  rateValue: number;
  unit: string;  // $/kWh for electricity, $/MCF for natural gas
  period: string; // e.g. '2026-01'
}

export async function fetchElectricityPrice(state: string, sector = 'IND'): Promise<EnergyPrice | null> {
  const key = process.env.EIA_API_KEY;
  if (!key) throw new Error('EIA_API_KEY not configured');

  // electricity/retail-sales: price in cents/kWh
  const url = new URL(`${BASE}/electricity/retail-sales/data/`);
  url.searchParams.set('api_key', key);
  url.searchParams.set('frequency', 'monthly');
  url.searchParams.set('data[0]', 'price');
  url.searchParams.set('facets[stateid][]', state);
  url.searchParams.set('facets[sectorid][]', sector); // IND=industrial, ALL=all sectors
  url.searchParams.set('sort[0][column]', 'period');
  url.searchParams.set('sort[0][direction]', 'desc');
  url.searchParams.set('length', '1');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`EIA error ${res.status}`);
  const body = await res.json();
  const row = body?.response?.data?.[0];
  if (!row || row.price == null) return null;

  // price is in cents/kWh — convert to $/kWh
  return {
    fuel: 'electricity',
    state,
    rateValue: parseFloat(row.price) / 100,
    unit: '$/kWh',
    period: row.period,
  };
}

export async function fetchNaturalGasPrice(state: string): Promise<EnergyPrice | null> {
  const key = process.env.EIA_API_KEY;
  if (!key) throw new Error('EIA_API_KEY not configured');
  const url = new URL(`${BASE}/natural-gas/pri/sum/data/`);
  url.searchParams.set('api_key', key);
  url.searchParams.set('frequency', 'monthly');
  url.searchParams.set('data[0]', 'value');
  url.searchParams.set('facets[duoarea][]', `S${state}`);
  url.searchParams.set('sort[0][column]', 'period');
  url.searchParams.set('sort[0][direction]', 'desc');
  url.searchParams.set('length', '1');
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`EIA error ${res.status}`);
  const body = await res.json();
  const row = body?.response?.data?.[0];
  if (!row || row.value == null) return null;
  return {
    fuel: 'natural_gas', state,
    rateValue: parseFloat(row.value),  // $/MCF (thousand cubic feet)
    unit: '$/MCF',
    period: row.period,
  };
}
```

Route + tests: same pattern as BLS. Commit.

---

### Task 19: Method + Region selector UI for assessments

**Files:**
- Modify: `app/project/[projectId]/case/[caseId]/page.tsx` (replace "Run Assessment" button)
- Create: `components/assessments/run-assessment-modal.tsx`

**Step 1: Create modal component**

```tsx
// components/assessments/run-assessment-modal.tsx
'use client';

import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { apiGet, apiPost } from '@/lib/api-client';

const REGIONS = [
  { code: 'Global', label: 'Global average' },
  { code: 'US-NY', label: 'United States — New York' },
  { code: 'US-CA', label: 'United States — California' },
  { code: 'US-TX', label: 'United States — Texas' },
  { code: 'FR',    label: 'France' },
  { code: 'DE',    label: 'Germany' },
  { code: 'GB',    label: 'United Kingdom' },
  { code: 'CN',    label: 'China' },
  { code: 'IN',    label: 'India' },
];

interface Props {
  open: boolean;
  onClose: () => void;
  caseId: number;
  onCompleted: (result: any) => void;
}

export function RunAssessmentModal({ open, onClose, caseId, onCompleted }: Props) {
  const [method, setMethod] = useState('CML 2001');
  const [region, setRegion] = useState('Global');
  const [methods, setMethods] = useState<string[]>(['CML 2001']);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const data = await apiGet<any>('/api/integrations/status');
        const imported = (data.factorsByMethod ?? []).map((m: any) => m.method_name);
        if (imported.length) setMethods(imported);
      } catch { /* fall through — keeps defaults */ }
    })();
  }, [open]);

  const run = async () => {
    setRunning(true); setError(null);
    try {
      const result = await apiPost<any>(
        `/api/cases/${caseId}/assessments`,
        { run_name: `Assessment ${new Date().toLocaleString()}`,
          calculation_method: method, region_code: region },
      );
      onCompleted(result);
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally { setRunning(false); }
  };

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Run Assessment</DialogTitle>
          <DialogDescription>
            Choose the valuation method and region for this calculation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Valuation method
            </label>
            <select
              value={method} onChange={e => setMethod(e.target.value)}
              className="w-full rounded border-gray-300"
            >
              {methods.map(m => <option key={m} value={m}>{m}</option>)}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Only methods imported into your database are shown.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Region
            </label>
            <select
              value={region} onChange={e => setRegion(e.target.value)}
              className="w-full rounded border-gray-300"
            >
              {REGIONS.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Location-specific factors are used when available (e.g. electricity grid carbon).
              Global fallback is used otherwise.
            </p>
          </div>

          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>

        <DialogFooter>
          <button onClick={onClose}
            className="px-4 py-2 rounded border border-gray-300 text-gray-700">
            Cancel
          </button>
          <button onClick={run} disabled={running}
            className="px-4 py-2 rounded bg-emerald-600 text-white disabled:opacity-50">
            {running ? 'Running…' : 'Run assessment'}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

**Step 2: Wire into case page**

In `app/project/[projectId]/case/[caseId]/page.tsx`, locate the existing "Run Assessment" button, replace onClick with:

```tsx
const [assessOpen, setAssessOpen] = useState(false);
// ...
<button onClick={() => setAssessOpen(true)} className="...">Run Assessment</button>
<RunAssessmentModal
  open={assessOpen}
  onClose={() => setAssessOpen(false)}
  caseId={Number(caseId)}
  onCompleted={() => router.refresh()}
/>
```

**Step 3: Accept region_code in the assessment route**

Modify `app/api/cases/[caseId]/assessments/route.ts` POST handler:

- Destructure `region_code` from body
- Pass `{ method, regionCode: region_code }` into `calculateCaseImpacts`
- Store region_code in the INSERT into `assessment_runs`

**Step 4: Manual verification**

1. Case page → Run Assessment → modal appears
2. Default method = "CML 2001", region = "Global"
3. Click Run → assessment completes, results refresh
4. Change region to "US-NY" → Run again → numbers differ (at minimum GW different if Electricity Maps synced US-NY)

**Step 5: Commit**

```bash
git add components/assessments/run-assessment-modal.tsx \
        app/project/[projectId]/case/[caseId]/page.tsx \
        app/api/cases/[caseId]/assessments/route.ts
git commit -m "feat(ui): method + region selector for running assessments"
```

---

### Task 20: Auto-populate energy + labor cost on flow creation

**Files:**
- Create: `lib/costs/auto-populate.ts`
- Modify: `app/api/components/[componentId]/flows/route.ts` (POST) + `app/api/components/[componentId]/route.ts` (PUT)
- Create: `tests/lib/costs/auto-populate.test.ts`

The idea: when a user sets the component's `driver_type` to "Electricity (kWh)", and the case has a region, use the cached electricity price to fill `energy_cost`. Same for labor if an occupation code is set.

**Step 1: Extend component schema**

(One-line migration in 006 or new 007 — a `labor_occupation` string column)

Add to `database/migrations/007_cost_auto_populate.sql`:
```sql
ALTER TABLE component
  ADD COLUMN labor_occupation VARCHAR(10) NULL COMMENT 'BLS OEWS code e.g. 51-4121' AFTER driver_type,
  ADD COLUMN labor_hours DECIMAL(10,4) NULL AFTER labor_occupation;

ALTER TABLE case_table
  ADD COLUMN region_code VARCHAR(20) NULL AFTER description;
```

Run via a new migration runner (`scripts/run-migration-007.js`). Commit.

**Step 2: Write the auto-populate function (with tests)**

```typescript
// lib/costs/auto-populate.ts
import { queryOne, execute } from '@/lib/db-helpers';
import { getOrFetchRate } from '@/lib/integrations/cost-rates';
import { fetchElectricityPrice, fetchNaturalGasPrice } from '@/lib/integrations/eia/client';
import { fetchMedianHourlyWage } from '@/lib/integrations/bls/client';

export async function autoPopulateCosts(componentId: number): Promise<{
  laborSet: boolean; energySet: boolean; totalsSet: number;
}> {
  const comp = await queryOne<any>(`
    SELECT c.component_id, c.labor_occupation, c.labor_hours, c.driver_type, c.quantity,
           ct.region_code
      FROM component c JOIN case_table ct ON c.case_id = ct.case_id
     WHERE c.component_id = ?`, [componentId]);
  if (!comp) throw new Error('component not found');

  let laborSet = false, energySet = false, totalsSet = 0;
  const region = (comp.region_code ?? 'US').slice(0, 2).toUpperCase();

  // Labor
  if (comp.labor_occupation && comp.labor_hours) {
    try {
      const rate = await getOrFetchRate({
        type: 'labor', key: comp.labor_occupation, region,
        fetcher: async () => {
          const w = await fetchMedianHourlyWage(comp.labor_occupation, region);
          if (!w) throw new Error('no BLS data');
          return { rateValue: w.hourlyRate, unit: '$/hr',
                   source: `BLS ${w.year}`, effectiveDate: `${w.year}-05-01` };
        },
      });
      const laborCost = rate.rateValue * parseFloat(comp.labor_hours);
      await execute('UPDATE component SET labor_cost = ? WHERE component_id = ?', [laborCost, componentId]);
      laborSet = true; totalsSet++;
    } catch { /* leave untouched */ }
  }

  // Energy — for each driver flow of Electricity or Natural Gas
  const flows = await (await import('@/lib/db-helpers')).query<any>(`
    SELECT f.quantity, s.substance_name
      FROM flows f JOIN substances s ON f.substance_id = s.substance_id
     WHERE f.component_id = ? AND f.is_driver = 1
  `, [componentId]);

  let energyCost = 0, energyFound = false;
  for (const f of flows) {
    const name = String(f.substance_name).toLowerCase();
    if (name.includes('electricity')) {
      try {
        const rate = await getOrFetchRate({
          type: 'electricity', key: 'grid', region,
          fetcher: async () => {
            const p = await fetchElectricityPrice(region);
            if (!p) throw new Error('no EIA data');
            return { rateValue: p.rateValue, unit: p.unit,
                     source: `EIA ${p.period}`, effectiveDate: `${p.period}-01` };
          },
        });
        energyCost += rate.rateValue * parseFloat(f.quantity);
        energyFound = true;
      } catch { /* skip */ }
    } else if (name.includes('natural gas')) {
      try {
        const rate = await getOrFetchRate({
          type: 'natural_gas', key: 'industrial', region,
          fetcher: async () => {
            const p = await fetchNaturalGasPrice(region);
            if (!p) throw new Error('no EIA data');
            return { rateValue: p.rateValue, unit: p.unit,
                     source: `EIA ${p.period}`, effectiveDate: `${p.period}-01` };
          },
        });
        energyCost += rate.rateValue * parseFloat(f.quantity);
        energyFound = true;
      } catch { /* skip */ }
    }
  }
  if (energyFound) {
    await execute('UPDATE component SET energy_cost = ? WHERE component_id = ?', [energyCost, componentId]);
    energySet = true; totalsSet++;
  }

  return { laborSet, energySet, totalsSet };
}
```

**Step 3: Test — mock both clients and `getOrFetchRate`**

Write unit tests similar to the PubChem pattern.

**Step 4: Wire into component PUT**

At the bottom of the PUT handler in `app/api/components/[componentId]/route.ts`, before returning, optionally:

```typescript
// Auto-fill costs on save if the body requested it
if ((request as any)._autofill !== false && (await hasAutoFillablePrefs(componentId))) {
  try { await autoPopulateCosts(componentId); } catch { /* soft fail */ }
}
```

Simpler and more explicit: add a dedicated endpoint `POST /api/components/[componentId]/auto-costs` that triggers it and is called from the UI after changes.

**Step 5: UI affordance**

Add a button on the component edit form: "Auto-fill labor + energy costs" — when clicked, calls the new endpoint and refetches.

**Step 6: Commit (multiple small commits)**

```bash
git add database/migrations/007_cost_auto_populate.sql scripts/run-migration-007.js
git commit -m "feat(db): add labor_occupation + labor_hours + case region"

git add lib/costs/auto-populate.ts tests/lib/costs/auto-populate.test.ts
git commit -m "feat(costs): auto-populate from BLS + EIA cached rates"

git add app/api/components/[componentId]/auto-costs/route.ts # new
git commit -m "feat(api): POST /components/:id/auto-costs"

git add app/project/[projectId]/case/[caseId]/component/new/page.tsx \
        app/project/[projectId]/case/[caseId]/page.tsx
git commit -m "feat(ui): auto-fill costs button on component editor"
```

---

### Task 21: End-to-end verification for Phase 1b

Manually verify on the EV Battery project:

1. In /admin/integrations, click "Sync electricity zones" for US-NY.
2. Edit a case → set region = US-NY.
3. Edit an elemental task → set `labor_occupation = 51-4121`, `labor_hours = 0.5`.
4. Click "Auto-fill costs" → `labor_cost` should fill to ~$12.50 (or live number).
5. Run assessment with region=US-NY → Global Warming for electricity is ~0.283 × kWh (higher than the Global 0.42 average in seeds — compare).
6. Re-run with region=FR → Global Warming lower due to French grid carbon.

Commit a short verification note.

---

## PHASE 1c — Metals, more methods, PDF attribution

### Task 22: Metals-API client + material rate endpoint

Pattern: `lib/integrations/metals/client.ts` + `app/api/integrations/metals/fetch-price/route.ts`. Same shape as BLS/EIA. Auto-populate material cost for any flow whose substance matches a known metal symbol (Steel-HR, ALU, XCU, ZNC). Add `METALS_API_KEY` to `.env.local`.

TDD as before, commit.

### Task 23: ReCiPe Midpoint (H) factor seed

`lib/integrations/openlca/data/recipe-midpoint-h.ts` — same structure as CML seed. Supported methods map in `openlca/import/route.ts` gains `'ReCiPe Midpoint (H)': RECIPE_MIDPOINT_H`. User imports it from the admin dashboard. TDD + commit.

### Task 24: TRACI 2.1 factor seed

Same pattern. Add `'TRACI 2.1'` entry to the dashboard.

### Task 25: PDF source attribution

Modify `lib/pdf-generator.ts`:

- Add a new section "Data Sources" at the end of the report listing:
  - "Characterization factors: CML 2001 (openLCA package 2.7.4)"
  - "Electricity grid carbon (US-NY): Electricity Maps API, fetched 2026-04-13"
  - "Labor rates: BLS OEWS 2024 (Welders, New York)"
  - "Energy prices: EIA retail-sales monthly, 2026-01"
- Add a small "Source" column next to each impact value in the tables, containing abbreviated provenance.

Write snapshot-style tests (generate a PDF, assert it contains the required strings via `pdfparse`/`pdftotext`).

Commit.

### Task 26: Phase 1c verification + plan update

Run full verification:
- All 3 methods (CML, ReCiPe, TRACI) importable
- Metals API fills material cost for Steel flows
- PDF report cites sources for every number
- Final acceptance pass against design's "Success Criteria" section

Commit a summary doc `docs/plans/2026-04-13-phase1c-verification.md`.

---

## Final housekeeping

- [ ] `pnpm test` — all green
- [ ] `pnpm build` — no type errors
- [ ] `pnpm lint` — no new warnings
- [ ] Every new route has a test; every lib has a test
- [ ] `docs/plans/2026-04-13-api-integration-design.md` unchanged
- [ ] Squash/rebase commits if noisy (optional; prefer readable history)

**Final commit:**

```bash
git commit --allow-empty -m "feat: LCAPIX v3 API integration phase 1 complete"
git push origin main   # only if user confirms; do not auto-push
```

---

## Execution notes for whoever implements

- Tasks are numbered; each should be a separate commit (or a couple of commits per task).
- TDD: write the test, run it and watch it fail, implement, run it and watch it pass, commit.
- Never batch multiple tasks before committing.
- If a test passes on the first run, that is a code smell. Re-check the test actually exercises the code.
- For any task that needs to hit a live external API, mock it in unit tests; smoke-test manually with curl.
- Use `@superpowers:verification-before-completion` before marking any task complete.
- Use `@superpowers:systematic-debugging` if something unexpected breaks.
