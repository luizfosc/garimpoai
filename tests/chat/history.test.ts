import { saveMessage, listSessions, loadSession, cleanupOldSessions } from '../../src/chat/history';
import { initializeDb, getDb, closeDb } from '../../src/database/connection';
import fs from 'fs';
import path from 'path';
import os from 'os';

let testDir: string;

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'garimpoai-test-'));
  initializeDb(testDir);
});

afterEach(() => {
  closeDb();
  fs.rmSync(testDir, { recursive: true, force: true });
});

describe('saveMessage', () => {
  it('should save a user message', () => {
    saveMessage(testDir, 'session-1', 'user', 'Ola, quero buscar licitacoes');

    const sqlite = (getDb(testDir) as unknown as { session: { client: any } }).session.client;
    const rows = sqlite.prepare('SELECT * FROM chat_history WHERE session_id = ?').all('session-1');

    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe('user');
    expect(rows[0].content).toBe('Ola, quero buscar licitacoes');
  });

  it('should save both user and assistant messages', () => {
    saveMessage(testDir, 'session-1', 'user', 'Pergunta');
    saveMessage(testDir, 'session-1', 'assistant', 'Resposta');

    const sqlite = (getDb(testDir) as unknown as { session: { client: any } }).session.client;
    const rows = sqlite.prepare('SELECT * FROM chat_history WHERE session_id = ? ORDER BY id').all('session-1');

    expect(rows).toHaveLength(2);
    expect(rows[0].role).toBe('user');
    expect(rows[1].role).toBe('assistant');
  });
});

describe('listSessions', () => {
  it('should return empty array when no sessions exist', () => {
    const sessions = listSessions(testDir);
    expect(sessions).toHaveLength(0);
  });

  it('should list sessions with preview and count', () => {
    // Insert with explicit timestamps to guarantee ordering
    const sqlite = (getDb(testDir) as unknown as { session: { client: any } }).session.client;
    sqlite.prepare(
      "INSERT INTO chat_history (session_id, role, content, timestamp) VALUES (?, ?, ?, '2026-01-01 10:00:00')"
    ).run('session-a', 'user', 'Primeira pergunta');
    sqlite.prepare(
      "INSERT INTO chat_history (session_id, role, content, timestamp) VALUES (?, ?, ?, '2026-01-01 10:01:00')"
    ).run('session-a', 'assistant', 'Primeira resposta');
    sqlite.prepare(
      "INSERT INTO chat_history (session_id, role, content, timestamp) VALUES (?, ?, ?, '2026-01-01 11:00:00')"
    ).run('session-b', 'user', 'Segunda pergunta');

    const sessions = listSessions(testDir);

    expect(sessions).toHaveLength(2);
    // Most recent first
    expect(sessions[0].sessionId).toBe('session-b');
    expect(sessions[0].messageCount).toBe(1);
    expect(sessions[0].preview).toBe('Segunda pergunta');

    expect(sessions[1].sessionId).toBe('session-a');
    expect(sessions[1].messageCount).toBe(2);
    expect(sessions[1].preview).toBe('Primeira pergunta');
  });

  it('should respect limit parameter', () => {
    saveMessage(testDir, 'session-1', 'user', 'Msg 1');
    saveMessage(testDir, 'session-2', 'user', 'Msg 2');
    saveMessage(testDir, 'session-3', 'user', 'Msg 3');

    const sessions = listSessions(testDir, 2);
    expect(sessions).toHaveLength(2);
  });
});

describe('loadSession', () => {
  it('should return empty array for non-existent session', () => {
    const messages = loadSession(testDir, 'nonexistent');
    expect(messages).toHaveLength(0);
  });

  it('should load all messages in order', () => {
    saveMessage(testDir, 'session-x', 'user', 'Pergunta 1');
    saveMessage(testDir, 'session-x', 'assistant', 'Resposta 1');
    saveMessage(testDir, 'session-x', 'user', 'Pergunta 2');
    saveMessage(testDir, 'session-x', 'assistant', 'Resposta 2');

    const messages = loadSession(testDir, 'session-x');

    expect(messages).toHaveLength(4);
    expect(messages[0].role).toBe('user');
    expect(messages[0].content).toBe('Pergunta 1');
    expect(messages[1].role).toBe('assistant');
    expect(messages[3].content).toBe('Resposta 2');
    expect(messages[0].sessionId).toBe('session-x');
  });
});

describe('cleanupOldSessions', () => {
  it('should delete messages older than retention days', () => {
    // Insert a message with old timestamp manually
    const sqlite = (getDb(testDir) as unknown as { session: { client: any } }).session.client;
    sqlite.prepare(
      "INSERT INTO chat_history (session_id, role, content, timestamp) VALUES (?, ?, ?, datetime('now', '-100 days'))"
    ).run('old-session', 'user', 'Mensagem antiga');

    // Insert a recent message
    saveMessage(testDir, 'new-session', 'user', 'Mensagem recente');

    const deleted = cleanupOldSessions(testDir, 90);

    expect(deleted).toBe(1);

    // Verify only new message remains
    const remaining = sqlite.prepare('SELECT COUNT(*) as count FROM chat_history').get() as { count: number };
    expect(remaining.count).toBe(1);
  });

  it('should return 0 when nothing to clean', () => {
    saveMessage(testDir, 'session-1', 'user', 'Mensagem recente');
    const deleted = cleanupOldSessions(testDir, 90);
    expect(deleted).toBe(0);
  });
});

describe('session_id format', () => {
  it('should accept UUID v4 format', () => {
    const uuid = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
    saveMessage(testDir, uuid, 'user', 'Test message');

    const sessions = listSessions(testDir);
    expect(sessions[0].sessionId).toBe(uuid);
  });
});
