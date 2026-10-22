// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Log in (F1.2b): errors sit in the form, never in a toast (rules.md: no toast
// covers text or a button). A ?error= code from the Google route shows as a
// card above the form, known codes only: a crafted link never puts its own
// words on an LCAPIX page.
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

import LoginPage from '@/app/auth/login/page';

function openWith(query: string) {
  window.history.replaceState({}, '', `/auth/login${query}`);
  return render(<LoginPage />);
}
const card = async () => (await screen.findByRole('alert')).textContent ?? '';

describe('Login page ?error= handling (L8)', () => {
  it('never shows raw text from the URL', async () => {
    const { container } = openWith('?error=' + encodeURIComponent('Your account is locked. Call 555-0100 to verify.'));
    expect(await card()).toMatch(/Sign-in error/);
    expect(container.textContent).not.toMatch(/555-0100|locked/);
  });

  it('does not crash on a malformed percent-escape', async () => {
    expect(() => openWith('?error=%25')).not.toThrow();
    expect(await card()).toMatch(/Sign-in error/);
  });

  it.each([
    ['oauth_state_mismatch', /expired|again/i],
    ['google_email_unverified', /verif/i],
    ['account_inactive', /inactive/i],
    ['google_cancelled', /cancel/i],
    ['session_expired', /session/i],
    ['google_not_configured', /not yet configured/i],
  ])('maps %s to its own message', async (code, re) => {
    openWith(`?error=${code}`);
    const text = await card();
    expect(text).not.toMatch(/Sign-in error/);
    expect(text).not.toContain(code);
    expect(text).toMatch(re);
  });

  it('strips the param so a reload does not show it again', async () => {
    openWith('?error=oauth_failed');
    await card();
    expect(window.location.search).toBe('');
  });
});

describe('Login form', () => {
  beforeEach(() => {
    push.mockReset();
    localStorage.clear();
    window.history.replaceState({}, '', '/auth/login');
  });

  function submit(email: string, password: string) {
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: email } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: password } });
    fireEvent.submit(screen.getByLabelText('Email').closest('form')!);
  }

  it('a wrong password: the server\'s neutral words under the password, nothing stored', async () => {
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
    await waitFor(() => expect(screen.getByText('Invalid email or password. Try again.')).toBeTruthy());
    expect(screen.getByLabelText('Password').getAttribute('aria-invalid')).toBe('true');
    expect(push).not.toHaveBeenCalled();
    expect(localStorage.getItem('auth_token')).toBeNull();
    vi.unstubAllGlobals();
  });

  it('a good password goes home with the session stored', async () => {
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
    expect(localStorage.getItem('auth_token')).toBe('t');
    vi.unstubAllGlobals();
  });

  it.each(['Failed to fetch', 'NetworkError when attempting to fetch resource.', 'Load failed'])(
    'the server out of reach (%s) reads the same plain words in every browser',
    async (raw) => {
      vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError(raw))));
      submit('jo@corp.com', 'right-password');
      await waitFor(() => expect(screen.getByText('We could not reach LCAPIX. Check your connection and try again.')).toBeTruthy());
      expect(screen.queryByText(raw)).toBeNull();
      expect(push).not.toHaveBeenCalled();
      vi.unstubAllGlobals();
    },
  );

  it('Forgot password? says Coming soon: there is no reset yet', () => {
    render(<LoginPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Forgot password?' }));
    expect(screen.getByText('Resetting a password by email is coming soon.')).toBeTruthy();
  });

  it('the first Tab stop is Continue with Google (acceptance check 10)', () => {
    const { container } = render(<LoginPage />);
    const first = container.querySelector('a[href], button, input');
    expect(first?.textContent).toContain('Continue with Google');
  });
});
