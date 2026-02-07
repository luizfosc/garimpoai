// Prompt engineering for compliance checking

/** System prompt for compliance analysis */
export const COMPLIANCE_SYSTEM_PROMPT = `Voce e um especialista em compliance de licitacoes publicas brasileiras.
Sua tarefa e analisar os requisitos de uma licitacao e verificar se a empresa possui os documentos necessarios para participar.

Regras:
- Responda APENAS com JSON valido, sem markdown, sem explicacoes fora do JSON
- Seja conservador: se nao tem certeza que o documento atende, marque como "parcial"
- Considere prazos de validade dos documentos
- Explique de forma pratica o que esta faltando ou precisa de atencao`;

/** Build the user prompt for compliance check */
export function buildCompliancePrompt(
  licitacaoData: Record<string, unknown>,
  documentosEmpresa: Array<{ tipo: string; nome: string; status: string; dataValidade: string | null }>
): string {
  return `Analise se a empresa pode participar desta licitacao.

Compare os requisitos da licitacao com os documentos que a empresa possui.
Retorne um JSON com esta estrutura exata:

{
  "score": 85,
  "parecer": "apto | parcialmente_apto | inapto",
  "resumo": "Resumo pratico da situacao de compliance",
  "itens": [
    {
      "requisito": "Descricao do requisito do edital",
      "status": "atendido | parcial | pendente | nao_aplicavel",
      "tipoDocumento": "tipo do documento necessario (ex: certidao_federal) ou null",
      "documentoNome": "Nome do documento da empresa que atende, ou null",
      "observacao": "Explicacao pratica"
    }
  ]
}

Regras para o score:
- 100 = todos os requisitos atendidos com documentos vigentes
- 70-99 = parcialmente apto (falta algo menor ou documento proximo do vencimento)
- 40-69 = parcialmente apto (faltam documentos importantes mas nao impossivel)
- 0-39 = inapto (faltam documentos essenciais)

Regras para o parecer:
- "apto" = score >= 80
- "parcialmente_apto" = score >= 40
- "inapto" = score < 40

Dados da licitacao:
${JSON.stringify(licitacaoData, null, 2)}

Documentos da empresa:
${JSON.stringify(documentosEmpresa, null, 2)}`;
}
