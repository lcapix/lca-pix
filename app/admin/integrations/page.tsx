// app/admin/integrations/page.tsx
'use client';

import { AuthGuard } from '@/components/auth-guard';
import { AppTopBar } from '@/components/lcapix';
import { useAdminAccess } from '@/lib/admin/use-integrations';
import { AccessNotice } from './_components/access-notice';
import { IntegrationsDashboard } from './_components/integrations-dashboard';

export default function IntegrationsAdminPage() {
  // The integration APIs are admin-only (they write the shared factor library,
  // substance catalog and cost-rate cache). Ask the server who this is before
  // rendering or loading anything; the client store has no account_type.
  const access = useAdminAccess();

  return (
    <AuthGuard>
      {access === 'admin' ? (
        <IntegrationsDashboard />
      ) : (
        <>
          <AppTopBar current="integrations" />
          <AccessNotice checking={access === 'checking'} />
        </>
      )}
    </AuthGuard>
  );
}
