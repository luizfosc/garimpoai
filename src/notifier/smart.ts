import Anthropic from '@anthropic-ai/sdk';
import { getDb } from '../database/connection';
import { FilterResult } from '../filter/engine';
import { recordUsage } from '../analyzer/cost-tracker';

export interface SemanticScore {
  score: number;
  resumo: string;
  cached: boolean;
}

/** Classify relevance of a licitacao for an alert using Haiku */
export async function classifyRelevance(
  licitacao: FilterResult,
  keywords: string[],
  apiKey: string,
  model: string,
  dataDir: string,
): Promise<SemanticScore> {
  const client = new Anthropic({ apiKey });

  const valor = licitacao.valorTotalEstimado
    ? `R$ ${licitacao.valorTotalEstimado.toLocaleString('pt-BR')}`
    : 'Nao informado';

  const prompt = [
    `Classifique a relevancia desta licitacao para uma empresa que busca: ${keywords.join(', ')}.`,
    `Licitacao: ${licitacao.objetoCompra} | Orgao: ${licitacao.orgaoRazaoSocial || 'N/A'} | UF: ${licitacao.ufSigla || 'N/A'} | Valor: ${valor}`,
    `Responda APENAS com JSON: {"score": 0-100, "resumo": "uma linha explicando"}`,
  ].join('\n');

  const response = await client.messages.create({
    model,
    max_tokens: 150,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find(
    (b): b is Anthropic.Messages.TextBlock => b.type === 'text'
  );

  // Track usage
  recordUsage(dataDir, 'smart_alert' as 'analysis', model, response.usage.input_tokens, response.usage.output_tokens, 0);

  if (!textBlock) {
    return { score: 50, resumo: 'Resposta vazia da IA', cached: false };
  }

  try {
    let jsonStr = textBlock.text.trim();
    if (jsonStr.startsWith('```')) {
      jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    const parsed = JSON.parse(jsonStr);
    return {
      score: Math.max(0, Math.min(100, parsed.score || 50)),
      resumo: parsed.resumo || '',
      cached: false,
    };
  } catch {
    return { score: 50, resumo: 'Erro ao interpretar resposta', cached: false };
  }
}

/** Regex-based fallback scoring */
export function regexFallbackScore(licitacao: FilterResult, keywords: string[]): SemanticScore {
  const objeto = licitacao.objetoCompra.toLowerCase();
  const lowerKeywords = keywords.map(k => k.toLowerCase());

  const matchCount = lowerKeywords.filter(kw => objeto.includes(kw)).length;

  if (matchCount === lowerKeywords.length) {
    return { score: 100, resumo: 'Todas as palavras-chave encontradas', cached: false };
  }
  if (matchCount > 0) {
    return { score: 50, resumo: `${matchCount}/${lowerKeywords.length} palavras-chave encontradas`, cached: false };
  }
  return { score: 0, resumo: 'Nenhuma palavra-chave encontrada', cached: false };
}

/** Get cached score for alert+licitacao pair */
export function getCachedScore(dataDir: string, alertaId: number, licitacaoId: string): SemanticScore | null {
  const db = getDb(dataDir);
  const sqlite = (db as unknown as { session: { client: { prepare: (sql: string) => { get: (...args: unknown[]) => Record<string, unknown> | undefined } } } }).session.client;

  const row = sqlite
    .prepare('SELECT semantic_score, resumo FROM alert_scores WHERE alerta_id = ? AND licitacao_id = ?')
    .get(alertaId, licitacaoId) as { semantic_score: number; resumo: string } | undefined;

  if (!row) return null;

  return {
    score: row.semantic_score,
    resumo: row.resumo || '',
    cached: true,
  };
}

/** Cache a score for alert+licitacao pair */
export function cacheScore(dataDir: string, alertaId: number, licitacaoId: string, score: number, resumo: string): void {
  const db = getDb(dataDir);
  const sqlite = (db as unknown as { session: { client: { prepare: (sql: string) => { run: (...args: unknown[]) => void } } } }).session.client;

  sqlite
    .prepare('INSERT OR REPLACE INTO alert_scores (alerta_id, licitacao_id, semantic_score, resumo) VALUES (?, ?, ?, ?)')
    .run(alertaId, licitacaoId, score, resumo);
}
