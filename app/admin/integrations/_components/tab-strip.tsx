'use client';

import { TABS, type TabId } from '@/lib/admin/integrations';

/** The dashboard's tab strip; the active tab is underlined. */
export function TabStrip({
  tab,
  onSelect,
}: {
  tab: TabId;
  onSelect: (id: TabId) => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        marginBottom: 24,
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      {TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onSelect(t.id)}
          style={{
            padding: '10px 16px',
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color:
              tab === t.id
                ? 'var(--text-primary)'
                : 'var(--text-tertiary)',
            fontSize: 13,
            fontWeight: tab === t.id ? 500 : 400,
            fontFamily: 'var(--font-ui)',
            borderBottom:
              '2px solid ' +
              (tab === t.id ? 'var(--brand-primary)' : 'transparent'),
            marginBottom: '-1px',
          }}
        >
          {t.l}
        </button>
      ))}
    </div>
  );
}
