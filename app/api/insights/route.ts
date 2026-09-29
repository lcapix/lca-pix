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
 * Limits: 16 KB body (checked on Content-Length and while reading), question
 * at most 500 characters, capped lists and strings (sanitizeInsightFacts), and
 * RATE_LIMITS.insights per user. Refusals are JSON with fallback:true.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
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

export async function POST(request: NextRequest) {
  try {
    const userId = await requireAuth(request);

    // Refuse an oversized body before reading any of it (INS-2).
    if ((declaredContentLength(request) ?? 0) > INSIGHT_LIMITS.bodyBytes) return tooLarge();

    const token = process.env.HF_TOKEN;
    const model = process.env.HF_INSIGHTS_MODEL || INSIGHTS_DEFAULT_MODEL;

    // No key configured → tell the client to fall back to computed insights.
    // 200 (not an error): the deterministic path is a first-class mode.
    if (!token) {
      return fallback({ reason: 'HF_TOKEN not configured' });
    }

    // Each narration is a paid model call: 20 per user per hour.
    const limited = await enforceRateLimit(RATE_LIMITS.insights, [userId], { fallback: true });
    if (limited) return limited;

    let raw: unknown;
    try {
      const bytes = await readBodyCapped(request, INSIGHT_LIMITS.bodyBytes);
      raw = JSON.parse(new TextDecoder().decode(bytes));
    } catch (e) {
      if (e instanceof PayloadTooLargeError) return tooLarge();
      return fallback({ error: 'Body must be JSON' }, 400);
    }
    const parsed = sanitizeInsightFacts(raw);
    if (!parsed.ok) return fallback({ error: parsed.error }, 400);
    const { system, user } = buildInsightMessages(parsed.facts);

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

    return new Response(sseToText(hfRes.body), {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Insights-Model': model,
      },
    });
  } catch (error: any) {
    if (
      error.message === 'No authentication token provided' ||
      error.message === 'Invalid or expired token' ||
      error.message === 'Unauthorized' ||
      error.message === 'User account not found or inactive'
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Insights route error:', error);
    // Degrade to computed insights rather than surfacing an error banner.
    return fallback({ reason: 'insights route error' });
  }
}
