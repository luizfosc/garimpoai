import { DocumentManager } from '../../src/documents/manager';
import { checkExpiry } from '../../src/documents/expiry-checker';
import { initializeDb, getDb, closeDb } from '../../src/database/connection';
import fs from 'fs';
import path from 'path';
import os from 'os';

let testDir: string;
let manager: DocumentManager;

beforeEach(() => {
  testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'garimpoai-docs-test-'));
  initializeDb(testDir);
  manager = new DocumentManager(testDir);
});

afterEach(() => {
  closeDb();
  fs.rmSync(testDir, { recursive: true, force: true });
});

describe('DocumentManager', () => {
  describe('register', () => {
    it('should register a document and return it', () => {
      const doc = manager.register({
        tipo: 'certidao_federal',
        nome: 'CND Federal',
        emissor: 'Receita Federal',
        dataValidade: '2027-12-31',
      });

      expect(doc.id).toBeDefined();
      expect(doc.tipo).toBe('certidao_federal');
      expect(doc.nome).toBe('CND Federal');
      expect(doc.emissor).toBe('Receita Federal');
      expect(doc.status).toBe('vigente');
      expect(doc.dataValidade).toBe('2027-12-31');
    });

    it('should set status as vencido for expired documents', () => {
      const doc = manager.register({
        tipo: 'certidao_federal',
        nome: 'CND Vencida',
        emissor: 'Receita Federal',
        dataValidade: '2020-01-01',
      });

      expect(doc.status).toBe('vencido');
    });

    it('should set status as proximo_vencimento for soon-expiring docs', () => {
      const soon = new Date();
      soon.setDate(soon.getDate() + 10);
      const soonStr = soon.toISOString().split('T')[0];

      const doc = manager.register({
        tipo: 'certidao_fgts',
        nome: 'CRF FGTS',
        emissor: 'CEF',
        dataValidade: soonStr,
      });

      expect(doc.status).toBe('proximo_vencimento');
    });

    it('should set vigente when no expiry date', () => {
      const doc = manager.register({
        tipo: 'contrato_social',
        nome: 'Contrato Social',
        emissor: 'Junta Comercial',
      });

      expect(doc.status).toBe('vigente');
      expect(doc.dataValidade).toBeNull();
    });
  });

  describe('getById', () => {
    it('should return document by ID', () => {
      const created = manager.register({
        tipo: 'alvara',
        nome: 'Alvará de Funcionamento',
        emissor: 'Prefeitura',
      });

      const found = manager.getById(created.id);
      expect(found).not.toBeNull();
      expect(found!.nome).toBe('Alvará de Funcionamento');
    });

    it('should return null for non-existent ID', () => {
      expect(manager.getById(9999)).toBeNull();
    });
  });

  describe('list', () => {
    it('should list all documents', () => {
      manager.register({ tipo: 'certidao_federal', nome: 'Doc 1', emissor: 'E1' });
      manager.register({ tipo: 'certidao_estadual', nome: 'Doc 2', emissor: 'E2' });
      manager.register({ tipo: 'alvara', nome: 'Doc 3', emissor: 'E3' });

      const docs = manager.list();
      expect(docs).toHaveLength(3);
    });

    it('should filter by type', () => {
      manager.register({ tipo: 'certidao_federal', nome: 'Doc 1', emissor: 'E1' });
      manager.register({ tipo: 'certidao_estadual', nome: 'Doc 2', emissor: 'E2' });

      const docs = manager.list({ tipo: 'certidao_federal' });
      expect(docs).toHaveLength(1);
      expect(docs[0].tipo).toBe('certidao_federal');
    });

    it('should filter by status', () => {
      manager.register({ tipo: 'certidao_federal', nome: 'Vigente', emissor: 'E1', dataValidade: '2027-12-31' });
      manager.register({ tipo: 'certidao_estadual', nome: 'Vencida', emissor: 'E2', dataValidade: '2020-01-01' });

      const vigentes = manager.list({ status: 'vigente' });
      expect(vigentes).toHaveLength(1);
      expect(vigentes[0].nome).toBe('Vigente');
    });
  });

  describe('remove', () => {
    it('should remove a document', () => {
      const doc = manager.register({ tipo: 'alvara', nome: 'Alvara', emissor: 'Pref' });
      expect(manager.remove(doc.id)).toBe(true);
      expect(manager.getById(doc.id)).toBeNull();
    });

    it('should return false for non-existent ID', () => {
      expect(manager.remove(9999)).toBe(false);
    });
  });

  describe('refreshStatuses', () => {
    it('should update status of expired documents', () => {
      // Insert a doc that was vigente but now expired (simulate by direct DB insert)
      const db = getDb(testDir);
      const { documentosEmpresa } = require('../../src/database/schema');
      db.insert(documentosEmpresa).values({
        tipo: 'certidao_federal',
        nome: 'CND velha',
        emissor: 'RF',
        dataValidade: '2020-01-01',
        status: 'vigente', // Wrong status, should be corrected
      }).run();

      const result = manager.refreshStatuses();
      expect(result.updated).toBe(1);

      const docs = manager.list();
      expect(docs[0].status).toBe('vencido');
    });
  });

  describe('getExpiring', () => {
    it('should return documents expiring within N days', () => {
      const soon = new Date();
      soon.setDate(soon.getDate() + 5);
      const soonStr = soon.toISOString().split('T')[0];

      manager.register({ tipo: 'certidao_federal', nome: 'Vencendo', emissor: 'RF', dataValidade: soonStr });
      manager.register({ tipo: 'contrato_social', nome: 'Longe', emissor: 'JC', dataValidade: '2028-12-31' });

      const expiring = manager.getExpiring(30);
      expect(expiring).toHaveLength(1);
      expect(expiring[0].nome).toBe('Vencendo');
    });

    it('should return empty array when nothing is expiring', () => {
      manager.register({ tipo: 'contrato_social', nome: 'OK', emissor: 'JC', dataValidade: '2028-12-31' });

      const expiring = manager.getExpiring(30);
      expect(expiring).toHaveLength(0);
    });
  });

  describe('findBestMatch', () => {
    it('should return vigente document of matching type', () => {
      manager.register({ tipo: 'certidao_federal', nome: 'CND Federal', emissor: 'RF', dataValidade: '2027-06-30' });
      manager.register({ tipo: 'certidao_federal', nome: 'CND Federal Nova', emissor: 'RF', dataValidade: '2027-12-31' });

      const match = manager.findBestMatch('certidao_federal');
      expect(match).not.toBeNull();
      // Should return the one with latest expiry
      expect(match!.nome).toBe('CND Federal Nova');
    });

    it('should fall back to proximo_vencimento when no vigente', () => {
      const soon = new Date();
      soon.setDate(soon.getDate() + 10);
      manager.register({ tipo: 'certidao_fgts', nome: 'CRF', emissor: 'CEF', dataValidade: soon.toISOString().split('T')[0] });

      const match = manager.findBestMatch('certidao_fgts');
      expect(match).not.toBeNull();
      expect(match!.status).toBe('proximo_vencimento');
    });

    it('should return null when no matching type exists', () => {
      manager.register({ tipo: 'alvara', nome: 'Alvara', emissor: 'Pref' });

      const match = manager.findBestMatch('certidao_federal');
      expect(match).toBeNull();
    });

    it('should not return vencido documents', () => {
      manager.register({ tipo: 'certidao_federal', nome: 'Vencida', emissor: 'RF', dataValidade: '2020-01-01' });

      const match = manager.findBestMatch('certidao_federal');
      expect(match).toBeNull();
    });
  });
});

describe('checkExpiry', () => {
  it('should return both expiring and expired documents', () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 5);
    manager.register({ tipo: 'certidao_federal', nome: 'Vencendo', emissor: 'RF', dataValidade: soon.toISOString().split('T')[0] });
    manager.register({ tipo: 'certidao_estadual', nome: 'Vencida', emissor: 'SEFAZ', dataValidade: '2020-01-01' });
    manager.register({ tipo: 'contrato_social', nome: 'OK', emissor: 'JC', dataValidade: '2028-12-31' });

    const result = checkExpiry(testDir, 30);
    expect(result.expiring).toHaveLength(1);
    expect(result.expired).toHaveLength(1);
    expect(result.expiring[0].nome).toBe('Vencendo');
    expect(result.expired[0].nome).toBe('Vencida');
  });
});
