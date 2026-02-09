// ============================================================================
// GarimpoAI Dashboard - Single Page Application
// Vanilla JS SPA with hash-based routing
// ============================================================================

(function () {
  'use strict';

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  const API = '';

  async function api(path) {
    const res = await fetch(`${API}${path}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }

  function formatBRL(value) {
    if (value == null || isNaN(value)) return 'N/D';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  function formatDate(str) {
    if (!str) return 'N/D';
    const d = new Date(str);
    if (isNaN(d.getTime())) return str;
    return d.toLocaleDateString('pt-BR');
  }

  function formatNumber(n) {
    return new Intl.NumberFormat('pt-BR').format(n || 0);
  }

  function formatDuration(ms) {
    if (!ms) return 'N/D';
    if (ms < 1000) return ms + 'ms';
    const sec = (ms / 1000).toFixed(1);
    if (sec < 60) return sec + 's';
    const min = Math.floor(ms / 60000);
    const remaining = ((ms % 60000) / 1000).toFixed(0);
    return min + 'min ' + remaining + 's';
  }

  function timeAgo(isoStr) {
    if (!isoStr) return 'N/D';
    const date = new Date(isoStr);
    if (isNaN(date.getTime())) return isoStr;
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHrs = Math.floor(diffMin / 60);
    const diffDays = Math.floor(diffHrs / 24);

    if (diffSec < 60) return 'agora';
    if (diffMin < 60) return 'ha ' + diffMin + ' min';
    if (diffHrs < 24) return 'ha ' + diffHrs + 'h';
    if (diffDays < 30) return 'ha ' + diffDays + 'd';
    return formatDate(isoStr);
  }

  function el(id) {
    return document.getElementById(id);
  }

  function render(html) {
    document.getElementById('app').innerHTML = html;
    if (window.lucide) lucide.createIcons();
  }

  function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }

  function safeParse(val, fallback) {
    if (!val) return fallback;
    if (Array.isArray(val)) return val;
    try { return JSON.parse(val); } catch { return fallback; }
  }

  function truncate(str, maxLen) {
    if (!str) return '';
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen) + '...';
  }

  // --------------------------------------------------------------------------
  // Reusable Components
  // --------------------------------------------------------------------------

  function loading() {
    return `<div class="flex items-center justify-center py-20">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
      <span class="ml-3 text-slate-500">Carregando...</span>
    </div>`;
  }

  function errorMessage(msg) {
    return `<div class="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
      <i data-lucide="alert-triangle" class="w-8 h-8 text-red-400 mx-auto mb-2"></i>
      <p class="text-red-600 font-medium">Erro ao carregar dados</p>
      <p class="text-sm text-red-500 mt-1">${escapeHtml(msg)}</p>
    </div>`;
  }

  function emptyState(msg) {
    return `<div class="text-center py-12 text-slate-400">
      <i data-lucide="inbox" class="w-10 h-10 mx-auto mb-3 opacity-50"></i>
      <p class="text-sm">${escapeHtml(msg)}</p>
    </div>`;
  }

  function badge(text, color) {
    return `<span class="text-xs px-2 py-0.5 rounded-full bg-${color}-50 text-${color}-600">${escapeHtml(String(text))}</span>`;
  }

  function sectionTitle(title, icon) {
    return `<div class="flex items-center gap-2 mb-4 mt-8">
      <i data-lucide="${icon}" class="w-5 h-5 text-slate-400"></i>
      <h3 class="text-lg font-semibold text-slate-700">${escapeHtml(title)}</h3>
    </div>`;
  }

  function statCard(label, value, icon, color) {
    return `<div class="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
      <div class="flex items-center justify-between">
        <div>
          <p class="text-sm text-slate-500">${escapeHtml(label)}</p>
          <p class="text-2xl font-bold text-slate-800 mt-1">${value}</p>
        </div>
        <div class="w-12 h-12 rounded-xl bg-${color}-50 flex items-center justify-center">
          <i data-lucide="${icon}" class="w-6 h-6 text-${color}-500"></i>
        </div>
      </div>
    </div>`;
  }

  function parseHashParams() {
    const hash = window.location.hash || '';
    const qIdx = hash.indexOf('?');
    if (qIdx < 0) return {};
    const params = new URLSearchParams(hash.substring(qIdx + 1));
    const result = {};
    for (const [k, v] of params) result[k] = v;
    return result;
  }

  // --------------------------------------------------------------------------
  // State
  // --------------------------------------------------------------------------

  let cachedStats = null;
  const licitacoesState = { offset: 0, limit: 20, total: 0 };

  // --------------------------------------------------------------------------
  // Page: Overview (#overview)
  // --------------------------------------------------------------------------

  async function renderOverview() {
    render(loading());

    try {
      const [stats, buscas, coletas] = await Promise.all([
        api('/api/stats'),
        api('/api/buscas').catch(() => []),
        api('/api/coletas').catch(() => []),
      ]);

      cachedStats = stats;
      const custoHoje = stats.iaUsageHoje ? stats.iaUsageHoje.custoTotal : (stats.custoHoje || 0);

      const html = `
        ${renderStatsCards(stats, custoHoje)}
        ${renderUfDistribution(stats.porUf)}
        ${renderRecentSearches(buscas)}
        ${renderRecentCollections(coletas)}
      `;

      render(html);
    } catch (err) {
      render(errorMessage(err.message));
    }
  }

  function renderStatsCards(stats, custoHoje) {
    const cards = [
      { label: 'Total Licitacoes', value: formatNumber(stats.total), icon: 'file-text', color: 'blue' },
      { label: 'Analisadas', value: formatNumber(stats.analisados || stats.analisadas), icon: 'brain', color: 'green' },
      { label: 'Alertas Ativos', value: formatNumber(stats.alertasAtivos), icon: 'bell', color: 'amber' },
      { label: 'Custo Hoje', value: formatBRL(custoHoje), icon: 'coins', color: 'purple' },
    ];

    return `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      ${cards.map(c => statCard(c.label, c.value, c.icon, c.color)).join('')}
    </div>`;
  }

  function renderUfDistribution(porUf) {
    if (!porUf || Object.keys(porUf).length === 0) return '';

    const sorted = Object.entries(porUf)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);

    const max = sorted[0][1];

    return `
      ${sectionTitle('Distribuicao por UF', 'map-pin')}
      <div class="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <div class="space-y-3">
          ${sorted.map(([uf, count]) => {
            const pct = Math.max((count / max) * 100, 2);
            return `<div class="flex items-center gap-3">
              <span class="text-sm font-medium text-slate-600 w-8">${escapeHtml(uf)}</span>
              <div class="flex-1 bg-slate-100 rounded-full h-5 overflow-hidden">
                <div class="bg-amber-500 h-5 rounded-full transition-all" style="width: ${pct}%"></div>
              </div>
              <span class="text-sm text-slate-500 w-16 text-right">${formatNumber(count)}</span>
            </div>`;
          }).join('')}
        </div>
      </div>
    `;
  }

  function renderRecentSearches(buscas) {
    const items = Array.isArray(buscas) ? buscas : [];

    let content;
    if (items.length === 0) {
      content = emptyState('Nenhuma busca recente');
    } else {
      content = `
        <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-slate-100 bg-slate-50/50">
                <th class="text-left py-3 px-4 font-medium text-slate-500">Query</th>
                <th class="text-left py-3 px-4 font-medium text-slate-500">Resultados</th>
                <th class="text-left py-3 px-4 font-medium text-slate-500">Data</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(b => `
                <tr class="border-b border-slate-50 hover:bg-slate-50/50">
                  <td class="py-3 px-4 text-slate-700">${escapeHtml(b.query || b.keywords || '')}</td>
                  <td class="py-3 px-4 text-slate-600">${formatNumber(b.resultsCount || b.resultados || b.total || 0)}</td>
                  <td class="py-3 px-4 text-slate-500">${timeAgo(b.timestamp || b.data || b.criadoEm)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    return `
      ${sectionTitle('Buscas Recentes', 'search')}
      ${content}
    `;
  }

  function renderRecentCollections(coletas) {
    const items = Array.isArray(coletas) ? coletas : [];

    let content;
    if (items.length === 0) {
      content = emptyState('Nenhuma coleta recente');
    } else {
      content = `
        <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-slate-100 bg-slate-50/50">
                <th class="text-left py-3 px-4 font-medium text-slate-500">Modalidade</th>
                <th class="text-left py-3 px-4 font-medium text-slate-500">Data</th>
                <th class="text-left py-3 px-4 font-medium text-slate-500">Novos</th>
                <th class="text-left py-3 px-4 font-medium text-slate-500">Erros</th>
                <th class="text-left py-3 px-4 font-medium text-slate-500">Duracao</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(c => {
                const sucesso = c.sucesso === true || c.sucesso === 1;
                const hasErrors = (c.erros || 0) > 0;
                const novos = c.novosRegistros ?? c.novos_registros ?? c.novos ?? c.inseridos ?? 0;
                const durMs = c.duracaoMs ?? c.duracao_ms ?? null;
                return `
                  <tr class="border-b border-slate-50 hover:bg-slate-50/50">
                    <td class="py-3 px-4 text-slate-700">${escapeHtml(c.modalidadeId || c.modalidade_id || c.modalidade || c.tipo || '')}</td>
                    <td class="py-3 px-4 text-slate-500">${timeAgo(c.iniciadoEm || c.iniciado_em || c.data || c.criadoEm)}</td>
                    <td class="py-3 px-4">${novos > 0 ? badge('+' + formatNumber(novos), 'green') : badge('0', 'slate')}</td>
                    <td class="py-3 px-4">${hasErrors ? badge(c.erros, 'red') : badge('0', 'slate')}</td>
                    <td class="py-3 px-4 text-slate-500">${formatDuration(durMs)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    return `
      ${sectionTitle('Coletas Recentes', 'download')}
      ${content}
    `;
  }

  // --------------------------------------------------------------------------
  // Page: Licitacoes (#licitacoes)
  // --------------------------------------------------------------------------

  async function renderLicitacoes() {
    render(loading());

    try {
      // Load stats for UF dropdown if not cached
      if (!cachedStats) {
        cachedStats = await api('/api/stats').catch(() => null);
      }

      // Parse hash params
      const params = parseHashParams();
      const keywords = params.keywords || '';
      const uf = params.uf || '';
      const valorMin = params.valorMin || '';
      const valorMax = params.valorMax || '';
      const offset = parseInt(params.offset) || 0;
      licitacoesState.offset = offset;

      // Build UF options from stats
      const ufs = cachedStats?.porUf ? Object.keys(cachedStats.porUf).sort() : [];

      // Render search form immediately, then show loading for results
      const searchHtml = renderSearchForm(keywords, uf, valorMin, valorMax, ufs);
      render(searchHtml + `<div id="lic-results">${loading()}</div><div id="lic-detail"></div>`);

      // Fetch results
      const queryParts = [];
      if (keywords) queryParts.push(`keywords=${encodeURIComponent(keywords)}`);
      if (uf) queryParts.push(`uf=${encodeURIComponent(uf)}`);
      if (valorMin) queryParts.push(`valorMin=${encodeURIComponent(valorMin)}`);
      if (valorMax) queryParts.push(`valorMax=${encodeURIComponent(valorMax)}`);
      queryParts.push(`limit=${licitacoesState.limit}`);
      queryParts.push(`offset=${offset}`);

      const data = await api(`/api/licitacoes?${queryParts.join('&')}`);
      const items = Array.isArray(data) ? data : (data.results || data.items || data.licitacoes || []);
      const total = data.total != null ? data.total : items.length;
      licitacoesState.total = total;

      renderLicitacoesResults(items, total, offset);
    } catch (err) {
      render(errorMessage(err.message));
    }
  }

  function renderSearchForm(keywords, uf, valorMin, valorMax, ufs) {
    return `
      <div class="bg-white rounded-xl p-5 shadow-sm border border-slate-100 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div class="lg:col-span-2">
            <input type="text" id="search-keywords" value="${escapeHtml(keywords)}"
              placeholder="Buscar licitacoes..."
              class="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500"
              onkeydown="if(event.key==='Enter') window._searchLicitacoes()" />
          </div>
          <div>
            <select id="search-uf"
              class="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 bg-white">
              <option value="">Todas UFs</option>
              ${ufs.map(u => `<option value="${escapeHtml(u)}" ${u === uf ? 'selected' : ''}>${escapeHtml(u)}</option>`).join('')}
            </select>
          </div>
          <div>
            <input type="number" id="search-valor-min" value="${escapeHtml(valorMin)}"
              placeholder="Valor Min"
              class="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500" />
          </div>
          <div class="flex gap-2">
            <input type="number" id="search-valor-max" value="${escapeHtml(valorMax)}"
              placeholder="Valor Max"
              class="flex-1 px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500" />
            <button onclick="window._searchLicitacoes()"
              class="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap flex items-center gap-1.5">
              <i data-lucide="search" class="w-4 h-4"></i>
              Buscar
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function renderLicitacoesResults(items, total, offset) {
    const container = el('lic-results');
    if (!container) return;

    const limit = licitacoesState.limit;
    const start = total > 0 ? offset + 1 : 0;
    const end = Math.min(offset + limit, total);

    let html = `
      <p class="text-sm text-slate-500 mb-4">${formatNumber(total)} licitacoes encontradas
        ${total > 0 ? `<span class="text-slate-400">(${start}-${end})</span>` : ''}
      </p>
    `;

    if (items.length === 0) {
      html += emptyState('Nenhuma licitacao encontrada para os filtros selecionados');
    } else {
      html += `<div class="grid gap-4">
        ${items.map(lic => renderLicitacaoCard(lic)).join('')}
      </div>`;
    }

    // Pagination
    if (total > limit) {
      const hasPrev = offset > 0;
      const hasNext = offset + limit < total;
      html += `
        <div class="flex items-center justify-between mt-6">
          <button onclick="window._paginateLicitacoes(${offset - limit})"
            class="px-4 py-2 text-sm border border-slate-200 rounded-lg flex items-center gap-1 ${hasPrev ? 'hover:bg-slate-50 text-slate-700' : 'text-slate-300 cursor-not-allowed'}"
            ${hasPrev ? '' : 'disabled'}>
            <i data-lucide="chevron-left" class="w-4 h-4"></i> Anterior
          </button>
          <span class="text-sm text-slate-500">${start}-${end} de ${formatNumber(total)}</span>
          <button onclick="window._paginateLicitacoes(${offset + limit})"
            class="px-4 py-2 text-sm border border-slate-200 rounded-lg flex items-center gap-1 ${hasNext ? 'hover:bg-slate-50 text-slate-700' : 'text-slate-300 cursor-not-allowed'}"
            ${hasNext ? '' : 'disabled'}>
            Proximo <i data-lucide="chevron-right" class="w-4 h-4"></i>
          </button>
        </div>
      `;
    }

    container.innerHTML = html;
    if (window.lucide) lucide.createIcons();
  }

  function renderLicitacaoCard(lic) {
    const id = lic.numeroControlePNCP || lic.id || lic.pncp_id || '';
    const objeto = lic.objetoCompra || lic.objeto || lic.objeto_compra || '';
    const orgao = lic.orgaoRazaoSocial || lic.orgao || lic.orgao_razao_social || '';
    const ufSigla = lic.ufSigla || lic.uf || lic.uf_sigla || '';
    const valor = lic.valorTotalEstimado ?? lic.valor ?? lic.valor_total_estimado ?? null;
    const dataAbertura = lic.dataAberturaProposta || lic.dataAbertura || lic.data_abertura_proposta || '';
    const modalidade = lic.modalidadeNome || lic.modalidade || lic.modalidade_nome || '';
    const analisado = lic.analisado || lic.temAnalise || false;

    return `
      <div class="bg-white rounded-xl p-5 shadow-sm border border-slate-100 hover:shadow-md transition-shadow cursor-pointer"
        onclick="window._viewLicitacao('${escapeHtml(String(id))}')">
        <div class="flex justify-between items-start">
          <div class="flex-1 mr-3">
            <h3 class="font-medium text-slate-800 line-clamp-2">${escapeHtml(objeto)}</h3>
            <p class="text-sm text-slate-500 mt-1">${escapeHtml(orgao)}</p>
          </div>
          ${ufSigla ? badge(ufSigla, 'blue') : ''}
        </div>
        <div class="flex flex-wrap gap-4 mt-3 text-sm text-slate-500">
          <span>Valor: ${formatBRL(valor)}</span>
          <span>Abertura: ${formatDate(dataAbertura)}</span>
          ${modalidade ? `<span>Modalidade: ${escapeHtml(modalidade)}</span>` : ''}
        </div>
        ${analisado ? `<div class="mt-2">${badge('Analisada', 'green')}</div>` : ''}
      </div>
    `;
  }

  // -- Detail view --

  async function viewLicitacao(id) {
    // Check if we're inside the licitacoes page with a detail panel
    const detailEl = el('lic-detail');
    const target = detailEl || document.getElementById('app');

    if (detailEl) {
      detailEl.innerHTML = `<div class="mt-4">${loading()}</div>`;
      if (window.lucide) lucide.createIcons();
    } else {
      render(loading());
    }

    try {
      const data = await api(`/api/licitacoes/${encodeURIComponent(id)}`);

      // API may return { licitacoes: {...}, analises: {...} } or flat object
      const lic = data.licitacoes || data;
      const analise = data.analises || data.analise || null;

      const objeto = lic.objetoCompra || lic.objeto || lic.objeto_compra || '';
      const orgao = lic.orgaoRazaoSocial || lic.orgao || lic.orgao_razao_social || '';
      const ufSigla = lic.ufSigla || lic.uf || lic.uf_sigla || '';
      const valor = lic.valorTotalEstimado ?? lic.valor ?? lic.valor_total_estimado ?? null;
      const dataAbertura = lic.dataAberturaProposta || lic.dataAbertura || lic.data_abertura_proposta || '';
      const modalidade = lic.modalidadeNome || lic.modalidade || lic.modalidade_nome || '';

      let analiseHtml = '';
      if (analise) {
        analiseHtml = renderAnalise(analise);
      } else {
        analiseHtml = `
          <div class="pt-4 mt-4 border-t border-slate-100">
            <p class="text-sm text-slate-400 flex items-center gap-2">
              <i data-lucide="brain" class="w-4 h-4"></i>
              Nenhuma analise de IA disponivel para esta licitacao.
            </p>
          </div>
        `;
      }

      const detailHtml = `
        <div class="bg-white rounded-xl p-6 shadow-sm border border-slate-100 mt-4">
          <div class="flex items-start justify-between mb-4">
            <button onclick="window._backToLicitacoes()"
              class="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 transition-colors">
              <i data-lucide="arrow-left" class="w-4 h-4"></i> Voltar para lista
            </button>
            <button onclick="window._closeDetail()"
              class="text-slate-400 hover:text-slate-600 transition-colors p-1">
              <i data-lucide="x" class="w-5 h-5"></i>
            </button>
          </div>

          <h2 class="text-xl font-semibold text-slate-800 mb-4">${escapeHtml(objeto)}</h2>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-6">
            <div>
              <p class="text-slate-400 text-xs uppercase font-medium mb-1">Orgao</p>
              <p class="text-slate-700">${escapeHtml(orgao)}</p>
            </div>
            <div>
              <p class="text-slate-400 text-xs uppercase font-medium mb-1">Valor Estimado</p>
              <p class="text-slate-700 font-medium">${formatBRL(valor)}</p>
            </div>
            <div>
              <p class="text-slate-400 text-xs uppercase font-medium mb-1">Data de Abertura</p>
              <p class="text-slate-700">${formatDate(dataAbertura)}</p>
            </div>
            <div>
              <p class="text-slate-400 text-xs uppercase font-medium mb-1">Modalidade</p>
              <p class="text-slate-700">${escapeHtml(modalidade)}</p>
            </div>
            <div>
              <p class="text-slate-400 text-xs uppercase font-medium mb-1">UF</p>
              <p class="text-slate-700">${ufSigla ? badge(ufSigla, 'blue') : 'N/D'}</p>
            </div>
            ${lic.situacaoCompraNome || lic.situacao_compra_nome ? `<div>
              <p class="text-slate-400 text-xs uppercase font-medium mb-1">Situacao</p>
              <p class="text-slate-700">${escapeHtml(lic.situacaoCompraNome || lic.situacao_compra_nome)}</p>
            </div>` : ''}
            ${lic.orgaoCnpj || lic.orgao_cnpj || lic.cnpj ? `<div>
              <p class="text-slate-400 text-xs uppercase font-medium mb-1">CNPJ</p>
              <p class="text-slate-700 font-mono text-xs">${escapeHtml(lic.orgaoCnpj || lic.orgao_cnpj || lic.cnpj)}</p>
            </div>` : ''}
            ${lic.srp != null ? `<div>
              <p class="text-slate-400 text-xs uppercase font-medium mb-1">SRP</p>
              <p class="text-slate-700">${lic.srp ? 'Sim' : 'Nao'}</p>
            </div>` : ''}
            ${lic.valorTotalHomologado ?? lic.valor_total_homologado ? `<div>
              <p class="text-slate-400 text-xs uppercase font-medium mb-1">Valor Homologado</p>
              <p class="text-slate-700">${formatBRL(lic.valorTotalHomologado ?? lic.valor_total_homologado)}</p>
            </div>` : ''}
          </div>

          ${(lic.linkSistemaOrigem || lic.link_sistema_origem || lic.linkProcessoEletronico || lic.link_processo_eletronico) ? `
            <div class="flex flex-wrap gap-3 mb-6">
              ${(lic.linkSistemaOrigem || lic.link_sistema_origem) ? `<a href="${escapeHtml(lic.linkSistemaOrigem || lic.link_sistema_origem)}" target="_blank" rel="noopener" class="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1"><i data-lucide="external-link" class="w-3.5 h-3.5"></i>Sistema de Origem</a>` : ''}
              ${(lic.linkProcessoEletronico || lic.link_processo_eletronico) ? `<a href="${escapeHtml(lic.linkProcessoEletronico || lic.link_processo_eletronico)}" target="_blank" rel="noopener" class="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1"><i data-lucide="external-link" class="w-3.5 h-3.5"></i>Processo Eletronico</a>` : ''}
            </div>
          ` : ''}

          ${analiseHtml}
        </div>
      `;

      if (detailEl) {
        detailEl.innerHTML = detailHtml;
      } else {
        render(detailHtml);
      }
      if (window.lucide) lucide.createIcons();
    } catch (err) {
      const errHtml = `<div class="mt-4">${errorMessage(err.message)}</div>`;
      if (detailEl) {
        detailEl.innerHTML = errHtml;
      } else {
        render(errHtml);
      }
      if (window.lucide) lucide.createIcons();
    }
  }

  function renderAnalise(analise) {
    const docsNecessarios = safeParse(analise.documentosNecessarios || analise.documentos_necessarios, []);
    const dific = analise.dificuldade || '';
    const dificuldadeColor = { facil: 'green', medio: 'amber', media: 'amber', dificil: 'red' }[dific] || 'slate';

    return `
      <div class="pt-4 mt-4 border-t border-slate-100">
        <h4 class="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <i data-lucide="brain" class="w-4 h-4 text-purple-500"></i>
          Analise de IA
          ${analise.modelo ? badge('Modelo: ' + analise.modelo, 'slate') : ''}
        </h4>

        ${analise.resumo ? `
          <div class="bg-purple-50 rounded-lg p-4 mb-4">
            <p class="text-xs font-medium text-purple-400 uppercase mb-1">Resumo</p>
            <p class="text-sm text-slate-800 leading-relaxed">${escapeHtml(analise.resumo)}</p>
          </div>
        ` : ''}

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          ${analise.oQueE || analise.o_que_e ? `<div>
            <p class="text-xs text-slate-400 uppercase font-medium mb-1">O que e</p>
            <p class="text-sm text-slate-700">${escapeHtml(analise.oQueE || analise.o_que_e)}</p>
          </div>` : ''}
          ${dific ? `<div>
            <p class="text-xs text-slate-400 uppercase font-medium mb-1">Dificuldade</p>
            <p class="text-sm">${badge(dific, dificuldadeColor)}</p>
            ${(analise.justificativaDificuldade || analise.justificativa_dificuldade) ? `<p class="text-xs text-slate-500 mt-1">${escapeHtml(analise.justificativaDificuldade || analise.justificativa_dificuldade)}</p>` : ''}
          </div>` : ''}
        </div>

        ${docsNecessarios.length > 0 ? `
          <div class="mb-4">
            <p class="text-xs text-slate-400 uppercase font-medium mb-2">Documentos Necessarios</p>
            <div class="flex flex-wrap gap-1.5">
              ${docsNecessarios.map(d => badge(typeof d === 'string' ? d : (d.nome || JSON.stringify(d)), 'blue')).join('')}
            </div>
          </div>
        ` : ''}

        ${(analise.documentos_necessarios && typeof analise.documentos_necessarios === 'string') ? `
          <div class="mb-4">
            <p class="text-xs text-slate-400 uppercase font-medium mb-1">Documentos Necessarios</p>
            <p class="text-sm text-slate-700">${escapeHtml(analise.documentos_necessarios)}</p>
          </div>
        ` : ''}

        ${(analise.dicaIniciante || analise.dica_iniciante) ? `
          <div class="bg-amber-50 border border-amber-100 rounded-lg p-3 mb-4">
            <p class="text-xs font-medium text-amber-700 mb-1 flex items-center gap-1">
              <i data-lucide="lightbulb" class="w-3 h-3"></i> Dica para Iniciantes
            </p>
            <p class="text-sm text-amber-800">${escapeHtml(analise.dicaIniciante || analise.dica_iniciante)}</p>
          </div>
        ` : ''}

        ${(analise.proximoPasso || analise.proximo_passo) ? `
          <div class="bg-blue-50 border border-blue-100 rounded-lg p-3">
            <p class="text-xs font-medium text-blue-700 mb-1 flex items-center gap-1">
              <i data-lucide="arrow-right" class="w-3 h-3"></i> Proximo Passo
            </p>
            <p class="text-sm text-blue-800">${escapeHtml(analise.proximoPasso || analise.proximo_passo)}</p>
          </div>
        ` : ''}
      </div>
    `;
  }

  // -- Search / pagination --

  function searchLicitacoes() {
    const keywords = (el('search-keywords')?.value || '').trim();
    const uf = el('search-uf')?.value || '';
    const valorMin = el('search-valor-min')?.value || '';
    const valorMax = el('search-valor-max')?.value || '';

    const params = [];
    if (keywords) params.push(`keywords=${encodeURIComponent(keywords)}`);
    if (uf) params.push(`uf=${encodeURIComponent(uf)}`);
    if (valorMin) params.push(`valorMin=${encodeURIComponent(valorMin)}`);
    if (valorMax) params.push(`valorMax=${encodeURIComponent(valorMax)}`);

    window.location.hash = '#licitacoes' + (params.length ? '?' + params.join('&') : '');
  }

  function paginateLicitacoes(newOffset) {
    const hash = window.location.hash || '#licitacoes';
    const [base, queryStr] = hash.split('?');
    const params = new URLSearchParams(queryStr || '');
    params.set('offset', String(Math.max(0, newOffset)));
    window.location.hash = base + '?' + params.toString();
  }

  function backToLicitacoes() {
    const detailEl = el('lic-detail');
    if (detailEl) {
      detailEl.innerHTML = '';
    } else {
      renderLicitacoes();
    }
  }

  function closeDetail() {
    const detailEl = el('lic-detail');
    if (detailEl) detailEl.innerHTML = '';
  }

  // --------------------------------------------------------------------------
  // Page: Alertas (#alertas)
  // --------------------------------------------------------------------------

  async function renderAlertas() {
    render(loading());

    try {
      const alertasData = await api('/api/alertas');
      const items = Array.isArray(alertasData) ? alertasData : (alertasData.items || []);

      const html = `
        ${renderAlertForm()}

        ${sectionTitle('Alertas Configurados', 'bell')}
        ${items.length === 0
          ? emptyState('Nenhum alerta configurado. Crie o primeiro usando o formulario acima.')
          : `<div class="grid grid-cols-1 md:grid-cols-2 gap-4">${items.map(a => renderAlertCard(a)).join('')}</div>`
        }
        <div id="alert-scores-panel"></div>
      `;

      render(html);
    } catch (err) {
      render(errorMessage(err.message));
    }
  }

  function renderAlertForm() {
    return `
      <div class="bg-white rounded-xl shadow-sm border border-slate-100 mb-6">
        <button onclick="window._toggleAlertForm()"
          class="w-full flex items-center justify-between px-5 py-4 text-left">
          <div class="flex items-center gap-2">
            <i data-lucide="plus-circle" class="w-5 h-5 text-amber-500"></i>
            <span class="font-medium text-slate-700">Criar Novo Alerta</span>
          </div>
          <i data-lucide="chevron-down" id="alert-form-chevron" class="w-5 h-5 text-slate-400 transition-transform"></i>
        </button>
        <div id="alert-form-body" class="hidden px-5 pb-5">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-slate-600 mb-1">Nome *</label>
              <input type="text" id="alert-nome" placeholder="Ex: Servicos de TI"
                class="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-600 mb-1">Keywords (separadas por virgula) *</label>
              <input type="text" id="alert-keywords" placeholder="software, TI, desenvolvimento"
                class="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-600 mb-1">UFs (opcional, separadas por virgula)</label>
              <input type="text" id="alert-ufs" placeholder="SP, RJ, MG"
                class="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-600 mb-1">Canal</label>
              <select id="alert-canal"
                class="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500 bg-white">
                <option value="telegram">Telegram</option>
                <option value="email">Email</option>
                <option value="ambos">Ambos</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-600 mb-1">Valor Min (opcional)</label>
              <input type="number" id="alert-valor-min" placeholder="0"
                class="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500" />
            </div>
            <div>
              <label class="block text-sm font-medium text-slate-600 mb-1">Valor Max (opcional)</label>
              <input type="number" id="alert-valor-max" placeholder="0"
                class="w-full px-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/40 focus:border-amber-500" />
            </div>
          </div>
          <div id="alert-form-message" class="mt-3 text-sm hidden"></div>
          <button onclick="window._createAlert()"
            class="mt-4 px-6 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <i data-lucide="plus" class="w-4 h-4"></i>
            Criar Alerta
          </button>
        </div>
      </div>
    `;
  }

  function renderAlertCard(a) {
    const keywords = safeParse(a.keywords, []);
    const ufs = safeParse(a.ufs, []);
    const ativo = a.ativo !== false && a.ativo !== 0;
    const id = a.id;

    return `
      <div class="bg-white rounded-xl p-5 shadow-sm border border-slate-100">
        <div class="flex justify-between items-start">
          <div class="flex-1">
            <h3 class="font-medium text-slate-800">${escapeHtml(a.nome || 'Sem nome')}</h3>
            <p class="text-xs text-slate-400 mt-0.5">Criado em ${formatDate(a.criadoEm)}</p>
            <div class="flex gap-1 mt-2 flex-wrap">
              ${keywords.map(k => badge(k, 'amber')).join('')}
            </div>
            ${ufs.length > 0 ? `<div class="flex gap-1 mt-1 flex-wrap">
              ${ufs.map(u => badge(u, 'blue')).join('')}
            </div>` : ''}
            <div class="flex flex-wrap gap-3 mt-2 text-sm text-slate-500">
              ${a.canal ? `<span>Canal: ${badge(a.canal, 'purple')}</span>` : ''}
              ${a.valorMinimo || a.valorMin || a.valorMaximo || a.valorMax ? `<span>Valor: ${formatBRL(a.valorMinimo || a.valorMin)} - ${formatBRL(a.valorMaximo || a.valorMax)}</span>` : ''}
            </div>
          </div>
          <div class="flex flex-col items-end gap-2 ml-3">
            <label class="relative inline-flex items-center cursor-pointer">
              <input type="checkbox" class="sr-only peer" ${ativo ? 'checked' : ''}
                onchange="window._toggleAlert(${id}, this.checked)" />
              <div class="w-9 h-5 bg-slate-200 peer-focus:ring-2 peer-focus:ring-amber-500/20 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
            </label>
            <button onclick="window._showAlertScores(${id}, '${escapeHtml(a.nome || '')}')"
              class="text-xs text-slate-400 hover:text-amber-500 transition-colors flex items-center gap-1">
              <i data-lucide="bar-chart-3" class="w-3.5 h-3.5"></i>
              Ver scores
            </button>
          </div>
        </div>
      </div>
    `;
  }

  function toggleAlertForm() {
    const body = el('alert-form-body');
    const chevron = el('alert-form-chevron');
    if (!body) return;
    body.classList.toggle('hidden');
    if (chevron) chevron.style.transform = body.classList.contains('hidden') ? '' : 'rotate(180deg)';
  }

  async function createAlert() {
    const nome = el('alert-nome')?.value?.trim();
    const keywordsRaw = el('alert-keywords')?.value?.trim();
    const ufsRaw = el('alert-ufs')?.value?.trim();
    const canal = el('alert-canal')?.value;
    const valorMin = el('alert-valor-min')?.value;
    const valorMax = el('alert-valor-max')?.value;
    const msgEl = el('alert-form-message');

    if (!nome || !keywordsRaw) {
      if (msgEl) {
        msgEl.className = 'mt-3 text-sm text-red-600';
        msgEl.textContent = 'Nome e keywords sao obrigatorios.';
        msgEl.classList.remove('hidden');
      }
      return;
    }

    try {
      if (msgEl) {
        msgEl.className = 'mt-3 text-sm text-slate-500';
        msgEl.textContent = 'Criando alerta...';
        msgEl.classList.remove('hidden');
      }

      const body = {
        nome,
        keywords: keywordsRaw.split(',').map(s => s.trim()).filter(Boolean),
        canal: canal || 'telegram',
      };
      if (ufsRaw) body.ufs = ufsRaw.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
      if (valorMin) body.valorMinimo = Number(valorMin);
      if (valorMax) body.valorMaximo = Number(valorMax);

      const res = await fetch(`${API}/api/alertas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Erro: ${res.status}`);
      }

      if (msgEl) {
        msgEl.className = 'mt-3 text-sm text-green-600';
        msgEl.textContent = 'Alerta criado com sucesso!';
      }

      setTimeout(() => renderAlertas(), 800);
    } catch (err) {
      if (msgEl) {
        msgEl.className = 'mt-3 text-sm text-red-600';
        msgEl.textContent = `Erro ao criar alerta: ${err.message}`;
        msgEl.classList.remove('hidden');
      }
    }
  }

  async function toggleAlert(id, newStatus) {
    try {
      const res = await fetch(`${API}/api/alertas/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: newStatus }),
      });
      if (!res.ok) throw new Error(`Erro: ${res.status}`);
    } catch (err) {
      alert(`Erro ao atualizar alerta: ${err.message}`);
      renderAlertas();
    }
  }

  async function showAlertScores(id, nome) {
    const panel = el('alert-scores-panel');
    if (!panel) return;

    panel.innerHTML = `<div class="mt-6">${loading()}</div>`;
    if (window.lucide) lucide.createIcons();

    try {
      const scores = await api(`/api/alertas/${id}/scores`);
      const items = Array.isArray(scores) ? scores : (scores.items || []);

      if (items.length === 0) {
        panel.innerHTML = `
          <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-6 mt-6">
            <div class="flex items-center justify-between mb-3">
              <h4 class="text-sm font-semibold text-slate-700">Matches: ${escapeHtml(nome)}</h4>
              <button onclick="el('alert-scores-panel').innerHTML=''" class="text-slate-400 hover:text-slate-600 p-1">
                <i data-lucide="x" class="w-4 h-4"></i>
              </button>
            </div>
            ${emptyState('Nenhum match encontrado para este alerta.')}
          </div>
        `;
        if (window.lucide) lucide.createIcons();
        return;
      }

      panel.innerHTML = `
        <div class="mt-6">
          ${sectionTitle('Scores do Alerta: ' + (nome || '#' + id), 'bar-chart-3')}
          <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <div class="flex justify-end px-4 pt-3">
              <button onclick="document.getElementById('alert-scores-panel').innerHTML=''" class="text-slate-400 hover:text-slate-600 p-1">
                <i data-lucide="x" class="w-4 h-4"></i>
              </button>
            </div>
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-slate-100 bg-slate-50/50">
                  <th class="text-left py-3 px-4 font-medium text-slate-500">Licitacao</th>
                  <th class="text-left py-3 px-4 font-medium text-slate-500">Score</th>
                  <th class="text-left py-3 px-4 font-medium text-slate-500">Resumo</th>
                  <th class="text-left py-3 px-4 font-medium text-slate-500">Data</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(s => {
                  const scoreVal = s.semantic_score != null ? (s.semantic_score * 100).toFixed(0) + '%' : (s.score || 'N/D');
                  const scoreNum = s.semantic_score != null ? s.semantic_score * 100 : (s.score || 0);
                  const scoreColor = scoreNum >= 70 ? 'green' : scoreNum >= 40 ? 'amber' : 'slate';
                  const licId = s.licitacao_id || s.licitacaoId || '';
                  return `
                    <tr class="border-b border-slate-50 hover:bg-slate-50/50 cursor-pointer"
                      onclick="window._viewLicitacao('${escapeHtml(String(licId))}')">
                      <td class="py-3 px-4 text-slate-700 font-mono text-xs">${escapeHtml(truncate(String(licId), 30))}</td>
                      <td class="py-3 px-4">${badge(scoreVal, scoreColor)}</td>
                      <td class="py-3 px-4 text-slate-600">${escapeHtml(truncate(s.resumo || s.objeto || '', 80))}</td>
                      <td class="py-3 px-4 text-slate-500 text-xs">${timeAgo(s.timestamp || s.data || s.criadoEm)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
      if (window.lucide) lucide.createIcons();
    } catch (err) {
      panel.innerHTML = `<div class="mt-6">${errorMessage(err.message)}</div>`;
      if (window.lucide) lucide.createIcons();
    }
  }

  // --------------------------------------------------------------------------
  // Page: Compliance (#compliance)
  // --------------------------------------------------------------------------

  async function renderCompliance() {
    render(loading());

    try {
      const [docs, expiringData] = await Promise.all([
        api('/api/documentos'),
        api('/api/documentos/expiring').catch(() => []),
      ]);

      const items = Array.isArray(docs) ? docs : (docs.items || []);

      // Handle both formats: array of expiring or {expiring: [], expired: []}
      const expiring = Array.isArray(expiringData) ? expiringData : (expiringData.expiring || []);
      const expired = Array.isArray(expiringData) ? [] : (expiringData.expired || []);

      // Also check items directly for documents expiring within 30 days
      const now = new Date();
      const thirtyDays = 30 * 24 * 60 * 60 * 1000;
      const nearExpiry = items.filter(d => {
        const val = d.dataValidade || d.validade || d.vencimento;
        if (!val) return false;
        const exp = new Date(val);
        return exp.getTime() - now.getTime() < thirtyDays && exp.getTime() > now.getTime();
      });

      const alertCount = Math.max(expiring.length, nearExpiry.length);

      let alertHtml = '';
      if (alertCount > 0 || expired.length > 0) {
        alertHtml = `
          <div class="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <i data-lucide="alert-triangle" class="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0"></i>
            <div>
              ${expired.length > 0 ? `<p class="font-medium text-red-700">${expired.length} documento(s) vencido(s)</p>` : ''}
              ${alertCount > 0 ? `<p class="font-medium text-amber-700">${alertCount} documento(s) proximo(s) do vencimento</p>` : ''}
              <p class="text-sm text-amber-600 mt-1">Verifique os documentos listados abaixo e providencie a renovacao.</p>
            </div>
          </div>
        `;
      }

      let docsHtml;
      if (items.length === 0) {
        docsHtml = emptyState('Nenhum documento cadastrado');
      } else {
        docsHtml = `
          <div class="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-slate-100 bg-slate-50/50">
                  <th class="text-left py-3 px-4 font-medium text-slate-500">Documento</th>
                  <th class="text-left py-3 px-4 font-medium text-slate-500">Tipo</th>
                  <th class="text-left py-3 px-4 font-medium text-slate-500">Emissor</th>
                  <th class="text-left py-3 px-4 font-medium text-slate-500">Validade</th>
                  <th class="text-left py-3 px-4 font-medium text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(d => {
                  const validade = d.dataValidade || d.validade || d.vencimento;
                  const status = getDocumentStatus(d.status, validade);
                  return `
                    <tr class="border-b border-slate-50 hover:bg-slate-50/50">
                      <td class="py-3 px-4 text-slate-700">${escapeHtml(d.nome || d.titulo || '')}</td>
                      <td class="py-3 px-4 text-slate-500">${escapeHtml(d.tipo || '')}</td>
                      <td class="py-3 px-4 text-slate-500">${escapeHtml(d.emissor || '')}</td>
                      <td class="py-3 px-4 text-slate-500">${formatDate(validade)}</td>
                      <td class="py-3 px-4">${badge(status.label, status.color)}</td>
                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;
      }

      const html = `
        ${sectionTitle('Documentos', 'file-check')}
        ${alertHtml}
        ${docsHtml}

        <div class="bg-blue-50 border border-blue-200 rounded-xl p-5 mt-8 flex items-start gap-3">
          <i data-lucide="terminal" class="w-5 h-5 text-blue-500 mt-0.5 flex-shrink-0"></i>
          <div>
            <p class="font-medium text-blue-700">Verificacao de Compliance</p>
            <p class="text-sm text-blue-600 mt-1">Para verificar compliance de uma licitacao especifica, use o CLI:</p>
            <code class="block mt-2 px-3 py-2 bg-blue-100/50 rounded-lg text-sm text-blue-800 font-mono">garimpoai compliance &lt;licitacao-id&gt;</code>
          </div>
        </div>
      `;

      render(html);
    } catch (err) {
      render(errorMessage(err.message));
    }
  }

  function getDocumentStatus(apiStatus, validade) {
    // Use API-provided status if available
    const statusMap = {
      vigente: { label: 'Vigente', color: 'green' },
      proximo_vencimento: { label: 'Proximo vencimento', color: 'amber' },
      vencido: { label: 'Vencido', color: 'red' },
    };

    if (apiStatus && statusMap[apiStatus]) return statusMap[apiStatus];

    // Fallback: calculate from date
    if (!validade) return { label: 'Sem validade', color: 'slate' };

    const now = new Date();
    const exp = new Date(validade);
    const diff = exp.getTime() - now.getTime();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    if (diff < 0) return { label: 'Vencido', color: 'red' };
    if (diff < thirtyDays) return { label: 'Proximo vencimento', color: 'amber' };
    return { label: 'Vigente', color: 'green' };
  }

  // --------------------------------------------------------------------------
  // Page: Sistema (#sistema)
  // --------------------------------------------------------------------------

  let sistemaTab = 'custos';

  async function renderSistema() {
    render(`
      ${sectionTitle('Sistema', 'settings')}

      <!-- Tabs -->
      <div class="flex gap-1 bg-slate-100 rounded-lg p-1 mb-6 overflow-x-auto">
        <button onclick="window._switchSistemaTab('custos')" id="tab-custos"
          class="px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${sistemaTab === 'custos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}">
          <span class="flex items-center gap-1.5"><i data-lucide="coins" class="w-3.5 h-3.5"></i>Custos IA</span>
        </button>
        <button onclick="window._switchSistemaTab('chat')" id="tab-chat"
          class="px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${sistemaTab === 'chat' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}">
          <span class="flex items-center gap-1.5"><i data-lucide="message-circle" class="w-3.5 h-3.5"></i>Chat</span>
        </button>
        <button onclick="window._switchSistemaTab('backup')" id="tab-backup"
          class="px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${sistemaTab === 'backup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}">
          <span class="flex items-center gap-1.5"><i data-lucide="hard-drive" class="w-3.5 h-3.5"></i>Backup</span>
        </button>
        <button onclick="window._switchSistemaTab('config')" id="tab-config"
          class="px-4 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${sistemaTab === 'config' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}">
          <span class="flex items-center gap-1.5"><i data-lucide="sliders-horizontal" class="w-3.5 h-3.5"></i>Config</span>
        </button>
      </div>

      <!-- Tab content -->
      <div id="sistema-content"></div>
    `);

    loadSistemaTab();
  }

  function switchSistemaTab(tab) {
    sistemaTab = tab;
    const tabs = ['custos', 'chat', 'backup', 'config'];
    tabs.forEach(t => {
      const tabEl = el('tab-' + t);
      if (!tabEl) return;
      if (t === tab) {
        tabEl.className = tabEl.className.replace('text-slate-500 hover:text-slate-700', 'bg-white text-slate-900 shadow-sm');
      } else {
        tabEl.className = tabEl.className.replace('bg-white text-slate-900 shadow-sm', 'text-slate-500 hover:text-slate-700');
      }
    });
    loadSistemaTab();
  }

  async function loadSistemaTab() {
    const container = el('sistema-content');
    if (!container) return;

    container.innerHTML = loading();
    if (window.lucide) lucide.createIcons();

    try {
      switch (sistemaTab) {
        case 'custos':
          await renderCustosTab(container);
          break;
        case 'chat':
          await renderChatTab(container);
          break;
        case 'backup':
          await renderBackupTab(container);
          break;
        case 'config':
          await renderConfigTab(container);
          break;
      }
    } catch (err) {
      container.innerHTML = errorMessage(err.message);
      if (window.lucide) lucide.createIcons();
    }
  }

  // -- Custos Tab --

  async function renderCustosTab(container) {
    const custos = await api('/api/custos');
    const hoje = custos.hoje || {};
    const historico = custos.historico || custos.history || [];

    container.innerHTML = `
      <div class="space-y-6">
        <!-- Today's stats -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          ${statCard('Analises Hoje', formatNumber(hoje.totalAnalises || hoje.analises || 0), 'brain', 'green')}
          ${statCard('Chats Hoje', formatNumber(hoje.totalChats || hoje.chats || 0), 'message-circle', 'blue')}
          ${statCard('Tokens Hoje', formatNumber((hoje.tokensInput || 0) + (hoje.tokensOutput || 0) || hoje.tokens || 0), 'hash', 'purple')}
          ${statCard('Custo Hoje', formatBRL(hoje.custoTotal || hoje.custo || 0), 'coins', 'amber')}
        </div>

        <!-- History table -->
        <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
          <h3 class="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
            <i data-lucide="calendar" class="w-4 h-4 text-slate-400"></i>
            Ultimos 7 Dias
          </h3>
          ${historico.length === 0
            ? emptyState('Nenhum dado de custo registrado.')
            : `<div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="text-left text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100">
                      <th class="py-2 px-3">Data</th>
                      <th class="py-2 px-3">Analises</th>
                      <th class="py-2 px-3">Chats</th>
                      <th class="py-2 px-3">Tokens</th>
                      <th class="py-2 px-3">Custo</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${historico.slice(0, 7).map(d => `
                      <tr class="border-b border-slate-50 hover:bg-slate-50/50">
                        <td class="py-2.5 px-3 text-slate-700">${formatDate(d.data || d.date)}</td>
                        <td class="py-2.5 px-3 text-slate-600">${formatNumber(d.analises || d.totalAnalises || 0)}</td>
                        <td class="py-2.5 px-3 text-slate-600">${formatNumber(d.chats || d.totalChats || 0)}</td>
                        <td class="py-2.5 px-3 text-slate-600">${formatNumber(d.tokens || 0)}</td>
                        <td class="py-2.5 px-3 text-slate-700 font-medium">${formatBRL(d.custo || d.custoTotal || 0)}</td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>`
          }
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  }

  // -- Chat Tab --

  async function renderChatTab(container) {
    const sessions = await api('/api/chat/sessions').catch(() => []);
    const items = Array.isArray(sessions) ? sessions : (sessions.items || []);

    container.innerHTML = `
      <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <h3 class="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <i data-lucide="message-circle" class="w-4 h-4 text-slate-400"></i>
          Sessoes de Chat Recentes
          ${badge(String(items.length) + ' sessoes', 'slate')}
        </h3>
        ${items.length === 0
          ? emptyState('Nenhuma sessao de chat encontrada.')
          : `<div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100">
                    <th class="py-2 px-3">ID</th>
                    <th class="py-2 px-3">Inicio</th>
                    <th class="py-2 px-3">Ultima Mensagem</th>
                    <th class="py-2 px-3">Mensagens</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.map(s => `
                    <tr class="border-b border-slate-50 hover:bg-slate-50/50">
                      <td class="py-2.5 px-3 text-slate-700 font-mono text-xs">${escapeHtml(truncate(String(s.id || s.sessionId || ''), 16))}</td>
                      <td class="py-2.5 px-3 text-slate-500">${timeAgo(s.inicio || s.startedAt || s.criadoEm)}</td>
                      <td class="py-2.5 px-3 text-slate-500">${timeAgo(s.ultimaMensagem || s.lastMessage || s.atualizadoEm)}</td>
                      <td class="py-2.5 px-3 text-slate-600">${formatNumber(s.mensagens || s.messageCount || 0)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>`
        }
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  }

  // -- Backup Tab --

  async function renderBackupTab(container) {
    const backups = await api('/api/backups').catch(() => []);
    const items = Array.isArray(backups) ? backups : (backups.items || []);

    container.innerHTML = `
      <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h3 class="text-sm font-semibold text-slate-700">Backups do Banco de Dados</h3>
            <p class="text-xs text-slate-400 mt-1">${items.length} backup(s) encontrado(s)</p>
          </div>
          <button onclick="window._createBackup()" id="backup-btn"
            class="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
            <i data-lucide="hard-drive-download" class="w-4 h-4"></i>
            Criar Backup
          </button>
        </div>
        <div id="backup-message" class="hidden mb-4"></div>

        ${items.length === 0
          ? emptyState('Nenhum backup encontrado. Crie o primeiro backup agora.')
          : `<div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead>
                  <tr class="text-left text-xs text-slate-400 uppercase tracking-wide border-b border-slate-100">
                    <th class="py-2 px-3">Arquivo</th>
                    <th class="py-2 px-3">Tamanho</th>
                    <th class="py-2 px-3">Data</th>
                  </tr>
                </thead>
                <tbody>
                  ${items.map(b => `
                    <tr class="border-b border-slate-50 hover:bg-slate-50/50">
                      <td class="py-2.5 px-3 text-slate-700 font-mono text-xs flex items-center gap-2">
                        <i data-lucide="file-archive" class="w-3.5 h-3.5 text-slate-400"></i>
                        ${escapeHtml(b.name || b.nome || b.filename || b.path || '')}
                      </td>
                      <td class="py-2.5 px-3 text-slate-500">${escapeHtml(b.size || b.tamanho || '')}</td>
                      <td class="py-2.5 px-3 text-slate-400">${formatDate(b.date || b.data || b.criadoEm || b.createdAt)}</td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>`
        }
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  }

  async function createBackup() {
    const btn = el('backup-btn');
    const msgEl = el('backup-message');

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div> Criando...`;
    }
    if (msgEl) {
      msgEl.className = 'mb-4 p-3 bg-slate-50 rounded-lg text-sm text-slate-500 flex items-center gap-2';
      msgEl.innerHTML = '<div class="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-500"></div> Criando backup...';
      msgEl.classList.remove('hidden');
    }

    try {
      const res = await fetch(`${API}/api/backup`, { method: 'POST' });
      if (!res.ok) throw new Error(`Erro: ${res.status}`);
      const data = await res.json();

      if (msgEl) {
        msgEl.className = 'mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 flex items-center gap-2';
        msgEl.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4"></i> Backup criado com sucesso! ${data.size || data.tamanho ? `Tamanho: ${escapeHtml(data.size || data.tamanho)}` : ''} ${data.durationMs ? `| Duracao: ${formatDuration(data.durationMs)}` : ''}`;
        msgEl.classList.remove('hidden');
        if (window.lucide) lucide.createIcons();
      }

      setTimeout(() => loadSistemaTab(), 2000);
    } catch (err) {
      if (msgEl) {
        msgEl.className = 'mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600';
        msgEl.textContent = `Erro ao criar backup: ${err.message}`;
        msgEl.classList.remove('hidden');
      }
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="hard-drive-download" class="w-4 h-4"></i> Criar Backup`;
        if (window.lucide) lucide.createIcons();
      }
    }
  }

  // -- Config Tab --

  async function renderConfigTab(container) {
    if (!cachedStats) {
      cachedStats = await api('/api/stats').catch(() => null);
    }
    const stats = cachedStats;

    if (!stats) {
      container.innerHTML = emptyState('Nao foi possivel carregar informacoes de configuracao.');
      if (window.lucide) lucide.createIcons();
      return;
    }

    const config = stats.config || stats;

    container.innerHTML = `
      <div class="bg-white rounded-xl shadow-sm border border-slate-100 p-6">
        <h3 class="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <i data-lucide="sliders-horizontal" class="w-4 h-4 text-slate-400"></i>
          Configuracao do Sistema
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          ${stats.dataDir || config.dataDir ? `
            <div>
              <p class="text-slate-400 text-xs uppercase font-medium mb-1">Diretorio de Dados</p>
              <p class="text-slate-700 font-mono text-xs bg-slate-50 px-3 py-2 rounded-lg">${escapeHtml(stats.dataDir || config.dataDir)}</p>
            </div>
          ` : ''}
          ${config.ufs || stats.ufs ? `
            <div>
              <p class="text-slate-400 text-xs uppercase font-medium mb-2">UFs Configuradas</p>
              <div class="flex gap-1 flex-wrap">
                ${(Array.isArray(config.ufs || stats.ufs) ? (config.ufs || stats.ufs) : []).map(u => badge(u, 'blue')).join('')}
              </div>
            </div>
          ` : ''}
          ${config.keywords || stats.keywords ? `
            <div>
              <p class="text-slate-400 text-xs uppercase font-medium mb-2">Keywords</p>
              <div class="flex gap-1 flex-wrap">
                ${(Array.isArray(config.keywords || stats.keywords) ? (config.keywords || stats.keywords) : []).map(k => badge(k, 'amber')).join('')}
              </div>
            </div>
          ` : ''}
          ${config.modelos || config.models || stats.modelos ? `
            <div>
              <p class="text-slate-400 text-xs uppercase font-medium mb-2">Modelos IA</p>
              <div class="space-y-1">
                ${Object.entries(config.modelos || config.models || stats.modelos || {}).map(([k, v]) =>
                  `<div class="flex items-center gap-2">
                    <span class="text-xs text-slate-400 font-medium">${escapeHtml(k)}:</span>
                    <span class="text-xs text-slate-700 font-mono bg-slate-50 px-2 py-0.5 rounded">${escapeHtml(String(v))}</span>
                  </div>`
                ).join('')}
              </div>
            </div>
          ` : ''}
          ${stats.total != null ? `
            <div>
              <p class="text-slate-400 text-xs uppercase font-medium mb-1">Total Licitacoes no Banco</p>
              <p class="text-slate-700 font-medium">${formatNumber(stats.total)}</p>
            </div>
          ` : ''}
          ${stats.dbSize || config.dbSize ? `
            <div>
              <p class="text-slate-400 text-xs uppercase font-medium mb-1">Tamanho do Banco</p>
              <p class="text-slate-700">${escapeHtml(stats.dbSize || config.dbSize)}</p>
            </div>
          ` : ''}
        </div>
      </div>
    `;
    if (window.lucide) lucide.createIcons();
  }

  // --------------------------------------------------------------------------
  // Router
  // --------------------------------------------------------------------------

  const routes = {
    'overview': renderOverview,
    'licitacoes': renderLicitacoes,
    'alertas': renderAlertas,
    'compliance': renderCompliance,
    'sistema': renderSistema,
  };

  function router() {
    const hash = window.location.hash || '#overview';
    const routeKey = hash.split('?')[0].replace('#', '');
    const page = routes[routeKey] || routes['overview'];
    page();

    // Sync sidebar nav active state (setActiveNav defined in index.html)
    if (typeof setActiveNav === 'function') {
      setActiveNav('#' + (routeKey || 'overview'));
    }
  }

  window.addEventListener('hashchange', router);
  window.addEventListener('DOMContentLoaded', router);

  // If DOM already loaded (script at end of body), fire immediately
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    router();
  }

  // --------------------------------------------------------------------------
  // Global function bindings (for onclick handlers in rendered HTML)
  // --------------------------------------------------------------------------

  window._searchLicitacoes = searchLicitacoes;
  window._paginateLicitacoes = paginateLicitacoes;
  window._viewLicitacao = viewLicitacao;
  window._backToLicitacoes = backToLicitacoes;
  window._closeDetail = closeDetail;
  window._toggleAlertForm = toggleAlertForm;
  window._createAlert = createAlert;
  window._toggleAlert = toggleAlert;
  window._showAlertScores = showAlertScores;
  window._createBackup = createBackup;
  window._switchSistemaTab = switchSistemaTab;

})();
