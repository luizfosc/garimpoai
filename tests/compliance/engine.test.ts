import { ComplianceEngine } from '../../src/compliance/engine';
import { DocumentManager } from '../../src/documents/manager';
import { initializeDb, getDb, closeDb } from '../../src/database/connection';
import { licitacoes, complianceChecks } from '../../src/database/schema';
import { GarimpoAIConfig } from '../../src/types/config';
import { recordUsage, getTodayUsage } from '../../src/analyzer/cost-tracker';
import complianceFixture from '../fixtures/compliance-response.json';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { eq } from 'drizzle-orm';

// Mock Anthropic SDK
jest.mock('@anthropic-ai/sdk', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      messages: {
        create: jest.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: JSON.stringify(complianceFixture),
            },
          ],
          usage: {
            input_tokens: 1500,
            output_tokens: 600,
          },
        }),
      },
    })),
  };
});

let testDir: string;
let config: GarimpoAIConfig;

function makeConfig(dataDir: string): GarimpoAIConfig {
  return {
    pncp: { ufs: [], modalidades: [6], keywords: ['software'] },
    alertas: {
      telegram: { enabled: false, botToken: '', chatId: '' },
      email: { enabled: false, smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '', from: '', to: '' },
    },
    ia: {
      provider: 'anthropic',
      apiKey: 'test-key',
      autoAnalyze: true,
      maxPerDay: 50,
      chatModel: 'claude-haiku-4-5-20251001',
      analysisModel: 'claude-sonnet-4-5-20250929',
    },
    scheduler: { intervalMinutes: 30 },
    chat: { historyRetentionDays: 90, maxSessionsListed: 10 },
    dataDir,
  };
}

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'garimpoai-compliance-test-'));
  config = makeConfig(testDir);
  initializeDb(testDir);

  // Insert test licitacao
  const db = getDb(testDir);
  db.insert(licitacoes)
    .values({
      numeroControlePNCP: 'TEST-COMP-001',
      objetoCompra: 'Contratação de serviço de desenvolvimento de software',
      valorTotalEstimado: 500000,
      modalidadeId: 6,
      modalidadeNome: 'Pregão - Eletrônico',
      anoCompra: 2026,
      sequencialCompra: 1,
      orgaoCnpj: '00000000000001',
      ufSigla: 'SP',
      orgaoRazaoSocial: 'Ministério da Economia',
      dataPublicacaoPncp: '2026-02-07',
    })
    .run();

  // Register company documents
  const docManager = new DocumentManager(testDir);
  docManager.register({
    tipo: 'certidao_federal',
    nome: 'CND Federal',
    emissor: 'Receita Federal',
    dataValidade: '2027-06-30',
  });
  docManager.register({
    tipo: 'certidao_fgts',
    nome: 'CRF FGTS',
    emissor: 'CEF',
    dataValidade: '2027-06-30',
  });
  docManager.register({
    tipo: 'atestado_capacidade',
    nome: 'Atestado Projeto X',
    emissor: 'Cliente ABC',
    dataValidade: '2027-12-31',
  });
});

afterEach(() => {
  closeDb();
  fs.rmSync(testDir, { recursive: true, force: true });
});

describe('ComplianceEngine', () => {
  it('should check compliance and return structured result', async () => {
    const engine = new ComplianceEngine(config);
    const result = await engine.check('TEST-COMP-001');

    expect(result.cached).toBe(false);
    expect(result.score).toBe(75);
    expect(result.parecer).toBe('parcialmente_apto');
    expect(result.resumo).toBeDefined();
    expect(result.itens).toHaveLength(4);
    expect(result.tokensUsados).toBe(2100);
    expect(result.custoEstimado).toBeGreaterThan(0);
  });

  it('should return cached result on second call', async () => {
    const engine = new ComplianceEngine(config);

    await engine.check('TEST-COMP-001');
    const result = await engine.check('TEST-COMP-001');

    expect(result.cached).toBe(true);
    expect(result.score).toBe(75);
  });

  it('should throw on non-existent licitacao', async () => {
    const engine = new ComplianceEngine(config);

    await expect(engine.check('NONEXISTENT')).rejects.toThrow('nao encontrada');
  });

  it('should return inapto when no documents registered', async () => {
    // Clear all documents
    const db = getDb(testDir);
    const { documentosEmpresa } = require('../../src/database/schema');
    db.delete(documentosEmpresa).run();

    const engine = new ComplianceEngine(config);
    const result = await engine.check('TEST-COMP-001');

    expect(result.score).toBe(0);
    expect(result.parecer).toBe('inapto');
    expect(result.cached).toBe(false);
  });

  it('should match compliance items with company documents', async () => {
    const engine = new ComplianceEngine(config);
    const result = await engine.check('TEST-COMP-001');

    // The fixture has certidao_federal as first item
    const federalItem = result.itens.find((i) => i.requisito.includes('Federais'));
    expect(federalItem).toBeDefined();
    expect(federalItem!.documentoEmpresaId).toBeDefined();
    expect(federalItem!.documentoNome).toBe('CND Federal');
  });

  it('should save compliance check to database', async () => {
    const engine = new ComplianceEngine(config);
    await engine.check('TEST-COMP-001');

    const db = getDb(testDir);
    const saved = db
      .select()
      .from(complianceChecks)
      .where(eq(complianceChecks.licitacaoId, 'TEST-COMP-001'))
      .get();

    expect(saved).toBeDefined();
    expect(saved!.score).toBe(75);
    expect(saved!.parecer).toBe('parcialmente_apto');
  });

  it('should track usage as compliance type', async () => {
    const engine = new ComplianceEngine(config);
    await engine.check('TEST-COMP-001');

    const usage = getTodayUsage(testDir);
    expect(usage.totalCompliance).toBe(1);
  });

  it('should respect daily limit', async () => {
    // Fill up the limit
    for (let i = 0; i < 50; i++) {
      recordUsage(testDir, 'analysis', 'test', 100, 50, 0.001);
    }

    const engine = new ComplianceEngine(config);
    await expect(engine.check('TEST-COMP-001')).rejects.toThrow('Limite diario');
  });
});
