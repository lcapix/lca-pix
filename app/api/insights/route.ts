/**
 * POST /api/insights — grounded AI narration for Magic Insights.
 *
 * Body: InsightFacts (the numbers the engine already computed) + mode/question.
 * Streams a plain-text narration from an OPEN model on Hugging Face's
 * OpenAI-compatible router, under a strict "use only these figures, never
 * invent a number" system prompt.
 *
 * Honesty by construction:
 *  - The model is handed the computed facts and told never to produce new
 *    numbers; it phrases and reasons, it does not calculate.
 *  - If HF_TOKEN is not configured, this returns { fallback: true } with 200
 *    so the client silently uses the deterministic computed insight instead.
 *    The AI path is strictly additive; the product never depends on it.
 *
 * Checked before it is sent: the reply is collected in full and every number
 * in it must match a number in the facts the model was given (lib/insights/
 * number-check). One unsupported number drops the reply, and the client shows
 * the computed insight instead. So the narration is no longer streamed: it
 * arrives whole, after the check.
 *
 * Limits: 16 KB body (checked on Content-Length and while reading), question
 * at most 500 characters, capped lists and strings (sanitizeInsightFacts), and
 * RATE_LIMITS.insights per user. Refusals are JSON with fallback:true.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { caseAccessDenied, isAuthError } from '@/lib/route-guard';
import { createHash } from 'crypto';
import { execute, queryOne } from '@/lib/db-helpers';
import { parseId } from '@/lib/ids';
import { checkNarrationNumbers } from '@/lib/insights/number-check';
import {
  buildInsightMessages,
  HF_ROUTER_URL,
  INSIGHTS_DEFAULT_MODEL,
  INSIGHT_LIMITS,
  sanitizeInsightFacts,
} from '@/lib/insights/prompt';
import {
  PayloadTooLargeError,
  RATE_LIMITS,
  declaredContentLength,
  enforceRateLimit,
  readBodyCapped,
} from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 60;

// Every non-stream reply carries fallback:true, so the modal quietly shows the
// computed insight instead (it treats any JSON response as the fallback signal).
function fallback(body: Record<string, unknown>, status = 200) {
  return NextResponse.json({ fallback: true, ...body }, { status });
}

const tooLarge = () =>
  fallback({ error: `Request too large (limit ${INSIGHT_LIMITS.bodyBytes / 1024} KB)` }, 413);

/**
 * Re-emit only the text deltas of an OpenAI-style SSE stream as plain UTF-8.
 *
 * pull() keeps reading until it has enqueued something or the upstream is
 * done. A pull that returns without enqueuing is not called again for the
 * pending read, so returning early on a role-only, reasoning-only or
 * keep-alive event (gpt-oss sends those before any content) stalled the whole
 * narration until maxDuration (INS-1).
 */
function sseToText(body: ReadableStream<Uint8Array>): ReadableStream<Uint8Array> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = '';
  let finished = false;

  const finish = (controller: ReadableStreamDefaultController<Uint8Array>) => {
    finished = true;
    controller.close();
    reader.cancel().catch(() => {});
  };

  /** Handle complete lines; returns 'done' on [DONE], else whether text was enqueued. */
  const drain = (lines: string[], controller: ReadableStreamDefaultController<Uint8Array>) => {
    let enqueued = false;
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue; // comments / keep-alives / event names
      const data = t.slice(5).trim();
      if (data === '[DONE]') return 'done' as const;
      try {
        const delta = JSON.parse(data)?.choices?.[0]?.delta?.content;
        if (typeof delta === 'string' && delta) {
          controller.enqueue(encoder.encode(delta));
          enqueued = true;
        }
      } catch {
        /* ignore non-JSON lines */
      }
    }
    return enqueued;
  };

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      while (!finished) {
        const { done, value } = await reader.read();
        if (done) {
          buffer += decoder.decode();
          drain(buffer ? [buffer] : [], controller);
          buffer = '';
          finish(controller);
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // keep the partial last line
        const out = drain(lines, controller);
        if (out === 'done') {
          finish(controller);
          return;
        }
        if (out) return;
      }
    },
    cancel() {
      finished = true;
      reader.cancel().catch(() => {});
    },
  });
}

/** The run a narration is about, and whether its project lets AI phrase it (migrate-042). */
async function runScope(runId: number): Promise<{ case_id: number; ai_enabled: boolean } | null> {
  const sql = (withSwitch: boolean) =>
    `SELECT r.case_id${withSwitch ? ', p.ai_enabled' : ''}
       FROM assessment_runs r
       JOIN case_table c ON c.case_id = r.case_id
       JOIN project p ON p.project_id = c.project_id
      WHERE r.run_id = ?`;
  let row: any;
  try {
    row = await queryOne<any>(sql(true), [runId]);
  } catch (err: any) {
    if (err?.code !== 'ER_BAD_FIELD_ERROR') throw err;
    row = await queryOne<any>(sql(false), [runId]); // before migrate-042: on (D7)
  }
  if (!row) return null;
  return { case_id: Number(row.case_id), ai_enabled: row.ai_enabled == null || Number(row.ai_enabled) === 1 };
}

