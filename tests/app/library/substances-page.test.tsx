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

import SubstancesLibraryPage from '@/app/library/substances/page';

const json = (status: number, body: any) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe('/library/substances', () => {
  beforeEach(() => vi.resetAllMocks());

  it('shows each substance\'s unit (the API field is `unit`) in the Default unit column (FAC-3)', async () => {
    vi.mocked(api.apiRequest).mockResolvedValue(json(200, {
      success: true,
      substances: [
        { substance_id: 1, substance_name: 'Steel', cas_number: null, category: 'resource', unit: 'kg' },
        { substance_id: 2, substance_name: 'Electricity', cas_number: null, category: 'resource', unit: 'kWh' },
      ],
    }));

    render(<SubstancesLibraryPage />);
    expect(await screen.findByText('Steel')).toBeInTheDocument();
    expect(screen.getByText('kg')).toBeInTheDocument();
    expect(screen.getByText('kWh')).toBeInTheDocument();
  });
});
