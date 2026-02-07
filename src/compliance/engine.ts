// Compliance engine: AI checks if company can participate in a procurement

import Anthropic from '@anthropic-ai/sdk';
import { getDb } from '../database/connection';
import { licitacoes, complianceChecks, complianceItems } from '../database/schema';
import { DocumentManager } from '../documents/manager';
import { GarimpoAIConfig } from '../types/config';
import type { ComplianceCheckResult, ComplianceItem } from '../types/documents';
import { eq } from 'drizzle-orm';
import { COMPLIANCE_SYSTEM_PROMPT, buildCompliancePrompt } from './prompts';
import { estimateCost } from '../analyzer/prompts';
import { recordUsage, isLimitReached } from '../analyzer/cost-tracker';

export class ComplianceEngine {
  private config: GarimpoAIConfig;
  private client: Anthropic;
  private docManager: DocumentManager;

  constructor(config: GarimpoAIConfig) {
    this.config = config;
    this.client = new Anthropic({ apiKey: config.ia.apiKey });
    this.docManager = new DocumentManager(config.dataDir);
  }

  /** Check compliance for a licitacao */
  async check(licitacaoId: string): Promise<ComplianceCheckResult> {
    const db = getDb(this.config.dataDir);

    // Check cache first
    const existing = db
      .select()
      .from(complianceChecks)
      .where(eq(complianceChecks.licitacaoId, licitacaoId))
      .get();

    if (existing) {
      const items = db
        .select()
        .from(complianceItems)
        .where(eq(complianceItems.checkId, existing.id))
        .all();

      return {
        licitacaoId,
        score: existing.score,
        parecer: existing.parecer as ComplianceCheckResult['parecer'],
        resumo: existing.resumo,
        itens: items.map((item) => ({
          requisito: item.requisito,
          status: item.status as ComplianceItem['status'],
          documentoEmpresaId: item.documentoEmpresaId,
          documentoNome: item.documentoNome,
          observacao: item.observacao || '',
        })),
        tokensUsados: existing.tokensUsados || 0,
        custoEstimado: existing.custoEstimado || 0,
        cached: true,
      };
    }

    // Check daily limit
    if (isLimitReached(this.config.dataDir, this.config.ia.maxPerDay)) {
      throw new Error(
        `Limite diario de analises atingido (${this.config.ia.maxPerDay}). Tente amanha.`
      );
    }

    // Fetch licitacao data
    const licitacao = db
      .select()
      .from(licitacoes)
      .where(eq(licitacoes.numeroControlePNCP, licitacaoId))
      .get();

    if (!licitacao) {
      throw new Error(`Licitacao ${licitacaoId} nao encontrada no banco`);
    }

    // Refresh document statuses before checking
    this.docManager.refreshStatuses();

    // Get all company documents
    const docs = this.docManager.list();
    if (docs.length === 0) {
      return {
        licitacaoId,
        score: 0,
        parecer: 'inapto',
        resumo: 'Nenhum documento da empresa cadastrado. Cadastre seus documentos primeiro com "cadastra minha certidao..."',
        itens: [],
        tokensUsados: 0,
        custoEstimado: 0,
        cached: false,
      };
    }

    const licitacaoData = {
      id: licitacao.numeroControlePNCP,
      objeto: licitacao.objetoCompra,
      valor: licitacao.valorTotalEstimado,
      modalidade: licitacao.modalidadeNome,
      modoDisputa: licitacao.modoDisputaNome,
      orgao: licitacao.orgaoRazaoSocial,
      uf: licitacao.ufSigla,
      amparoLegal: licitacao.amparoLegalNome,
      amparoLegalDescricao: licitacao.amparoLegalDescricao,
      dataAbertura: licitacao.dataAberturaProposta,
      informacaoComplementar: licitacao.informacaoComplementar,
    };

    const docsForPrompt = docs.map((d) => ({
      tipo: d.tipo,
      nome: d.nome,
      status: d.status,
      dataValidade: d.dataValidade,
    }));

    // Call Claude for compliance analysis
    const model = this.config.ia.analysisModel;
    const response = await this.client.messages.create({
      model,
      max_tokens: 2048,
      system: COMPLIANCE_SYSTEM_PROMPT,
      messages: [
        { role: 'user', content: buildCompliancePrompt(licitacaoData, docsForPrompt) },
      ],
    });

    // Extract text content
    const textBlock = response.content.find(
      (b): b is Anthropic.Messages.TextBlock => b.type === 'text'
    );

    if (!textBlock) {
      throw new Error('Resposta vazia da IA');
    }

    // Parse JSON response
    let parsed: {
      score: number;
      parecer: string;
      resumo: string;
      itens: Array<{
        requisito: string;
        status: string;
        tipoDocumento?: string | null;
        documentoNome?: string | null;
        observacao: string;
      }>;
    };

    try {
      let jsonStr = textBlock.text.trim();
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
      }
      parsed = JSON.parse(jsonStr);
    } catch {
      throw new Error(`Erro ao parsear resposta de compliance: ${textBlock.text.substring(0, 200)}`);
    }

    // Calculate costs
    const inputTokens = response.usage.input_tokens;
    const outputTokens = response.usage.output_tokens;
    const totalTokens = inputTokens + outputTokens;
    const custo = estimateCost(model, inputTokens, outputTokens);

    // Match AI items with actual company documents
    const itens: ComplianceItem[] = parsed.itens.map((item) => {
      let documentoEmpresaId: number | null = null;
      let documentoNome: string | null = item.documentoNome || null;

      // Try to find matching document by type
      if (item.tipoDocumento) {
        const match = this.docManager.findBestMatch(item.tipoDocumento as any);
        if (match) {
          documentoEmpresaId = match.id;
          documentoNome = match.nome;
        }
      }

      return {
        requisito: item.requisito,
        status: item.status as ComplianceItem['status'],
        documentoEmpresaId,
        documentoNome,
        observacao: item.observacao,
      };
    });

    // Save to DB
    const checkResult = db
      .insert(complianceChecks)
      .values({
        licitacaoId,
        score: parsed.score,
        parecer: parsed.parecer,
        resumo: parsed.resumo,
        modelo: model,
        tokensUsados: totalTokens,
        custoEstimado: custo,
        rawResponse: textBlock.text,
      })
      .run();

    const checkId = Number(checkResult.lastInsertRowid);

    // Save items
    for (const item of itens) {
      db.insert(complianceItems)
        .values({
          checkId,
          requisito: item.requisito,
          status: item.status,
          documentoEmpresaId: item.documentoEmpresaId,
          documentoNome: item.documentoNome,
          observacao: item.observacao,
        })
        .run();
    }

    // Track usage
    recordUsage(this.config.dataDir, 'compliance', model, inputTokens, outputTokens, custo);

    return {
      licitacaoId,
      score: parsed.score,
      parecer: parsed.parecer as ComplianceCheckResult['parecer'],
      resumo: parsed.resumo,
      itens,
      tokensUsados: totalTokens,
      custoEstimado: custo,
      cached: false,
    };
  }
}
