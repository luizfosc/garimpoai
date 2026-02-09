import { loadConfig } from '../config/loader';
import { initializeDb, getDb } from '../database/connection';
import {
  licitacoes,
  alertas,
  analises,
  coletas,
  notificacoesEnviadas,
  iaUsage,
  documentosEmpresa,
  complianceChecks,
  complianceItems,
} from '../database/schema';
import { FilterEngine, FilterResult } from '../filter/engine';
import { createBackup, formatSize, getBackupPath } from '../backup/backup';
import { getTodayUsage } from '../analyzer/cost-tracker';
import { listSearches } from '../filter/search-history';
import { DocumentManager } from '../documents/manager';
import { eq, desc, sql, and } from 'drizzle-orm';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import fs from 'fs';
import type Database from 'better-sqlite3';

// ─── Config & Init ───────────────────────────────────────────────────────────

const config = loadConfig();
initializeDb(config.dataDir);

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper: get raw better-sqlite3 instance from drizzle
function getSqlite(): Database.Database {
  const db = getDb(config.dataDir);
  return (db as unknown as { session: { client: Database.Database } }).session
    .client;
}

// ─── API Routes ──────────────────────────────────────────────────────────────

// GET /api/stats — overview statistics
app.get('/api/stats', (_req: Request, res: Response) => {
  try {
    const engine = new FilterEngine(config);
    const stats = engine.getStats();
    const usage = getTodayUsage(config.dataDir);

    const db = getDb(config.dataDir);
    const alertCount =
      db
        .select({ count: sql<number>`count(*)` })
        .from(alertas)
        .get()?.count ?? 0;
    const alertasAtivos =
      db
        .select({ count: sql<number>`count(*)` })
        .from(alertas)
        .where(eq(alertas.ativo, true))
        .get()?.count ?? 0;
    const docCount =
      db
        .select({ count: sql<number>`count(*)` })
        .from(documentosEmpresa)
        .get()?.count ?? 0;

    res.json({
      ...stats,
      alertas: alertCount,
      alertasAtivos,
      documentos: docCount,
      iaUsageHoje: usage,
      dataDir: config.dataDir,
    });
  } catch (error) {
    res
      .status(500)
      .json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
  }
});

// GET /api/licitacoes — search with query params
app.get('/api/licitacoes', (req: Request, res: Response) => {
  try {
    const { keywords, uf, valorMin, valorMax, limit, offset } =
      req.query as Record<string, string | undefined>;

    const engine = new FilterEngine(config);
    const results = engine.search({
      keywords: keywords ? keywords.split(',') : undefined,
      uf: uf ? uf.split(',') : undefined,
      valorMin: valorMin ? Number(valorMin) : undefined,
      valorMax: valorMax ? Number(valorMax) : undefined,
      limit: Number(limit) || 20,
      offset: Number(offset) || 0,
    });

    res.json(results);
  } catch (error) {
    res
      .status(500)
      .json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
  }
});

// GET /api/licitacoes/:id — single licitacao with analysis
app.get('/api/licitacoes/:id', (req: Request, res: Response) => {
  try {
    const db = getDb(config.dataDir);
    const sqlite = (
      db as unknown as { session: { client: import('better-sqlite3').Database } }
    ).session.client;

    const row = sqlite
      .prepare(
        `
      SELECT l.*, a.resumo as analise_resumo, a.o_que_e, a.dificuldade, a.dica_iniciante, a.proximo_passo,
             a.documentos_necessarios, a.requisitos_habilitacao, a.justificativa_dificuldade, a.prazo_proposta, a.valor_estimado
      FROM licitacoes l
      LEFT JOIN analises a ON a.licitacao_id = l.numero_controle_pncp
      WHERE l.numero_controle_pncp = ?
    `
      )
      .get(req.params.id);

    if (!row) {
      res.status(404).json({ error: 'Licitacao not found' });
      return;
    }

    res.json(row);
  } catch (error) {
    res
      .status(500)
      .json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
  }
});

// GET /api/alertas — list all alerts
app.get('/api/alertas', (_req: Request, res: Response) => {
  try {
    const db = getDb(config.dataDir);
    const items = db.select().from(alertas).all();

    // Parse JSON fields for the response
    const parsed = items.map((item) => ({
      ...item,
      keywords: item.keywords ? JSON.parse(item.keywords) : [],
      ufs: item.ufs ? JSON.parse(item.ufs) : null,
      modalidades: item.modalidades ? JSON.parse(item.modalidades) : null,
    }));

    res.json(parsed);
  } catch (error) {
    res
      .status(500)
      .json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
  }
});

// POST /api/alertas — create a new alert
app.post('/api/alertas', (req: Request, res: Response) => {
  try {
    const { nome, keywords, ufs, valorMinimo, valorMaximo, canal } = req.body;

    if (!nome || !keywords || !Array.isArray(keywords)) {
      res.status(400).json({ error: 'nome and keywords (array) are required' });
      return;
    }

    const db = getDb(config.dataDir);
    db.insert(alertas)
      .values({
        nome,
        keywords: JSON.stringify(keywords),
        ufs: ufs ? JSON.stringify(ufs) : null,
        valorMinimo: valorMinimo ?? null,
        valorMaximo: valorMaximo ?? null,
        canal: canal || 'telegram',
      })
      .run();

    res.status(201).json({ success: true });
  } catch (error) {
    res
      .status(500)
      .json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
  }
});

