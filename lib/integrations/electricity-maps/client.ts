// lib/integrations/electricity-maps/client.ts
// Docs: https://docs.electricitymaps.com/
// Free tier: 1 zone, hourly resolution.

const BASE = 'https://api.electricitymap.org/v3';

export interface CarbonIntensity {
  zone: string;
  carbonIntensity_gCO2eq_per_kWh: number;
  carbonIntensity_kgCO2eq_per_kWh: number;
  datetime: string;
  updatedAt: string;
}

export async function fetchCarbonIntensity(zone: string): Promise<CarbonIntensity> {
  const key = process.env.ELECTRICITY_MAPS_API_KEY;
  if (!key) {
    throw new Error('Electricity Maps API key not configured (set ELECTRICITY_MAPS_API_KEY) — sign up at https://www.electricitymaps.com/free-tier-api');
  }

  const res = await fetch(
    `${BASE}/carbon-intensity/latest?zone=${encodeURIComponent(zone)}`,
    {
      headers: {
        'auth-token': key,
        'Accept': 'application/json',
      },
    },
  );
  if (!res.ok) {
    throw new Error(`Electricity Maps error ${res.status} for zone ${zone}`);
  }
  const body = await res.json();
  // A missing reading comes back as null; null / 1000 is 0, which would be
  // written as a zero-carbon grid. Refuse anything that is not a real number.
  const g = body?.carbonIntensity;
  if (typeof g !== 'number' || !Number.isFinite(g) || g < 0) {
    throw new Error(`Electricity Maps returned no carbon intensity for zone ${zone}`);
  }
  return {
    zone: body.zone,
    carbonIntensity_gCO2eq_per_kWh: g,
    carbonIntensity_kgCO2eq_per_kWh: g / 1000,
    datetime: body.datetime,
    updatedAt: body.updatedAt,
  };
}
