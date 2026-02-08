import fs from 'fs';
import { getDb } from '../database/connection';
import { licitacoes, analises } from '../database/schema';
import { eq, and, inArray, gte, lte, like, sql } from 'drizzle-orm';

const UTF8_BOM = '\ufeff';
const MAX_EXPORT = 10000;

export interface ExportFilters {
  keywords?: string[];
  uf?: string[];
  valorMin?: number;
  valorMax?: number;
}

export interface ExportResult {
  path: string;
  count: number;
  format: 'csv' | 'json';
}

interface LicitacaoRow {
  numeroControlePNCP: string;
  objetoCompra: string;
  orgaoRazaoSocial: string | null;
  ufSigla: string | null;
  municipioNome: string | null;
  modalidadeNome: string;
  valorTotalEstimado: number | null;
  dataAberturaProposta: string | null;
  situacaoCompraNome: string | null;
  resumo: string | null;
  dificuldade: string | null;
  proximoPasso: string | null;
}

// CSV header labels (Brazilian Portuguese for Excel users)
const CSV_HEADERS = [
  'ID', 'Objeto', 'Orgao', 'UF', 'Municipio', 'Modalidade',
  'Valor Estimado', 'Data Abertura', 'Situacao',
  'Resumo IA', 'Dificuldade', 'Proximo Passo',
];

/** Query licitacoes with LEFT JOIN on analises */
export function queryLicitacoesWithAnalysis(
  dataDir: string,
  filters: ExportFilters,
  limit: number = MAX_EXPORT,
): LicitacaoRow[] {
  const db = getDb(dataDir);

  const conditions = [];

  if (filters.uf && filters.uf.length > 0) {
    conditions.push(inArray(licitacoes.ufSigla, filters.uf));
  }
  if (filters.valorMin !== undefined) {
    conditions.push(gte(licitacoes.valorTotalEstimado, filters.valorMin));
  }
  if (filters.valorMax !== undefined) {
    conditions.push(lte(licitacoes.valorTotalEstimado, filters.valorMax));
  }

  let query = db
    .select({
      numeroControlePNCP: licitacoes.numeroControlePNCP,
      objetoCompra: licitacoes.objetoCompra,
      orgaoRazaoSocial: licitacoes.orgaoRazaoSocial,
      ufSigla: licitacoes.ufSigla,
      municipioNome: licitacoes.municipioNome,
      modalidadeNome: licitacoes.modalidadeNome,
      valorTotalEstimado: licitacoes.valorTotalEstimado,
      dataAberturaProposta: licitacoes.dataAberturaProposta,
      situacaoCompraNome: licitacoes.situacaoCompraNome,
      resumo: analises.resumo,
      dificuldade: analises.dificuldade,
      proximoPasso: analises.proximoPasso,
    })
    .from(licitacoes)
    .leftJoin(analises, eq(licitacoes.numeroControlePNCP, analises.licitacaoId));

  if (conditions.length > 0) {
    query = query.where(and(...conditions)) as typeof query;
  }

  // Keyword filtering via FTS or LIKE
  let rows = query.limit(limit).all();

  if (filters.keywords && filters.keywords.length > 0) {
    const lowerKeywords = filters.keywords.map(k => k.toLowerCase());
    rows = rows.filter(r =>
      lowerKeywords.some(kw => r.objetoCompra.toLowerCase().includes(kw))
    );
  }

  return rows;
}

/** Escape a CSV field value */
function escapeCsvField(value: string | null | undefined, separator: string): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Escape if contains separator, quotes, or newlines
  if (str.includes(separator) || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Generate CSV content */
export function toCsv(data: LicitacaoRow[], outputPath: string, separator: string = ';'): void {
  const lines: string[] = [];

  // Header
  lines.push(CSV_HEADERS.join(separator));

  // Data rows
  for (const row of data) {
    const fields = [
      row.numeroControlePNCP,
      row.objetoCompra,
      row.orgaoRazaoSocial,
      row.ufSigla,
      row.municipioNome,
      row.modalidadeNome,
      row.valorTotalEstimado !== null ? String(row.valorTotalEstimado) : '',
      row.dataAberturaProposta,
      row.situacaoCompraNome,
      row.resumo,
      row.dificuldade,
      row.proximoPasso,
    ];
    lines.push(fields.map(f => escapeCsvField(f, separator)).join(separator));
  }

  fs.writeFileSync(outputPath, UTF8_BOM + lines.join('\n'), 'utf-8');
}

/** Generate JSON content */
export function toJson(data: LicitacaoRow[], outputPath: string): void {
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
}

/** Generate auto filename */
export function getExportFilename(format: 'csv' | 'json'): string {
  const date = new Date().toISOString().substring(0, 10);
  return `garimpoai-export-${date}.${format}`;
}

/** Main export orchestrator */
export function exportLicitacoes(
  dataDir: string,
  filters: ExportFilters,
  format: 'csv' | 'json',
  outputPath: string,
  separator: string = ';',
): ExportResult {
  const data = queryLicitacoesWithAnalysis(dataDir, filters);

  if (format === 'csv') {
    toCsv(data, outputPath, separator);
  } else {
    toJson(data, outputPath);
  }

  return {
    path: outputPath,
    count: data.length,
    format,
  };
}
