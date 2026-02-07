// Check document expiry and integrate with notification system

import { DocumentManager } from './manager';
import type { DocumentoEmpresa } from '../types/documents';

export interface ExpiryCheckResult {
  expiring: DocumentoEmpresa[];
  expired: DocumentoEmpresa[];
}

/** Check for expiring and expired documents */
export function checkExpiry(dataDir: string, warningDays: number = 30): ExpiryCheckResult {
  const manager = new DocumentManager(dataDir);
  manager.refreshStatuses();

  const allDocs = manager.list();
  const expired = allDocs.filter((d) => d.status === 'vencido');
  const expiring = manager.getExpiring(warningDays);

  return { expiring, expired };
}
