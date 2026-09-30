/**
 * Request-body helpers shared by the API routes.
 */
import { NextResponse } from 'next/server';

export type JsonObject = Record<string, any>;

export type ReadJsonResult =
  | { ok: true; body: JsonObject }
  | { ok: false; response: NextResponse };

const refuse = (error: string): ReadJsonResult => ({
  ok: false,
  response: NextResponse.json({ error }, { status: 400 }),
});

/**
 * The request body as a JSON object, or a 400 the route returns as is.
 *
 * A bare `await request.json()` inside a route's try sends invalid JSON to the
 * catch-all, which answers 500. Here invalid JSON is "Invalid JSON body", and
 * valid JSON that is not an object (a string, an array, null) is refused too,
 * so a route can read fields off the result without further checks. The body
 * is never echoed back.
 *
 * `optional: true` is for routes whose body may be left out: an empty body
 * reads as {}; a body that is present must still be a JSON object.
 *
 *   const json = await readJson(request);
 *   if (!json.ok) return json.response;
 *   const body = json.body;
 */
export async function readJson(
  request: Request,
  opts: { optional?: boolean } = {},
): Promise<ReadJsonResult> {
  let text: string;
  try {
    text = await request.text();
  } catch {
    return refuse('Invalid JSON body');
  }
  if (opts.optional && text.trim() === '') return { ok: true, body: {} };
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return refuse('Invalid JSON body');
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return refuse('Request body must be a JSON object');
  }
  return { ok: true, body: value as JsonObject };
}
