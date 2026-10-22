'use client';

// The sticky action bar: Cancel, Save as draft, the "Name + type required"
// hint, and the primary Create component / Save changes.

export function FormActionBar({
  isModal,
  isEditMode,
  isFormValid,
  isSubmitting,
  onCancel,
  onSubmit,
}: {
  isModal: boolean;
  isEditMode: boolean;
  isFormValid: boolean;
  isSubmitting: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  return (
    <div
      className="glass"
      style={{
        position: 'sticky',
        bottom: 0,
        left: 0,
        right: 0,
        height: 64,
        display: 'flex',
        alignItems: 'center',
        padding: isModal ? '0 20px' : '0 32px',
        zIndex: 40,
        borderRadius: 0,
        borderTop: '1px solid var(--border-subtle)',
      }}
    >
      <div
        style={{
          maxWidth: isModal ? '100%' : 720,
          width: '100%',
          margin: '0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={onCancel}
        >
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-tertiary btn-sm"
          onClick={() => onSubmit()}
          disabled={!isFormValid || isSubmitting}
        >
          Save as draft
        </button>
        <div style={{ flex: 1 }} />
        {!isFormValid && (
          <span
            className="mono"
            style={{
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--text-tertiary)',
              marginRight: 8,
            }}
          >
            Name + type required
          </span>
        )}
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => onSubmit()}
          disabled={!isFormValid || isSubmitting}
        >
          {isSubmitting
            ? isEditMode ? 'Saving…' : 'Creating…'
            : isEditMode ? 'Save changes' : 'Create component'}
        </button>
      </div>
    </div>
  );
}
