import { createBackup, rotateBackups, getBackupPath, formatSize } from '../../src/backup/backup';
import { validateBackupFile, restoreBackup } from '../../src/backup/restore';
import { initializeDb, getDb, closeDb } from '../../src/database/connection';
import { licitacoes } from '../../src/database/schema';
import fs from 'fs';
import path from 'path';
import os from 'os';

let testDir: string;

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'garimpoai-backup-'));
  initializeDb(testDir);

  // Insert test data so DB has content
  const db = getDb(testDir);
  db.insert(licitacoes)
    .values({
      numeroControlePNCP: 'BACKUP-TEST-001',
      objetoCompra: 'Test licitacao for backup',
      valorTotalEstimado: 100000,
      modalidadeId: 6,
      modalidadeNome: 'Pregão - Eletrônico',
      anoCompra: 2026,
      sequencialCompra: 1,
      orgaoCnpj: '00000000000001',
    })
    .run();
});

afterEach(() => {
  closeDb();
  fs.rmSync(testDir, { recursive: true, force: true });
});

describe('createBackup', () => {
  it('should create a backup file', () => {
    const result = createBackup(testDir);

    expect(fs.existsSync(result.path)).toBe(true);
    expect(result.sizeBytes).toBeGreaterThan(0);
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(result.path).toContain('backups');
    expect(result.path).toContain('backup-');
  });

  it('should create backup at custom output path', () => {
    const customPath = path.join(testDir, 'custom-backup.db');
    const result = createBackup(testDir, customPath);

    expect(result.path).toBe(customPath);
    expect(fs.existsSync(customPath)).toBe(true);
  });

  it('should create backups directory if not exists', () => {
    const backupsDir = path.join(testDir, 'backups');
    expect(fs.existsSync(backupsDir)).toBe(false);

    createBackup(testDir);

    expect(fs.existsSync(backupsDir)).toBe(true);
  });
});

describe('rotateBackups', () => {
  it('should keep only maxBackups files', () => {
    const backupsDir = path.join(testDir, 'backups');
    fs.mkdirSync(backupsDir, { recursive: true });

    // Create 7 fake backup files
    for (let i = 1; i <= 7; i++) {
      const name = `backup-2026-01-0${i}T10-00-00.db`;
      fs.writeFileSync(path.join(backupsDir, name), 'fake');
    }

    const deleted = rotateBackups(backupsDir, 5);

    expect(deleted).toBe(2);
    const remaining = fs.readdirSync(backupsDir);
    expect(remaining).toHaveLength(5);
    // Oldest should be deleted
    expect(remaining).not.toContain('backup-2026-01-01T10-00-00.db');
    expect(remaining).not.toContain('backup-2026-01-02T10-00-00.db');
  });

  it('should return 0 when under max', () => {
    const backupsDir = path.join(testDir, 'backups');
    fs.mkdirSync(backupsDir, { recursive: true });

    fs.writeFileSync(path.join(backupsDir, 'backup-2026-01-01T10-00-00.db'), 'fake');

    const deleted = rotateBackups(backupsDir, 5);
    expect(deleted).toBe(0);
  });

  it('should return 0 for non-existent directory', () => {
    const deleted = rotateBackups(path.join(testDir, 'nonexistent'), 5);
    expect(deleted).toBe(0);
  });
});

describe('validateBackupFile', () => {
  it('should accept valid SQLite file', () => {
    const dbPath = path.join(testDir, 'garimpoai.db');
    const result = validateBackupFile(dbPath);
    expect(result.valid).toBe(true);
  });

  it('should reject non-existent file', () => {
    const result = validateBackupFile('/tmp/nonexistent-file.db');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('should reject non-SQLite file', () => {
    const fakePath = path.join(testDir, 'fake.db');
    // Must be at least 100 bytes to pass the size check
    fs.writeFileSync(fakePath, 'x'.repeat(200));

    const result = validateBackupFile(fakePath);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not a valid SQLite');
  });

  it('should reject too-small file', () => {
    const tinyPath = path.join(testDir, 'tiny.db');
    fs.writeFileSync(tinyPath, 'x');

    const result = validateBackupFile(tinyPath);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('too small');
  });
});

describe('restoreBackup', () => {
  it('should restore database from backup', async () => {
    // Create a backup first
    const backupResult = createBackup(testDir);

    // Insert more data after backup
    const db = getDb(testDir);
    db.insert(licitacoes)
      .values({
        numeroControlePNCP: 'AFTER-BACKUP-001',
        objetoCompra: 'After backup data',
        valorTotalEstimado: 50000,
        modalidadeId: 6,
        modalidadeNome: 'Pregão - Eletrônico',
        anoCompra: 2026,
        sequencialCompra: 2,
        orgaoCnpj: '00000000000002',
      })
      .run();

    // Restore (skip confirmation for test)
    const result = await restoreBackup(backupResult.path, testDir, true);
    expect(result.restored).toBe(true);

    // Verify: AFTER-BACKUP-001 should NOT exist (restored from before)
    const restoredDb = getDb(testDir);
    const rows = restoredDb.select().from(licitacoes).all();
    expect(rows).toHaveLength(1);
    expect(rows[0].numeroControlePNCP).toBe('BACKUP-TEST-001');
  });

  it('should reject invalid backup file', async () => {
    const fakePath = path.join(testDir, 'fake.db');
    // Must be >100 bytes to pass size check and reach header validation
    fs.writeFileSync(fakePath, 'x'.repeat(200));

    const result = await restoreBackup(fakePath, testDir, true);
    expect(result.restored).toBe(false);
    expect(result.error).toContain('not a valid SQLite');
  });
});

describe('formatSize', () => {
  it('should format bytes', () => {
    expect(formatSize(500)).toBe('500 B');
  });

  it('should format kilobytes', () => {
    expect(formatSize(1536)).toBe('1.5 KB');
  });

  it('should format megabytes', () => {
    expect(formatSize(2 * 1024 * 1024)).toBe('2.0 MB');
  });
});

describe('getBackupPath', () => {
  it('should generate timestamped path', () => {
    const p = getBackupPath(testDir);
    expect(p).toContain('backups');
    expect(p).toContain('backup-');
    expect(p).toMatch(/backup-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}\.db$/);
  });
});