// PATCH /api/alertas/:id — toggle alert active status
app.patch('/api/alertas/:id', (req: Request, res: Response) => {
  try {
    const db = getDb(config.dataDir);
    db.update(alertas)
      .set({ ativo: req.body.ativo })
      .where(eq(alertas.id, Number(req.params.id)))
      .run();

    res.json({ success: true });
  } catch (error) {
    res
      .status(500)
      .json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
  }
});

// GET /api/alertas/:id/scores — semantic scores for an alert
app.get('/api/alertas/:id/scores', (req: Request, res: Response) => {
  try {
    const sqlite = getSqlite();
    const scores = sqlite
      .prepare(
        `
      SELECT as2.*, l.objeto_compra FROM alert_scores as2
      JOIN licitacoes l ON l.numero_controle_pncp = as2.licitacao_id
      WHERE as2.alerta_id = ? ORDER BY as2.semantic_score DESC LIMIT 20
    `
      )
      .all(Number(req.params.id));

    res.json(scores);
  } catch (error) {
    res
      .status(500)
      .json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
  }
});

// GET /api/documentos — list company documents + expiring
app.get('/api/documentos', (_req: Request, res: Response) => {
  try {
    const docManager = new DocumentManager(config.dataDir);
    const docs = docManager.list();
    res.json(docs);
  } catch (error) {
    res
      .status(500)
      .json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
  }
});

app.get('/api/documentos/expiring', (_req: Request, res: Response) => {
  try {
    const docManager = new DocumentManager(config.dataDir);
    const expiring = docManager.getExpiring(30);
    res.json(expiring);
  } catch (error) {
    res
      .status(500)
      .json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
  }
});

// GET /api/compliance/:licitacaoId — compliance check for a licitacao
app.get('/api/compliance/:licitacaoId', (req: Request, res: Response) => {
  try {
    const db = getDb(config.dataDir);
    const check = db
      .select()
      .from(complianceChecks)
      .where(eq(complianceChecks.licitacaoId, req.params.licitacaoId))
      .orderBy(desc(complianceChecks.criadoEm))
      .get();

    if (!check) {
      res.status(404).json({ error: 'No compliance check found' });
      return;
    }

    const items = db
      .select()
      .from(complianceItems)
      .where(eq(complianceItems.checkId, check.id))
      .all();

    res.json({ ...check, items });
  } catch (error) {
    res
      .status(500)
      .json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
  }
});

// GET /api/custos — AI cost tracking (today + last 7 days)
app.get('/api/custos', (_req: Request, res: Response) => {
  try {
    const usage = getTodayUsage(config.dataDir);
    const sqlite = getSqlite();
    const history = sqlite
      .prepare(
        `
      SELECT data, tipo, SUM(tokens_input) as tokens_in, SUM(tokens_output) as tokens_out,
             SUM(custo_estimado) as custo
      FROM ia_usage WHERE data >= date('now', '-7 days')
      GROUP BY data, tipo ORDER BY data DESC
    `
      )
      .all();

    res.json({ hoje: usage, historico: history });
  } catch (error) {
    res
      .status(500)
      .json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
  }
});

// GET /api/buscas — recent search history
app.get('/api/buscas', (_req: Request, res: Response) => {
  try {
    const searches = listSearches(config.dataDir, 10);
    res.json(searches);
  } catch (error) {
    res
      .status(500)
      .json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
  }
});

// POST /api/backup — create a database backup
app.post('/api/backup', (_req: Request, res: Response) => {
  try {
    const result = createBackup(config.dataDir);
    res.json({
      success: true,
      path: result.path,
      size: formatSize(result.sizeBytes),
      durationMs: result.durationMs,
    });
  } catch (error) {
    res
      .status(500)
      .json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
  }
});

// GET /api/backups — list existing backups
app.get('/api/backups', (_req: Request, res: Response) => {
  try {
    const backupsDir = path.join(config.dataDir, 'backups');

    if (!fs.existsSync(backupsDir)) {
      res.json([]);
      return;
    }

    const files = fs
      .readdirSync(backupsDir)
      .filter((f) => f.endsWith('.db'))
      .map((f) => {
        const stat = fs.statSync(path.join(backupsDir, f));
        return {
          name: f,
          size: formatSize(stat.size),
          date: stat.mtime.toISOString(),
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    res.json(files);
  } catch (error) {
    res
      .status(500)
      .json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
  }
});

// GET /api/coletas — recent collection runs
app.get('/api/coletas', (_req: Request, res: Response) => {
  try {
    const db = getDb(config.dataDir);
    const items = db
      .select()
      .from(coletas)
      .orderBy(desc(coletas.iniciadoEm))
      .limit(10)
      .all();

    res.json(items);
  } catch (error) {
    res
      .status(500)
      .json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
  }
});

// GET /api/chat/sessions — recent chat sessions
app.get('/api/chat/sessions', (_req: Request, res: Response) => {
  try {
    const sqlite = getSqlite();
    const sessions = sqlite
      .prepare(
        `
      SELECT session_id, MIN(timestamp) as started, MAX(timestamp) as last_msg, COUNT(*) as messages
      FROM chat_history GROUP BY session_id ORDER BY last_msg DESC LIMIT 10
    `
      )
      .all();

    res.json(sessions);
  } catch (error) {
    res
      .status(500)
      .json({
        error: error instanceof Error ? error.message : 'Unknown error',
      });
  }
});

// ─── SPA Fallback ────────────────────────────────────────────────────────────

app.use((_req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ─── Start Server ────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`GarimpoAI Dashboard: http://localhost:${PORT}`);
  console.log(`Data: ${config.dataDir}`);
});

export default app;
