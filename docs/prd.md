# GarimpoAI Brownfield Enhancement PRD

## Fase 3 — Qualidade de Vida e Inteligencia

| Campo | Valor |
|-------|-------|
| **Produto** | GarimpoAI |
| **Versao Atual** | 0.1.0 (Fase 1 + Fase 2) |
| **Fase** | 3 |
| **Autor** | Morgan (PM Agent) |
| **Revisado por** | Pax (PO Agent) |
| **Data** | 2026-02-07 |
| **Revisao** | 2026-02-08 |
| **Status** | Validated |

---

## 1. Intro Project Analysis and Context

### 1.1 Existing Project Overview

**Analysis Source:** IDE-based fresh analysis (sessao com @Atlas / Analyst Agent)

**Current Project State:**

GarimpoAI e um assistente pessoal de licitacoes publicas brasileiras com IA conversacional (Claude). O sistema coleta dados da API PNCP (Portal Nacional de Contratacoes Publicas), permite busca full-text com FTS5, analise profunda com IA, gestao de documentos da empresa, compliance checking e notificacoes automaticas via Telegram e Email.

**Stack:** Node.js 20+, TypeScript strict, SQLite (better-sqlite3) com FTS5, Anthropic Claude SDK, Commander.js CLI

**Metricas atuais:**
- 13 modulos / 31 arquivos TypeScript / ~4400 linhas
- 64 testes (100% passing, 6 suites)
- TypeCheck limpo (strict mode)
- Zero divida tecnica (nenhum TODO/FIXME/HACK)
- DB: ~18MB com dados reais coletados

### 1.2 Available Documentation

- [x] Tech Stack Documentation
- [x] Source Tree / Architecture
- [x] Coding Standards (TypeScript strict, padroes claros)
- [x] API Documentation (PNCP API integrada)
- [ ] UX/UI Guidelines (CLI only, sem UI)
- [x] Technical Debt Documentation (zero divida)

### 1.3 Enhancement Scope Definition

**Enhancement Type:**
- [x] New Feature Addition
- [x] Major Feature Modification
- [x] Integration with New Systems

**Enhancement Description:**

Evolucao do GarimpoAI da Fase 2 (CLI funcional com IA) para Fase 3 — focada em tornar o produto mais robusto, inteligente e preparado para uso diario real. Inclui melhorias de persistencia, busca avancada, alertas inteligentes, operacoes em lote e exportacao de dados.

**Impact Assessment:**
- [x] Moderate Impact (some existing code changes)

As features propostas sao majoritariamente aditivas — novos modulos que se integram com a infraestrutura existente (DB, CLI, chat). Modulos existentes precisam de ajustes pontuais (ex: filter engine para operadores avancados, notifier para smart alerts), mas a arquitetura core permanece intacta.

### 1.4 Goals

- Tornar o chat conversacional mais util com historico persistente entre sessoes
- Aumentar a precisao de busca com operadores avancados (AND, NOT, aspas)
- Reduzir ruido nos alertas usando analise semantica com IA ao inves de regex simples
- Permitir analise em lote para avaliar multiplas licitacoes de uma vez
- Dar ao usuario controle sobre seus dados com backup/export
- Preparar o produto para uso diario recorrente (scheduler + historico + alertas inteligentes)

### 1.5 Background Context

O GarimpoAI nasceu para resolver um problema real: monitorar e analisar licitacoes publicas brasileiras e trabalhoso, fragmentado e exige conhecimento tecnico da API PNCP. As Fases 1 e 2 entregaram um CLI funcional com chat IA, coleta automatica, compliance e notificacoes.

Porem, para uso diario sustentavel, faltam recursos de "qualidade de vida": o chat perde contexto entre sessoes, alertas sao por regex (gerando falsos positivos), nao ha como exportar dados para analise externa, e buscas complexas exigem multiplas queries. A Fase 3 resolve essas friccoes mantendo o principio CLI-first.

### 1.6 Change Log

