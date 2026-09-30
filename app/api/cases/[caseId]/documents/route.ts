import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, insert, execute } from '@/lib/db-helpers';
import { requireAuth, checkProjectAccess } from '@/lib/auth';
import {
  extractDocText,
  readUploadForm,
  sniffUpload,
  MAX_UPLOAD_BYTES,
  UPLOAD_TOO_LARGE_MESSAGE,
} from '@/lib/ingest/extract-text';
import { readSheet } from '@/lib/ingest/sheet-reader';
import { PayloadTooLargeError } from '@/lib/rate-limit';

/**
 * The documents a case was built from, kept so a person can read from them
 * while they model. The importer used to read a file in memory and drop it,
 * which left a student typing from a document the app could no longer show.
 *
 * Text only. A stored document is a reference to read, not an attachment to
 * download: it exists so a flow can be checked against the line it came from.
 */

// Enough for a routing pack or a long EPD; well under MEDIUMTEXT's 16MB.
const MAX_CHARS = 400_000;
const MAX_BYTES = MAX_UPLOAD_BYTES;
// case_documents.doc_type is VARCHAR(64).
const MAX_DOC_TYPE = 64;

/** Migration 021 adds the table; until it is applied, say so plainly. */
function missingTable(err: any) {
  return err?.code === 'ER_NO_SUCH_TABLE';
}

/**
 * Any project member may read a case's documents; attaching and deleting
 * them needs 'editor' (a viewer must not plant or remove reference material).
 */
async function caseAccess(request: NextRequest, caseIdParam: string, level?: 'editor') {
  const userId = await requireAuth(request);
  const caseId = parseInt(caseIdParam);
  const caseData = await queryOne<any>('SELECT project_id FROM case_table WHERE case_id = ?', [caseId]);
  if (!caseData) return { error: NextResponse.json({ error: 'Case not found' }, { status: 404 }) };
  const allowed = level
    ? await checkProjectAccess(userId, caseData.project_id, level)
    : await checkProjectAccess(userId, caseData.project_id);
  if (!allowed) {
    return { error: NextResponse.json({ error: 'Access denied' }, { status: 403 }) };
  }
  return { userId, caseId };
}

const tooLarge = () => NextResponse.json({ error: UPLOAD_TOO_LARGE_MESSAGE }, { status: 413 });

