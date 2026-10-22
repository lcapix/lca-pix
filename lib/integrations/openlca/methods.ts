// lib/integrations/openlca/methods.ts
// The impact methods the openLCA seed files cover. Anything else, including a
// 'QUARANTINE: …' name, is refused by the importer. Pure module (no DB).
export const SUPPORTED_METHODS = ['CML 2001', 'ReCiPe Midpoint (H)', 'TRACI 2.1'] as const;
export type SupportedMethod = (typeof SUPPORTED_METHODS)[number];

export function isSupportedMethod(name: unknown): name is SupportedMethod {
  return typeof name === 'string' && (SUPPORTED_METHODS as readonly string[]).includes(name);
}
