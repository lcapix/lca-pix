// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

// Sign-up (F1.2): errors on their line, never in a toast; the duplicate answer
// is the server's neutral words with "Log in instead"; the typed name goes as
// full_name; then About you.
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));

import SignupPage from '@/app/auth/signup/page';

const NEUTRAL = 'We could not create an account with those details. If you already have an account, log in instead.';

describe('Signup page', () => {
  beforeEach(() => {
    push.mockReset();
    localStorage.clear();
  });

  function fillAndSubmit() {
    render(<SignupPage />);
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Jo Smith' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jo@corp.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'longenough1' } });
    fireEvent.submit(screen.getByLabelText('Email').closest('form')!);
  }

  it('a used email: the neutral words under the email, with Log in instead', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ error: NEUTRAL }), { status: 409, headers: { 'content-type': 'application/json' } })),
    );
    fillAndSubmit();
    await waitFor(() => expect(screen.getByText(NEUTRAL, { exact: false })).toBeTruthy());
    expect(screen.getByRole('link', { name: 'Log in instead.' }).getAttribute('href')).toBe('/auth/login');
    expect(screen.getByLabelText('Email').getAttribute('aria-invalid')).toBe('true');
    expect(push).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('sends the typed name as full_name and lets the server pick the username (AUTH-4)', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ success: true, token: 't', user: { id: 5, username: 'jo', email: 'jo@corp.com' } }), {
        status: 201,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    fillAndSubmit();
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0] as any[];
    expect(JSON.parse(init.body)).toEqual({ full_name: 'Jo Smith', email: 'jo@corp.com', password: 'longenough1' });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/auth/onboarding'));
    expect(localStorage.getItem('auth_token')).toBe('t');
    vi.unstubAllGlobals();
  });

  it('checks the password before sending: 8 characters and one number', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    render(<SignupPage />);
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jo@corp.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'longenough' } });
    fireEvent.submit(screen.getByLabelText('Email').closest('form')!);
    expect(screen.getByText('Add at least one number.')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
