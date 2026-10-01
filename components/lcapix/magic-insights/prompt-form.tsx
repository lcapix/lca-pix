'use client'

export interface CustomPromptFormProps {
  prompt: string
  onPromptChange: (value: string) => void
  /** Asks the typed question (the default form submit is prevented). */
  onSubmit: () => void
  /** Example questions shown as the placeholder. */
  exampleQs: string[]
}

/** Free-text prompt — shown while the custom chip is active. */
export function CustomPromptForm({ prompt, onPromptChange, onSubmit, exampleQs }: CustomPromptFormProps) {
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      style={{
        padding: '12px 24px 0',
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      <textarea
        value={prompt}
        onChange={(e) => onPromptChange(e.target.value)}
        placeholder={`e.g. "${exampleQs[0]}" or "${exampleQs[1]}"`}
        rows={2}
        style={{
          fontSize: 13,
          padding: '8px 10px',
          borderRadius: 8,
          border: '1px solid var(--border-subtle)',
          background: 'var(--surface-base)',
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-ui)',
          resize: 'vertical',
          minHeight: 48,
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <button
          type="submit"
          className="btn btn-primary btn-sm"
          disabled={!prompt.trim()}
        >
          Ask
        </button>
      </div>
    </form>
  )
}
