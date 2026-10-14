import {requestJSON} from './handoff/services.js';

import './admin-status.css';

const PAGE_SIZE = 80;
const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const unknown = value => isRecord(value) && value.status === 'unknown';
const formatValue = value => typeof value === 'number' ? value.toLocaleString('zh-CN') : typeof value === 'string' ? value : '未知';
const formatTime = value => value ? new Date(value).toLocaleString('zh-CN', {hour12: false}) : '未知';
const text = value => {
  if (typeof value === 'string') return value;
  if (value === undefined || unknown(value)) return '未知';
  try { return JSON.stringify(value, null, 2) ?? '未知'; } catch { return '未知'; }
};
const rowText = value => typeof value === 'string' ? value : '未知';
const records = value => (Array.isArray(value) ? value : []).filter(isRecord);
const displayText = value => typeof value === 'string' ? value : unknown(value) || value === undefined || value === null ? '未知' : text(value);
const clampPage = (current, count) => Math.max(0, Math.min(current, Math.max(0, Math.ceil(count / PAGE_SIZE) - 1)));

function element(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (value !== undefined) node.textContent = value;
  return node;
}

function button(label, className = 'text-btn') {
  const node = element('button', className, label);
  node.type = 'button';
  return node;
}

function jsonDetails(summary, value) {
  const details = element('details', 'admin-json');
  const label = element('summary', '', summary);
  const pre = element('pre', '', text(value));
  details.append(label, pre);
  return details;
}

function statusRow(label, value, note) {
  const row = element('div', 'admin-stat');
  row.append(element('span', '', label), element('strong', '', formatValue(value)));
  if (note) row.append(element('small', '', note));
  return row;
}

function matching(item, query) {
  return !query || JSON.stringify(item).toLowerCase().includes(query);
}

