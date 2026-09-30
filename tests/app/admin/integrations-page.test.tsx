// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as api from '@/lib/api-client';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/components/auth-guard', () => ({ AuthGuard: ({ children }: any) => <>{children}</> }));
vi.mock('@/components/lcapix', () => ({
  AppTopBar: () => null,
  Icon: () => null,
  StatusDot: () => null,
  MiniBar: () => null,
  fmtInt: (n: number) => String(n),
  fmtNum: (n: number) => String(n),
}));
vi.mock('recharts', () => ({
  Sankey: () => null, Tooltip: () => null, Rectangle: () => null,
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}));
vi.mock('@/components/integrations/import-buttons', () => ({ ImportButtons: () => null }));
vi.mock('@/components/integrations/log-viewer', () => ({ LogViewer: () => null }));
vi.mock('@/lib/api-client');

import IntegrationsAdminPage from '@/app/admin/integrations/page';

const STATUS = {
  success: true,
  substances: { total: 10, enriched: 2 },
  factorsByMethod: [{ method_name: 'CML 2001', factors: 100 }],
  rateCache: [],
  sources: [],
};

function me(accountType: 'admin' | 'user' | null) {
  vi.mocked(api.apiGet).mockImplementation(async (url: string) => {
    if (url === '/api/auth/me') {
      return accountType ? { success: true, user: { id: 1, account_type: accountType } } : { error: 'Not authenticated' };
    }
    if (url === '/api/integrations/status') return STATUS;
    throw new Error(`unexpected ${url}`);
  });
}

describe('/admin/integrations', () => {
  beforeEach(() => vi.resetAllMocks());

  it('shows an admins-only state to a non-admin and loads no integration data', async () => {
    me('user');
    render(<IntegrationsAdminPage />);

    expect(await screen.findByText(/admins only/i)).toBeInTheDocument();
    expect(api.apiGet).not.toHaveBeenCalledWith('/api/integrations/status');
    expect(screen.queryByText('Integrations')).not.toBeInTheDocument();
  });

  it('shows the admins-only state when the account cannot be read', async () => {
    me(null);
    render(<IntegrationsAdminPage />);
    expect(await screen.findByText(/admins only/i)).toBeInTheDocument();
    expect(api.apiGet).not.toHaveBeenCalledWith('/api/integrations/status');
  });

  it('loads the dashboard for an admin', async () => {
    me('admin');
    render(<IntegrationsAdminPage />);

    expect(await screen.findByText('Integrations')).toBeInTheDocument();
    await waitFor(() => expect(api.apiGet).toHaveBeenCalledWith('/api/integrations/status'));
    expect(screen.queryByText(/admins only/i)).not.toBeInTheDocument();
  });

  it('does not show the fabricated "Systems harmonized / 99.94% uptime" banner', async () => {
    me('admin');
    render(<IntegrationsAdminPage />);
    await screen.findByText('Integrations');
    await waitFor(() => expect(api.apiGet).toHaveBeenCalledWith('/api/integrations/status'));

    expect(screen.queryByText(/Systems harmonized/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/uptime/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/04:00 UTC/)).not.toBeInTheDocument();
  });
});
