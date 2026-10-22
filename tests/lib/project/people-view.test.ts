import { describe, expect, it } from 'vitest'
import {
  casesBy,
  chunks,
  emailsIn,
  holdersLine,
  lastAddLines,
  namesList,
  peopleHeader,
  privacyConsequence,
  theirCases,
  type Person,
} from '@/lib/project/people-view'

const p = (user_id: number, full_name: string, permission_name: string): Person => ({
  user_id,
  full_name,
  username: full_name.toLowerCase().replace(/\s+/g, '.'),
  email: `${full_name.toLowerCase().replace(/\s+/g, '.')}@stateu.edu`,
  permission_name,
})
const ana = p(2, 'Ana Ruiz', 'editor')
const jon = p(3, 'Jon Tan', 'editor')
const noah = p(4, 'Noah Kim', 'editor')
const omar = p(5, 'Omar Haddad', 'viewer')
const members = [ana, jon, noah, omar]
const by = casesBy([{ created_by: 1 }, { created_by: 1 }, { created_by: 2 }, { created_by: 3 }, { created_by: 3 }, { created_by: null }])

describe('people view', () => {
  it('heads with everyone, the owner once, and each access', () => {
    expect(peopleHeader(members, { name: 'Elena Rivera', isMe: true })).toBe('5 people · You own it · 3 can change · 1 can read')
    expect(peopleHeader([], { name: 'Elena Rivera', isMe: false })).toBe('1 person · Elena Rivera owns it')
  })

  it('counts cases per person and words an empty cell by what they can do', () => {
    expect(by.get(1)).toBe(2)
    expect(by.get(3)).toBe(2)
    expect(theirCases(0, 'editor')).toBe('None yet')
    expect(theirCases(0, 'viewer')).toBe('None')
    expect(holdersLine(members, by, 'student')).toBe('2 students hold the 3 student cases')
  })

  it('finds every address in typed text or a CSV, once, lowercased', () => {
    expect(emailsIn('A.Ruiz@StateU.edu, j.tan@stateu.edu;  a.ruiz@stateu.edu\nNoah Kim <n.kim@stateu.edu>')).toEqual([
      'a.ruiz@stateu.edu',
      'j.tan@stateu.edu',
      'n.kim@stateu.edu',
    ])
    expect(emailsIn('Student,Email\n"Ruiz, Ana",a.ruiz@stateu.edu\n"Tan, Jon",j.tan@stateu.edu.')).toEqual(['a.ruiz@stateu.edu', 'j.tan@stateu.edu'])
    expect(emailsIn('no addresses here')).toEqual([])
    expect(chunks([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]])
  })

  it('says what happened to each email of the last add', () => {
    const lines = lastAddLines(
      [
        { outcome: 'added', email: 'l.ortiz@stateu.edu', member: { user_id: 9, full_name: 'Lena Ortiz', username: 'lo', email: 'l.ortiz@stateu.edu', permission_name: 'viewer' } },
        { outcome: 'added', email: 'k.moreno@stateu.edu', member: { user_id: 10, full_name: 'Kai Moreno', username: 'km', email: 'k.moreno@stateu.edu', permission_name: 'viewer' } },
        { outcome: 'changed', email: 'a.ruiz@stateu.edu', member: { user_id: 2, full_name: 'Ana Ruiz', username: 'ar', email: 'a.ruiz@stateu.edu', permission_name: 'viewer' } },
        { outcome: 'no_account', email: 'j.doe@stateu.edu' },
      ],
      'viewer',
    )
    expect(lines.map((l) => l.text)).toEqual([
      '2 added (Lena Ortiz and Kai Moreno)',
      '1 already here, access changed to Can read (Ana Ruiz)',
      '1 has no account yet (j.doe@stateu.edu): they need to sign up first. No email is sent.',
    ])
    expect(lines.map((l) => l.kind)).toEqual(['ok', 'changed', 'warn'])
    expect(lastAddLines([{ outcome: 'invalid', email: 'x' }, { outcome: 'limited', email: 'y@z.co' }], 'editor').map((l) => l.text)).toEqual([
      '1 is not an email address (x)',
      '1 not looked up: too many lookups this hour. Add it again later.',
    ])
  })

  it('names who the privacy switch changes things for, by the D2 rule', () => {
    expect(privacyConsequence(members, by, 'student')).toBe(
      "Students will see only the cases they made, and yours read only. 2 students with a case stop seeing each other's. Noah Kim has no case yet and can still copy yours. Omar Haddad can read only and will see only your cases.",
    )
    expect(namesList(['A', 'B', 'C', 'D', 'E'])).toBe('A, B and 3 others')
  })
})
