// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';

const toast = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }));
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }));
vi.mock('@/components/lcapix/auth/auth-shell', () => ({
  AuthShell: ({ children }: any) => <div>{children}</div>,
}));

import LoginPage from '@/app/auth/login/page';

function openWith(query: string) {
  window.history.replaceState({}, '', `/auth/login${query}`);
  render(<LoginPage />);
}

describe('Login page ?error= handling (L8)', () => {
  beforeEach(() => toast.mockReset());

  it('never shows raw text from the URL', async () => {
    openWith('?error=' + encodeURIComponent('Your account is locked. Call 555-0100 to verify.'));
    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    const shown = JSON.stringify(toast.mock.calls[0][0]);
    expect(shown).not.toMatch(/555-0100|locked/);
    expect(toast.mock.calls[0][0].title).toBe('Sign-in error');
  });

  it('does not crash on a malformed percent-escape', async () => {
    expect(() => openWith('?error=%25')).not.toThrow();
    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    expect(JSON.stringify(toast.mock.calls[0][0])).not.toContain('%');
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
    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    const { title, description } = toast.mock.calls[0][0];
    expect(title).not.toBe('Sign-in error');
    expect(`${title} ${description}`).not.toContain(code);
    expect(`${title} ${description}`).toMatch(re);
  });

  it('strips the param so a reload does not re-toast', async () => {
    openWith('?error=oauth_failed');
    await waitFor(() => expect(toast).toHaveBeenCalled());
    expect(window.location.search).toBe('');
  });
});
