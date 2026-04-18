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
  return {
    zone: body.zone,
    carbonIntensity_gCO2eq_per_kWh: body.carbonIntensity,
    carbonIntensity_kgCO2eq_per_kWh: body.carbonIntensity / 1000,
    datetime: body.datetime,
    updatedAt: body.updatedAt,
  };
}
