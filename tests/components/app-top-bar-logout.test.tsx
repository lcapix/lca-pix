// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

import { AppTopBar } from '@/components/lcapix/app-top-bar';
import { useAuthStore, useProjectStore } from '@/lib/store';

describe('AppTopBar logout (M4, AUTH-3, AUTH-5)', () => {
  beforeEach(() => {
    push.mockReset();
    localStorage.clear();
    useAuthStore.setState({ user: { id: '1', name: 'Jo', email: 'jo@corp.com', createdAt: new Date() } as any, isAuthenticated: true });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('calls POST /api/auth/logout, clears local session state and the persisted projects', async () => {
    const fetchMock = vi.fn(async () => new Response('{"success":true}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    localStorage.setItem('auth_token', 't');
    localStorage.setItem('user', '{}');
    useProjectStore.setState({ projects: [{ id: 'p1', name: 'Previous user project' } as any] });
    expect(localStorage.getItem('lcapix-projects')).toBeTruthy();

    render(<AppTopBar />);
    fireEvent.click(screen.getByLabelText('Account menu'));
    fireEvent.click(screen.getByText('Log out'));

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST' }));
    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(localStorage.getItem('lcapix-projects')).toBeNull();
    expect(useProjectStore.getState().projects).toEqual([]);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(push).toHaveBeenCalledWith('/auth/login');
  });

  it('still logs out locally when the logout request fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    localStorage.setItem('auth_token', 't');
    render(<AppTopBar />);
    fireEvent.click(screen.getByLabelText('Account menu'));
    fireEvent.click(screen.getByText('Log out'));
    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });
});