export function mountAdminStatus({trigger}) {
  const dialog = element('dialog', 'admin-dialog');
  dialog.id = 'admin-status-dialog';
  dialog.setAttribute('aria-label', '管理员审计');
  const head = element('div', 'admin-head');
  const title = element('div');
  title.append(element('p', 'eyebrow', '只读快照'), element('h2', '', '管理员审计'));
  const close = button('关闭', 'icon-btn');
  close.setAttribute('aria-label', '关闭管理员审计');
  head.append(title, close);
  const body = element('div', 'admin-body');
  const actions = element('div', 'admin-actions');
  const refresh = button('刷新快照');
  const search = element('input');
  const content = element('div', 'admin-content');
  search.type = 'search';
  search.placeholder = '搜索 Surface、路径、来源或原因';
  search.setAttribute('aria-label', search.placeholder);
  actions.append(refresh, search);
  body.append(actions, content);
  dialog.append(head, body);
  document.body.append(dialog);

  let snapshot = null;
  let request = {status: '未请求', time: null, url: '/data/admin-status.json'};
  let page = 0;
  let surfacePage = 0;
  let query = '';

  function render() {
    content.replaceChildren();

    const runtime = element('section', 'admin-runtime');
    runtime.append(
      element('h3', '', '本浏览器请求状态'),
      element('p', 'admin-note', '仅表示此浏览器可访问的页面和状态文件；不代表服务进程、局域网可达性或构建仍然一致。'),
      statusRow('页面位置', location.href),
      statusRow('当前脚本', [...document.scripts].map(script => script.src).filter(Boolean).join('\n') || '未检测到外部脚本'),
      statusRow('状态文件', `${request.status} · ${request.url}`),
      statusRow('最近请求', request.time ? formatTime(request.time) : '未请求')
    );
    content.append(runtime);
    if (!snapshot) {
      content.append(element('p', 'admin-empty', '尚未加载管理员快照。'));
      return;
    }

    const meta = element('section', 'admin-meta');
    meta.append(element('h3', '', '快照范围'), statusRow('快照生成时间', formatTime(snapshot.generatedAtUtc)), element('p', 'admin-note', '报告来源的 mtime 与 SHA256 见下方。生成时间不是任一报告的复测时间，来源 SHA256 也不是原始资源哈希。'));
    content.append(meta);

    const coverage = isRecord(snapshot.coverage) ? snapshot.coverage : {};
    const coverageSection = element('section', 'admin-section');
    coverageSection.append(element('h3', '', '材质分派覆盖'), element('p', 'admin-note', displayText(coverage.note)));
    const stats = element('div', 'admin-stats');
    stats.append(statusRow('总 slots', coverage.total), statusRow('已分派', coverage.covered), statusRow('未分派', coverage.unsupported), statusRow('适配器', coverage.adapters));
    coverageSection.append(stats, jsonDetails('口径与来源', {basis: coverage.basis, status: coverage.status}));
    const matchingSurfaces = records(coverage.surfaces).filter(row => matching(row, query));
    const surfaceRows = matchingSurfaces.slice(surfacePage * PAGE_SIZE, (surfacePage + 1) * PAGE_SIZE);
    const table = element('div', 'admin-table');
    table.append(element('div', 'admin-table-head', 'Surface / adapter / slots / models'));
    for (const row of surfaceRows) table.append(element('div', 'admin-table-row', `${rowText(row.surface)} · ${rowText(row.adapter)} · ${formatValue(row.slots)} / ${formatValue(row.models)}`));
    if (!surfaceRows.length) table.append(element('p', 'admin-empty', '没有匹配的 Surface 条目。'));
    coverageSection.append(table);
    if (matchingSurfaces.length > PAGE_SIZE) {
      const pager = element('div', 'admin-pager');
      const previous = button('上一页'); const next = button('下一页');
      previous.disabled = surfacePage === 0; next.disabled = (surfacePage + 1) * PAGE_SIZE >= matchingSurfaces.length;
      previous.onclick = () => { surfacePage--; render(); }; next.onclick = () => { surfacePage++; render(); };
      pager.append(previous, element('span', '', `Surface ${surfacePage + 1} / ${Math.ceil(matchingSurfaces.length / PAGE_SIZE)} · ${matchingSurfaces.length} 条`), next);
      coverageSection.append(pager);
    }
    content.append(coverageSection);

    const gaps = isRecord(snapshot.gaps) ? snapshot.gaps : {};
    const gapSection = element('section', 'admin-section');
    gapSection.append(element('h3', '', '缺口与检验范围'), element('p', 'admin-note', displayText(gaps.basis)));
    const categories = element('div', 'admin-category-grid');
    for (const [name, value] of Object.entries(isRecord(gaps.categories) ? gaps.categories : {})) {
      const card = element('div', 'admin-category');
      card.append(element('strong', '', name), element('small', '', rowText(value?.scope)), jsonDetails('状态', value));
      categories.append(card);
    }
    gapSection.append(categories);
    const matches = records(gaps.items).filter(item => matching(item, query));
    const shown = matches.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
    const list = element('div', 'admin-gap-list');
    for (const item of shown) {
      const row = element('details', 'admin-gap');
      row.append(element('summary', '', `${rowText(item.category)} · ${rowText(item.status)} · ${rowText(item.path)}`), jsonDetails('来源与原因', {source: item.source, reason: item.reason, detail: item.detail}));
      list.append(row);
    }
    if (!shown.length) list.append(element('p', 'admin-empty', '没有匹配的缺口条目。'));
    gapSection.append(list);
    if (matches.length > PAGE_SIZE) {
      const pager = element('div', 'admin-pager');
      const previous = button('上一页'); const next = button('下一页');
      previous.disabled = page === 0; next.disabled = (page + 1) * PAGE_SIZE >= matches.length;
      previous.onclick = () => { page--; render(); }; next.onclick = () => { page++; render(); };
      pager.append(previous, element('span', '', `${page + 1} / ${Math.ceil(matches.length / PAGE_SIZE)} · ${matches.length} 条`), next);
      gapSection.append(pager);
    }
    content.append(gapSection);

    const tree = isRecord(snapshot.resourceTree) ? snapshot.resourceTree : {status: 'unknown'};
    const treeSection = element('section', 'admin-section');
    treeSection.append(element('h3', '', '资源树'), element('p', 'admin-note', '按源报告结构展示；未补造项目路径。'), jsonDetails('资源树明细', tree));
    content.append(treeSection);

    const auditSection = element('section', 'admin-section');
    auditSection.append(element('h3', '', '审计状态与证据边界'));
    for (const audit of records(snapshot.audits)) auditSection.append(jsonDetails(`${rowText(audit.name)} · ${rowText(audit.status)} · ${rowText(audit.sourceStatus)}`, audit));
    content.append(auditSection);

    const sourceSection = element('section', 'admin-section');
    sourceSection.append(element('h3', '', '快照来源'));
    for (const source of records(snapshot.sources)) sourceSection.append(jsonDetails(`${rowText(source.name)} · ${rowText(source.status)}`, source));
    content.append(sourceSection);

    const buildSection = element('section', 'admin-section');
    buildSection.append(element('h3', '', '生成时构建信息'), jsonDetails('dist index', snapshot.buildAtGeneration || {status: 'unknown'}));
    content.append(buildSection);

    const handoff = element('section', 'admin-section');
    handoff.append(element('h3', '', '当前交接'), jsonDetails(rowText(snapshot.handoff?.source), snapshot.handoff?.text || '未知'));
    content.append(handoff);
    const baseline = element('section', 'admin-section');
    baseline.append(element('h3', '', '本次基线'), jsonDetails(rowText(snapshot.baseline?.source), snapshot.baseline?.text || '未知'));
    content.append(baseline);
  }

  async function load(force = false) {
    request = {status: '请求中', time: new Date().toISOString(), url: '/data/admin-status.json'};
    if (snapshot || dialog.open) render();
    try {
      const response = await requestJSON(`/data/admin-status.json${force ? `?refresh=${Date.now()}` : ''}`, {cache: 'no-store'});
      request = {status: `HTTP ${response.status}`, time: new Date().toISOString(), url: response.url || '/data/admin-status.json'};
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      snapshot = isRecord(payload) ? payload : {status: 'unknown'};
      const surfaces = records(snapshot.coverage?.surfaces).filter(row => matching(row, query));
      const gaps = records(snapshot.gaps?.items).filter(item => matching(item, query));
      surfacePage = clampPage(surfacePage, surfaces.length);
      page = clampPage(page, gaps.length);
    } catch (error) {
      snapshot = null;
      request = {status: `失败: ${error.message}`, time: new Date().toISOString(), url: '/data/admin-status.json'};
    }
    render();
  }

  async function open() {
    if (!dialog.open) dialog.showModal();
    await load();
  }

  refresh.onclick = () => load(true);
  search.oninput = () => { query = search.value.trim().toLowerCase(); page = 0; surfacePage = 0; render(); };
  trigger.addEventListener('click', open);
  close.addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && dialog.open) dialog.close(); });
  return {open, load};
}
