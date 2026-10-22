// js-yaml 4 ships no types and @types/js-yaml is not installed; the suite
// only needs load().
declare module 'js-yaml' {
  export function load(input: string, options?: Record<string, unknown>): unknown;
  const yaml: { load: typeof load };
  export default yaml;
}
