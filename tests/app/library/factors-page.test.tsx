// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as api from '@/lib/api-client';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@/components/auth-guard', () => ({ AuthGuard: ({ children }: any) => <>{children}</> }));
vi.mock('@/components/lcapix', () => ({
  AppTopBar: () => null,
  Icon: () => null,
  SectionHeader: ({ title }: any) => <h2>{title}</h2>,
}));
vi.mock('@/lib/store', () => ({
  useAuthStore: (sel: any) => sel({ user: { id: '1', name: 'Test User', email: 't@example.com' } }),
}));
vi.mock('@/lib/api-client');

import FactorsLibraryPage from '@/app/library/factors/page';

const json = (status: number, body: any) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

function respond(map: Record<string, Response>) {
  vi.mocked(api.apiRequest).mockImplementation(async (url: string) => map[url.split('?')[0]]);
}

describe('/library/factors', () => {
  beforeEach(() => vi.resetAllMocks());

  it('shows the error state, not "no factors", when the factor API fails (FAC-2)', async () => {
    respond({
      '/api/integrations/status': json(200, { success: true, factorsByMethod: [] }),
      '/api/driver-factors': json(500, { error: 'Failed to fetch driver factors' }),
    });

    render(<FactorsLibraryPage />);
    expect(await screen.findByText(/couldn.t load the factor library/i)).toBeInTheDocument();
    expect(screen.queryByText(/No factors match/i)).not.toBeInTheDocument();
  });

  it('does not offer quarantined methods as filter chips (FAC-2)', async () => {
    respond({
      '/api/integrations/status': json(200, {
        success: true,
        factorsByMethod: [
          { method_name: 'TRACI 2.1', factors: 4057 },
          { method_name: 'QUARANTINE: TRACI 2.1', factors: 18 },
        ],
      }),
      '/api/driver-factors': json(200, { success: true, factors: [] }),
    });

    render(<FactorsLibraryPage />);
    expect(await screen.findByText(/TRACI 2\.1 \(4057\)/)).toBeInTheDocument();
    expect(screen.queryByText(/QUARANTINE/)).not.toBeInTheDocument();
  });
});
