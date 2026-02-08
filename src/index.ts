#!/usr/bin/env node
import { Command } from 'commander';
import { loadConfig, findConfigFile, generateDefaultConfig, saveConfig } from './config/loader';
import { initializeDb, getDb } from './database/connection';
import { Collector } from './collector/collector';
import { FilterEngine } from './filter/engine';
import { PncpClient } from './collector/pncp-client';
import { alertas } from './database/schema';
import { eq } from 'drizzle-orm';
import chalk from 'chalk';
import fs from 'fs';
import path from 'path';

const VERSION = '0.1.0';

const program = new Command();

program
  .name('garimpoai')
  .description('GarimpoAI - Assistente pessoal de licitações públicas com IA conversacional')
  .version(VERSION);

// Default command (no args) = open chat
program
  .command('chat', { isDefault: true })
  .description('Abrir modo conversacional com IA')
  .action(async () => {
    const config = loadConfig();
    initializeDb(config.dataDir);

    if (!config.ia.apiKey) {
      console.log(chalk.yellow(
        '\n⚠️  Chave de API Anthropic não configurada.\n' +
        '   Configure em garimpoai.yaml ou exporte ANTHROPIC_API_KEY.\n' +
        '   Sem ela, a busca funciona mas a análise IA fica desabilitada.\n'
      ));
    }

    // Dynamic import to avoid loading chat deps when not needed
    const { startChat } = await import('./chat/repl');
    await startChat(config);
  });

program
  .command('collect')
  .description('Coletar licitações da API PNCP')
  .option('-d, --days <number>', 'Dias para coletar (default: 7)', '7')
  .option('--from <date>', 'Data inicial (YYYY-MM-DD)')
  .option('--to <date>', 'Data final (YYYY-MM-DD)')
  .action(async (opts) => {
    const config = loadConfig();
    initializeDb(config.dataDir);

    const collector = new Collector(config, (msg) => console.log(chalk.dim(msg)));

    const dataFinal = opts.to ? new Date(opts.to) : new Date();
    const dataInicial = opts.from
      ? new Date(opts.from)
      : new Date(Date.now() - parseInt(opts.days) * 24 * 60 * 60 * 1000);

    console.log(chalk.bold('\n📡 GarimpoAI - Coleta\n'));

    const result = await collector.collect({
      dataInicial,
      dataFinal,
      onProgress: (msg) => console.log(msg),
    });

    console.log(chalk.green(`\n✅ ${result.totalColetados} licitações coletadas`));
    console.log(chalk.dim(`   ${result.novos} novas | ${result.atualizados} atualizadas | ${result.erros} erros`));
    console.log(chalk.dim(`   Tempo: ${(result.duracaoMs / 1000).toFixed(1)}s\n`));
  });