// GET /api/cases/[caseId]/documents          -> the list (no content)
// GET /api/cases/[caseId]/documents?id=12    -> one document with its text
export async function GET(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId: caseIdParam } = await params;
    const access = await caseAccess(request, caseIdParam);
    if (access.error) return access.error;

    const id = new URL(request.url).searchParams.get('id');

    if (id) {
      const doc = await queryOne<any>(
        `SELECT document_id, filename, doc_type, content, created_at
           FROM case_documents WHERE document_id = ? AND case_id = ?`,
        [parseInt(id), access.caseId],
      );
      if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
      return NextResponse.json({ success: true, document: doc });
    }

    const documents = await query<any>(
      `SELECT document_id, filename, doc_type, created_at,
              CHAR_LENGTH(COALESCE(content, '')) AS char_count
         FROM case_documents WHERE case_id = ?
         ORDER BY created_at, document_id`,
      [access.caseId],
    );
    return NextResponse.json({ success: true, documents });
  } catch (error: any) {
    if (missingTable(error)) return NextResponse.json({ success: true, documents: [] });
    if (/Unauthorized|token/i.test(error?.message ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('List case documents error:', error);
    return NextResponse.json({ error: 'Failed to load documents' }, { status: 500 });
  }
}

// POST /api/cases/[caseId]/documents — multipart: file, doc_type
export async function POST(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId: caseIdParam } = await params;
    const access = await caseAccess(request, caseIdParam, 'editor');
    if (access.error) return access.error;

    // Size is checked before the body is buffered (Content-Length, then a
    // capped read), not after request.formData() has read all of it.
    let form: FormData;
    try {
      form = await readUploadForm(request);
    } catch (e) {
      if (e instanceof PayloadTooLargeError) return tooLarge();
      return NextResponse.json({ error: 'Could not read the upload' }, { status: 400 });
    }
    const file = form.get('file');
    const docTypeRaw = form.get('doc_type');
    const docType = typeof docTypeRaw === 'string' ? docTypeRaw.trim() || null : null;

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }
    if (docType && docType.length > MAX_DOC_TYPE) {
      return NextResponse.json(
        { error: `doc_type must be at most ${MAX_DOC_TYPE} characters` },
        { status: 400 },
      );
    }
    if (file.size > MAX_BYTES) return tooLarge();

    const buf = Buffer.from(await file.arrayBuffer());
    const sniffed = sniffUpload(buf, file.name);
    if (!sniffed.ok) {
      return NextResponse.json({ error: sniffed.error }, { status: 415 });
    }

    // A spreadsheet's text is its rows; anything else goes through the same
    // extractor the importer uses, so what is stored is what the importer read.
    let text = '';
    if (sniffed.kind === 'xlsx' || sniffed.kind === 'xls' || /\.(csv|tsv)$/i.test(file.name)) {
      try {
        const read = readSheet(buf, file.name, () => true);
        if (read?.rows?.length) {
          // The sheet reader adds bookkeeping columns (__row); they are its
          // business, not something to show somebody reading their own document.
          const cols = Object.keys(read.rows[0]).filter((c) => !c.startsWith('__'));
          text = [
            cols.join('\t'),
            ...read.rows.map((r: any) => cols.map((c) => String(r[c] ?? '')).join('\t')),
          ].join('\n');
        }
      } catch {
        // fall through to the plain-text path below
      }
    }
    if (!text) {
      const extracted = await extractDocText(buf, file.name);
      text = extracted.text;
    }

    text = text.replace(/\u0000/g, '').trim();
    if (!text) {
      return NextResponse.json(
        { error: 'No readable text in that file. Scanned images are not read.' },
        { status: 400 },
      );
    }
    const truncated = text.length > MAX_CHARS;
    if (truncated) text = text.slice(0, MAX_CHARS);

    const documentId = await insert(
      `INSERT INTO case_documents (case_id, filename, doc_type, content, uploaded_by)
       VALUES (?, ?, ?, ?, ?)`,
      [access.caseId, file.name.slice(0, 255), docType, text, access.userId],
    );

    return NextResponse.json({
      success: true,
      document: { document_id: documentId, filename: file.name, doc_type: docType, char_count: text.length },
      truncated,
    });
  } catch (error: any) {
    if (missingTable(error)) {
      return NextResponse.json(
        { error: 'Reference documents need migration 021. Run it, then attach the file again.' },
        { status: 503 },
      );
    }
    if (/Unauthorized|token/i.test(error?.message ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Attach case document error:', error);
    return NextResponse.json({ error: 'Failed to attach document' }, { status: 500 });
  }
}

// DELETE /api/cases/[caseId]/documents?id=12
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ caseId: string }> }) {
  try {
    const { caseId: caseIdParam } = await params;
    const access = await caseAccess(request, caseIdParam, 'editor');
    if (access.error) return access.error;

    const id = new URL(request.url).searchParams.get('id');
    if (!id || !/^\d+$/.test(id)) {
      return NextResponse.json({ error: 'Missing document id' }, { status: 400 });
    }

    const removed = await execute('DELETE FROM case_documents WHERE document_id = ? AND case_id = ?', [
      parseInt(id),
      access.caseId,
    ]);
    if (!removed) return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (missingTable(error)) return NextResponse.json({ success: true });
    if (/Unauthorized|token/i.test(error?.message ?? '')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Delete case document error:', error);
    return NextResponse.json({ error: 'Failed to delete document' }, { status: 500 });
  }
}
