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
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import {
  buildInsightMessages,
  HF_ROUTER_URL,
  INSIGHTS_DEFAULT_MODEL,
  type InsightFacts,
} from '@/lib/insights/prompt';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    await requireAuth(request);

    const token = process.env.HF_TOKEN;
    const model = process.env.HF_INSIGHTS_MODEL || INSIGHTS_DEFAULT_MODEL;

    // No key configured → tell the client to fall back to computed insights.
    // 200 (not an error): the deterministic path is a first-class mode.
    if (!token) {
      return NextResponse.json({ fallback: true, reason: 'HF_TOKEN not configured' });
    }

    const facts = (await request.json()) as InsightFacts;
    const { system, user } = buildInsightMessages(facts);

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
      // Surface as fallback so the UI degrades to computed insights instead of
      // showing an error — but include the status for the console/telemetry.
      return NextResponse.json(
        { fallback: true, reason: `HF ${hfRes.status}: ${detail.slice(0, 200)}` },
        { status: 200 }
      );
    }

    // Parse the OpenAI-style SSE from HF and re-emit only the text deltas as a
    // plain UTF-8 stream — keeps the client trivial (append chunks as they land).
    const reader = hfRes.body.getReader();
    const decoder = new TextDecoder();
    const encoder = new TextEncoder();
    let buffer = '';

    const stream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // keep the partial last line
        for (const line of lines) {
          const t = line.trim();
          if (!t.startsWith('data:')) continue;
          const data = t.slice(5).trim();
          if (data === '[DONE]') {
            controller.close();
            return;
          }
          try {
            const json = JSON.parse(data);
            const delta = json?.choices?.[0]?.delta?.content;
            if (delta) controller.enqueue(encoder.encode(delta));
          } catch {
            /* ignore keep-alives / non-JSON lines */
          }
        }
      },
      cancel() {
        reader.cancel().catch(() => {});
      },
    });

    return new Response(stream, {
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
    return NextResponse.json({ fallback: true, reason: 'insights route error' }, { status: 200 });
  }
}
