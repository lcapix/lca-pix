'use client';

import { useState } from 'react';
import { AppTopBar } from '@/components/lcapix';
import type { TabId } from '@/lib/admin/integrations';
import { useIntegrationsStatus } from '@/lib/admin/use-integrations';
import { DashboardHeader } from './dashboard-header';
import { TabStrip } from './tab-strip';
import { OverviewTab } from './overview-tab';
import { SourcesTab } from './sources-tab';
import { KeysTab } from './keys-tab';
import { LogTab } from './log-tab';
import { SchemaTab } from './schema-tab';

/** The admin dashboard: header, tab strip, load/error state and the active tab. */
export function IntegrationsDashboard() {
  const { status, loading, error, logRefresh, refresh } = useIntegrationsStatus();
  const [tab, setTab] = useState<TabId>('overview');

  return (
    <>
      <AppTopBar current="integrations" />

      <div
        style={{
          padding: '32px 32px 80px',
          maxWidth: 1440,
          margin: '0 auto',
        }}
      >
        {/* Header */}
        <DashboardHeader onRefresh={refresh} />

        {/* Tab strip */}
        <TabStrip tab={tab} onSelect={setTab} />

        {loading && (
          <div
            className="body"
            style={{
              color: 'var(--text-tertiary)',
              padding: '48px 0',
              textAlign: 'center',
            }}
          >
            Loading…
          </div>
        )}
        {error && (
          <div
            className="mono label-sm"
            style={{
              color: 'var(--signal-error)',
              padding: '12px 0',
              fontSize: 13,
            }}
          >
            Error: {error}
          </div>
        )}

        {!loading && !error && (
          <>
            {tab === 'overview' && status && (
              <OverviewTab status={status} onRefresh={refresh} />
            )}
            {tab === 'sources' && <SourcesTab status={status} />}
            {tab === 'keys' && <KeysTab status={status} />}
            {tab === 'log' && <LogTab logRefresh={logRefresh} />}
            {tab === 'schema' && <SchemaTab status={status} />}
          </>
        )}
      </div>
    </>
  );
}