| Change | Date | Version | Description | Author |
|--------|------|---------|-------------|--------|
| Initial draft | 2026-02-07 | 0.1.0 | PRD Fase 3 criado | Morgan (PM) |
| PO Validation | 2026-02-08 | 0.2.0 | Validacao tecnica, resequenciamento, refinamento de ACs | Pax (PO) |

---

## 2. Requirements

### 2.1 Functional Requirements

- **FR1:** O sistema deve persistir o historico de conversas do chat entre sessoes, permitindo ao usuario retomar contexto anterior com comando `/history`
- **FR2:** O motor de busca FTS5 deve suportar operadores avancados: AND, NOT, aspas para busca exata, e wildcards
- **FR3:** O sistema de alertas deve usar analise semantica com IA (Claude Haiku) para classificar relevancia ao inves de matching por regex, com limite maximo de 20 licitacoes classificadas por ciclo
- **FR4:** O sistema deve suportar analise em lote (batch), permitindo analisar ate 10 licitacoes em um unico comando `analyze --batch`
- **FR5:** O sistema deve permitir exportar dados em formatos CSV e JSON via comando `export`
- **FR6:** O sistema deve permitir backup completo do banco de dados e restauracao via comandos `backup` e `restore`
- **FR7:** O historico de buscas realizadas deve ser rastreado na tabela `search_history` para analise de padroes

### 2.2 Non-Functional Requirements

- **NFR1:** Novas features nao devem aumentar o tempo de startup do CLI em mais de 200ms
- **NFR2:** Batch analysis deve respeitar o limite diario existente (maxPerDay) e processar em paralelo com maximo de 3 chamadas simultaneas a API
- **NFR3:** Export de dados de ate 10.000 registros deve completar em menos de 5 segundos
- **NFR4:** Smart alerts devem manter custo IA abaixo de $0.01 por ciclo de notificacao, com hard limit de 20 classificacoes por ciclo
- **NFR5:** Historico de chat deve ter retencao configuravel (default: 90 dias) com cleanup automatico

### 2.3 Compatibility Requirements

- **CR1:** API CLI existente deve manter 100% de retrocompatibilidade — nenhum comando existente pode mudar comportamento
- **CR2:** Schema do banco de dados deve usar migrations incrementais (novas tabelas/colunas), sem alterar tabelas existentes
- **CR3:** Configuracao YAML existente deve permanecer valida — novas opcoes sao aditivas com defaults sensatos
- **CR4:** Integracao com Telegram e Email existente deve continuar funcionando sem alteracoes

---

## 3. Technical Constraints and Integration Requirements

### 3.1 Existing Technology Stack

| Camada | Tecnologia | Versao |
|--------|-----------|--------|
| Language | TypeScript (strict mode) | 5.9.3 |
| Runtime | Node.js | >=20.0.0 |
| Database | SQLite via better-sqlite3 | 11.8.0 |
| ORM | Drizzle ORM | 0.38.0 |
| AI Provider | Anthropic Claude SDK | 0.39.0 |
| CLI Framework | Commander.js | 12.1.0 |
| Scheduler | node-cron | 3.0.3 |
| Notifications | node-telegram-bot-api + nodemailer | 0.66.0 / 6.10.0 |
| Validation | Zod | 3.24.0 |

### 3.2 Integration Approach

**Database Integration Strategy:**
- Migrations incrementais — novas tabelas: `chat_history`, `search_history`, `alert_scores`
- Manter singleton pattern existente (`getDb()` / `closeDb()`)
- FTS5 existente permanece intacto — operadores avancados sao nativos do SQLite FTS5

**API Integration Strategy:**
- Novos comandos CLI adicionados ao Commander existente em `src/index.ts`
- Novas tools do chat adicionadas em `src/chat/tools.ts` e `src/chat/tool-executor.ts`
- Anthropic SDK existente reutilizado para smart alerts (apenas novo prompt)

**Testing Integration Strategy:**
- Mesmo padrao Jest + ts-jest
- Fixtures em `tests/fixtures/`
- Pattern existente: mock de DB in-memory + `closeDb()` no `afterEach`
- Meta: manter 100% passing, expandir cobertura para novos modulos

