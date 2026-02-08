import { recordSearch, listSearches, getSearch } from '../../src/filter/search-history';
import { initializeDb, closeDb } from '../../src/database/connection';
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

describe('recordSearch', () => {
  it('should record a search with query and count', () => {
    recordSearch(testDir, 'software', null, 15);

    const searches = listSearches(testDir);
    expect(searches).toHaveLength(1);
    expect(searches[0].query).toBe('software');
    expect(searches[0].resultsCount).toBe(15);
    expect(searches[0].filters).toBeNull();
  });

  it('should record search with JSON filters', () => {
    const filters = { uf: ['SP', 'RJ'], valorMin: 10000 };
    recordSearch(testDir, 'tecnologia', filters, 8);

    const searches = listSearches(testDir);
    expect(searches[0].filters).toBe(JSON.stringify(filters));
  });
});

describe('listSearches', () => {
  it('should return empty array when no searches', () => {
    const searches = listSearches(testDir);
    expect(searches).toHaveLength(0);
  });

  it('should list searches in reverse chronological order', () => {
    recordSearch(testDir, 'software', null, 10);
    recordSearch(testDir, 'tecnologia', null, 5);
    recordSearch(testDir, 'saude', null, 20);

    const searches = listSearches(testDir);
    expect(searches).toHaveLength(3);
    // Most recent first (same timestamp, so by id desc)
    expect(searches[0].query).toBe('saude');
    expect(searches[2].query).toBe('software');
  });

  it('should respect limit parameter', () => {
    for (let i = 0; i < 10; i++) {
      recordSearch(testDir, `busca-${i}`, null, i);
    }

    const searches = listSearches(testDir, 3);
    expect(searches).toHaveLength(3);
  });
});

describe('getSearch', () => {
  it('should return specific search by id', () => {
    recordSearch(testDir, 'software', { uf: ['SP'] }, 12);
    recordSearch(testDir, 'tecnologia', null, 5);

    const search = getSearch(testDir, 1);
    expect(search).not.toBeNull();
    expect(search!.query).toBe('software');
    expect(search!.resultsCount).toBe(12);
  });

  it('should return null for non-existent id', () => {
    const search = getSearch(testDir, 999);
    expect(search).toBeNull();
  });

  it('should preserve filters as parseable JSON', () => {
    const filters = { uf: ['MG'], valorMin: 50000, valorMax: 200000 };
    recordSearch(testDir, 'manutencao', filters, 3);

    const search = getSearch(testDir, 1);
    expect(search).not.toBeNull();
    const parsed = JSON.parse(search!.filters!);
    expect(parsed.uf).toEqual(['MG']);
    expect(parsed.valorMin).toBe(50000);
    expect(parsed.valorMax).toBe(200000);
  });
});
