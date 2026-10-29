// British spellings read as American before a substance is searched or matched.
// Whole words only. Units are left alone: "tonne" is a unit, handled by lib/units.

const PAIRS: Array<[RegExp, string]> = [
  [/\baluminium\b/gi, 'aluminum'],
  [/\bsulphur\b/gi, 'sulfur'],
  [/\bsulphate\b/gi, 'sulfate'],
  [/\bsulphide\b/gi, 'sulfide'],
  [/\bsulphuric\b/gi, 'sulfuric'],
  [/\bfibre\b/gi, 'fiber'],
  [/\bcaesium\b/gi, 'cesium'],
]

/** The same text with each British spelling above written the American way. */
export function americanize(text: string): string {
  return PAIRS.reduce(
    (out, [re, us]) =>
      out.replace(re, (word) => (word[0] === word[0].toUpperCase() ? us[0].toUpperCase() + us.slice(1) : us)),
    text,
  )
}
