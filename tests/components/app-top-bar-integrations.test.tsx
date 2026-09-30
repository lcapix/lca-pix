// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

import { AppTopBar } from '@/components/lcapix/app-top-bar';
import { useAuthStore } from '@/lib/store';

function meResponds(accountType: 'user' | 'admin' | null, status = 200) {
  const fetchMock = vi.fn(async (url: string) => {
    if (String(url).startsWith('/api/auth/me')) {
      return new Response(
        JSON.stringify(accountType ? { success: true, user: { id: 1, account_type: accountType } } : { error: 'x' }),
        { status },
      );
    }
    return new Response('{}', { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const navButton = () => screen.queryByRole('button', { name: 'Integrations' });

describe('AppTopBar: the Integrations entry is for platform admins only', () => {
  beforeEach(() => {
    push.mockReset();
    localStorage.clear();
    localStorage.setItem('auth_token', 't');
    useAuthStore.setState({ user: { id: '1', name: 'Jo', email: 'jo@corp.com', createdAt: new Date() } as any, isAuthenticated: true });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('hides the nav item and the account-menu item for a regular user', async () => {
    const fetchMock = meResponds('user');
    render(<AppTopBar />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/auth/me', expect.anything()));
    await act(async () => {});
    expect(navButton()).toBeNull();
    fireEvent.click(screen.getByLabelText('Account menu'));
    expect(screen.queryByRole('menuitem', { name: /Integrations/ })).toBeNull();
    // The rest of the bar is still there.
    expect(screen.getByRole('button', { name: 'Projects' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Docs' })).toBeTruthy();
  });

  it('shows both to a platform admin', async () => {
    meResponds('admin');
    render(<AppTopBar />);
    await waitFor(() => expect(navButton()).not.toBeNull());
    fireEvent.click(navButton()!);
    expect(push).toHaveBeenCalledWith('/admin/integrations');
    fireEvent.click(screen.getByLabelText('Account menu'));
    expect(screen.getByRole('menuitem', { name: /Integrations/ })).toBeTruthy();
  });

  it('stays hidden when /api/auth/me fails', async () => {
    const fetchMock = meResponds(null, 401);
    render(<AppTopBar />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    await act(async () => {});
    expect(navButton()).toBeNull();
  });

  it('stays hidden, without asking, when there is no session token', async () => {
    localStorage.removeItem('auth_token');
    const fetchMock = meResponds('admin');
    render(<AppTopBar />);
    await act(async () => {});
    expect(navButton()).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