program
  .command('search <keywords...>')
  .description('Buscar licitações por palavras-chave (suporta "exato", AND, NOT, prefixo*)')
  .option('--uf <ufs...>', 'Filtrar por UF(s)')
  .option('--valor-min <number>', 'Valor mínimo')
  .option('--valor-max <number>', 'Valor máximo')
  .option('--abertas', 'Apenas com propostas abertas')
  .option('-n, --limit <number>', 'Número de resultados', '20')
  .option('--json', 'Output em JSON')
  .option('--history', 'Listar últimas 20 buscas')
  .option('--replay <id>', 'Re-executar busca anterior por ID')
  .action((keywords: string[], opts) => {
    const config = loadConfig();
    initializeDb(config.dataDir);

    const { recordSearch, listSearches, getSearch } = require('./filter/search-history');

    // Handle --history
    if (opts.history) {
      const searches = listSearches(config.dataDir, 20);
      if (searches.length === 0) {
        console.log(chalk.yellow('\nNenhuma busca registrada ainda.\n'));
        return;
      }
      console.log(chalk.bold('\n📋 Últimas buscas:\n'));
      for (const s of searches) {
        const filters = s.filters ? ` (${s.filters})` : '';
        console.log(chalk.dim(`  #${s.id}  ${s.timestamp}  "${s.query}"  → ${s.resultsCount} resultados${filters}`));
      }
      console.log(chalk.dim('\n  Use --replay <id> para re-executar uma busca.\n'));
      return;
    }

    // Handle --replay
    if (opts.replay) {
      const search = getSearch(config.dataDir, parseInt(opts.replay));
      if (!search) {
        console.log(chalk.red(`\nBusca #${opts.replay} não encontrada.\n`));
        return;
      }
      const parsedFilters = search.filters ? JSON.parse(search.filters) : {};
      const engine = new FilterEngine(config);
      const results = engine.search({
        keywords: search.query.split(' '),
        uf: parsedFilters.uf,
        valorMin: parsedFilters.valorMin,
        valorMax: parsedFilters.valorMax,
        limit: parseInt(opts.limit),
      });

      recordSearch(config.dataDir, search.query, parsedFilters, results.length);
      console.log(chalk.bold(`\n🔄 Replay da busca #${search.id}: "${search.query}" → ${results.length} resultados\n`));

      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        const valor = r.valorTotalEstimado
          ? `R$ ${r.valorTotalEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
          : 'Não informado';
        console.log(chalk.bold(`  ${i + 1}. ${r.modalidadeNome}`));
        console.log(`     ${r.objetoCompra.substring(0, 100)}${r.objetoCompra.length > 100 ? '...' : ''}`);
        console.log(chalk.dim(`     🏛️  ${r.orgaoRazaoSocial || 'N/A'} — ${r.municipioNome || ''}/${r.ufSigla || ''}`));
        console.log(chalk.dim(`     💰 ${valor} | 📅 ${r.dataAberturaProposta || 'Sem prazo'}`));
        console.log(chalk.dim(`     🔗 ${r.numeroControlePNCP}`));
        console.log();
      }
      return;
    }

    const engine = new FilterEngine(config);
    const filters: Record<string, unknown> = {};
    if (opts.uf) filters.uf = opts.uf;
    if (opts.valorMin) filters.valorMin = parseFloat(opts.valorMin);
    if (opts.valorMax) filters.valorMax = parseFloat(opts.valorMax);

    const results = engine.search({
      keywords,
      uf: opts.uf,
      valorMin: opts.valorMin ? parseFloat(opts.valorMin) : undefined,
      valorMax: opts.valorMax ? parseFloat(opts.valorMax) : undefined,
      apenasAbertas: opts.abertas,
      limit: parseInt(opts.limit),
    });

    // Record search in history
    recordSearch(config.dataDir, keywords.join(' '), Object.keys(filters).length > 0 ? filters : null, results.length);

    if (opts.json) {
      console.log(JSON.stringify(results, null, 2));
      return;
    }

    if (results.length === 0) {
      console.log(chalk.yellow('\nNenhuma licitação encontrada para esses termos.\n'));
      return;
    }

    console.log(chalk.bold(`\n📋 ${results.length} licitações encontradas:\n`));

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      const valor = r.valorTotalEstimado
        ? `R$ ${r.valorTotalEstimado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        : 'Não informado';

      console.log(chalk.bold(`  ${i + 1}. ${r.modalidadeNome}`));
      console.log(`     ${r.objetoCompra.substring(0, 100)}${r.objetoCompra.length > 100 ? '...' : ''}`);
      console.log(chalk.dim(`     🏛️  ${r.orgaoRazaoSocial || 'N/A'} — ${r.municipioNome || ''}/${r.ufSigla || ''}`));
      console.log(chalk.dim(`     💰 ${valor} | 📅 ${r.dataAberturaProposta || 'Sem prazo'}`));
      console.log(chalk.dim(`     🔗 ${r.numeroControlePNCP}`));
      console.log();
    }
  });

program
  .command('backup')
  .description('Criar backup do banco de dados')
  .option('--output <path>', 'Destino customizado para o backup')
  .action((opts) => {
    const config = loadConfig();
    initializeDb(config.dataDir);

    const { createBackup, formatSize } = require('./backup/backup');
    try {
      const result = createBackup(config.dataDir, opts.output);
      console.log(chalk.green(`\n✅ Backup criado com sucesso!`));
      console.log(chalk.dim(`   Arquivo: ${result.path}`));
      console.log(chalk.dim(`   Tamanho: ${formatSize(result.sizeBytes)}`));
      console.log(chalk.dim(`   Tempo: ${result.durationMs}ms\n`));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(chalk.red(`\n❌ Erro ao criar backup: ${msg}\n`));
    }
  });

program
  .command('restore <path>')
  .description('Restaurar banco de dados a partir de backup')
  .action(async (backupPath: string) => {
    const config = loadConfig();
    initializeDb(config.dataDir);

    const { restoreBackup } = require('./backup/restore');
    const result = await restoreBackup(backupPath, config.dataDir);
    if (result.restored) {
      console.log(chalk.green(`\n✅ Backup restaurado com sucesso!\n`));
    } else {
      console.log(chalk.red(`\n❌ ${result.error}\n`));
    }
  });

program
  .command('export <type>')
  .description('Exportar dados em CSV ou JSON')
  .option('--format <format>', 'Formato: csv ou json', 'csv')
  .option('--output <path>', 'Arquivo de saída')
  .option('--uf <ufs...>', 'Filtrar por UF(s)')
  .option('--valor-min <number>', 'Valor mínimo')
  .option('--valor-max <number>', 'Valor máximo')
  .option('--keywords <words...>', 'Filtrar por palavras-chave')
  .action((type: string, opts) => {
    if (type !== 'licitacoes') {
      console.log(chalk.red(`\n❌ Tipo "${type}" não suportado. Use: licitacoes\n`));
      return;
    }

    const config = loadConfig();
    initializeDb(config.dataDir);

    const { exportLicitacoes, getExportFilename } = require('./export/exporter');
    const format = opts.format === 'json' ? 'json' : 'csv';
    const outputPath = opts.output || getExportFilename(format);
    const separator = config.export?.csvSeparator || ';';

    const filters: Record<string, unknown> = {};
    if (opts.uf) filters.uf = opts.uf;
    if (opts.valorMin) filters.valorMin = parseFloat(opts.valorMin);
    if (opts.valorMax) filters.valorMax = parseFloat(opts.valorMax);
    if (opts.keywords) filters.keywords = opts.keywords;

    try {
      const result = exportLicitacoes(config.dataDir, filters, format, outputPath, separator);
      console.log(chalk.green(`\n✅ ${result.count} licitações exportadas!`));
      console.log(chalk.dim(`   Formato: ${result.format.toUpperCase()}`));
      console.log(chalk.dim(`   Arquivo: ${result.path}\n`));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(chalk.red(`\n❌ Erro ao exportar: ${msg}\n`));
    }
  });

program
  .command('stats')
  .description('Estatísticas da base de dados')
  .action(() => {
    const config = loadConfig();
    initializeDb(config.dataDir);

    const engine = new FilterEngine(config);
    const stats = engine.getStats();

    console.log(chalk.bold('\n📊 GarimpoAI - Estatísticas\n'));
    console.log(`  Total de licitações: ${chalk.bold(String(stats.total))}`);
    console.log(`  Matched (filtros):   ${chalk.bold(String(stats.matched))}`);
    console.log(`  Analisadas (IA):     ${chalk.bold(String(stats.analisados))}`);

    if (Object.keys(stats.porUf).length > 0) {
      console.log(chalk.bold('\n  Por UF (top 10):'));
      for (const [uf, count] of Object.entries(stats.porUf)) {
        console.log(`    ${uf}: ${count}`);
      }
    }

    if (Object.keys(stats.porModalidade).length > 0) {
      console.log(chalk.bold('\n  Por Modalidade:'));
      for (const [mod, count] of Object.entries(stats.porModalidade)) {
        console.log(`    ${mod}: ${count}`);
      }
    }
    console.log();
  });

program
  .command('analyze [id]')
  .description('Analisar licitação(ões) com IA')
  .option('--json', 'Output em JSON')
  .option('--batch <ids>', 'Analisar múltiplas (IDs separados por vírgula)')
  .option('--top <number>', 'Analisar top N da última busca')
  .action(async (id: string | undefined, opts) => {
    const config = loadConfig();
    initializeDb(config.dataDir);

    if (!config.ia.apiKey) {
      console.log(chalk.red('\n❌ Chave de API Anthropic necessária para análise.\n'));
      process.exit(1);
    }

    // Handle --batch or --top (batch mode)
    if (opts.batch || opts.top) {
      const { analyzeBatch } = await import('./analyzer/batch');
      let ids: string[] = [];

      if (opts.batch) {
        ids = opts.batch.split(',').map((s: string) => s.trim()).filter(Boolean);
      } else if (opts.top) {
        const { listSearches, getSearch } = require('./filter/search-history');
        const searches = listSearches(config.dataDir, 1);
        if (searches.length === 0) {
          console.log(chalk.red('\n❌ Nenhuma busca anterior encontrada. Execute uma busca primeiro.\n'));
          return;
        }
        const lastSearch = getSearch(config.dataDir, searches[0].id);
        const parsedFilters = lastSearch.filters ? JSON.parse(lastSearch.filters) : {};
        const engine = new FilterEngine(config);
        const results = engine.search({
          keywords: lastSearch.query.split(' '),
          uf: parsedFilters.uf,
          valorMin: parsedFilters.valorMin,
          valorMax: parsedFilters.valorMax,
          limit: parseInt(opts.top),
        });
        ids = results.map((r: { numeroControlePNCP: string }) => r.numeroControlePNCP);
        if (ids.length === 0) {
          console.log(chalk.yellow('\n⚠️  Nenhuma licitação encontrada na última busca.\n'));
          return;
        }
        console.log(chalk.dim(`\n🔍 Usando top ${ids.length} da busca "${lastSearch.query}"\n`));
      }

      if (ids.length > 10) {
        console.log(chalk.yellow(`\n⚠️  Máximo 10 por batch. Usando os primeiros 10.\n`));
        ids = ids.slice(0, 10);
      }

      console.log(chalk.bold(`\n🔬 Analisando ${ids.length} licitações em lote...\n`));

      const result = await analyzeBatch(ids, config, (completed, total) => {
        process.stdout.write(`\r  [${completed}/${total}] Analisando...`);
      });

      console.log('\n');

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      // Table output
      const Table = require('cli-table3');
      const table = new Table({
        head: ['#', 'ID', 'Dificuldade', 'Resumo'],
        colWidths: [4, 25, 13, 60],
        wordWrap: true,
      });

      for (let i = 0; i < result.results.length; i++) {
        const r = result.results[i];
        if (r.error) {
          table.push([i + 1, r.id.substring(0, 22), chalk.red('erro'), r.error.substring(0, 57)]);
        } else {
          const diffColor = r.dificuldade === 'facil' ? chalk.green : r.dificuldade === 'dificil' ? chalk.red : chalk.yellow;
          table.push([
            i + 1,
            r.id.substring(0, 22),
            diffColor(r.dificuldade || '?'),
            (r.resumo || '').substring(0, 57) + ((r.resumo || '').length > 57 ? '...' : ''),
          ]);
        }
      }

      console.log(table.toString());
      console.log(chalk.dim(`\n  ${result.completed}/${result.total} analisadas com sucesso`));
      if (result.stoppedByLimit) {
        console.log(chalk.yellow('  ⚠️  Parou por limite diário atingido'));
      }
      console.log();
      return;
    }

    // Single analysis mode (original)
    if (!id) {
      console.log(chalk.red('\n❌ Informe o ID da licitação ou use --batch/--top.\n'));
      return;
    }

    const { Analyzer } = await import('./analyzer/analyzer');
    const analyzer = new Analyzer(config);

    console.log(chalk.dim('\n⏳ Analisando...\n'));

    try {
      const result = await analyzer.analyze(id);

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      const a = result.analise;
      console.log(chalk.bold.yellow('📋 Análise da Licitação\n'));
      console.log(chalk.bold('Resumo:'), a.resumo);
      console.log(chalk.bold('\nO que é:'), a.oQueE);
      console.log(chalk.bold('\nDificuldade:'), `${a.dificuldade} — ${a.justificativaDificuldade}`);
      console.log(chalk.bold('\nValor:'), a.valorEstimado);
      console.log(chalk.bold('\nPrazo:'), a.prazoProposta || 'Não informado');

      if (a.documentosNecessarios.length > 0) {
        console.log(chalk.bold('\nDocumentos necessários:'));
        for (const doc of a.documentosNecessarios) {
          console.log(`  ${doc.obrigatorio ? '✅' : '⚪'} ${doc.nome}: ${doc.descricao}`);
        }
      }

      if (a.requisitosHabilitacao.length > 0) {
        console.log(chalk.bold('\nRequisitos de habilitação:'));
        for (const req of a.requisitosHabilitacao) {
          console.log(`  • ${req}`);
        }
      }

      console.log(chalk.bold('\n💡 Dica para iniciante:'), a.dicaIniciante);
      console.log(chalk.bold('\n➡️  Próximo passo:'), a.proximoPasso);

      if (result.cached) {
        console.log(chalk.dim('\n(análise carregada do cache)'));
      } else {
        console.log(chalk.dim(`\n(${result.tokensUsados} tokens | US$ ${result.custoEstimado.toFixed(4)})`));
      }
      console.log();
    } catch (err) {
      console.log(chalk.red(`\n❌ ${err instanceof Error ? err.message : err}\n`));
      process.exit(1);
    }
  });

program
  .command('alerts')
  .description('Listar alertas configurados')
  .option('--json', 'Output em JSON')
  .action((opts) => {
    const config = loadConfig();
    initializeDb(config.dataDir);

    const db = getDb(config.dataDir);
    const allAlerts = db.select().from(alertas).all();

    if (opts.json) {
      console.log(JSON.stringify(allAlerts, null, 2));
      return;
    }

    if (allAlerts.length === 0) {
      console.log(chalk.yellow('\nNenhum alerta configurado.'));
      console.log(chalk.dim('  Use o chat para criar: "me avisa quando tiver licitação de software em SP"\n'));
      return;
    }

    console.log(chalk.bold(`\n🔔 ${allAlerts.length} alerta(s):\n`));
    for (const alert of allAlerts) {
      const status = alert.ativo ? chalk.green('ativo') : chalk.red('inativo');
      const keywords = JSON.parse(alert.keywords).join(', ');
      const ufs = alert.ufs ? JSON.parse(alert.ufs).join(', ') : 'todas';
      console.log(`  ${alert.id}. ${alert.nome} [${status}]`);
      console.log(chalk.dim(`     Keywords: ${keywords} | UFs: ${ufs} | Canal: ${alert.canal}`));
      console.log();
    }
  });

// === Document management commands ===
const docs = program
  .command('docs')
  .description('Gerenciar documentos da empresa');

docs
  .command('list')
  .description('Listar documentos cadastrados')
  .option('--status <status>', 'Filtrar por status (vigente, vencido, proximo_vencimento)')
  .option('--json', 'Output em JSON')
  .action((opts) => {
    const config = loadConfig();
    initializeDb(config.dataDir);

    const { DocumentManager } = require('./documents/manager');
    const manager = new DocumentManager(config.dataDir);
    const allDocs = manager.list(opts.status ? { status: opts.status } : undefined);

    if (opts.json) {
      console.log(JSON.stringify(allDocs, null, 2));
      return;
    }

    if (allDocs.length === 0) {
      console.log(chalk.yellow('\nNenhum documento cadastrado.'));
      console.log(chalk.dim('  Use: garimpoai docs add --tipo certidao_federal --nome "CND Federal" --emissor "Receita Federal"\n'));
      return;
    }

    console.log(chalk.bold(`\n📄 ${allDocs.length} documento(s):\n`));
    for (const doc of allDocs) {
      const statusColor = doc.status === 'vigente' ? chalk.green : doc.status === 'vencido' ? chalk.red : chalk.yellow;
      console.log(`  ${doc.id}. ${doc.nome} [${statusColor(doc.status)}]`);
      console.log(chalk.dim(`     Tipo: ${doc.tipo} | Emissor: ${doc.emissor} | Validade: ${doc.dataValidade || 'sem vencimento'}`));
      console.log();
    }
  });

docs
  .command('add')
  .description('Cadastrar novo documento')
  .requiredOption('--tipo <tipo>', 'Tipo do documento')
  .requiredOption('--nome <nome>', 'Nome do documento')
  .requiredOption('--emissor <emissor>', 'Órgão emissor')
  .option('--emissao <data>', 'Data de emissão (YYYY-MM-DD)')
  .option('--validade <data>', 'Data de validade (YYYY-MM-DD)')
  .option('--obs <texto>', 'Observação')
  .action((opts) => {
    const config = loadConfig();
    initializeDb(config.dataDir);

    const { DocumentManager } = require('./documents/manager');
    const manager = new DocumentManager(config.dataDir);
    const doc = manager.register({
      tipo: opts.tipo,
      nome: opts.nome,
      emissor: opts.emissor,
      dataEmissao: opts.emissao,
      dataValidade: opts.validade,
      observacao: opts.obs,
    });

    console.log(chalk.green(`\n✅ Documento cadastrado (ID: ${doc.id})`));
    console.log(chalk.dim(`   ${doc.nome} — ${doc.emissor} — Status: ${doc.status}\n`));
  });

docs
  .command('remove <id>')
  .description('Remover um documento')
  .action((id: string) => {
    const config = loadConfig();
    initializeDb(config.dataDir);

    const { DocumentManager } = require('./documents/manager');
    const manager = new DocumentManager(config.dataDir);
    const removed = manager.remove(parseInt(id));

    if (removed) {
      console.log(chalk.green(`\n✅ Documento ${id} removido.\n`));
    } else {
      console.log(chalk.red(`\n❌ Documento ${id} não encontrado.\n`));
    }
  });

docs
  .command('vencendo')
  .description('Documentos vencendo ou vencidos')
  .option('-d, --days <number>', 'Dias para considerar (default: 30)', '30')
  .action((opts) => {
    const config = loadConfig();
    initializeDb(config.dataDir);

    const { checkExpiry } = require('./documents/expiry-checker');
    const result = checkExpiry(config.dataDir, parseInt(opts.days));

    if (result.expired.length === 0 && result.expiring.length === 0) {
      console.log(chalk.green('\n✅ Nenhum documento vencido ou vencendo.\n'));
      return;
    }

    if (result.expired.length > 0) {
      console.log(chalk.bold.red(`\n⚠️  ${result.expired.length} documento(s) VENCIDO(S):\n`));
      for (const doc of result.expired) {
        console.log(chalk.red(`  • ${doc.nome} (venceu em ${doc.dataValidade})`));
      }
    }

    if (result.expiring.length > 0) {
      console.log(chalk.bold.yellow(`\n⏰ ${result.expiring.length} documento(s) vencendo em breve:\n`));
      for (const doc of result.expiring) {
        console.log(chalk.yellow(`  • ${doc.nome} (vence em ${doc.dataValidade})`));
      }
    }
    console.log();
  });

// === Compliance command ===
program
  .command('compliance <id>')
  .description('Verificar compliance para uma licitação')
  .option('--json', 'Output em JSON')
  .action(async (id: string, opts) => {
    const config = loadConfig();
    initializeDb(config.dataDir);

    if (!config.ia.apiKey) {
      console.log(chalk.red('\n❌ Chave de API Anthropic necessária para compliance.\n'));
      process.exit(1);
    }

    const { ComplianceEngine } = await import('./compliance/engine');
    const engine = new ComplianceEngine(config);

    console.log(chalk.dim('\n⏳ Verificando compliance...\n'));

    try {
      const result = await engine.check(id);

      if (opts.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      const parecerColor = result.parecer === 'apto' ? chalk.green : result.parecer === 'inapto' ? chalk.red : chalk.yellow;
      console.log(chalk.bold.yellow('📋 Verificação de Compliance\n'));
      console.log(chalk.bold('Score:'), `${result.score}/100`);
      console.log(chalk.bold('Parecer:'), parecerColor(result.parecer.toUpperCase()));
      console.log(chalk.bold('\nResumo:'), result.resumo);

      if (result.itens.length > 0) {
        console.log(chalk.bold('\nChecklist:'));
        for (const item of result.itens) {
          const icon = item.status === 'atendido' ? '✅' : item.status === 'parcial' ? '⚠️' : item.status === 'nao_aplicavel' ? '⬜' : '❌';
          console.log(`  ${icon} ${item.requisito}`);
          if (item.documentoNome) console.log(chalk.dim(`     Doc: ${item.documentoNome}`));
          if (item.observacao) console.log(chalk.dim(`     ${item.observacao}`));
        }
      }

      if (result.cached) {
        console.log(chalk.dim('\n(resultado carregado do cache)'));
      } else {
        console.log(chalk.dim(`\n(${result.tokensUsados} tokens | US$ ${result.custoEstimado.toFixed(4)})`));
      }
      console.log();
    } catch (err) {
      console.log(chalk.red(`\n❌ ${err instanceof Error ? err.message : err}\n`));
      process.exit(1);
    }
  });

program
  .command('start')
  .description('Iniciar scheduler automático (daemon mode)')
  .action(async () => {
    const config = loadConfig();
    initializeDb(config.dataDir);

    const { Scheduler } = await import('./scheduler/scheduler');
    const scheduler = new Scheduler(config);

    console.log(chalk.bold.yellow('\n🤖 GarimpoAI — Scheduler\n'));

    // Handle graceful shutdown
    const shutdown = () => {
      console.log(chalk.dim('\nDesligando scheduler...'));
      scheduler.stop();
      process.exit(0);
    };
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    scheduler.start();

    // Keep process alive
    console.log(chalk.dim(`Rodando a cada ${config.scheduler.intervalMinutes} minutos. Ctrl+C para parar.\n`));
  });

program
  .command('config')
  .description('Gerenciar configuração')
  .command('init')
  .description('Criar arquivo de configuração padrão')
  .action(() => {
    const defaultDir = path.join(process.env.HOME || '~', '.garimpoai');
    const configPath = path.join(defaultDir, 'garimpoai.yaml');

    if (fs.existsSync(configPath)) {
      console.log(chalk.yellow(`\n⚠️  Config já existe em: ${configPath}\n`));
      return;
    }

    if (!fs.existsSync(defaultDir)) {
      fs.mkdirSync(defaultDir, { recursive: true });
    }

    fs.writeFileSync(configPath, generateDefaultConfig(), 'utf-8');
    console.log(chalk.green(`\n✅ Config criada em: ${configPath}`));
    console.log(chalk.dim('   Edite o arquivo com suas preferências e chave de API.\n'));
  });

program.parse();
