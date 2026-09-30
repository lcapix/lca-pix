// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const push = vi.fn();
const { toast } = vi.hoisted(() => ({
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }));
vi.mock('sonner', () => ({ toast }));
vi.mock('@/components/lcapix/auth/auth-shell', () => ({
  AuthShell: ({ children }: any) => <div>{children}</div>,
}));

import SignupPage from '@/app/auth/signup/page';

describe('Signup page', () => {
  beforeEach(() => {
    push.mockReset();
    toast.error.mockReset();
    toast.success.mockReset();
    localStorage.clear();
  });

  function fillAndSubmit() {
    render(<SignupPage />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Jo Smith' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jo@corp.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'longenough1' } });
    fireEvent.submit(screen.getByLabelText('Email').closest('form')!);
  }

  it('shows the server error in a toast when signup fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ error: 'An account with this email already exists' }), {
          status: 409,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    fillAndSubmit();
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith('Signup failed', {
        description: 'An account with this email already exists',
      }),
    );
    expect(push).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('sends the typed name as full_name and lets the server pick the username (AUTH-4)', async () => {
    const fetchMock = vi.fn(async () =>
      new Response(
        JSON.stringify({ success: true, token: 't', user: { id: 5, username: 'jo', email: 'jo@corp.com' } }),
        { status: 201, headers: { 'content-type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    render(<SignupPage />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Jo Smith' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'jo@corp.com' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'longenough1' } });
    fireEvent.submit(screen.getByLabelText('Email').closest('form')!);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0] as any[];
    const sent = JSON.parse(init.body);
    expect(sent).toEqual({ full_name: 'Jo Smith', email: 'jo@corp.com', password: 'longenough1' });
    await waitFor(() => expect(push).toHaveBeenCalledWith('/auth/onboarding'));
    expect(toast.success).toHaveBeenCalledWith('Account created successfully!', {
      description: "Just a few quick details and you're in.",
    });
    vi.unstubAllGlobals();
  });
});
