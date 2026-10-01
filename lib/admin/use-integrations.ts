'use client';

// Admin → Integrations data hooks: who is looking (admin or not) and the
// /api/integrations/status payload with its refresh action.

import { useCallback, useEffect, useState } from 'react';
import { apiGet } from '@/lib/api-client';
import type { Status } from '@/lib/admin/integrations';

/** Result of the server-side admin check. */
export type AdminAccess = 'checking' | 'admin' | 'denied';

/**
 * The integration APIs are admin-only (they write the shared factor library,
 * substance catalog and cost-rate cache). Ask the server who this is before
 * rendering or loading anything; the client store has no account_type.
 * 'checking' until /api/auth/me answers, then 'admin' or 'denied' (also
 * 'denied' when the call fails).
 */
export function useAdminAccess(): AdminAccess {
  const [access, setAccess] = useState<AdminAccess>('checking');

  useEffect(() => {
    let cancelled = false;
    apiGet<{ user?: { account_type?: string } }>('/api/auth/me')
      .then((d) => {
        if (!cancelled) setAccess(d?.user?.account_type === 'admin' ? 'admin' : 'denied');
      })
      .catch(() => {
        if (!cancelled) setAccess('denied');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return access;
}

/** What useIntegrationsStatus hands the dashboard. */
export interface IntegrationsStatusState {
  status: Status | null;
  loading: boolean;
  error: string | null;
  /** Bumped after every successful load so the activity log re-reads. */
  logRefresh: number;
  /** Reload /api/integrations/status (also runs once on mount). */
  refresh: () => Promise<void>;
}

/**
 * Loads /api/integrations/status on mount and on refresh(). loading is true
 * while a request is in flight; error holds the thrown message (the previous
 * status is kept); a successful load bumps logRefresh.
 */
export function useIntegrationsStatus(): IntegrationsStatusState {
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [logRefresh, setLogRefresh] = useState(0);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiGet<Status>('/api/integrations/status');
      setStatus(data);
      setLogRefresh((n) => n + 1);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { status, loading, error, logRefresh, refresh };
}
