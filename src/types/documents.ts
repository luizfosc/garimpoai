// Types for company document management and compliance checking

/** Types of documents a company can register */
export type TipoDocumento =
  | 'certidao_federal'
  | 'certidao_estadual'
  | 'certidao_municipal'
  | 'certidao_trabalhista'
  | 'certidao_fgts'
  | 'contrato_social'
  | 'balanco_patrimonial'
  | 'atestado_capacidade'
  | 'alvara'
  | 'registro_conselho'
  | 'seguro'
  | 'outro';

/** Document status */
export type StatusDocumento = 'vigente' | 'vencido' | 'proximo_vencimento';

/** A company document stored in the database */
export interface DocumentoEmpresa {
  id: number;
  tipo: TipoDocumento;
  nome: string;
  emissor: string;
  dataEmissao: string | null;
  dataValidade: string | null;
  status: StatusDocumento;
  observacao: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

/** Input for registering a new document */
export interface RegisterDocumentInput {
  tipo: TipoDocumento;
  nome: string;
  emissor: string;
  dataEmissao?: string;
  dataValidade?: string;
  observacao?: string;
}

/** Compliance check result from AI */
export interface ComplianceCheckResult {
  licitacaoId: string;
  score: number; // 0-100
  parecer: 'apto' | 'parcialmente_apto' | 'inapto';
  resumo: string;
  itens: ComplianceItem[];
  tokensUsados: number;
  custoEstimado: number;
  cached: boolean;
}

/** A single requirement item in the compliance check */
export interface ComplianceItem {
  requisito: string;
  status: 'atendido' | 'parcial' | 'pendente' | 'nao_aplicavel';
  documentoEmpresaId: number | null;
  documentoNome: string | null;
  observacao: string;
}

/** AI-extracted requirements from a procurement */
export interface RequisitosExtraidos {
  requisitos: RequisitoEdital[];
}

/** A single requirement extracted from the procurement text */
export interface RequisitoEdital {
  descricao: string;
  tipoDocumento: TipoDocumento | null;
  obrigatorio: boolean;
}
