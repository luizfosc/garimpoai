# AIOS Skills - Essenciais

Esta pasta contém as **14 skills essenciais** do Antigravity integradas ao AIOS.

## 📊 Skills Disponíveis

### Tier 1: Must-Have (5 skills) 🔥

| Skill | Quando Usar |
|-------|-------------|
| `concise-planning` | Planning estruturado antes de implementação |
| `systematic-debugging` | Debug científico com root cause analysis |
| `kaizen` | Continuous improvement e code review |
| `ethical-hacking-methodology` | Security audit e penetration testing |
| `architecture-decision-records` | Documentar ADRs formalmente |

### Tier 2: High Value (9 skills) ⚡

| Skill | Quando Usar |
|-------|-------------|
| `error-detective` | Análise de logs e error patterns |
| `code-refactoring-refactor-clean` | SOLID refactoring com clean code |
| `security-auditor` | Compliance audits e frameworks |
| `event-sourcing-architect` | Event-driven systems |
| `git-pushing` | Git workflow padronizado |
| `typescript-pro` | TypeScript idiomático avançado |
| `error-handling-patterns` | Error handling cross-language |
| `top-web-vulnerabilities` | OWASP Top 10 |
| `production-code-audit` | Enterprise-grade code review |

## 🎯 Como Usar

### No Claude Code
```
>> @concise-planning create implementation plan
>> @systematic-debugging investigate this error
>> @kaizen review this code for improvements
```

### Workflow Híbrido com AIOS
```
@po *create-story               # AIOS: Criar story
>> concise-planning             # Skill: Planning formal
@architect review design        # AIOS: Revisar arquitetura
>> architecture-decision-records # Skill: Documentar ADR
@dev implement                  # AIOS: Implementar
>> systematic-debugging         # Skill: Debug científico
@qa validate                    # AIOS: Validar qualidade
>> kaizen review code           # Skill: Melhoria contínua
@devops push                    # AIOS: Deploy
```

## 📚 Referência

- **Source:** Antigravity Awesome Skills
- **Total Original:** 626 skills
- **Curadas para AIOS:** 14 essenciais + 46 especializadas
- **Critério:** Skills que complementam AIOS agents

## 🔗 Ver Também

- `../agents/` - 11 AIOS agents (personas completas)
- `../skills-especializadas/` - 46 skills domain-specific
- `~/.agent/skills/` - Catálogo completo Antigravity (626 skills)

---

*Curadoria: 2026-02-04*
