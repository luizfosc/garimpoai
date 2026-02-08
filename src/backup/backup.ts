import fs from 'fs';
import path from 'path';
import { getDb } from '../database/connection';
import Database from 'better-sqlite3';

const MAX_BACKUPS = 5;

/** Get raw sqlite instance from drizzle */
function getSqlite(dataDir: string): Database.Database {
  const db = getDb(dataDir);
  return (db as unknown as { session: { client: Database.Database } }).session.client;
}

/** Generate backup file path with timestamp */
export function getBackupPath(dataDir: string): string {
  const backupsDir = path.join(dataDir, 'backups');
  if (!fs.existsSync(backupsDir)) {
    fs.mkdirSync(backupsDir, { recursive: true });
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  return path.join(backupsDir, `backup-${timestamp}.db`);
}

/** Create a backup of the database */
export function createBackup(dataDir: string, outputPath?: string): { path: string; sizeBytes: number; durationMs: number } {
  const startTime = Date.now();
  const dbPath = path.join(dataDir, 'garimpoai.db');

  if (!fs.existsSync(dbPath)) {
    throw new Error(`Database not found: ${dbPath}`);
  }

  // WAL checkpoint to flush all pending writes
  const sqlite = getSqlite(dataDir);
  sqlite.pragma('wal_checkpoint(RESTART)');

  const backupPath = outputPath || getBackupPath(dataDir);
  const backupDir = path.dirname(backupPath);
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  fs.copyFileSync(dbPath, backupPath);

  // Rotate backups if using default directory
  if (!outputPath) {
    rotateBackups(path.join(dataDir, 'backups'), MAX_BACKUPS);
  }

  const sizeBytes = fs.statSync(backupPath).size;
  const durationMs = Date.now() - startTime;

  return { path: backupPath, sizeBytes, durationMs };
}

/** Rotate backups, keeping only maxBackups most recent */
export function rotateBackups(backupsDir: string, maxBackups: number = MAX_BACKUPS): number {
  if (!fs.existsSync(backupsDir)) return 0;

  const files = fs.readdirSync(backupsDir)
    .filter(f => f.startsWith('backup-') && f.endsWith('.db'))
    .sort();

  let deleted = 0;
  while (files.length > maxBackups) {
    const oldest = files.shift()!;
    fs.unlinkSync(path.join(backupsDir, oldest));
    deleted++;
  }

  return deleted;
}

/** Format file size for display */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
