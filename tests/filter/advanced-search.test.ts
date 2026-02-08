import { FilterEngine } from '../../src/filter/engine';
import { initializeDb, getDb, closeDb } from '../../src/database/connection';
import { licitacoes } from '../../src/database/schema';
import { GarimpoAIConfig } from '../../src/types/config';
import fs from 'fs';
import path from 'path';
import os from 'os';

let testDir: string;
let config: GarimpoAIConfig;

function makeConfig(dataDir: string): GarimpoAIConfig {
  return {
    pncp: { ufs: [], modalidades: [6, 8], keywords: ['software', 'tecnologia'] },
    alertas: {
      telegram: { enabled: false, botToken: '', chatId: '' },
      email: { enabled: false, smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '', from: '', to: '' },
    },
    ia: { provider: 'anthropic', apiKey: '', autoAnalyze: false, maxPerDay: 50, chatModel: '', analysisModel: '' },
    scheduler: { intervalMinutes: 30 },
    chat: { historyRetentionDays: 90, maxSessionsListed: 10 },
    dataDir,
  };
}

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'garimpoai-fts-'));
  config = makeConfig(testDir);
  initializeDb(testDir);

  const db = getDb(testDir);

  // Insert test data
  const items = [
    { id: 'FTS-001', objeto: 'Software de gestão financeira municipal', orgao: 'Prefeitura de Campinas', uf: 'SP' },
    { id: 'FTS-002', objeto: 'Tecnologia da informação para saúde', orgao: 'Hospital Municipal', uf: 'RJ' },
    { id: 'FTS-003', objeto: 'Manutenção de equipamentos médicos', orgao: 'Secretaria de Saúde', uf: 'MG' },
    { id: 'FTS-004', objeto: 'Software de controle de frotas e veículos', orgao: 'Departamento de Transportes', uf: 'SP' },
    { id: 'FTS-005', objeto: 'Aquisição de material de escritório', orgao: 'Câmara Municipal', uf: 'BA' },
  ];

  for (const item of items) {
    db.insert(licitacoes)
      .values({
        numeroControlePNCP: item.id,
        objetoCompra: item.objeto,
        valorTotalEstimado: 100000,
        modalidadeId: 6,
        modalidadeNome: 'Pregão - Eletrônico',
        anoCompra: 2026,
        sequencialCompra: 1,
        orgaoCnpj: '00000000000001',
        ufSigla: item.uf,
        orgaoRazaoSocial: item.orgao,
      })
      .run();
  }
});

afterEach(() => {
  closeDb();
  fs.rmSync(testDir, { recursive: true, force: true });
});

describe('hasAdvancedOperators', () => {
  it('should detect quoted strings', () => {
    expect(FilterEngine.hasAdvancedOperators('"software de gestao"')).toBe(true);
  });

  it('should detect AND operator', () => {
    expect(FilterEngine.hasAdvancedOperators('software AND saude')).toBe(true);
  });

  it('should detect NOT operator', () => {
    expect(FilterEngine.hasAdvancedOperators('software NOT escritorio')).toBe(true);
  });

  it('should detect wildcard', () => {
    expect(FilterEngine.hasAdvancedOperators('soft*')).toBe(true);
  });

  it('should return false for simple keywords', () => {
    expect(FilterEngine.hasAdvancedOperators('software tecnologia')).toBe(false);
  });

  it('should be case-insensitive for operators', () => {
    expect(FilterEngine.hasAdvancedOperators('software and saude')).toBe(true);
    expect(FilterEngine.hasAdvancedOperators('software not escritorio')).toBe(true);
  });
});

describe('advanced FTS5 search', () => {
  it('should search with exact phrase (quotes)', () => {
    const engine = new FilterEngine(config);
    const results = engine.searchFullText(['"gestão financeira"']);

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].objetoCompra).toContain('gestão financeira');
  });

  it('should search with AND operator', () => {
    const engine = new FilterEngine(config);
    const results = engine.searchFullText(['software AND financeira']);

    expect(results.length).toBe(1);
    expect(results[0].numeroControlePNCP).toBe('FTS-001');
  });

  it('should search with NOT operator', () => {
    const engine = new FilterEngine(config);
    const results = engine.searchFullText(['software NOT frotas']);

    expect(results.length).toBe(1);
    expect(results[0].numeroControlePNCP).toBe('FTS-001');
  });

  it('should search with wildcard prefix', () => {
    const engine = new FilterEngine(config);
    const results = engine.searchFullText(['soft*']);

    expect(results.length).toBe(2); // FTS-001 and FTS-004 both have "Software"
  });

  it('should fallback silently on invalid FTS5 syntax', () => {
    const engine = new FilterEngine(config);
    // Unbalanced quotes is invalid FTS5 syntax
    const results = engine.searchFullText(['"unclosed']);

    // Should not throw, returns empty or fallback results
    expect(Array.isArray(results)).toBe(true);
  });

  it('should still work with simple keywords (regression)', () => {
    const engine = new FilterEngine(config);
    const results = engine.searchFullText(['software']);

    expect(results.length).toBe(2); // FTS-001 and FTS-004
  });
});
