import { GarimpoAIConfig } from '../types/config';
import { FilterEngine } from '../filter/engine';
import { Collector } from '../collector/collector';
import { Analyzer } from '../analyzer/analyzer';
import { getTodayUsage } from '../analyzer/cost-tracker';
import { getDb, initializeDb } from '../database/connection';
import { licitacoes, alertas } from '../database/schema';
import { eq, sql } from 'drizzle-orm';
import { SearchResultReference } from '../types/chat';
import { DocumentManager } from '../documents/manager';
import { ComplianceEngine } from '../compliance/engine';
import type { RegisterDocumentInput, TipoDocumento, StatusDocumento } from '../types/documents';
import { checkExpiry } from '../documents/expiry-checker';
import { recordSearch } from '../filter/search-history';
import { exportLicitacoes, getExportFilename } from '../export/exporter';

/** Execute tool calls from the AI */
export class ToolExecutor {
  private config: GarimpoAIConfig;
  private filterEngine: FilterEngine;
  private analyzer: Analyzer | null;
  private docManager: DocumentManager;
  private complianceEngine: ComplianceEngine | null;
  private lastSearchResults: SearchResultReference[] = [];

  constructor(config: GarimpoAIConfig) {
    this.config = config;
    this.filterEngine = new FilterEngine(config);
    this.analyzer = config.ia.apiKey ? new Analyzer(config) : null;
    this.docManager = new DocumentManager(config.dataDir);
    this.complianceEngine = config.ia.apiKey ? new ComplianceEngine(config) : null;
  }

  getLastSearchResults(): SearchResultReference[] {
    return this.lastSearchResults;
  }

  async execute(
    toolName: string,
    input: Record<string, unknown>
  ): Promise<string> {
    switch (toolName) {
      case 'search_licitacoes':
        return this.searchLicitacoes(input);
      case 'analyze_licitacao':
        return this.analyzeLicitacao(input);
      case 'create_alert':
        return this.createAlert(input);
      case 'get_stats':
        return this.getStats();
      case 'get_licitacao_detail':
        return this.getLicitacaoDetail(input);
      case 'run_collect':
        return this.runCollect(input);
      case 'register_document':
        return this.registerDocument(input);
      case 'list_documents':
        return this.listDocuments(input);
      case 'check_compliance':
        return this.checkCompliance(input);
      case 'export_data':
        return this.exportData(input);
      case 'get_expiring_documents':
        return this.getExpiringDocuments(input);
      default:
        return JSON.stringify({ error: `Tool desconhecida: ${toolName}` });
    }
  }

  private searchLicitacoes(input: Record<string, unknown>): string {
    const results = this.filterEngine.search({
      keywords: input.keywords as string[] | undefined,
      uf: input.uf as string[] | undefined,
      modalidade: input.modalidade as number[] | undefined,
      valorMin: input.valorMin as number | undefined,
      valorMax: input.valorMax as number | undefined,
      apenasAbertas: input.apenasAbertas as boolean | undefined,
      limit: (input.limit as number) || 10,
    });

    // Save references for "analisa a terceira" type queries
    this.lastSearchResults = results.map((r, i) => ({
      index: i + 1,
      numeroControlePNCP: r.numeroControlePNCP,
      objetoCompra: r.objetoCompra,
    }));

    // Record search in history
    const queryStr = (input.keywords as string[] || []).join(' ');
    const filters: Record<string, unknown> = {};
    if (input.uf) filters.uf = input.uf;
    if (input.valorMin) filters.valorMin = input.valorMin;
    if (input.valorMax) filters.valorMax = input.valorMax;
    recordSearch(this.config.dataDir, queryStr, Object.keys(filters).length > 0 ? filters : null, results.length);

    return JSON.stringify({
      total: results.length,
      resultados: results.map((r, i) => ({
        posicao: i + 1,
        id: r.numeroControlePNCP,
        objeto: r.objetoCompra,
        valor: r.valorTotalEstimado,
        modalidade: r.modalidadeNome,
        uf: r.ufSigla,
        municipio: r.municipioNome,
        orgao: r.orgaoRazaoSocial,
        dataAbertura: r.dataAberturaProposta,
        dataPublicacao: r.dataPublicacaoPncp,
        jaAnalisada: r.analisado,
      })),
    });
  }

