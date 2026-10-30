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
        borderBottom: '1px solid var(--ds-line)',
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
                ? 'var(--ds-text)'
                : 'var(--ds-text-3)',
            fontSize: 13,
            fontWeight: tab === t.id ? 500 : 400,
            fontFamily: 'var(--ds-font)',
            borderBottom:
              '2px solid ' +
              (tab === t.id ? 'var(--ds-green)' : 'transparent'),
            marginBottom: '-1px',
          }}
        >
          {t.l}
        </button>
      ))}
    </div>
  );
}
