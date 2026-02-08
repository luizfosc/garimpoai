import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { closeDb, getDb, initializeDb } from '../database/connection';

const SQLITE_HEADER = 'SQLite format 3';

/** Validate that a file is a valid SQLite database */
export function validateBackupFile(filePath: string): { valid: boolean; error?: string } {
  if (!fs.existsSync(filePath)) {
    return { valid: false, error: `File not found: ${filePath}` };
  }

  const stat = fs.statSync(filePath);
  if (stat.size < 100) {
    return { valid: false, error: 'File too small to be a valid SQLite database' };
  }

  // Check SQLite magic header (first 16 bytes)
  const buffer = Buffer.alloc(16);
  const fd = fs.openSync(filePath, 'r');
  fs.readSync(fd, buffer, 0, 16, 0);
  fs.closeSync(fd);

  const header = buffer.toString('utf-8', 0, 15);
  if (header !== SQLITE_HEADER) {
    return { valid: false, error: 'File is not a valid SQLite database' };
  }

  return { valid: true };
}

/** Ask for user confirmation */
async function confirm(question: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 's');
    });
  });
}

/** Restore database from a backup file */
export async function restoreBackup(
  backupPath: string,
  dataDir: string,
  skipConfirmation = false
): Promise<{ restored: boolean; error?: string }> {
  // Validate backup file
  const validation = validateBackupFile(backupPath);
  if (!validation.valid) {
    return { restored: false, error: validation.error };
  }

  // Ask for confirmation
  if (!skipConfirmation) {
    const confirmed = await confirm('Restaurar backup? Dados atuais serao substituidos. (s/N) ');
    if (!confirmed) {
      return { restored: false, error: 'Restore cancelled by user' };
    }
  }

  const dbPath = path.join(dataDir, 'garimpoai.db');

  // Close current DB connection
  closeDb();

  // Copy backup over current database
  fs.copyFileSync(backupPath, dbPath);

  // Reconnect
  initializeDb(dataDir);

  return { restored: true };
}
