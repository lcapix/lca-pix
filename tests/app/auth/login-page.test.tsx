// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// The page toasts through sonner, whose <Toaster/> is mounted in app/layout.tsx
// (the shadcn use-toast store had no Toaster, so nothing ever showed).
const { toast } = vi.hoisted(() => {
  const error = vi.fn();
  const success = vi.fn();
  return { toast: Object.assign(vi.fn(), { error, success }) };
});
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock('sonner', () => ({ toast }));
vi.mock('@/components/lcapix/auth/auth-shell', () => ({
  AuthShell: ({ children }: any) => <div>{children}</div>,
}));

import LoginPage from '@/app/auth/login/page';

function openWith(query: string) {
  window.history.replaceState({}, '', `/auth/login${query}`);
  render(<LoginPage />);
}

describe('Login page ?error= handling (L8)', () => {
  beforeEach(() => {
    toast.mockReset();
    toast.error.mockReset();
    toast.success.mockReset();
  });

  it('never shows raw text from the URL', async () => {
    openWith('?error=' + encodeURIComponent('Your account is locked. Call 555-0100 to verify.'));
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    const shown = JSON.stringify(toast.error.mock.calls[0]);
    expect(shown).not.toMatch(/555-0100|locked/);
    expect(toast.error.mock.calls[0][0]).toBe('Sign-in error');
  });

  it('does not crash on a malformed percent-escape', async () => {
    expect(() => openWith('?error=%25')).not.toThrow();
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(JSON.stringify(toast.error.mock.calls[0])).not.toContain('%');
  });

  it.each([
    ['oauth_state_mismatch', /expired|again/i],
    ['google_email_unverified', /verif/i],
    ['use_password_login', /password/i],
    ['account_inactive', /inactive/i],
    ['google_cancelled', /cancel/i],
    ['session_expired', /session/i],
    ['google_not_configured', /not yet configured/i],
  ])('maps %s to its own message', async (code, re) => {
    openWith(`?error=${code}`);
    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    const [title, { description }] = toast.error.mock.calls[0];
    expect(title).not.toBe('Sign-in error');
    expect(`${title} ${description}`).not.toContain(code);
    expect(`${title} ${description}`).toMatch(re);
  });

  it('strips the param so a reload does not re-toast', async () => {
    openWith('?error=oauth_failed');
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(window.location.search).toBe('');
  });
});

describe('Login form', () => {
  beforeEach(() => {
    toast.error.mockReset();
    toast.success.mockReset();
    push.mockReset();
    localStorage.clear();
    window.history.replaceState({}, '', '/auth/login');
  });

  function submit(email: string, password: string) {
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: email } });
    fireEvent.change(screen.getByLabelText(/^password/i), { target: { value: password } });
    fireEvent.submit(screen.getByLabelText(/email/i).closest('form')!);
  }

  it('shows an error toast with the server message for a wrong password', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: 'Invalid email or password' }), {
          status: 401,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    submit('jo@corp.com', 'wrong-password');

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Login failed', {
        description: 'Invalid email or password',
      }),
    );
    expect(push).not.toHaveBeenCalled();
    expect(localStorage.getItem('auth_token')).toBeNull();
    vi.unstubAllGlobals();
  });

  it('shows a success toast and goes home on a good password', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({ success: true, token: 't', user: { id: 5, username: 'jo', email: 'jo@corp.com' } }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        ),
      ),
    );
    submit('jo@corp.com', 'right-password');

    await waitFor(() => expect(push).toHaveBeenCalledWith('/home'));
    expect(toast.success).toHaveBeenCalledWith('Welcome back!', {
      description: 'You have successfully logged in.',
    });
    vi.unstubAllGlobals();
  });
});