### 3.3 Code Organization and Standards

**File Structure — novos modulos:**

```
src/
├── export/          <- NOVO: export.ts (CSV/JSON)
├── backup/          <- NOVO: backup.ts, restore.ts
├── chat/
│   ├── history.ts   <- NOVO: persistencia de historico
│   └── (existentes sem breaking changes)
├── filter/
│   └── engine.ts    <- MODIFICADO: operadores avancados + try-catch fallback
├── notifier/
│   └── smart.ts     <- NOVO: classificador semantico
└── (demais intocados)
```

**Naming Conventions:** kebab-case para arquivos, PascalCase para tipos, camelCase para funcoes
**Coding Standards:** TypeScript strict, zero `any`, async/await, error handling com try-catch

### 3.4 Deployment and Operations

**Build Process:** Sem mudancas — `tsc` para build, `tsx` para dev

**Configuration Management — novas chaves YAML:**

```yaml
chat:
  historyRetentionDays: 90        # default
  maxSessionsListed: 10           # default, max sessoes listadas em /history

export:
  defaultFormat: "csv"            # default
  csvCharset: "utf-8"             # default, com BOM para Excel

alerts:
  useSemanticMatching: true       # default, fallback para regex
  semanticModel: "claude-haiku-4-5-20251001"
  semanticThreshold: 60           # score minimo para notificar (0-100)
  maxClassificationsPerCycle: 20  # hard limit de classificacoes por ciclo

batch:
  maxConcurrent: 3                # default, chamadas simultaneas
  maxPerBatch: 10                 # default, max licitacoes por batch
```

**Config Schema (src/types/config.ts) — tipos Zod a adicionar:**

```typescript
export interface ChatConfig {
  historyRetentionDays: number;   // default 90
  maxSessionsListed: number;      // default 10
}

export interface ExportConfig {
  defaultFormat: 'csv' | 'json';  // default 'csv'
  csvCharset: string;             // default 'utf-8'
}

export interface AlertsConfigExtension {
  useSemanticMatching: boolean;   // default true
  semanticModel: string;
  semanticThreshold: number;      // default 60
  maxClassificationsPerCycle: number; // default 20
}

export interface BatchConfig {
  maxConcurrent: number;          // default 3
  maxPerBatch: number;            // default 10
}
```

### 3.5 Database Schema — Novas Tabelas

```sql
-- Story 1.1: Chat History
CREATE TABLE IF NOT EXISTS chat_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  timestamp TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_chat_session ON chat_history(session_id);
CREATE INDEX idx_chat_timestamp ON chat_history(timestamp);

-- Story 1.3: Search History
CREATE TABLE IF NOT EXISTS search_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  query TEXT NOT NULL,
  filters TEXT,           -- JSON: {uf, modalidade, valorMin, valorMax}
  results_count INTEGER DEFAULT 0,
  timestamp TEXT DEFAULT (datetime('now'))
);

-- Story 1.4: Alert Scores Cache
CREATE TABLE IF NOT EXISTS alert_scores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  alerta_id INTEGER REFERENCES alertas(id),
  licitacao_id TEXT NOT NULL,
  semantic_score REAL NOT NULL,
  resumo TEXT,            -- resumo de 1 linha gerado pela IA
  timestamp TEXT DEFAULT (datetime('now')),
  UNIQUE(alerta_id, licitacao_id)
);
```

### 3.6 Risk Assessment and Mitigation

| Risco | Probabilidade | Impacto | Mitigacao |
|-------|--------------|---------|-----------|
| Smart alerts aumentam custo IA | Media | Medio | Hard limit 20 classificacoes/ciclo + fallback regex |
| Batch analysis excede rate limit Anthropic | Baixa | Alto | Throttling com 3 concurrent max + retry existente |
| Historico de chat infla o DB | Baixa | Baixo | Cleanup automatico (90 dias default), VACUUM periodico |
| Operadores FTS5 invalidos causam erro | Baixa | Baixo | Try-catch com fallback silencioso para busca simples |
| Backup de DB grande demora | Baixa | Baixo | Copy file direto (SQLite e single-file), progress bar |
| Restore durante scheduler ativo | Baixa | Medio | closeDb() antes de restore, parar scheduler se ativo |

