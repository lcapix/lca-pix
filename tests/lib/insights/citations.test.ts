import { describe, it, expect } from 'vitest'
import { citedContributor, dropPartialToken, splitCitations } from '@/lib/insights/citations'

// The regex the modal used before, with the `s` flag (built at runtime: the
// ES6 compile target rejects the flag in a literal).
const ORIGINAL_PARTIAL = new RegExp('\\{\\{(?:(?!\\}\\}).)*$', 's')

describe('dropPartialToken', () => {
  it('leaves text without an open token alone', () => {
    expect(dropPartialToken('')).toBe('')
    expect(dropPartialToken('plain text')).toBe('plain text')
    expect(dropPartialToken('a {{b}} c')).toBe('a {{b}} c')
    expect(dropPartialToken('a { b } c')).toBe('a { b } c')
    expect(dropPartialToken('ends with one {')).toBe('ends with one {')
  })

  it('drops a half-typed trailing token', () => {
    expect(dropPartialToken('totals {{3.41 kg')).toBe('totals ')
    expect(dropPartialToken('totals {{')).toBe('totals ')
    expect(dropPartialToken('{{a}} b {{c')).toBe('{{a}} b ')
    expect(dropPartialToken('{{a}} b {{c}')).toBe('{{a}} b ')
  })

  it('drops a partial token that spans a newline', () => {
    expect(dropPartialToken('and {{Frame\n')).toBe('and ')
    expect(dropPartialToken('and {{Frame\ntub')).toBe('and ')
    expect(dropPartialToken('line one\n{{x}}\nline {{two\r\nthree')).toBe('line one\n{{x}}\nline ')
  })

  it('matches the original s-flag regex on every input', () => {
    const inputs = [
      '',
      '{{',
      '{{{',
      '{{{a',
      '{{a}}',
      '{{a}}{{',
      'x {{a}} y {{b',
      'x {{a\nb',
      'x {{a b',
      'x {{a}\n}',
      'x {{a}}\n{{b\nc}}',
      'x {{a}}\n{{b\nc}',
      '}} {{ }} {{',
      'no braces\nat all',
    ]
    for (const s of inputs) expect(dropPartialToken(s), JSON.stringify(s)).toBe(s.replace(ORIGINAL_PARTIAL, ''))
  })
})

describe('splitCitations', () => {
  it('splits plain text and tokens in order', () => {
    expect(splitCitations('a {{b}} c')).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'token', value: 'b' },
      { kind: 'text', text: ' c' },
    ])
  })

  it('keeps empty text parts, so each part keeps its index', () => {
    expect(splitCitations('')).toEqual([{ kind: 'text', text: '' }])
    expect(splitCitations('{{a}}{{b}}')).toEqual([
      { kind: 'text', text: '' },
      { kind: 'token', value: 'a' },
      { kind: 'text', text: '' },
      { kind: 'token', value: 'b' },
      { kind: 'text', text: '' },
    ])
  })

  it('drops the incomplete trailing token first', () => {
    expect(splitCitations('totals {{1,235 kg CO2 eq}} for {{Glob')).toEqual([
      { kind: 'text', text: 'totals ' },
      { kind: 'token', value: '1,235 kg CO2 eq' },
      { kind: 'text', text: ' for ' },
    ])
  })

  it('keeps braces that do not form a token as text', () => {
    expect(splitCitations('x {{}} y')).toEqual([{ kind: 'text', text: 'x {{}} y' }])
    expect(splitCitations('x {{{a}} y')).toEqual([
      { kind: 'text', text: 'x ' },
      { kind: 'token', value: '{a' },
      { kind: 'text', text: ' y' },
    ])
  })

  it('allows a newline inside a token', () => {
    expect(splitCitations('{{Frame\ntubes}}')).toEqual([
      { kind: 'text', text: '' },
      { kind: 'token', value: 'Frame\ntubes' },
      { kind: 'text', text: '' },
    ])
  })
})

describe('citedContributor', () => {
  const contributors = [
    { id: '1', name: '10. Frame tubes' },
    { id: '2', name: 'Wheels' },
    { id: '3', name: 'Wheels and tires' },
  ]

  it('finds a contributor by its name or its step label', () => {
    expect(citedContributor('10. Frame tubes', contributors)?.id).toBe('1')
    expect(citedContributor('Frame tubes (step 10)', contributors)?.id).toBe('1')
    expect(citedContributor('the Wheels row', contributors)?.id).toBe('2')
  })

  it('takes the first match in contributor order', () => {
    expect(citedContributor('Wheels and tires', contributors)?.id).toBe('2')
  })

  it('finds nothing for a figure or an unknown name', () => {
    expect(citedContributor('59.2%', contributors)).toBeUndefined()
    expect(citedContributor('Frame tubes', contributors)).toBeUndefined()
    expect(citedContributor('anything', [])).toBeUndefined()
  })
})
