# AIOS Skills Index

## 📊 Visão Geral

```
AIOS Skill System
├── agents/                    (11) - Personas completas
├── skills/                    (14) - Skills essenciais
└── skills-especializadas/     (46) - Skills domain-specific

Total: 11 agents + 60 skills = 71 capacidades
```

## 🎯 Quando Usar Cada Camada

### Layer 1: AIOS Agents (11)
**Uso:** Diário | **Tipo:** Personas completas com contexto

| Agent | Use Para |
|-------|----------|
| `@dev` | Implementação, debugging, refactoring |
| `@qa` | Testes, validação, quality gates |
| `@architect` | Design de sistemas, decisões técnicas |
| `@data-engineer` | Database design, schema, migrations |
| `@po` | Stories, backlog, acceptance criteria |
| `@pm` | Planning, sprints, recursos |
| `@sm` | Agile ceremonies, processo |
| `@analyst` | Requirements, research, análise |
| `@ux-design-expert` | UX/UI design, usabilidade |
| `@devops` | Git, CI/CD, releases |
| `@aios-master` | Orchestration, framework development |

### Layer 2: Essential Skills (14)
**Uso:** Semanal | **Tipo:** Workflows e práticas fundamentais

**Workflows:**
- `concise-planning` - Planning estruturado
- `systematic-debugging` - Debug científico
- `kaizen` - Melhoria contínua
- `git-pushing` - Git workflow

**Security:**
- `ethical-hacking-methodology` - Pentest completo
- `security-auditor` - Compliance audits
- `top-web-vulnerabilities` - OWASP Top 10

**Architecture:**
- `architecture-decision-records` - ADRs formais
- `event-sourcing-architect` - Event-driven systems

**Code Quality:**
- `error-detective` - Análise de logs
- `code-refactoring-refactor-clean` - SOLID refactoring
- `error-handling-patterns` - Error handling
- `production-code-audit` - Code review enterprise
- `typescript-pro` - TypeScript avançado

### Layer 3: Specialized Skills (46)
**Uso:** On-demand | **Tipo:** Domain-specific expertise

**Por Domínio:**
- 🎮 3D/Games (6) - Three.js, Godot, Unreal, Minecraft
- ⛓️ Blockchain (3) - Smart contracts, DeFi, Solidity
- 💻 Frameworks (8) - Angular, Elixir, Haskell, Julia, C++
- 🛠️ Tools (6) - WhatsApp, Notion, Inngest, n8n
- 🎨 UI/UX (4) - Radix, Tailwind, Browser extensions
- 🚀 DevOps (5) - K8s, Terraform, AWS, Monorepo
- 🏗️ Architecture (5) - CQRS, Event Store, Saga
- 🤖 AI (2) - Agent orchestration, Prompt engineering
- 💼 Business (5) - Pricing, SEO, Marketing
- 🛡️ Security (4) - Burp Suite, Cloud pentest
- 📐 Dev Patterns (3) - API design, NestJS

## 🔄 Workflow Híbrido Recomendado

### Exemplo: Implementar Nova Feature

```bash
# 1. Planning (AIOS Agent)
@po *create-story "Add 3D product viewer"

# 2. Planning Formal (Essential Skill)
>> concise-planning create implementation plan for 3D viewer

# 3. Architecture Review (AIOS Agent)
@architect review 3D integration approach

# 4. Domain Expertise (Specialized Skill)
>> @3d-web-experience setup Three.js scene with product configurator

# 5. Implementation (AIOS Agent)
@dev implement 3D viewer component

# 6. Debug (Essential Skill)
>> systematic-debugging investigate WebGL performance issue

# 7. Security Review (Essential Skill)
>> ethical-hacking-methodology audit 3D asset loading

# 8. QA (AIOS Agent)
@qa validate 3D viewer

# 9. Improvement (Essential Skill)
>> kaizen review 3D code for optimization

# 10. Deploy (AIOS Agent)
@devops push changes
```

## 🔍 Como o AIOS Sugere Skills

### Descoberta Automática

Quando você menciona:
- **"3D website"** → Sugere `3d-web-experience`
- **"smart contract"** → Sugere `blockchain-developer`
- **"Godot game"** → Sugere `godot-gdscript-patterns`
- **"event sourcing"** → Sugere `event-sourcing-architect`
- **"debug complex error"** → Sugere `systematic-debugging`

### Contexto-Aware

O AIOS analisa:
1. Stack tecnológica do projeto
2. Palavra-chave na sua solicitação
3. Skills disponíveis relevantes
4. Sugere automaticamente a melhor skill

## 📚 Referências Rápidas

### Buscar Skills

```bash
# Essenciais
ls .claude/commands/AIOS/skills/

# Especializadas
ls .claude/commands/AIOS/skills-especializadas/

# Por categoria
ls .claude/commands/AIOS/skills-especializadas/ | grep -i "keyword"

# Ler skill específica
cat .claude/commands/AIOS/skills/concise-planning/SKILL.md
```

### Usar no Claude Code

```bash
# AIOS Agents (sempre @)
@dev implement feature

# Skills (sempre >>)
>> concise-planning create plan
>> @3d-web-experience setup scene
```

## 🎯 Quick Reference Card

| Preciso de... | Use... |
|---------------|--------|
| Gestão de projeto | `@po`, `@pm`, `@sm` |
| Implementar código | `@dev` |
| Planning formal | `>> concise-planning` |
| Debug complexo | `>> systematic-debugging` |
| Security audit | `>> ethical-hacking-methodology` |
| 3D web | `>> @3d-web-experience` |
| Blockchain | `>> @blockchain-developer` |
| Game dev (Godot) | `>> @godot-gdscript-patterns` |
| Event sourcing | `>> @event-sourcing-architect` |
| Code review | `>> kaizen` |
| ADR documentation | `>> architecture-decision-records` |
| Obsidian tags | `>> obsidian-tag-manager` |

## 📖 Documentação Completa

- **Agents:** `agents/_README.md`
- **Essential Skills:** `skills/README.md`
- **Specialized Skills:** `skills-especializadas/README.md`
- **AIOS Core:** `.aios-core/constitution.md`

---

*AIOS Skills System v1.0*
*Last Updated: 2026-02-04*
*CLI First | Observability Second | UI Third*