---

## 4. Epic and Story Structure

### Epic Approach

**Epic Structure Decision:** Epico unico — todas as features servem ao mesmo objetivo estrategico (tornar o produto viavel para uso diario) e compartilham infraestrutura (DB, CLI, chat).

---

### Epic 1: GarimpoAI Fase 3 — Qualidade de Vida e Inteligencia

**Epic Goal:** Evoluir o GarimpoAI de um prototipo funcional para uma ferramenta de uso diario sustentavel, adicionando persistencia, inteligencia nos alertas, operacoes em lote e controle sobre dados.

**Integration Requirements:** Todas as stories mantem retrocompatibilidade com CLI, DB schema e config YAML existentes. Cada story inclui verificacao de integridade do sistema existente.

**Sequencia:** 1.1 -> 1.2 -> 1.3 -> 1.4 -> 1.5 -> 1.6 -> 1.7

---

#### Story 1.1 — Historico de Chat Persistente

> Como um usuario do GarimpoAI,
> eu quero que minhas conversas sejam salvas entre sessoes,
> para que eu possa retomar o contexto sem repetir perguntas.

**Acceptance Criteria:**

1. Tabela `chat_history` criada conforme schema da secao 3.5
2. Session ID gerado como UUID v4 automaticamente no inicio de cada `startChat()`
3. Cada mensagem (user e assistant) persistida no DB apos ser processada
4. Comando `/history` no chat lista ultimas N sessoes (N configuravel, default 10) com data e preview
5. Comando `/history <session_id>` carrega mensagens da sessao anterior como contexto inicial (nova session_id e criada para a conversa atual)
6. Retencao configuravel via `chat.historyRetentionDays` (default: 90)
7. Cleanup automatico adicionado como etapa no pipeline do scheduler (`DELETE FROM chat_history WHERE timestamp < datetime('now', '-N days')`)

**Integration Verification:**

- IV1: Chat existente continua funcionando sem historico (graceful quando tabela vazia)
- IV2: Sliding window de 20 mensagens permanece inalterada no contexto ativo
- IV3: Performance do chat startup nao aumenta mais que 50ms

**Dev Notes:**

- Usar `crypto.randomUUID()` (Node.js 20+ nativo) para session_id
- Inserir no DB de forma sincrona (better-sqlite3 e sincrono por natureza)
- `/history <id>` cria NOVA session_id, mas pre-popula o array de mensagens com as da sessao anterior

---

#### Story 1.2 — Busca Avancada com Operadores FTS5

> Como um usuario buscando licitacoes,
> eu quero usar operadores como AND, NOT e aspas na busca,
> para que eu encontre resultados mais precisos.

**Acceptance Criteria:**

1. Busca suporta `"termo exato"` (aspas para match exato)
2. Busca suporta `termo1 AND termo2` (ambos obrigatorios)
3. Busca suporta `termo1 NOT termo2` (exclusao)
4. Busca suporta `termo*` (wildcard/prefixo)
5. Sintaxe invalida faz fallback silencioso para busca simples (try-catch em torno da query FTS5)
6. Help inline atualizado com exemplos de operadores no comando `/help` do chat e no `search --help` do CLI

**Integration Verification:**

- IV1: Buscas simples existentes retornam mesmos resultados (regressao zero)
- IV2: Tool `search_licitacoes` do chat suporta nova sintaxe
- IV3: Filtros por UF, modalidade e valor continuam funcionando em conjunto

**Dev Notes:**

- FTS5 do SQLite suporta todos esses operadores nativamente — o trabalho e expor a query do usuario diretamente ao FTS5 ao inves de wrappear com OR
- Detectar se query contem operadores (AND, NOT, aspas, *) e se sim, passar diretamente; se nao, manter comportamento atual (wrap com OR)
- Validacao: input deve passar regex `^[\w\s\(\)"\*\-]+$` ou fallback

