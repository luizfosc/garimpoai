import { analyzeBatch } from '../../src/analyzer/batch';
import { isLimitReached } from '../../src/analyzer/cost-tracker';
import { initializeDb, getDb, closeDb } from '../../src/database/connection';
import { licitacoes } from '../../src/database/schema';
import { GarimpoAIConfig } from '../../src/types/config';
import analysisFixture from '../fixtures/analysis-response.json';
import fs from 'fs';
import path from 'path';
import os from 'os';

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
              text: JSON.stringify(analysisFixture),
            },
          ],
          usage: {
            input_tokens: 1200,
            output_tokens: 800,
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

function insertTestLicitacoes(db: ReturnType<typeof getDb>, count: number) {
  for (let i = 1; i <= count; i++) {
    db.insert(licitacoes)
      .values({
        numeroControlePNCP: `BATCH-${String(i).padStart(3, '0')}`,
        objetoCompra: `Test licitacao ${i} for batch`,
        valorTotalEstimado: 100000 * i,
        modalidadeId: 6,
        modalidadeNome: 'Pregão - Eletrônico',
        anoCompra: 2026,
        sequencialCompra: i,
        orgaoCnpj: `0000000000000${i}`,
      })
      .run();
  }
}

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'garimpoai-batch-'));
  config = makeConfig(testDir);
  initializeDb(testDir);
});

afterEach(() => {
  closeDb();
  fs.rmSync(testDir, { recursive: true, force: true });
});

describe('analyzeBatch', () => {
  it('should analyze 3 licitacoes (1 chunk)', async () => {
    const db = getDb(testDir);
    insertTestLicitacoes(db, 3);

    const result = await analyzeBatch(
      ['BATCH-001', 'BATCH-002', 'BATCH-003'],
      config,
    );

    expect(result.completed).toBe(3);
    expect(result.total).toBe(3);
    expect(result.stoppedByLimit).toBe(false);
    expect(result.results).toHaveLength(3);
    expect(result.results[0].resumo).toBeDefined();
    expect(result.results[0].dificuldade).toBe('medio');
  });

  it('should analyze 7 licitacoes (3 chunks)', async () => {
    const db = getDb(testDir);
    insertTestLicitacoes(db, 7);

    const ids = Array.from({ length: 7 }, (_, i) => `BATCH-${String(i + 1).padStart(3, '0')}`);
    const result = await analyzeBatch(ids, config);

    expect(result.completed).toBe(7);
    expect(result.total).toBe(7);
    expect(result.results).toHaveLength(7);
  });

  it('should return cached results without new API call', async () => {
    const db = getDb(testDir);
    insertTestLicitacoes(db, 2);

    // First batch
    await analyzeBatch(['BATCH-001', 'BATCH-002'], config);

    // Second batch — should be cached
    const result = await analyzeBatch(['BATCH-001', 'BATCH-002'], config);
    expect(result.completed).toBe(2);
    expect(result.results[0].cached).toBe(true);
    expect(result.results[1].cached).toBe(true);
  });

  it('should stop when limit is reached', async () => {
    const db = getDb(testDir);
    insertTestLicitacoes(db, 5);

    // Set limit to 2
    const limitedConfig = { ...config, ia: { ...config.ia, maxPerDay: 2 } };

    const result = await analyzeBatch(
      ['BATCH-001', 'BATCH-002', 'BATCH-003', 'BATCH-004', 'BATCH-005'],
      limitedConfig,
    );

    // Should have completed some but not all (first chunk of 3, but limit is 2)
    // The first chunk processes all 3 in parallel, but 1 may hit the limit
    expect(result.total).toBe(5);
    expect(result.stoppedByLimit).toBe(true);
  });

  it('should handle non-existent IDs gracefully', async () => {
    const db = getDb(testDir);
    insertTestLicitacoes(db, 1);

    const result = await analyzeBatch(
      ['BATCH-001', 'NONEXISTENT-999'],
      config,
    );

    expect(result.results).toHaveLength(2);
    const success = result.results.find(r => r.id === 'BATCH-001');
    const failure = result.results.find(r => r.id === 'NONEXISTENT-999');
    expect(success?.resumo).toBeDefined();
    expect(failure?.error).toContain('nao encontrada');
  });

  it('should call onProgress callback', async () => {
    const db = getDb(testDir);
    insertTestLicitacoes(db, 2);

    const progressCalls: [number, number][] = [];
    await analyzeBatch(
      ['BATCH-001', 'BATCH-002'],
      config,
      (completed, total) => progressCalls.push([completed, total]),
    );

    expect(progressCalls.length).toBeGreaterThan(0);
    const lastCall = progressCalls[progressCalls.length - 1];
    expect(lastCall[1]).toBe(2); // total
  });
});
