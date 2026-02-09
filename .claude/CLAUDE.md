# GarimpoAI

Assistente pessoal de licitacoes publicas brasileiras com IA conversacional (Claude/Anthropic).

## Stack

- **Runtime:** Node.js >= 20
- **Linguagem:** TypeScript 5.9 (strict mode)
- **CLI:** Commander.js
- **Database:** SQLite via better-sqlite3 + Drizzle ORM
- **IA:** Anthropic Claude SDK (`claude-haiku-4-5-20251001` para chat, `claude-sonnet-4-5-20250929` para analise)
- **Testes:** Jest 30 + ts-jest
- **Validacao:** Zod
- **Notificacoes:** Telegram Bot API, Nodemailer

## Comandos

```bash
npm run dev          # CLI via tsx (dev mode)
npm test             # Jest (64 testes, 6 suites)
npm run test:watch   # Watch mode
npm run test:coverage
npm run build        # tsc -> dist/
npm run typecheck    # tsc --noEmit
npm run db:generate  # Gera migrations Drizzle
npm run db:migrate   # Executa migrations
npm run db:studio    # Drizzle Studio (GUI)
```

## Estrutura

```
src/
├── index.ts              # CLI principal (Commander.js)
├── types/                # Tipos TypeScript (config, pncp, analysis, chat, documents)
├── database/
│   ├── schema.ts         # Drizzle schema (9 tabelas)
│   └── connection.ts     # Singleton DB manager
├── collector/            # Coleta dados PNCP
├── filter/               # Motor busca FTS5
├── chat/                 # Sistema conversacional (REPL, tools, history)
├── analyzer/             # Analise com IA (individual + batch)
├── compliance/           # Verificacao compliance
├── documents/            # Gestao documentos empresa
├── notifier/             # Telegram + Email + Smart matching
├── scheduler/            # node-cron daemon
├── export/               # CSV/JSON exporter
├── backup/               # Backup/Restore DB
└── config/               # YAML loader + Zod validation
```

## Database

- **Config:** `~/.garimpoai/garimpoai.yaml` (copiar de `config.example.yaml`)
- **DB:** `~/.garimpoai/garimpoai.db` (~18MB com dados reais)
- **9 tabelas:** licitacoes, analises, alertas, notificacoes_enviadas, coletas, documentos_empresa, compliance_checks, compliance_items, ia_usage
- **FTS5:** `licitacoes_fts` com triggers de content-sync automatico

## Padroes Criticos

- `getDb(dataDir)` e singleton — se dataDir muda, auto-fecha conexao anterior
- Testes DEVEM chamar `closeDb()` em `afterEach` para evitar erros UNIQUE constraint
- PNCP API max page size: **50** (NOT 500 — retorna 400 se > 50)
- Analyzer cacheia resultados na tabela `analises` — nao faz double API call
- Cost tracker usa tabela `ia_usage` com agregacao diaria
- Chat tools: search, analyze, docs_check, set_alert, create_document

## APIs Externas

| API | Auth | Limite |
|-----|------|--------|
| PNCP (licitacoes) | Nenhuma | Pagina max 50 |
| Anthropic Claude | `ANTHROPIC_API_KEY` | `maxPerDay` config |
| Telegram Bot | Bot Token + Chat ID | Rate-limited |
| SMTP (Email) | Credenciais SMTP | Configuravel |

## Env Vars

- `ANTHROPIC_API_KEY` — override de `ia.apiKey` do YAML
- `GARIMPOAI_DATA_DIR` — override do diretorio de dados (default: ~/.garimpoai)