---

#### Story 1.3 — Tracking de Historico de Buscas

> Como um usuario recorrente,
> eu quero que minhas buscas anteriores sejam registradas,
> para que eu possa identificar padroes e repetir buscas frequentes.

**Acceptance Criteria:**

1. Tabela `search_history` criada conforme schema da secao 3.5
2. Toda busca (CLI e chat) registrada automaticamente com query, filtros (JSON), count de resultados e timestamp
3. Comando `search --history` lista ultimas 20 buscas com data e count
4. Comando `search --replay <id>` re-executa busca com mesma query e filtros contra dados atuais (resultados podem diferir pois dados mudam)
5. Tool `search_licitacoes` no chat registra buscas automaticamente

**Integration Verification:**

- IV1: Busca sem flag `--history` funciona exatamente como antes
- IV2: Performance de busca nao degradada (insert sincrono e rapido no SQLite)
- IV3: Stats existentes continuam corretas

**Dev Notes:**

- Campo `filters` armazenado como JSON string: `{"uf":["SP"],"valorMin":1000}`
- `--replay` re-executa com mesmos parametros mas dados atuais — util para monitoramento recorrente

---

#### Story 1.4 — Backup e Restore

> Como um usuario que valoriza seus dados,
> eu quero fazer backup e restaurar meu banco de dados,
> para que eu nao perca dados coletados e analises.

**Acceptance Criteria:**

1. Comando `backup` executa WAL checkpoint e cria copia timestamped em `~/.garimpoai/backups/`
2. Comando `backup --output /path/to/file.db` permite destino customizado
3. Comando `restore <path>` valida arquivo, pede confirmacao via readline, fecha DB, copia arquivo, e reconecta
4. Maximo de 5 backups retidos com rotacao automatica (deleta mais antigo)
5. Feedback com tamanho do backup e tempo de execucao
6. Se scheduler estiver ativo, pausar antes de restore e retomar apos

**Integration Verification:**

- IV1: Backup nao interrompe operacoes em andamento (WAL checkpoint + copy)
- IV2: Restore preserva todas as tabelas incluindo novas (chat_history, search_history)
- IV3: Singleton de DB (`getDb()`) reconecta corretamente apos restore

**Dev Notes:**

- WAL checkpoint: `db.pragma('wal_checkpoint(RESTART)')` antes de copiar
- Backup inclui `.db` apenas (WAL e SHM sao transientes e regenerados pelo SQLite)
- Usar `fs.copyFileSync()` para copia atomica

---

#### Story 1.5 — Analise em Lote (Batch)

> Como um usuario avaliando multiplas licitacoes,
> eu quero analisar varias de uma vez,
> para que eu economize tempo ao comparar oportunidades.

**Acceptance Criteria:**

1. Comando `analyze --batch <id1,id2,...>` analisa ate 10 licitacoes
2. Comando `analyze --batch --top 5` analisa os top 5 da ultima busca (usa `search_history` para obter ultima query, re-executa e pega top N)
3. Processamento em chunks de 3 com `Promise.all()` (sem dependencia externa)
4. Verifica limite diario (`isLimitReached()`) ANTES de cada analise individual, para parcial se limite atingido
5. Output formatado como tabela comparativa com colunas: ID, Objeto (truncado), Dificuldade, Score, Resumo
6. Progress indicator (counter `[3/10]`) durante processamento

**Integration Verification:**

- IV1: `analyze <id>` individual continua funcionando identicamente
- IV2: Cache de analises existente e reutilizado (sem re-analise)
- IV3: Cost tracker registra todas as chamadas do batch

**Dev Notes:**

- Throttling simples com chunks: `for (let i = 0; i < ids.length; i += 3) { await Promise.all(chunk.map(...)) }`
- `--top N` funciona via: query `search_history` para ultima busca, re-executar busca, pegar primeiros N IDs
- Resultado parcial e valido — se 7 de 10 analisadas e limit atingido, mostra as 7

