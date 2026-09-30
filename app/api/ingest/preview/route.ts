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
import { query, queryOne } from '@/lib/db-helpers';
import { requireAuth } from '@/lib/auth';
import { caseAccessDenied, isAuthError } from '@/lib/route-guard';
import { structureItac, listPlantIds } from '@/lib/ingest/itac';
import { isBomHeader, structureBom } from '@/lib/ingest/bom';
import { isRoutingHeader, structureRouting } from '@/lib/ingest/routing';
import { isEquipmentHeader, structureEquipment, type CaseStep } from '@/lib/ingest/equipment';
import { mapModel, type CatalogSubstance } from '@/lib/ingest/maplca';
import { readSheet, workbookText, limitedRange, SHEET_LIMITS, type SheetRead } from '@/lib/ingest/sheet-reader';
import type { ProcessModel } from '@/lib/ingest/schema';
import {
  MAX_UPLOAD_BYTES,
  MULTIPART_OVERHEAD_BYTES,
  UPLOAD_TOO_LARGE_MESSAGE,
  readUploadForm,
  sniffUpload,
} from '@/lib/ingest/extract-text';
import {
  PayloadTooLargeError,
  RATE_LIMITS,
  declaredContentLength,
  enforceRateLimit,
} from '@/lib/rate-limit';
import { parseId } from '@/lib/ids';

export const runtime = 'nodejs';
// Uploads are capped at 12 MB (the full ITAC database workbook is ~16 MB and
// has to be split; on Vercel the body limit is 4.5 MB). Parsing a large
// workbook takes a few seconds; an AI-structured document can take longer.
export const maxDuration = 60;

