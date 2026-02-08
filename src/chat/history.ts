import { getDb } from '../database/connection';
import Database from 'better-sqlite3';

export interface ChatSession {
  sessionId: string;
  messageCount: number;
  lastTimestamp: string;
  preview: string;
}

export interface ChatMessage {
  id: number;
  sessionId: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

/** Get raw sqlite instance from drizzle */
function getSqlite(dataDir: string): Database.Database {
  const db = getDb(dataDir);
  return (db as unknown as { session: { client: Database.Database } }).session.client;
}

/** Save a chat message to history */
export function saveMessage(dataDir: string, sessionId: string, role: 'user' | 'assistant', content: string): void {
  const sqlite = getSqlite(dataDir);
  sqlite.prepare(
    'INSERT INTO chat_history (session_id, role, content) VALUES (?, ?, ?)'
  ).run(sessionId, role, content);
}

/** List recent chat sessions with preview */
export function listSessions(dataDir: string, limit: number = 10): ChatSession[] {
  const sqlite = getSqlite(dataDir);
  const rows = sqlite.prepare(`
    SELECT
      session_id as sessionId,
      COUNT(*) as messageCount,
      MAX(timestamp) as lastTimestamp,
      (SELECT content FROM chat_history ch2
       WHERE ch2.session_id = ch.session_id AND ch2.role = 'user'
       ORDER BY ch2.id ASC LIMIT 1) as preview
    FROM chat_history ch
    GROUP BY session_id
    ORDER BY MAX(timestamp) DESC
    LIMIT ?
  `).all(limit) as ChatSession[];

  return rows;
}

/** Load all messages from a specific session */
export function loadSession(dataDir: string, sessionId: string): ChatMessage[] {
  const sqlite = getSqlite(dataDir);
  const rows = sqlite.prepare(
    'SELECT id, session_id as sessionId, role, content, timestamp FROM chat_history WHERE session_id = ? ORDER BY id ASC'
  ).all(sessionId) as ChatMessage[];

  return rows;
}

/** Delete chat history older than retentionDays */
export function cleanupOldSessions(dataDir: string, retentionDays: number): number {
  const sqlite = getSqlite(dataDir);
  const result = sqlite.prepare(
    `DELETE FROM chat_history WHERE timestamp < datetime('now', '-' || ? || ' days')`
  ).run(retentionDays);

  return result.changes;
}