---

#### Story 1.6 — Export de Dados (CSV/JSON)

> Como um usuario que precisa analisar dados externamente,
> eu quero exportar licitacoes em CSV e JSON,
> para que eu possa usar em planilhas e outros sistemas.

**Acceptance Criteria:**

1. Comando `export licitacoes --format csv --output arquivo.csv`
2. Comando `export licitacoes --format json --output arquivo.json`
3. Suporta filtros existentes (UF, modalidade, valor, keywords)
4. Exporta ate 10.000 registros em menos de 5 segundos
5. Inclui analises IA quando disponiveis (LEFT JOIN com tabela `analises`)
6. Tool `export_data` adicionada ao chat
7. CSV gerado com UTF-8 BOM para compatibilidade com Excel, separador `;` (padrao brasileiro)
8. Campos JSON (como documentos necessarios) sao parseados em colunas separadas ou omitidos no CSV

**Integration Verification:**

- IV1: Dados exportados sao consistentes com output do `search`
- IV2: Filtros aplicados no export sao os mesmos do filter engine
- IV3: Nenhum dado sensivel (API keys, configs) e incluido no export

**Dev Notes:**

- Query SQL: `SELECT l.*, a.resumo, a.dificuldade FROM licitacoes l LEFT JOIN analises a ON l.numero_controle_pncp = a.licitacao_id WHERE ...`
- CSV: usar Buffer.from('\ufeff', 'utf8') como BOM prefix
- JSON: `JSON.stringify(results, null, 2)` para output legivel

---

#### Story 1.7 — Smart Alerts com Analise Semantica

> Como um usuario que recebe alertas de licitacoes,
> eu quero que os alertas usem IA para classificar relevancia,
> para que eu receba menos falsos positivos.

**Acceptance Criteria:**

1. Novo modulo `notifier/smart.ts` classifica licitacoes com Haiku (score 0-100)
2. Score e especifico por alerta: avalia relevancia da licitacao em relacao aos keywords E contexto do alerta
3. Apenas licitacoes com score >= threshold (config `alerts.semanticThreshold`, default 60) disparam notificacao
4. Hard limit de `alerts.maxClassificationsPerCycle` (default 20) licitacoes classificadas por ciclo — excedentes usam fallback regex
5. Config `alerts.useSemanticMatching` habilita/desabilita (default: true)
6. Fallback automatico para regex quando: API key ausente, limite diario excedido, ou maxClassificationsPerCycle atingido
7. Scores cacheados na tabela `alert_scores` (secao 3.5) — mesma licitacao+alerta nao e reclassificada
8. Notificacao inclui score de relevancia e resumo de 1 linha gerado pela IA
9. Custo por ciclo de notificacao limitado a ~$0.01 (garantido pelo hard limit de 20 classificacoes)

**Integration Verification:**

- IV1: Alertas existentes por regex continuam funcionando com `useSemanticMatching: false`
- IV2: Templates de Telegram/Email existentes compativeis com novo formato (score e resumo adicionados)
- IV3: Deduplicacao de notificacoes (tabela `notificacoes_enviadas`) continua funcionando

**Dev Notes:**

- Logica condicional no notifier:
  ```
  if (config.alerts.useSemanticMatching && hasApiKey && !isLimitReached && classifiedCount < maxPerCycle)
    → classifyWithHaiku()
  else
    → fallback regex score (match keywords = 100, partial = 50, none = 0)
  ```
- Custo estimado: 20 classificacoes * ~250 tokens = 5000 tokens/ciclo = ~$0.004 (dentro do budget)
- Estender `FilterResult` ou criar `ScoredResult extends FilterResult { score: number; resumo: string }`
- Esta story e a mais complexa — implementar por ultimo permite reutilizar patterns das anteriores

---

## 5. Story Sequencing Rationale

