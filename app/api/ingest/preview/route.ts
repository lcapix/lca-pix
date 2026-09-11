/**
 * POST /api/ingest/preview — document upload → ingestion plan (nothing written).
 *
 * Multipart form: file (the document), connector ('itac'), plant_id.
 * Runs the ported lcapix-ingest pipeline — extract (SheetJS) → structure
 * (deterministic ITAC connector) → map (fuzzy substance match + named unit
 * conversions, against the LIVE substance catalog) — and returns the full
 * plan for the review screen. The plan is the human gate: nothing reaches the
 * database until /api/ingest/apply receives the (possibly edited) plan back.
 */
import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import { structureItac, listPlantIds } from '@/lib/ingest/itac';
import { mapModel, type CatalogSubstance } from '@/lib/ingest/maplca';

export const runtime = 'nodejs';
// The real ITAC workbook is ~16MB; parsing takes a few seconds.
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);

    const form = await request.formData();
    const file = form.get('file');
    const connector = String(form.get('connector') ?? 'itac');
    const plantId = String(form.get('plant_id') ?? '').trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    if (connector !== 'itac') {
      return NextResponse.json(
        { error: `Unknown connector '${connector}'. Available: itac (DOE ITAC workbook).` },
        { status: 400 }
      );
    }
    if (!plantId) {
      return NextResponse.json(
        { error: 'plant_id is required (an ITAC assessment ID, e.g. WV0661)' },
        { status: 400 }
      );
    }

    // Extract: read the ASSESS sheet. sheet_to_json keys rows by header row,
    // matching what the proven Python pipeline saw through pandas.
    const XLSX = await import('xlsx');
    const buf = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buf, { type: 'buffer' });
    const assess = wb.Sheets['ASSESS'];
    if (!assess) {
      return NextResponse.json(
        { error: `No ASSESS sheet found. Sheets present: ${wb.SheetNames.join(', ')}` },
        { status: 400 }
      );
    }
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(assess);

    // Structure: deterministic connector.
    let pm;
    try {
      pm = structureItac(rows, plantId, file.name);
    } catch {
      const ids = listPlantIds(rows, plantId);
      return NextResponse.json(
        {
          error: `Assessment '${plantId}' not found in ${file.name}.`,
          matching_ids: ids.sample,
          matching_count: ids.total,
        },
        { status: 404 }
      );
    }

    // Map against the live catalog, factor coverage included so the review
    // screen can warn about zero-factor matches before anything is created.
    const substances = await query<any>(
      `SELECT s.substance_id, s.substance_name, s.unit,
              COALESCE(fc.factor_count, 0) AS factor_count
       FROM substances s
       LEFT JOIN (
         SELECT substance_id, COUNT(*) AS factor_count
         FROM driver_impact_factors
         WHERE factor_value <> 0
         GROUP BY substance_id
       ) fc ON fc.substance_id = s.substance_id`
    );
    const plan = mapModel(pm, substances as CatalogSubstance[]);

    return NextResponse.json({ success: true, connector, plant_id: plantId, plan });
  } catch (error: any) {
    if (
      error.message === 'No authentication token provided' ||
      error.message === 'Invalid or expired token' ||
      error.message === 'Unauthorized' ||
      error.message === 'User account not found or inactive'
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Ingest preview error:', error);
    return NextResponse.json({ error: 'Failed to build ingestion preview' }, { status: 500 });
  }
}
