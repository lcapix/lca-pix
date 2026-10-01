// Citation tokens in insight text. Values the engine computed are wrapped in
// {{…}} (by the computed insight, and by the AI narration); the modal renders
// each as a chip, linked to its source when it names a contributor. Pure: the
// React rendering lives in components/lcapix/magic-insights/cited-text.tsx.

import { stepLabel } from '@/lib/insights/consultant'

/** One piece of insight text: plain text, or the inner value of a {{…}} token. */
export type CitationPart = { kind: 'text'; text: string } | { kind: 'token'; value: string }

/**
 * Drops an incomplete trailing token. While the text streams in
 * character-by-character, the tail can be a half-typed token like
 * "totals {{3.41 kg" whose closing "}}" hasn't arrived yet. Drop that
 * incomplete trailing token so users never see raw "{{" braces flash; the chip
 * appears atomically once the token completes.
 */
export function dropPartialToken(text: string): string {
  // [\s\S] is any character, newlines included (what `.` matches under the
  // `s` flag, which the ES6 compile target does not allow).
  return text.replace(/\{\{(?:(?!\}\})[\s\S])*$/, '')
}

/**
 * Splits text into plain and token parts, in order. Empty plain parts are
 * kept (the modal renders one span per part, keyed by its index).
 */
export function splitCitations(text: string): CitationPart[] {
  const safe = dropPartialToken(text)
  const parts = safe.split(/(\{\{[^}]+\}\})/g)
  return parts.map((part): CitationPart => {
    const m = part.match(/^\{\{([^}]+)\}\}$/)
    return m ? { kind: 'token', value: m[1] } : { kind: 'text', text: part }
  })
}

/** The contributor a token cites: the first whose name, or step label, it contains. */
export function citedContributor<T extends { name: string }>(value: string, contributors: T[]): T | undefined {
  return contributors.find((c) => value.includes(c.name) || value.includes(stepLabel(c.name)))
}
