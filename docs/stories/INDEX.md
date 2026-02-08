# GarimpoAI Fase 3 — Stories Index

## Epic 1: Qualidade de Vida e Inteligencia

| # | Story | Sprint | Status | Complexidade | Linhas |
|---|-------|--------|--------|-------------|--------|
| [1.1](1.1.chat-history.md) | Chat History Persistente | Sprint 1 | Ready for Review | Baixa | ~120 |
| [1.2](1.2.busca-avancada-fts5.md) | Busca Avancada FTS5 | Sprint 1 | Ready for Review | Muito Baixa | ~50 |
| [1.3](1.3.search-history.md) | Search History Tracking | Sprint 1 | Ready for Review | Baixa | ~100 |
| [1.4](1.4.backup-restore.md) | Backup e Restore | Sprint 2 | Ready for Review | Baixa | ~100 |
| [1.5](1.5.batch-analysis.md) | Analise em Lote (Batch) | Sprint 3 | Ready for Review | Media | ~150 |
| [1.6](1.6.export-csv-json.md) | Export CSV/JSON | Sprint 2 | Ready for Review | Baixa | ~120 |
| [1.7](1.7.smart-alerts.md) | Smart Alerts Semanticos | Sprint 3 | Ready for Review | Media-Alta | ~200 |

## Sprint Plan

### Sprint 1 — Persistencia e Busca (~270 linhas)
- **Goal:** Dar ao usuario memoria — chat, busca e historico
- **Stories:** 1.1, 1.2, 1.3
- **Dependencias:** 1.1 primeiro (pattern de migration), depois 1.2 e 1.3

### Sprint 2 — Controle de Dados (~220 linhas)
- **Goal:** Backup, restore e export de dados
- **Stories:** 1.4, 1.6
- **Dependencias:** Independentes entre si

### Sprint 3 — Inteligencia (~350 linhas)
- **Goal:** Analise em lote e alertas semanticos com IA
- **Stories:** 1.5, 1.7
- **Dependencias:** 1.5 primeiro (throttling pattern), depois 1.7
- **Nota:** 1.5 depende de 1.3 (search_history para --top N)

## Metricas

| Metrica | Baseline | Sprint 1 | Sprint 2 | Sprint 3 |
|---------|----------|----------|----------|----------|
| Testes | 64 | 94 | 110 | 137 |
| Comandos CLI | 10 | 10 | 12 | 14 |
| Tools chat | 10 | 10 | 11 | 13 |

## Documentos Relacionados

- [PRD Fase 3](../prd.md) — Product Requirements Document