  private async analyzeLicitacao(input: Record<string, unknown>): Promise<string> {
    const id = input.licitacaoId as string;

    // If analyzer is available, do deep analysis
    if (this.analyzer) {
      try {
        const result = await this.analyzer.analyze(id);
        return Analyzer.formatForTool(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // Fall back to raw data if analysis fails
        return this.getLicitacaoRawData(id, msg);
      }
    }

    // No API key — return raw data for conversational analysis
    return this.getLicitacaoRawData(id);
  }

  private getLicitacaoRawData(id: string, warning?: string): string {
    const db = getDb(this.config.dataDir);
    const licitacao = db
      .select()
      .from(licitacoes)
      .where(eq(licitacoes.numeroControlePNCP, id))
      .get();

    if (!licitacao) {
      return JSON.stringify({ error: `Licitacao ${id} nao encontrada no banco` });
    }

    const data: Record<string, unknown> = {
      id: licitacao.numeroControlePNCP,
      objeto: licitacao.objetoCompra,
      valor: licitacao.valorTotalEstimado,
      modalidade: licitacao.modalidadeNome,
      modoDisputa: licitacao.modoDisputaNome,
      orgao: licitacao.orgaoRazaoSocial,
      unidade: licitacao.nomeUnidade,
      uf: licitacao.ufSigla,
      municipio: licitacao.municipioNome,
      amparoLegal: licitacao.amparoLegalNome,
      amparoLegalDescricao: licitacao.amparoLegalDescricao,
      dataPublicacao: licitacao.dataPublicacaoPncp,
      dataAbertura: licitacao.dataAberturaProposta,
      dataEncerramento: licitacao.dataEncerramentoProposta,
      linkOrigem: licitacao.linkSistemaOrigem,
      informacaoComplementar: licitacao.informacaoComplementar,
      processo: licitacao.processo,
      srp: licitacao.srp,
    };

    if (warning) {
      data._aviso = `Analise profunda falhou (${warning}). Dados brutos fornecidos.`;
    }

    return JSON.stringify(data);
  }

  private createAlert(input: Record<string, unknown>): string {
    const db = getDb(this.config.dataDir);

    const keywords = input.keywords as string[];
    const nome = `Alerta: ${keywords.join(', ')}`;

    db.insert(alertas)
      .values({
        nome,
        keywords: JSON.stringify(keywords),
        ufs: input.ufs ? JSON.stringify(input.ufs) : null,
        valorMinimo: input.valorMin as number | undefined,
        valorMaximo: input.valorMax as number | undefined,
        canal: (input.canal as string) || 'telegram',
      })
      .run();

    return JSON.stringify({
      sucesso: true,
      alerta: {
        nome,
        keywords,
        ufs: input.ufs || 'todas',
        valorMin: input.valorMin || 'sem minimo',
        valorMax: input.valorMax || 'sem maximo',
        canal: input.canal || 'telegram',
      },
    });
  }

  private getStats(): string {
    const stats = this.filterEngine.getStats();
    const iaUsage = getTodayUsage(this.config.dataDir);
    return JSON.stringify({
      ...stats,
      iaHoje: {
        analises: iaUsage.totalAnalises,
        chats: iaUsage.totalChats,
        compliance: iaUsage.totalCompliance,
        tokensInput: iaUsage.tokensInput,
        tokensOutput: iaUsage.tokensOutput,
        custoEstimado: `US$ ${iaUsage.custoTotal.toFixed(4)}`,
        limiteAnalises: this.config.ia.maxPerDay,
      },
    });
  }

  private async getLicitacaoDetail(input: Record<string, unknown>): Promise<string> {
    return this.getLicitacaoRawData(input.licitacaoId as string);
  }

  private async runCollect(input: Record<string, unknown>): Promise<string> {
    const dias = (input.dias as number) || 7;
    const collector = new Collector(this.config);

    const result = await collector.collect({
      dataInicial: new Date(Date.now() - dias * 24 * 60 * 60 * 1000),
      dataFinal: new Date(),
    });

    // Auto-filter after collection
    const matched = await this.filterEngine.autoFilter();

    return JSON.stringify({
      coletados: result.totalColetados,
      novos: result.novos,
      atualizados: result.atualizados,
      erros: result.erros,
      tempoSegundos: (result.duracaoMs / 1000).toFixed(1),
      matched,
    });
  }

  private registerDocument(input: Record<string, unknown>): string {
    const doc = this.docManager.register({
      tipo: input.tipo as TipoDocumento,
      nome: input.nome as string,
      emissor: input.emissor as string,
      dataEmissao: input.dataEmissao as string | undefined,
      dataValidade: input.dataValidade as string | undefined,
      observacao: input.observacao as string | undefined,
    });

    return JSON.stringify({
      sucesso: true,
      documento: {
        id: doc.id,
        tipo: doc.tipo,
        nome: doc.nome,
        emissor: doc.emissor,
        status: doc.status,
        dataValidade: doc.dataValidade || 'sem vencimento',
      },
    });
  }

  private listDocuments(input: Record<string, unknown>): string {
    const docs = this.docManager.list({
      tipo: input.tipo as TipoDocumento | undefined,
      status: input.status as StatusDocumento | undefined,
    });

    return JSON.stringify({
      total: docs.length,
      documentos: docs.map((d) => ({
        id: d.id,
        tipo: d.tipo,
        nome: d.nome,
        emissor: d.emissor,
        status: d.status,
        dataValidade: d.dataValidade || 'sem vencimento',
        dataEmissao: d.dataEmissao,
      })),
    });
  }

  private async checkCompliance(input: Record<string, unknown>): Promise<string> {
    const id = input.licitacaoId as string;

    if (!this.complianceEngine) {
      return JSON.stringify({
        error: 'Chave de API necessaria para verificar compliance. Configure ia.apiKey no garimpoai.yaml.',
      });
    }

    try {
      const result = await this.complianceEngine.check(id);
      return JSON.stringify({
        score: result.score,
        parecer: result.parecer,
        resumo: result.resumo,
        itens: result.itens.map((item) => ({
          requisito: item.requisito,
          status: item.status,
          documento: item.documentoNome,
          observacao: item.observacao,
        })),
        _meta: {
          cached: result.cached,
          tokensUsados: result.tokensUsados,
          custoEstimado: `US$ ${result.custoEstimado.toFixed(4)}`,
        },
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return JSON.stringify({ error: msg });
    }
  }

  private exportData(input: Record<string, unknown>): string {
    const format = (input.format as string) === 'json' ? 'json' as const : 'csv' as const;
    const outputPath = (input.outputPath as string) || getExportFilename(format);
    const separator = this.config.export?.csvSeparator || ';';

    const filters = {
      keywords: input.keywords as string[] | undefined,
      uf: input.uf as string[] | undefined,
      valorMin: input.valorMin as number | undefined,
      valorMax: input.valorMax as number | undefined,
    };

    const result = exportLicitacoes(this.config.dataDir, filters, format, outputPath, separator);

    return JSON.stringify({
      sucesso: true,
      arquivo: result.path,
      formato: result.format.toUpperCase(),
      totalRegistros: result.count,
    });
  }

  private getExpiringDocuments(input: Record<string, unknown>): string {
    const dias = (input.dias as number) || 30;
    const result = checkExpiry(this.config.dataDir, dias);

    return JSON.stringify({
      vencendo: result.expiring.map((d) => ({
        id: d.id,
        nome: d.nome,
        tipo: d.tipo,
        dataValidade: d.dataValidade,
        status: d.status,
      })),
      vencidos: result.expired.map((d) => ({
        id: d.id,
        nome: d.nome,
        tipo: d.tipo,
        dataValidade: d.dataValidade,
      })),
      totalVencendo: result.expiring.length,
      totalVencidos: result.expired.length,
    });
  }
}
