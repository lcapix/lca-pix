// lib/integrations/log.ts — audit trail for API integrations
import { insert } from '@/lib/db-helpers';

export type IntegrationSource =
  | 'openlca' | 'pubchem' | 'electricity_maps' | 'bls' | 'eia' | 'metals';

export type IntegrationStatus = 'success' | 'partial' | 'failed';

export interface LogParams {
  source: IntegrationSource;
  action: string;
  recordsAffected: number;
  executedBy: number | null;
  status?: IntegrationStatus;
  details?: Record<string, unknown>;
}

/**
 * Write a row to integration_log for auditability.
 * Returns the new log_id.
 */
export async function logIntegration(params: LogParams): Promise<number> {
  const status = params.status ?? 'success';
  const details = params.details ? JSON.stringify(params.details) : null;

  return insert(
    `INSERT INTO integration_log
       (source, action, records_affected, executed_by, status, details)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      params.source,
      params.action,
      params.recordsAffected,
      params.executedBy,
      status,
      details,
    ],
  );
}
