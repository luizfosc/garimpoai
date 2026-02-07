// CRUD and status management for company documents

import { getDb } from '../database/connection';
import { documentosEmpresa } from '../database/schema';
import { eq, sql } from 'drizzle-orm';
import type {
  DocumentoEmpresa,
  RegisterDocumentInput,
  StatusDocumento,
  TipoDocumento,
} from '../types/documents';

/** Days before expiry to flag as "proximo_vencimento" */
const EXPIRY_WARNING_DAYS = 30;

export class DocumentManager {
  private dataDir: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
  }

  /** Register a new company document */
  register(input: RegisterDocumentInput): DocumentoEmpresa {
    const db = getDb(this.dataDir);
    const status = this.computeStatus(input.dataValidade ?? null);

    const result = db
      .insert(documentosEmpresa)
      .values({
        tipo: input.tipo,
        nome: input.nome,
        emissor: input.emissor,
        dataEmissao: input.dataEmissao ?? null,
        dataValidade: input.dataValidade ?? null,
        status,
        observacao: input.observacao ?? null,
      })
      .run();

    return this.getById(Number(result.lastInsertRowid))!;
  }

  /** Get a document by ID */
  getById(id: number): DocumentoEmpresa | null {
    const db = getDb(this.dataDir);
    const row = db
      .select()
      .from(documentosEmpresa)
      .where(eq(documentosEmpresa.id, id))
      .get();

    return row ? this.rowToDoc(row) : null;
  }

  /** List all documents, optionally filtered by type or status */
  list(filters?: {
    tipo?: TipoDocumento;
    status?: StatusDocumento;
  }): DocumentoEmpresa[] {
    const db = getDb(this.dataDir);
    let query = db.select().from(documentosEmpresa);

    if (filters?.tipo) {
      query = query.where(eq(documentosEmpresa.tipo, filters.tipo)) as typeof query;
    }
    if (filters?.status) {
      query = query.where(eq(documentosEmpresa.status, filters.status)) as typeof query;
    }

    return query.all().map((row) => this.rowToDoc(row));
  }

  /** Remove a document by ID */
  remove(id: number): boolean {
    const db = getDb(this.dataDir);
    const result = db
      .delete(documentosEmpresa)
      .where(eq(documentosEmpresa.id, id))
      .run();

    return result.changes > 0;
  }

  /** Refresh status of all documents based on current date */
  refreshStatuses(): { updated: number } {
    const docs = this.list();
    let updated = 0;
    const db = getDb(this.dataDir);

    for (const doc of docs) {
      const newStatus = this.computeStatus(doc.dataValidade);
      if (newStatus !== doc.status) {
        db.update(documentosEmpresa)
          .set({ status: newStatus, atualizadoEm: new Date().toISOString() })
          .where(eq(documentosEmpresa.id, doc.id))
          .run();
        updated++;
      }
    }

    return { updated };
  }

  /** Get documents expiring within N days */
  getExpiring(days: number = EXPIRY_WARNING_DAYS): DocumentoEmpresa[] {
    this.refreshStatuses();
    const db = getDb(this.dataDir);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() + days);
    const cutoff = cutoffDate.toISOString().split('T')[0];
    const today = new Date().toISOString().split('T')[0];

    const rows = db
      .select()
      .from(documentosEmpresa)
      .where(
        sql`${documentosEmpresa.dataValidade} IS NOT NULL AND ${documentosEmpresa.dataValidade} <= ${cutoff} AND ${documentosEmpresa.dataValidade} >= ${today}`
      )
      .all();

    return rows.map((row) => this.rowToDoc(row));
  }

  /** Find the best matching document for a given requirement type */
  findBestMatch(tipoRequisito: TipoDocumento): DocumentoEmpresa | null {
    const db = getDb(this.dataDir);

    // First try exact type match with vigente status
    const vigente = db
      .select()
      .from(documentosEmpresa)
      .where(eq(documentosEmpresa.tipo, tipoRequisito))
      .all()
      .map((row) => this.rowToDoc(row))
      .filter((doc) => doc.status === 'vigente');

    if (vigente.length > 0) {
      // Return the one with the latest expiry date
      return vigente.sort((a, b) => {
        if (!a.dataValidade) return 1;
        if (!b.dataValidade) return -1;
        return b.dataValidade.localeCompare(a.dataValidade);
      })[0];
    }

    // Fall back to proximo_vencimento
    const expiring = db
      .select()
      .from(documentosEmpresa)
      .where(eq(documentosEmpresa.tipo, tipoRequisito))
      .all()
      .map((row) => this.rowToDoc(row))
      .filter((doc) => doc.status === 'proximo_vencimento');

    return expiring.length > 0 ? expiring[0] : null;
  }

  /** Compute document status from its expiry date */
  private computeStatus(dataValidade: string | null): StatusDocumento {
    if (!dataValidade) return 'vigente'; // No expiry = always valid

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(dataValidade + 'T00:00:00');

    if (expiry < today) return 'vencido';

    const warningDate = new Date(today);
    warningDate.setDate(warningDate.getDate() + EXPIRY_WARNING_DAYS);

    if (expiry <= warningDate) return 'proximo_vencimento';

    return 'vigente';
  }

  /** Convert a DB row to DocumentoEmpresa */
  private rowToDoc(row: typeof documentosEmpresa.$inferSelect): DocumentoEmpresa {
    return {
      id: row.id,
      tipo: row.tipo as TipoDocumento,
      nome: row.nome,
      emissor: row.emissor,
      dataEmissao: row.dataEmissao,
      dataValidade: row.dataValidade,
      status: row.status as StatusDocumento,
      observacao: row.observacao,
      criadoEm: row.criadoEm || '',
      atualizadoEm: row.atualizadoEm || '',
    };
  }
}
