'use client'

/** The message under a number input that cannot be saved as typed. */
export function InlineError({ msg }: { msg: string | null }) {
  return msg ? (
    <div role="alert" style={{ fontSize: 11, color: 'var(--signal-error)', marginTop: 4, lineHeight: 1.4 }}>
      {msg}
    </div>
  ) : null
}
