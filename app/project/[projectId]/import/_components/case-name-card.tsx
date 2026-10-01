'use client'

/** The editable name of the case a new import creates. */
export function CaseNameCard({
  caseName,
  onCaseNameChange,
}: {
  caseName: string
  onCaseNameChange: (caseName: string) => void
}) {
  return (
    <div className="card" style={{ padding: 20 }}>
      <label className="label" style={{ display: 'block', fontSize: 11, marginBottom: 6 }}>
        CASE NAME
      </label>
      <input
        className="input"
        value={caseName}
        onChange={(e) => onCaseNameChange(e.target.value)}
        style={{ maxWidth: 560 }}
      />
    </div>
  )
}
