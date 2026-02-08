import { getDb } from '../database/connection';
import Database from 'better-sqlite3';

export interface SearchRecord {
  id: number;
  query: string;
  filters: string | null;
  resultsCount: number;
  timestamp: string;
}

/** Get raw sqlite instance from drizzle */
function getSqlite(dataDir: string): Database.Database {
  const db = getDb(dataDir);
  return (db as unknown as { session: { client: Database.Database } }).session.client;
}

/** Record a search in history */
export function recordSearch(
  dataDir: string,
  query: string,
  filters: Record<string, unknown> | null,
  resultsCount: number
): void {
  const sqlite = getSqlite(dataDir);
  sqlite.prepare(
    'INSERT INTO search_history (query, filters, results_count) VALUES (?, ?, ?)'
  ).run(query, filters ? JSON.stringify(filters) : null, resultsCount);
}

/** List recent searches */
export function listSearches(dataDir: string, limit: number = 20): SearchRecord[] {
  const sqlite = getSqlite(dataDir);
  return sqlite.prepare(`
    SELECT id, query, filters, results_count as resultsCount, timestamp
    FROM search_history
    ORDER BY timestamp DESC, id DESC
    LIMIT ?
  `).all(limit) as SearchRecord[];
}

/** Get a specific search by id */
export function getSearch(dataDir: string, id: number): SearchRecord | null {
  const sqlite = getSqlite(dataDir);
  const row = sqlite.prepare(
    'SELECT id, query, filters, results_count as resultsCount, timestamp FROM search_history WHERE id = ?'
  ).get(id) as SearchRecord | undefined;
  return row || null;
}
