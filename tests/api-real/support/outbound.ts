/**
 * Outbound network for the API suite: the only thing it mocks.
 *
 * `globalThis.fetch` is replaced (in setup.ts) by `mockedFetch`, which answers
 * the fixed upstream hosts the app calls (BLS, EIA, Metals-API, Electricity
 * Maps, PubChem, Google OAuth, the Hugging Face router) with realistic
 * fixtures, and refuses everything else. A refused request is recorded in
 * `outbound.unmocked`, and setup.ts fails the test that made it, so nothing
 * ever reaches production, RDS, Google, Hugging Face or a Vercel host.
 *
 * Tests override a host for the current test with `mockOutbound()`; setup.ts
 * restores the defaults before every test.
 */

export type OutboundHandler = (url: URL, init?: RequestInit) => Response | Promise<Response>;

interface Route {
  match: (url: URL) => boolean;
  handler: OutboundHandler;
}

export interface OutboundCall {
  url: string;
  method: string;
  body?: string;
}

export const outbound = {
  calls: [] as OutboundCall[],
  unmocked: [] as string[],
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

// ── Fixtures ─────────────────────────────────────────────────────────────────

/** BLS OEWS v2 timeseries response: one median hourly wage. */
export function blsWage(value = '23.87', year = '2025') {
  return json({
    status: 'REQUEST_SUCCEEDED',
    responseTime: 41,
    message: [],
    Results: {
      series: [
        {
          seriesID: 'OEUN000000000000051412104',
          data: [{ year, period: 'A01', periodName: 'Annual', latest: 'true', value, footnotes: [{}] }],
        },
      ],
    },
  });
}

/** EIA v2 retail-sales / natural-gas response. */
export function eiaPrice(url: URL) {
  if (url.pathname.includes('natural-gas')) {
    return json({ response: { total: 1, data: [{ period: '2026-06', duoarea: 'SNC', value: 6.41, units: '$/MCF' }] } });
  }
  return json({
    response: { total: 1, data: [{ period: '2026-06', stateid: 'NC', sectorid: 'IND', price: 7.92, 'price-units': 'cents per kilowatt-hour' }] },
  });
}

/** Metals-API latest: USD per tonne. */
export function metalsLatest(url: URL) {
  const symbol = url.searchParams.get('symbols') ?? 'ALU';
  return json({ success: true, timestamp: 1790000000, base: 'USD', rates: { [symbol]: 2385.5 } });
}

/** Electricity Maps carbon intensity (g CO2eq / kWh). */
export function carbonIntensity(url: URL) {
  const zone = url.searchParams.get('zone') ?? 'US-CAL-CISO';
  return json({
    zone,
    carbonIntensity: 231,
    datetime: '2026-09-30T10:00:00.000Z',
    updatedAt: '2026-09-30T10:05:00.000Z',
    emissionFactorType: 'lifecycle',
    isEstimated: false,
  });
}

/** PubChem PUG REST property table for a compound name. */
export function pubchemProperties(url: URL) {
  const m = /\/compound\/name\/([^/]+)\/property/.exec(url.pathname);
  const name = m ? decodeURIComponent(m[1]) : 'unknown';
  if (/^zz|nonexistent/i.test(name)) return new Response('Not Found', { status: 404 });
  return json({
    PropertyTable: {
      Properties: [{ CID: 280, MolecularFormula: 'CO2', MolecularWeight: '44.009', IUPACName: `${name} (fixture)` }],
    },
  });
}

/** Google userinfo the default mock returns; tests change it with setGoogleUser(). */
export const googleUser = { email: 'google.user@lcapix.test', verified_email: true, name: 'Gia Google' as string | null };

export function setGoogleUser(u: Partial<typeof googleUser>) {
  Object.assign(googleUser, u);
}

/** An OpenAI-style SSE stream the way the HF router sends it for gpt-oss. */
export function hfStream(chunks: string[] = ['The mug ', 'is mostly ', 'electricity.']) {
  const events = [
    // role-only first delta, then a reasoning-only delta, then a keep-alive:
    // the INS-1 stall happened on exactly these.
    { choices: [{ delta: { role: 'assistant' } }] },
    { choices: [{ delta: { reasoning_content: 'Thinking about the facts.' } }] },
    ...chunks.map((c) => ({ choices: [{ delta: { content: c } }] })),
  ];
  const body = [
    ': keep-alive\n\n',
    ...events.map((e) => `data: ${JSON.stringify(e)}\n\n`),
    'data: [DONE]\n\n',
  ].join('');
  const bytes = new TextEncoder().encode(body);
  // Deliver in small uneven pieces so lines straddle chunk boundaries.
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (let i = 0; i < bytes.length; i += 37) controller.enqueue(bytes.slice(i, i + 37));
      controller.close();
    },
  });
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'text/event-stream' } });
}

const DEFAULT_ROUTES: Array<[RegExp, OutboundHandler]> = [
  [/^https:\/\/api\.bls\.gov\//, () => blsWage()],
  [/^https:\/\/api\.eia\.gov\//, (u) => eiaPrice(u)],
  [/^https:\/\/metals-api\.com\//, (u) => metalsLatest(u)],
  [/^https:\/\/api\.electricitymap\.org\//, (u) => carbonIntensity(u)],
  [/^https:\/\/pubchem\.ncbi\.nlm\.nih\.gov\//, (u) => pubchemProperties(u)],
  [/^https:\/\/oauth2\.googleapis\.com\/token/, () => json({ access_token: 'ya29.test-access-token', token_type: 'Bearer', expires_in: 3599 })],
  [/^https:\/\/www\.googleapis\.com\/oauth2\/v2\/userinfo/, () => json({ ...googleUser })],
  [/^https:\/\/router\.huggingface\.co\//, () => hfStream()],
];

let overrides: Route[] = [];

/** Answer requests whose URL matches `pattern` with `handler`, for the current test. */
export function mockOutbound(pattern: RegExp, handler: OutboundHandler) {
  overrides.unshift({ match: (u) => pattern.test(u.href), handler });
}

export function resetOutbound() {
  overrides = [];
  outbound.calls.length = 0;
  outbound.unmocked.length = 0;
  Object.assign(googleUser, { email: 'google.user@lcapix.test', verified_email: true, name: 'Gia Google' });
}

export async function mockedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const url = new URL(href);
  const method = (init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET')).toUpperCase();
  const body = init?.body;
  outbound.calls.push({
    url: url.href,
    method,
    body: typeof body === 'string' ? body : body instanceof URLSearchParams ? body.toString() : undefined,
  });
  const route =
    overrides.find((r) => r.match(url)) ??
    DEFAULT_ROUTES.filter(([re]) => re.test(url.href)).map(([, handler]) => ({ handler }))[0];
  if (!route) {
    outbound.unmocked.push(url.origin + url.pathname);
    throw new Error(`Unmocked outbound request to ${url.origin} (the API suite never reaches the network)`);
  }
  return route.handler(url, init);
}