/** A checked reply kept for this run and prompt, or null (none, or no cache table yet). */
async function cachedReply(runId: number, hash: string): Promise<{ reply: string; model: string } | null> {
  try {
    const row = await queryOne<any>(`SELECT reply, model FROM insight_cache WHERE run_id = ? AND prompt_hash = ?`, [runId, hash]);
    return row ? { reply: String(row.reply), model: String(row.model) } : null;
  } catch (err: any) {
    if (err?.code === 'ER_NO_SUCH_TABLE') return null;
    throw err;
  }
}

async function keepReply(runId: number, hash: string, model: string, reply: string): Promise<void> {
  try {
    await execute(`INSERT IGNORE INTO insight_cache (run_id, prompt_hash, model, reply) VALUES (?, ?, ?, ?)`, [
      runId,
      hash,
      model.slice(0, 100),
      reply,
    ]);
  } catch (err: any) {
    // A reply that cannot be kept is still a good reply.
    console.warn('Insight reply not cached:', err?.code ?? err?.message ?? err);
  }
}

const narration = (text: string, model: string, cache: 'hit' | 'miss') =>
  new Response(text, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Insights-Model': model,
      'X-Insights-Checked': 'numbers',
      'X-Insights-Cache': cache,
    },
  });

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth(request);

    // Refuse an oversized body before reading any of it (INS-2).
    if ((declaredContentLength(request) ?? 0) > INSIGHT_LIMITS.bodyBytes) return tooLarge();

    let raw: unknown;
    try {
      const bytes = await readBodyCapped(request, INSIGHT_LIMITS.bodyBytes);
      raw = JSON.parse(new TextDecoder().decode(bytes));
    } catch (e) {
      if (e instanceof PayloadTooLargeError) return tooLarge();
      return fallback({ error: 'Body must be JSON' }, 400);
    }

    // The run the narration is about: the caller must reach it, and its
    // project must allow AI (D7). Without a run there is nothing to check the
    // switch against, so the computed insight is the answer.
    const runId = parseId((raw as any)?.run_id);
    if (Number.isNaN(runId)) return fallback({ reason: 'no run' });
    const scope = await runScope(runId);
    if (!scope) return NextResponse.json({ fallback: true, error: 'Run not found' }, { status: 404 });
    const denied = await caseAccessDenied(userId, scope.case_id, undefined, { notFound: 'Run not found' });
    if (denied) return denied;
    if (!scope.ai_enabled) return fallback({ reason: 'AI is off for this project', ai: 'off' });

    const { run_id: _runId, ...factsBody } = (raw ?? {}) as Record<string, unknown>;
    const parsed = sanitizeInsightFacts(factsBody);
    if (!parsed.ok) return fallback({ error: parsed.error }, 400);
    const { system, user } = buildInsightMessages(parsed.facts);

    const model = process.env.HF_INSIGHTS_MODEL || INSIGHTS_DEFAULT_MODEL;
    // Asked before: the same checked words, no model call, no allowance used.
    const hash = createHash('sha256').update(`${model}\n${system}\n${user}`).digest('hex');
    const kept = await cachedReply(runId, hash);
    if (kept) return narration(kept.reply, kept.model, 'hit');

    // No key configured → tell the client to fall back to computed insights.
    // 200 (not an error): the deterministic path is a first-class mode.
    const token = process.env.HF_TOKEN;
    if (!token) {
      return fallback({ reason: 'HF_TOKEN not configured' });
    }

    // Each narration is a paid model call: 20 per user per hour.
    const limited = await enforceRateLimit(RATE_LIMITS.insights, [userId], { fallback: true });
    if (limited) return limited;

    const hfRes = await fetch(HF_ROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        stream: true,
        temperature: 0.3, // keep it grounded and repeatable, not creative
        max_tokens: 400,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });

    if (!hfRes.ok || !hfRes.body) {
      const detail = await hfRes.text().catch(() => hfRes.statusText);
      // Degrade to computed insights; the upstream text stays in the server log.
      console.warn(`Insights upstream HF ${hfRes.status}: ${String(detail).slice(0, 200)}`);
      return fallback({ reason: `HF ${hfRes.status}` });
    }

    // Collect the whole reply, then check every number in it against the facts.
    const text = (await new Response(sseToText(hfRes.body)).text()).trim();
    if (!text) return fallback({ reason: 'empty reply' });
    const check = checkNarrationNumbers(text, user);
    if (!check.ok) {
      // Only the count goes to the log: the reply may quote the user's own data.
      console.warn(`Insights reply dropped: ${check.unmatched.length} number(s) not in the facts`);
      return fallback({ reason: 'number check failed' });
    }

    await keepReply(runId, hash, model, text);
    return narration(text, model, 'miss');
  } catch (error: any) {
    if (isAuthError(error)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Insights route error:', error);
    // Degrade to computed insights rather than surfacing an error banner.
    return fallback({ reason: 'insights route error' });
  }
}
