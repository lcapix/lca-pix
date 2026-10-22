/**
 * The WV0661 worked plant: DOE ITAC assessment WV0661 (FY2024, an
 * electroplating shop in West Virginia), as read from the ITAC workbook by
 * scripts/fixtures/wv0661-extract.mjs. Real records only: every value keeps
 * the workbook cell it came from (itac.json), and every figure below is
 * arithmetic on those values. Nothing here is generated or assumed.
 *
 * ITAC holds annual totals, not monthly bills, payroll or jobs. Gates that
 * need those use a real plant's documents (the design partner, D9).
 */
import itac from './itac.json'

export type Itac = typeof itac
export const WV0661: Itac = itac

/** Cents of one stream's annual cost (null when the plant reports none). */
export function streamCents(data: Itac, code: string): number | null {
  return data.streams.find((s) => s.code === code)?.costCents ?? null
}

/** A recommendation's annual saving: the sum of its resources' savings, in cents. */
export function savedCents(rec: Itac['recommendations'][number]): number {
  return rec.resources.reduce((sum, r) => sum + (r.savedCents ?? 0), 0)
}

/** Simple payback in years: total implementation cost over annual saving. ITAC leaves PAYBACK blank. */
export function paybackYears(rec: Itac['recommendations'][number]): number | null {
  const saved = savedCents(rec)
  return rec.costCents == null || saved === 0 ? null : rec.costCents / saved
}

/** The figures DISCOVERY.md quotes, computed from the record. Money in cents. */
export function figures(data: Itac) {
  const ec = streamCents(data, 'EC') ?? 0
  const ed = streamCents(data, 'ED') ?? 0
  const ef = streamCents(data, 'EF') ?? 0
  const kwh = data.streams.find((s) => s.code === 'EC')?.usage ?? 0
  const kwMonths = data.streams.find((s) => s.code === 'ED')?.usage ?? 0
  const hours = data.plant.productionHours.value ?? 0
  const recs = data.recommendations
  const done = recs.filter((r) => r.implemented)
  const left = recs.filter((r) => !r.implemented)
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
  const demandSaved = sum(recs.flatMap((r) => r.resources.filter((x) => x.code === 'ED').map((x) => x.savedCents ?? 0)))
  // The most the average monthly peak could draw in the production hours; the rest runs outside them.
  const productionCeilingKwh = (kwMonths / 12) * hours
  return {
    electricityCents: ec + ed + ef,
    nonKwhShare: (ed + ef) / (ec + ed + ef),
    gasCents: streamCents(data, 'E2') ?? 0,
    implemented: { count: done.length, costCents: sum(done.map((r) => r.costCents ?? 0)), savedCents: sum(done.map(savedCents)) },
    notImplemented: { count: left.length, costCents: sum(left.map((r) => r.costCents ?? 0)), savedCents: sum(left.map(savedCents)) },
    demandSavedCents: demandSaved,
    allSavedCents: sum(recs.map(savedCents)),
    paybacksBlank: recs.filter((r) => r.payback == null).length,
    baseLoadKwhAtLeast: kwh - productionCeilingKwh,
  }
}

/**
 * What the record must reproduce (DISCOVERY.md §1 and §4, verified
 * 2026-10-21 and re-read 2026-10-22). Returns every mismatch; [] when the
 * extract is right. A check that can fail: the test plants a wrong cent.
 */
export function checkWv0661(data: Itac): string[] {
  const f = figures(data)
  const out: string[] = []
  const expect = (what: string, got: unknown, want: unknown) => {
    if (got !== want) out.push(`${what}: got ${String(got)}, want ${String(want)}`)
  }
  expect('sales', data.plant.salesCents.value, 200_000_000)
  expect('employees', data.plant.employees.value, 22)
  expect('production hours', data.plant.productionHours.value, 2080)
  expect('kWh', data.streams.find((s) => s.code === 'EC')?.usage, 466_871)
  expect('kW-months', data.streams.find((s) => s.code === 'ED')?.usage, 1953)
  expect('gas MMBtu', data.streams.find((s) => s.code === 'E2')?.usage, 3845)
  expect('electricity energy', streamCents(data, 'EC'), 4_819_400)
  expect('electricity demand', streamCents(data, 'ED'), 2_127_900)
  expect('electricity fees', streamCents(data, 'EF'), 858_000)
  expect('electricity total', f.electricityCents, 7_805_300)
  expect('gas', f.gasCents, 2_309_700)
  expect('recommendations', data.recommendations.length, 11)
  expect('implemented count', f.implemented.count, 7)
  expect('implemented cost', f.implemented.costCents, 1_667_700)
  expect('implemented saving', f.implemented.savedCents, 576_900)
  expect('not implemented count', f.notImplemented.count, 4)
  expect('not implemented cost', f.notImplemented.costCents, 3_905_800)
  expect('not implemented saving', f.notImplemented.savedCents, 1_734_700)
  expect('demand savings', f.demandSavedCents, 980_000)
  expect('all savings', f.allSavedCents, 2_311_600)
  expect('paybacks blank', f.paybacksBlank, 11)
  expect('base load kWh at least', f.baseLoadKwhAtLeast, 128_351)
  // Each recommendation's cost is its capital plus its other cost; a blank capital stays blank.
  for (const r of data.recommendations) {
    const parts = (r.capitalCents ?? 0) + (r.otherCents ?? 0)
    if (r.costCents !== parts) out.push(`recommendation ${r.number}: cost ${r.costCents} is not capital + other ${parts}`)
  }
  return out
}
