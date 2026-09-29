// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

const replace = vi.fn();
let search = new URLSearchParams('next=/home');
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace, push: vi.fn() }),
  useSearchParams: () => search,
}));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }));

import OAuthCallbackPage from '@/app/auth/callback/page';
import { useAuthStore } from '@/lib/store';

describe('/auth/callback (Google hand-off)', () => {
  beforeEach(() => {
    replace.mockReset();
    localStorage.clear();
    useAuthStore.setState({ user: null, isAuthenticated: false });
    search = new URLSearchParams('next=/home');
  });
  afterEach(() => vi.unstubAllGlobals());

  it('gets the token from the hand-off endpoint, not from a readable cookie', async () => {
    document.cookie = 'auth_token=legacy-readable-token; path=/';
    document.cookie = 'user_data=%7B%22id%22%3A1%7D; path=/';
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ success: true, token: 'jwt-from-server', user: { id: 3, username: 'jo', email: 'jo@corp.com' } }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<OAuthCallbackPage />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/home'));
    const [url, init] = fetchMock.mock.calls[0] as any[];
    expect(url).toBe('/api/auth/google/session');
    expect(init.method).toBe('POST');
    expect(localStorage.getItem('auth_token')).toBe('jwt-from-server');
    expect(JSON.parse(localStorage.getItem('user')!)).toMatchObject({ id: 3, username: 'jo' });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    // Legacy JS-readable cookies are gone after the sync.
    expect(document.cookie).not.toMatch(/auth_token=|user_data=/);
  });

  it('sends the user back to login when the hand-off fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"error":"x"}', { status: 401 })));
    render(<OAuthCallbackPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/auth/login?error=oauth_sync_failed'));
    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('only redirects to allow-listed paths', async () => {
    search = new URLSearchParams('next=https://evil.example');
    vi.stubGlobal('fetch', vi.fn(async () =>
      new Response(JSON.stringify({ token: 't', user: { id: 1, username: 'a', email: 'a@b.co' } }), { status: 200 }),
    ));
    render(<OAuthCallbackPage />);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/home'));
  });
});
