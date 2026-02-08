import { exportLicitacoes, queryLicitacoesWithAnalysis, toCsv, toJson, getExportFilename } from '../../src/export/exporter';
import { initializeDb, getDb, closeDb } from '../../src/database/connection';
import { licitacoes, analises } from '../../src/database/schema';
import fs from 'fs';
import path from 'path';
import os from 'os';

let testDir: string;

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'garimpoai-export-'));
  initializeDb(testDir);

  const db = getDb(testDir);

  // Insert test licitacoes
  db.insert(licitacoes)
    .values([
      {
        numeroControlePNCP: 'EXPORT-001',
        objetoCompra: 'Contratação de software de gestão',
        valorTotalEstimado: 150000,
        modalidadeId: 6,
        modalidadeNome: 'Pregão - Eletrônico',
        anoCompra: 2026,
        sequencialCompra: 1,
        orgaoCnpj: '00000000000001',
        orgaoRazaoSocial: 'Prefeitura Municipal de São Paulo',
        ufSigla: 'SP',
        municipioNome: 'São Paulo',
        dataAberturaProposta: '2026-03-15',
        situacaoCompraNome: 'Publicada',
      },
      {
        numeroControlePNCP: 'EXPORT-002',
        objetoCompra: 'Aquisição de mobiliário escolar',
        valorTotalEstimado: 80000,
        modalidadeId: 8,
        modalidadeNome: 'Dispensa de Licitação',
        anoCompra: 2026,
        sequencialCompra: 2,
        orgaoCnpj: '00000000000002',
        orgaoRazaoSocial: 'Secretaria de Educação - RJ',
        ufSigla: 'RJ',
        municipioNome: 'Rio de Janeiro',
        dataAberturaProposta: '2026-03-20',
        situacaoCompraNome: 'Aberta',
      },
      {
        numeroControlePNCP: 'EXPORT-003',
        objetoCompra: 'Serviço de limpeza predial',
        valorTotalEstimado: 200000,
        modalidadeId: 6,
        modalidadeNome: 'Pregão - Eletrônico',
        anoCompra: 2026,
        sequencialCompra: 3,
        orgaoCnpj: '00000000000003',
        orgaoRazaoSocial: 'Tribunal Regional - MG',
        ufSigla: 'MG',
        municipioNome: 'Belo Horizonte',
        dataAberturaProposta: '2026-04-01',
        situacaoCompraNome: 'Publicada',
      },
    ])
    .run();

  // Insert analysis for first licitacao
  db.insert(analises)
    .values({
      licitacaoId: 'EXPORT-001',
      resumo: 'Software de gestão para prefeitura',
      dificuldade: 'medio',
      proximoPasso: 'Preparar documentação técnica',
      modelo: 'claude-sonnet-4-5-20250929',
    })
    .run();
});

afterEach(() => {
  closeDb();
  fs.rmSync(testDir, { recursive: true, force: true });
});

describe('queryLicitacoesWithAnalysis', () => {
  it('should return all licitacoes with LEFT JOIN on analises', () => {
    const rows = queryLicitacoesWithAnalysis(testDir, {});
    expect(rows).toHaveLength(3);

    // First row should have analysis data
    const withAnalysis = rows.find(r => r.numeroControlePNCP === 'EXPORT-001');
    expect(withAnalysis?.resumo).toBe('Software de gestão para prefeitura');
    expect(withAnalysis?.dificuldade).toBe('medio');

    // Second row should have null analysis
    const withoutAnalysis = rows.find(r => r.numeroControlePNCP === 'EXPORT-002');
    expect(withoutAnalysis?.resumo).toBeNull();
  });

  it('should filter by UF', () => {
    const rows = queryLicitacoesWithAnalysis(testDir, { uf: ['SP'] });
    expect(rows).toHaveLength(1);
    expect(rows[0].ufSigla).toBe('SP');
  });

  it('should filter by value range', () => {
    const rows = queryLicitacoesWithAnalysis(testDir, { valorMin: 100000 });
    expect(rows).toHaveLength(2);
  });

  it('should filter by keywords', () => {
    const rows = queryLicitacoesWithAnalysis(testDir, { keywords: ['software'] });
    expect(rows).toHaveLength(1);
    expect(rows[0].objetoCompra).toContain('software');
  });
});

describe('toCsv', () => {
  it('should generate CSV with BOM and semicolon separator', () => {
    const rows = queryLicitacoesWithAnalysis(testDir, {});
    const outputPath = path.join(testDir, 'test.csv');
    toCsv(rows, outputPath, ';');

    const content = fs.readFileSync(outputPath, 'utf-8');

    // Check BOM
    expect(content.charCodeAt(0)).toBe(0xFEFF);

    // Check separator
    const lines = content.substring(1).split('\n'); // skip BOM
    expect(lines[0]).toContain(';');
    expect(lines[0]).toContain('ID');
    expect(lines[0]).toContain('Objeto');

    // Data rows (header + 3 data rows)
    expect(lines).toHaveLength(4);
  });

  it('should escape fields containing separator or quotes', () => {
    const rows = [{
      numeroControlePNCP: 'TEST-001',
      objetoCompra: 'Item com "aspas" e ponto;virgula',
      orgaoRazaoSocial: 'Orgao',
      ufSigla: 'SP',
      municipioNome: 'Cidade',
      modalidadeNome: 'Pregão',
      valorTotalEstimado: 1000,
      dataAberturaProposta: '2026-01-01',
      situacaoCompraNome: 'Aberta',
      resumo: null,
      dificuldade: null,
      proximoPasso: null,
    }];

    const outputPath = path.join(testDir, 'escape.csv');
    toCsv(rows, outputPath, ';');

    const content = fs.readFileSync(outputPath, 'utf-8');
    // Escaped field should be wrapped in quotes with doubled internal quotes
    expect(content).toContain('"Item com ""aspas"" e ponto;virgula"');
  });
});

describe('toJson', () => {
  it('should generate indented JSON', () => {
    const rows = queryLicitacoesWithAnalysis(testDir, {});
    const outputPath = path.join(testDir, 'test.json');
    toJson(rows, outputPath);

    const content = fs.readFileSync(outputPath, 'utf-8');
    const parsed = JSON.parse(content);

    expect(parsed).toHaveLength(3);
    expect(parsed[0].numeroControlePNCP).toBeDefined();
    // Check indentation
    expect(content).toContain('  ');
  });
});

describe('exportLicitacoes', () => {
  it('should export CSV with correct count', () => {
    const outputPath = path.join(testDir, 'export.csv');
    const result = exportLicitacoes(testDir, {}, 'csv', outputPath);

    expect(result.count).toBe(3);
    expect(result.format).toBe('csv');
    expect(result.path).toBe(outputPath);
    expect(fs.existsSync(outputPath)).toBe(true);
  });

  it('should export JSON with filters applied', () => {
    const outputPath = path.join(testDir, 'export.json');
    const result = exportLicitacoes(testDir, { uf: ['RJ'] }, 'json', outputPath);

    expect(result.count).toBe(1);
    const data = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
    expect(data[0].ufSigla).toBe('RJ');
  });
});

describe('getExportFilename', () => {
  it('should generate timestamped filename', () => {
    const csv = getExportFilename('csv');
    expect(csv).toMatch(/^garimpoai-export-\d{4}-\d{2}-\d{2}\.csv$/);

    const json = getExportFilename('json');
    expect(json).toMatch(/^garimpoai-export-\d{4}-\d{2}-\d{2}\.json$/);
  });
});
