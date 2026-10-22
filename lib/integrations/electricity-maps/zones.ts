// lib/integrations/electricity-maps/zones.ts
// Zones the grid-factor sync may write: the ones with a curated reference
// value in GRID_CARBON. The zone becomes geographic_scope on a shared factor
// row, so free text is not accepted. Pure module (no DB).
import { GRID_CARBON } from '@/lib/integrations/reference-rates';

export const SYNC_ZONES = Object.keys(GRID_CARBON);

export function isSyncZone(zone: unknown): zone is string {
  return typeof zone === 'string' && Object.prototype.hasOwnProperty.call(GRID_CARBON, zone);
}
