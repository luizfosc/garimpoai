import { regexFallbackScore, getCachedScore, cacheScore, classifyRelevance } from '../../src/notifier/smart';
import { ScoredMatch } from '../../src/notifier/templates';
import { FilterResult } from '../../src/filter/engine';
import { initializeDb, getDb, closeDb } from '../../src/database/connection';
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
              text: '{"score": 85, "resumo": "Altamente relevante para software"}',
            },
          ],
          usage: {
            input_tokens: 200,
            output_tokens: 50,
          },
        }),
      },
    })),
  };
});

let testDir: string;

const mockMatch: FilterResult = {
  id: 1,
  numeroControlePNCP: 'SMART-001',
  objetoCompra: 'Contratação de software de gestão empresarial e tecnologia da informação',
  valorTotalEstimado: 250000,
  modalidadeNome: 'Pregão - Eletrônico',
  ufSigla: 'SP',
  municipioNome: 'São Paulo',
  orgaoRazaoSocial: 'Secretaria de Tecnologia',
  dataAberturaProposta: '2026-03-01',
  dataPublicacaoPncp: '2026-02-07',
  matchScore: 1,
  analisado: false,
};

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'garimpoai-smart-'));
  initializeDb(testDir);
});

afterEach(() => {
  closeDb();
  fs.rmSync(testDir, { recursive: true, force: true });
});

describe('regexFallbackScore', () => {
  it('should return 100 when all keywords match', () => {
    const result = regexFallbackScore(mockMatch, ['software', 'tecnologia']);
    expect(result.score).toBe(100);
    expect(result.resumo).toContain('Todas as palavras-chave');
    expect(result.cached).toBe(false);
  });

  it('should return 50 when partial keywords match', () => {
    const result = regexFallbackScore(mockMatch, ['software', 'construção']);
    expect(result.score).toBe(50);
    expect(result.resumo).toContain('1/2');
  });

  it('should return 0 when no keywords match', () => {
    const result = regexFallbackScore(mockMatch, ['construção', 'obras']);
    expect(result.score).toBe(0);
    expect(result.resumo).toContain('Nenhuma');
  });

  it('should be case-insensitive', () => {
    const result = regexFallbackScore(mockMatch, ['SOFTWARE', 'TECNOLOGIA']);
    expect(result.score).toBe(100);
  });
});

describe('cacheScore / getCachedScore', () => {
  it('should return null for uncached score', () => {
    const result = getCachedScore(testDir, 1, 'NONEXISTENT');
    expect(result).toBeNull();
  });

  it('should cache and retrieve a score', () => {
    // First insert the alertas table entry
    const db = getDb(testDir);
    const sqlite = (db as unknown as { session: { client: { prepare: (sql: string) => { run: (...args: unknown[]) => void } } } }).session.client;
    sqlite.prepare('INSERT INTO alertas (nome, keywords) VALUES (?, ?)').run('Test Alert', '["software"]');

    cacheScore(testDir, 1, 'SMART-001', 85, 'Muito relevante');

    const result = getCachedScore(testDir, 1, 'SMART-001');
    expect(result).not.toBeNull();
    expect(result!.score).toBe(85);
    expect(result!.resumo).toBe('Muito relevante');
    expect(result!.cached).toBe(true);
  });

  it('should update cached score on re-insert', () => {
    const db = getDb(testDir);
    const sqlite = (db as unknown as { session: { client: { prepare: (sql: string) => { run: (...args: unknown[]) => void } } } }).session.client;
    sqlite.prepare('INSERT INTO alertas (nome, keywords) VALUES (?, ?)').run('Test Alert', '["software"]');

    cacheScore(testDir, 1, 'SMART-001', 60, 'Initial');
    cacheScore(testDir, 1, 'SMART-001', 90, 'Updated');

    const result = getCachedScore(testDir, 1, 'SMART-001');
    expect(result!.score).toBe(90);
    expect(result!.resumo).toBe('Updated');
  });
});

describe('classifyRelevance', () => {
  it('should call Anthropic API and return parsed score', async () => {
    const result = await classifyRelevance(
      mockMatch,
      ['software', 'tecnologia'],
      'test-api-key',
      'claude-haiku-4-5-20251001',
      testDir,
    );

    expect(result.score).toBe(85);
    expect(result.resumo).toBe('Altamente relevante para software');
    expect(result.cached).toBe(false);
  });

  it('should clamp score to 0-100 range', async () => {
    // Override mock for this test
    const Anthropic = require('@anthropic-ai/sdk').default;
    Anthropic.mockImplementationOnce(() => ({
      messages: {
        create: jest.fn().mockResolvedValue({
          content: [{ type: 'text', text: '{"score": 150, "resumo": "Overflow"}' }],
          usage: { input_tokens: 100, output_tokens: 30 },
        }),
      },
    }));

    const result = await classifyRelevance(mockMatch, ['software'], 'test-key', 'claude-haiku-4-5-20251001', testDir);
    expect(result.score).toBe(100);
  });

  it('should return score 50 on invalid JSON response', async () => {
    const Anthropic = require('@anthropic-ai/sdk').default;
    Anthropic.mockImplementationOnce(() => ({
      messages: {
        create: jest.fn().mockResolvedValue({
          content: [{ type: 'text', text: 'This is not valid JSON at all' }],
          usage: { input_tokens: 100, output_tokens: 30 },
        }),
      },
    }));

    const result = await classifyRelevance(mockMatch, ['software'], 'test-key', 'claude-haiku-4-5-20251001', testDir);
    expect(result.score).toBe(50);
    expect(result.resumo).toContain('Erro');
  });
});

describe('ScoredMatch type', () => {
  it('should extend FilterResult with score fields', () => {
    const scored: ScoredMatch = {
      ...mockMatch,
      semanticScore: 85,
      semanticResumo: 'Relevant',
    };

    expect(scored.semanticScore).toBe(85);
    expect(scored.semanticResumo).toBe('Relevant');
    expect(scored.objetoCompra).toBe(mockMatch.objetoCompra);
  });
});
