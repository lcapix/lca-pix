// lib/integrations/bls/client.ts
// Docs: https://www.bls.gov/developers/
// v2 API (JSON body, optional key for higher limits)
const BASE = 'https://api.bls.gov/publicAPI/v2/timeseries/data/';

// US state FIPS codes (2-digit padded)
const STATE_FIPS: Record<string, string> = {
  AL:'01',AK:'02',AZ:'04',AR:'05',CA:'06',CO:'08',CT:'09',DE:'10',FL:'12',GA:'13',
  HI:'15',ID:'16',IL:'17',IN:'18',IA:'19',KS:'20',KY:'21',LA:'22',ME:'23',MD:'24',
  MA:'25',MI:'26',MN:'27',MS:'28',MO:'29',MT:'30',NE:'31',NV:'32',NH:'33',NJ:'34',
  NM:'35',NY:'36',NC:'37',ND:'38',OH:'39',OK:'40',OR:'41',PA:'42',RI:'44',SC:'45',
  SD:'46',TN:'47',TX:'48',UT:'49',VT:'50',VA:'51',WA:'53',WV:'54',WI:'55',WY:'56',
};

export interface SeriesParts {
  occupation: string;          // e.g. '51-4121'
  state: string;               // 2-letter code or 'US'
  dataType: '03' | '04' | '13'; // 03 mean hourly, 04 median hourly, 13 annual mean
}

export function makeSeriesId({ occupation, state, dataType }: SeriesParts): string {
  const occ = occupation.replace('-', '');
  const areaType = state === 'US' ? 'N' : 'S';           // N = national, S = state
  const areaCode = state === 'US' ? '0000000' : `${STATE_FIPS[state] ?? '00'}00000`;
  const industry = '000000';
  return `OEU${areaType}${areaCode}${industry}${occ}${dataType}`;
}

export interface BLSWage {
  seriesId: string;
  hourlyRate: number;
  year: string;
  period: string;
}

// BLS OEWS publishes annual mean wages using a 2,080 hr/yr divisor (40 hr × 52 wk).
const ANNUAL_HOURS = 2080;
// Any wage above this looks like an annual figure mis-tagged as hourly; convert.
const HOURLY_SANITY_CEILING = 250;

export async function fetchMedianHourlyWage(
  occupation: string, state: string,
): Promise<BLSWage | null> {
  // Try multiple series in order of preference. BLS sometimes lacks median-hourly
  // data for a given occupation × state and only returns annual; fall back gracefully.
  // 04 = median hourly, 03 = mean hourly, 13 = annual mean (we convert /2080 when used).
  const dataTypes: Array<'04' | '03' | '13'> = ['04', '03', '13'];

  for (const dataType of dataTypes) {
    const seriesId = makeSeriesId({ occupation, state, dataType });
    const payload: Record<string, unknown> = {
      seriesid: [seriesId],
      startyear: String(new Date().getFullYear() - 1),
      endyear: String(new Date().getFullYear()),
    };
    if (process.env.BLS_API_KEY) payload.registrationkey = process.env.BLS_API_KEY;

    const res = await fetch(BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      // An HTTP failure is an API outage, not "this series has no data" —
      // trying the next series id against the same broken endpoint just
      // burns quota. Surface it; callers fall back to static rates.
      throw new Error(`BLS request failed: HTTP ${res.status}`);
    }

    const body: any = await res.json();
    const rows = body?.Results?.series?.[0]?.data ?? [];
    const latest = rows.find((r: any) => r.value && !isNaN(parseFloat(r.value)));
    if (!latest) continue;

    let value = parseFloat(latest.value);
    // Convert annual to hourly if we used the annual series — or if BLS
    // substituted annual data into the hourly series (caught by ceiling check).
    if (dataType === '13' || value > HOURLY_SANITY_CEILING) {
      value = Math.round((value / ANNUAL_HOURS) * 100) / 100;
    }
    return { seriesId, hourlyRate: value, year: latest.year, period: latest.period };
  }
  return null;
}