const tooLarge = () => NextResponse.json({ error: UPLOAD_TOO_LARGE_MESSAGE }, { status: 413 });

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth(request);

    // Refuse an oversized upload before reading it (M6, ING-3).
    if ((declaredContentLength(request) ?? 0) > MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD_BYTES) {
      return tooLarge();
    }

    // Each preview can fan out to several LLM calls: 10 per user per hour.
    const limited = await enforceRateLimit(RATE_LIMITS.ingestPreview, [userId]);
    if (limited) return limited;

    let form: FormData;
    try {
      form = await readUploadForm(request);
    } catch (e) {
      if (e instanceof PayloadTooLargeError) return tooLarge();
      return NextResponse.json({ error: 'Could not read the upload' }, { status: 400 });
    }
    const file = form.get('file');
    const connector = String(form.get('connector') ?? 'itac');
    const plantId = String(form.get('plant_id') ?? '').trim();

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    const STRUCTURED = ['itac', 'bom', 'equipment'];
    const LLM_HINTS = ['sds', 'epd', 'routing'];
    if (![...STRUCTURED, ...LLM_HINTS].includes(connector)) {
      return NextResponse.json(
        {
          error: `Unknown connector '${connector}'. Available: itac (DOE ITAC workbook), ` +
            `bom (bill-of-materials CSV/XLSX), equipment (machine list CSV/XLSX), ` +
            `routing (CSV/XLSX, or PDF via the AI path), sds / epd (AI-structured PDF/HTML/text).`,
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_UPLOAD_BYTES) return tooLarge();
    const buf = Buffer.from(await file.arrayBuffer());
    // The bytes must match an allowed extension (no docx/zip/images read as text).
    const sniffed = sniffUpload(buf, file.name);
    if (!sniffed.ok) {
      return NextResponse.json({ error: sniffed.error }, { status: 415 });
    }
    let pm: ProcessModel | undefined;
    const lotSizeRaw = Number(form.get('lot_size'));
    const lotSize = Number.isFinite(lotSizeRaw) && lotSizeRaw > 0 ? lotSizeRaw : null;

    // 'routing' is dual-mode: a spreadsheet routing is parsed deterministically;
    // a PDF/text traveler goes through the LLM path below.
    const isSpreadsheet =
      sniffed.kind === 'xlsx' || sniffed.kind === 'xls' || /\.(csv|tsv)$/i.test(file.name);

    if ((connector === 'bom' || connector === 'routing') && isSpreadsheet) {
      // Locate the table wherever it is (any sheet, header on any of the first
      // rows, cleaned headers), then run the deterministic connector on it.
      let read: SheetRead | null = null;
      try {
        read = readSheet(buf, file.name, connector === 'bom' ? isBomHeader : isRoutingHeader);
      } catch (e: any) {
        return NextResponse.json(
          { error: `Could not open ${file.name} as a spreadsheet (${e?.message ?? 'unreadable file'}).` },
          { status: 400 }
        );
      }
      if (read) {
        pm =
          connector === 'bom'
            ? structureBom(read.rows, file.name, plantId || undefined, {
                massHints: read.massHints,
                decimalComma: read.decimalComma,
              })
            : structureRouting(read.rows, file.name, plantId || undefined, {
                lotSize,
                timeHints: read.timeHints,
                decimalComma: read.decimalComma,
              });
        pm.notes.unshift(...read.notes);
      }
      // Nothing recognisable: read the sheet text with the AI path instead of
      // returning an empty plan. Same step checks, same human review.
      const found =
        !!pm &&
        (connector === 'routing'
          ? pm.nodes.some((n) => n.tier === 'operation')
          : pm.flows.length > 0 || pm.notes.some((n) => /has no mass/.test(n)));
      if (!found) {
        try {
          const { structureWithLLM } = await import('@/lib/ingest/llm-structure');
          const aiPm = await structureWithLLM(workbookText(buf, file.name), connector, file.name);
          aiPm.notes.unshift(
            'The columns were not recognised, so this spreadsheet was read by the AI path. Check every line before applying.',
          );
          pm = aiPm;
        } catch (e: any) {
          if (!pm) {
            return NextResponse.json(
              {
                error: `No ${connector === 'bom' ? 'bill-of-materials' : 'routing'} table found in ${file.name} (no recognisable column headers), and the AI fallback failed: ${e?.message}`,
              },
              { status: 400 }
            );
          }
          pm.notes.push(`The AI fallback was not available: ${e?.message}`);
        }
      }
    } else if (connector === 'itac') {
      // The ITAC workbook has a fixed layout: the ASSESS sheet.
      const XLSX = await import('xlsx');
      let wb;
      try {
        wb = XLSX.read(buf, { type: 'buffer', sheetRows: SHEET_LIMITS.maxRows + 30 });
      } catch (e: any) {
        return NextResponse.json(
          { error: `Could not open ${file.name} as a workbook (${e?.message ?? 'unreadable file'}).` },
          { status: 400 }
        );
      }
      {
        if (!plantId) {
          return NextResponse.json(
            { error: 'plant_id is required (an ITAC assessment ID, e.g. WV0661)' },
            { status: 400 }
          );
        }
        const assess = wb.Sheets['ASSESS'];
        if (!assess) {
          return NextResponse.json(
            { error: `No ASSESS sheet found. Sheets present: ${wb.SheetNames.join(', ')}` },
            { status: 400 }
          );
        }
        const { range } = limitedRange(assess);
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(assess, range ? { range } : {});
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
      }
    } else if (connector === 'equipment') {
      // An equipment list adds energy to the steps of an EXISTING case, joined
      // on the work center and using the hours the routing gave each step.
      const targetCaseId = parseId(form.get('target_case_id'));
      if (!targetCaseId) {
        return NextResponse.json(
          { error: 'An equipment list adds energy to the steps of an existing case: choose that case first.' },
          { status: 400 }
        );
      }
      const caseRow = await queryOne<any>(`SELECT project_id FROM case_table WHERE case_id = ?`, [targetCaseId]);
      if (!caseRow) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
      const denied = await caseAccessDenied(userId, targetCaseId, 'editor', { notFound: 'Case not found' });
      if (denied) return denied;
      const comps = await query<any>(
        `SELECT c.component_id, c.component_name, c.component_type, c.description, c.labor_hours,
                c.parent_component_id, p.component_name AS parent_name
           FROM component c
           LEFT JOIN component p ON p.component_id = c.parent_component_id
          WHERE c.case_id = ?`,
        [targetCaseId]
      );
      const steps: CaseStep[] = (comps as any[])
        .filter((c) => c.component_type === 'operation' || c.component_type === 'elemental_task')
        .map((c) => ({
          id: Number(c.component_id),
          name: String(c.component_name),
          // The routing wrote "Work center: X" on the step; else its parent group.
          workCenter:
            String(c.description ?? '').match(/Work center:\s*([^;\[\]]+)/i)?.[1]?.trim() ||
            c.parent_name ||
            null,
          hoursPerUnit: c.labor_hours != null ? Number(c.labor_hours) : null,
        }));
      let read: SheetRead | null = null;
      try {
        read = readSheet(buf, file.name, isEquipmentHeader);
      } catch (e: any) {
        return NextResponse.json(
          { error: `Could not open ${file.name} as a spreadsheet (${e?.message ?? 'unreadable file'}).` },
          { status: 400 }
        );
      }
      if (!read) {
        return NextResponse.json(
          { error: `No equipment table found in ${file.name}: it needs a work center column and a rated power column.` },
          { status: 400 }
        );
      }
      pm = structureEquipment(read.rows, file.name, {
        productName: (comps as any[]).find((c) => !c.parent_component_id)?.component_name ?? 'Product',
        steps,
        powerHints: read.powerHints,
        decimalComma: read.decimalComma,
      });
      pm.notes.unshift(...read.notes);
    } else {
      // LLM-structured connectors (sds / epd / routing): extract text → model.
      const { extractDocText } = await import('@/lib/ingest/extract-text');
      const { structureWithLLM } = await import('@/lib/ingest/llm-structure');
      let text = '';
      let pages: { total: number; read: number } | undefined;
      try {
        ({ text, pages } = await extractDocText(buf, file.name));
      } catch (e: any) {
        return NextResponse.json(
          { error: `Could not read text from ${file.name} (${e?.message ?? 'unreadable file'}).` },
          { status: 400 }
        );
      }
      if (!text || text.trim().length < 40) {
        return NextResponse.json(
          { error: 'Could not extract readable text (a scanned PDF may need OCR).' },
          { status: 400 }
        );
      }
      try {
        pm = await structureWithLLM(text, connector as 'sds' | 'epd' | 'routing', file.name);
      } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 400 });
      }
      if (pages && pages.read < pages.total) {
        pm.notes.push(
          `Only the first ${pages.read} of ${pages.total} PDF pages were read; the rest of the document was not structured.`,
        );
      }
    }

    // Map against the live catalog, factor coverage included so the review
    // screen can warn about zero-factor matches before anything is created.
    const substances = await query<any>(
      `SELECT s.substance_id, s.substance_name, s.unit, s.category,
              COALESCE(fc.factor_count, 0) AS factor_count
       FROM substances s
       LEFT JOIN (
         SELECT substance_id, COUNT(*) AS factor_count
         FROM driver_impact_factors
         WHERE factor_value <> 0
         GROUP BY substance_id
       ) fc ON fc.substance_id = s.substance_id`
    );
    if (!pm) {
      return NextResponse.json({ error: 'Nothing could be read from this document.' }, { status: 400 });
    }
    const plan = mapModel(pm, substances as CatalogSubstance[]);

    return NextResponse.json({ success: true, connector, plant_id: plantId, plan });
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Ingest preview error:', error);
    return NextResponse.json({ error: 'Failed to build ingestion preview' }, { status: 500 });
  }
}