| Ordem | Story | Score PO | Justificativa |
|-------|-------|---------|---------------|
| 1.1 | Chat History | 7/10 | Infraestrutura base — estabelece pattern de migration e nova tabela |
| 1.2 | Busca Avancada | 9/10 | FTS5 nativo, risco zero, melhora experiencia core |
| 1.3 | Search History | 8/10 | Reutiliza pattern de 1.1, complementa busca |
| 1.4 | Backup/Restore | 9/10 | Independente, WAL pronto, protege dados antes de features complexas |
| 1.5 | Batch Analysis | 7/10 | Reutiliza Analyzer existente, throttling simples |
| 1.6 | Export | 8/10 | Queries estaveis, feature de gestao |
| 1.7 | Smart Alerts | 5/10 | Mais complexa, implementar por ultimo, reutiliza patterns anteriores |

**Mudanca de sequencia (PO Review):** Story 1.4 (Smart Alerts) movida de posicao 4 para posicao 7 (ultima). Story 1.7 (Backup) movida para posicao 4. Rationale: Backup protege dados do usuario antes de implementar features mais complexas, e Smart Alerts (mais arriscada) se beneficia dos patterns estabelecidos pelas 6 stories anteriores.

**Principio:** Cada story e independente e entrega valor isoladamente. A sequencia minimiza risco ao sistema existente e permite entregas incrementais.

---

## 6. Estimativa de Esforco

| Story | Linhas Novas | Complexidade | Modulos Impactados |
|-------|-------------|--------------|-------------------|
| 1.1 Chat History | ~120 | Baixa | chat/history.ts (novo), chat/repl.ts, database/connection.ts, scheduler/ |
| 1.2 Busca Avancada | ~50 | Muito Baixa | filter/engine.ts |
| 1.3 Search History | ~100 | Baixa | database/connection.ts, index.ts, chat/tool-executor.ts |
| 1.4 Backup/Restore | ~100 | Baixa | backup/ (novo), index.ts |
| 1.5 Batch Analysis | ~150 | Media | analyzer/analyzer.ts, index.ts |
| 1.6 Export | ~120 | Baixa | export/ (novo), index.ts, chat/tools.ts |
| 1.7 Smart Alerts | ~200 | Media-Alta | notifier/smart.ts (novo), notifier/notifier.ts, notifier/templates.ts, database/connection.ts |
| **Total** | **~840** | — | — |

---

## 7. Success Metrics

| Metrica | Baseline (Fase 2) | Target (Fase 3) |
|---------|-------------------|-----------------|
| Testes passing | 64 | 100+ |
| Comandos CLI | 10 | 14 |
| Tools no chat | 10 | 13 |
| Custo IA diario max | ~$0.50 | ~$0.55 (com smart alerts limitado) |
| Tempo de startup CLI | <500ms | <700ms |
| Zero breaking changes | N/A | 100% retrocompativel |

---

## 8. PO Validation Report

**Validado por:** Pax (PO Agent) — 2026-02-08

**Resultado:** 6/7 stories GO, 1 story GO com ressalvas (1.7 Smart Alerts)

**Correcoes aplicadas nesta revisao:**
- Session ID definido como UUID v4 auto-gerado (Story 1.1)
- Try-catch + fallback para sintaxe FTS5 invalida (Story 1.2)
- Campo `filters` definido como JSON string (Story 1.3)
- Hard limit de 20 classificacoes/ciclo para controle de custo (Story 1.7)
- Nova tabela `alert_scores` para cache de scores (Story 1.7)
- Score definido como especifico por alerta (nao global)
- Resequenciamento: Backup antes de features complexas, Smart Alerts por ultimo
- Schema SQL completo adicionado (secao 3.5)
- Config schema TypeScript definido (secao 3.4)
- Risk assessment atualizado com novos riscos (secao 3.6)
- Dev Notes adicionados em todas as stories

---

*Documento gerado por Morgan (PM Agent) — 2026-02-07*
*Revisado por Pax (PO Agent) — 2026-02-08*
*GarimpoAI Brownfield Enhancement PRD v0.2.0*
