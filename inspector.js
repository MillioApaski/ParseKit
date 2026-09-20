'use strict';
// ParseKit inspector: all text is rendered with textContent. No data leaves the browser.
const treeContent = $('tree-content');
const diffContent = $('diff-content');
let treeRoot = null;
let treeEntry = null;
let lastDiff = [];
const own = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const jsonKind = value => value instanceof RawJSONNumber ? 'number' : value === null ? 'null' : Array.isArray(value) ? 'array' : typeof value;
const preview = (value, max = 180) => {
  let text;
  if (value instanceof RawJSONNumber) text = value.raw;
  else if (typeof value === 'string') text = JSON.stringify(value);
  else if (value === undefined) text = '(不存在)';
  else if (value !== null && typeof value === 'object') text = Array.isArray(value) ? 'Array(' + value.length + ')' : 'Object(' + Object.keys(value).length + ')';
  else text = String(value);
  return text.length > max ? text.slice(0, max - 1) + '…' : text;
};
const quoteKey = key => /^[A-Za-z_$][\w$]*$/.test(key) && !['__proto__', 'constructor', 'prototype'].includes(key) ? '.' + key : '[' + JSON.stringify(key) + ']';
function message(target, text, className = 'empty-state') {
  target.replaceChildren();
  const label = document.createElement('p');
  label.className = className;
  label.textContent = text;
  target.append(label);
}
async function copyText(text) {
  if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return; }
  const temp = document.createElement('textarea');
  temp.value = text;
  temp.style.position = 'fixed'; temp.style.opacity = '0';
  document.body.append(temp); temp.select();
  const ok = document.execCommand('copy');
  temp.remove();
  if (!ok) throw Error('浏览器拒绝自动复制');
}
function jsonChildren(value, path) {
  if (!value || typeof value !== 'object' || value instanceof RawJSONNumber) return [];
  return Object.keys(value).map(key => ({
    key, path: Array.isArray(value) ? path + '[' + key + ']' : path + quoteKey(key),
    value: value[key], kind: jsonKind(value[key]), format: 'json'
  }));
}
function xmlChildren(node, path) {
  const result = [];
  for (const attr of [...node.attributes]) result.push({
    key: '@' + attr.name, path: path + '/@' + attr.name,
    value: attr.value, kind: 'attribute', format: 'xml'
  });
  const sameNameCount = new Map();
  let textNumber = 0;
  for (const child of node.childNodes) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const index = (sameNameCount.get(child.nodeName) || 0) + 1;
      sameNameCount.set(child.nodeName, index);
      result.push({ key: child.nodeName, path: path + '/' + child.nodeName + '[' + index + ']',
        value: child, kind: 'element', format: 'xml' });
    } else if ((child.nodeType === Node.TEXT_NODE || child.nodeType === Node.CDATA_SECTION_NODE) && child.nodeValue.trim()) {
      textNumber++;
      result.push({ key: '#text', path: path + '/text()[' + textNumber + ']',
        value: child.nodeValue, kind: 'text', format: 'xml' });
    }
  }
  return result;
}
function nodeChildren(entry) {
  return entry.format === 'json' ? jsonChildren(entry.value, entry.path) :
    entry.kind === 'element' ? xmlChildren(entry.value, entry.path) : [];
}
function nodeCaption(entry) {
  if (entry.format === 'xml' && entry.kind === 'element')
    return '<' + entry.value.nodeName + '> · ' + entry.value.attributes.length + ' attrs';
  return preview(entry.value);
}
function createTreeNode(entry, depth = 0) {
  const children = nodeChildren(entry);
  const host = document.createElement('div'); host.className = 'tree-node';
  const row = document.createElement('div'); row.className = 'tree-row';
  const toggle = document.createElement('button'); toggle.className = 'tree-toggle';
  toggle.type = 'button'; toggle.textContent = children.length ? '▸' : '·';
  toggle.disabled = !children.length;
  toggle.setAttribute('aria-label', '展开或折叠 ' + entry.key);
  const path = document.createElement('button'); path.className = 'tree-path'; path.type = 'button';
  path.textContent = entry.key; path.title = '复制路径：' + entry.path;
  path.addEventListener('click', async () => {
    try { await copyText(entry.path); setStatus('已复制路径 ' + entry.path); }
    catch (e) { setStatus(e.message, true); }
  });
  const kind = document.createElement('span'); kind.className = 'tree-type';
  kind.textContent = entry.kind;
  const value = document.createElement('span');
  value.className = 'tree-value ' + (entry.kind === 'string' || entry.kind === 'text' || entry.kind === 'attribute' ? 'tree-string' : entry.kind === 'number' ? 'tree-number' : entry.kind === 'null' ? 'tree-null' : '');
  value.textContent = nodeCaption(entry);
  row.append(toggle, path, kind, value);
  if (entry.format === 'json') {
    const go = document.createElement('button');
    go.className = 'tree-jump'; go.type = 'button'; go.textContent = '查询 ↗';
    go.title = '在路径查询中查看这个节点';
    go.addEventListener('click', () => {
      $('query-path').value = entry.path;
      $('query-source').value = $('tree-source').value;
      selectView('query');
    });
    row.append(go);
  }
  host.append(row);
  let expanded = false;
  let branch = null;
  function open() {
    if (!children.length || expanded) return;
    if (!branch) {
      branch = document.createElement('div'); branch.className = 'tree-children';
      for (const child of children.slice(0, 250)) branch.append(createTreeNode(child, depth + 1));
      if (children.length > 250) {
        const notice = document.createElement('div'); notice.className = 'tree-notice';
        notice.textContent = '此层共有 ' + children.length + ' 项，仅显示前 250 项以保护浏览器性能。';
        branch.append(notice);
      }
      host.append(branch);
    }
    branch.hidden = false; expanded = true; toggle.textContent = '▾';
    toggle.setAttribute('aria-expanded', 'true');
  }
  function close() {
    if (!branch || !expanded) return;
    branch.hidden = true; expanded = false; toggle.textContent = '▸';
    toggle.setAttribute('aria-expanded', 'false');
  }
  toggle.addEventListener('click', () => expanded ? close() : open());
  host.openBranch = open; host.closeBranch = close;
  return host;
}
function renderTree() {
  const source = $('tree-source').value === 'output' ? output.value : input.value;
  if (!source.trim()) {
    $('tree-search-results').hidden = true;
    treeRoot = null; treeEntry = null; message(treeContent, '当前数据来源为空。先粘贴数据，或切换数据来源。');
    $('tree-summary').textContent = '等待数据'; $('tree-type').textContent = ''; return;
  }
  try {
    const type = typeOf(source);
    let entry;
    if (type === 'json') {
      const value = parseJSONLossless(source);
      entry = { key: '$', path: '$', value, kind: jsonKind(value), format: 'json' };
    } else {
      const xml = parseXML(source);
      entry = { key: xml.documentElement.nodeName,
        path: '/' + xml.documentElement.nodeName + '[1]',
        value: xml.documentElement, kind: 'element', format: 'xml' };
    }
    treeEntry = entry;
    treeRoot = createTreeNode(entry);
    treeContent.replaceChildren(treeRoot);
    treeRoot.openBranch();
    $('tree-summary').textContent = '点击字段名复制路径';
    $('tree-type').textContent = type.toUpperCase();
    setStatus('结构视图加载完成 · ' + type.toUpperCase());
    searchTree();
  } catch (e) {
    $('tree-search-results').hidden = true;
    treeRoot = null; treeEntry = null; message(treeContent, '无法解析数据：' + e.message);
    $('tree-summary').textContent = '校验失败'; $('tree-type').textContent = '';
    setStatus(e.message, true);
  }
}
function expandDepth(node, remaining) {
  if (!node || remaining <= 0) return;
  node.openBranch?.();
  if (remaining > 1) {
    const children = [...node.children].find(x => x.classList.contains('tree-children'));
    if (children) [...children.children].forEach(x => expandDepth(x, remaining - 1));
  }
}
function closeAll(node) {
  if (!node) return;
  const descendants = node.querySelectorAll('.tree-node');
  [...descendants].reverse().forEach(child => child.closeBranch?.());
  node.closeBranch?.();
}
const isObject = x => x !== null && typeof x === 'object' && !(x instanceof RawJSONNumber);
function diffJSON(before, after) {
  const changes = [];
  let count = 0, clipped = false;
  const visit = (a, b, path, depth = 0) => {
    if (++count > 15000 || depth > 100) { clipped = true; return; }
    const ka = jsonKind(a), kb = jsonKind(b);
    if (ka !== kb) { changes.push({ kind: 'changed', path, before: a, after: b }); return; }
    if (isObject(a) && isObject(b)) {
      const array = Array.isArray(a);
      const keys = array
        ? Array.from({ length: Math.max(a.length, b.length) }, (_, i) => String(i))
        : [...new Set([...Object.keys(a), ...Object.keys(b)])].sort();
      for (const key of keys) {
        if (clipped) break;
        const next = array ? path + '[' + key + ']' : path + quoteKey(key);
        if (!own(a, key)) changes.push({ kind: 'added', path: next, before: undefined, after: b[key] });
        else if (!own(b, key)) changes.push({ kind: 'removed', path: next, before: a[key], after: undefined });
        else visit(a[key], b[key], next, depth + 1);
      }
    } else if (!(a instanceof RawJSONNumber && b instanceof RawJSONNumber ? a.raw === b.raw : Object.is(a, b))) changes.push({ kind: 'changed', path, before: a, after: b });
  };
  visit(before, after, '$');
  return { changes, clipped };
}
function lineDiff(before, after) {
  const a = before.split('\n'), b = after.split('\n');
  const n = a.length, m = b.length;
  if (n * m > 600000) {
    const changes = [];
    for (let i = 0; i < Math.max(n, m); i++) {
      if (a[i] !== b[i]) changes.push({ kind: i >= n ? 'added' : i >= m ? 'removed' : 'changed', path: '行 ' + (i + 1), before: a[i], after: b[i] });
    }
    return { changes, clipped: true };
  }
  const stride = m + 1, table = new Uint32Array((n + 1) * (m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--)
    table[i * stride + j] = a[i] === b[j] ? 1 + table[(i + 1) * stride + j + 1] :
      Math.max(table[(i + 1) * stride + j], table[i * stride + j + 1]);
  const changes = []; let i = 0, j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && a[i] === b[j]) { i++; j++; continue; }
    if (i < n && (j === m || table[(i + 1) * stride + j] >= table[i * stride + j + 1])) {
      changes.push({ kind: 'removed', path: '旧行 ' + (i + 1), before: a[i], after: undefined }); i++;
    } else {
      changes.push({ kind: 'added', path: '新行 ' + (j + 1), before: undefined, after: b[j] }); j++;
    }
  }
  return { changes, clipped: false };
}
function displayDiff(changes, clipped, type) {
  diffContent.replaceChildren();
  $('diff-summary').textContent = changes.length + ' 处差异' + (clipped ? ' · 部分截断 / 降级比较' : '');
  if (!changes.length) { message(diffContent, '未检测到差异。'); return; }
  const frag = document.createDocumentFragment();
  for (const change of changes.slice(0, 600)) {
    const row = document.createElement('div'); row.className = 'diff-row diff-' + change.kind;
    const head = document.createElement('div'); head.className = 'diff-path';
    head.textContent = (change.kind === 'added' ? '+ ' : change.kind === 'removed' ? '− ' : '± ') + change.path;
    const a = document.createElement('div'); a.className = 'diff-value diff-before';
    const b = document.createElement('div'); b.className = 'diff-value diff-after';
    const leftCaption = document.createElement('span'); leftCaption.className = 'diff-caption'; leftCaption.textContent = 'BEFORE';
    const rightCaption = document.createElement('span'); rightCaption.className = 'diff-caption'; rightCaption.textContent = 'AFTER';
    a.append(leftCaption, document.createTextNode(type === 'xml' ? (change.before ?? '(不存在)') : preview(change.before, 500)));
    b.append(rightCaption, document.createTextNode(type === 'xml' ? (change.after ?? '(不存在)') : preview(change.after, 500)));
    row.append(head, a, b); frag.append(row);
  }
  if (changes.length > 600) {
    const notice = document.createElement('p'); notice.className = 'tree-notice';
    notice.textContent = '为保护页面性能，仅展示前 600 处差异；复制摘要可获取所有差异条目（每个值最多 1000 字符）。';
    frag.append(notice);
  }
  diffContent.append(frag);
}
function runDiff() {
  const before = $('diff-left').value.trim(), after = $('diff-right').value.trim();
  if (!before || !after) { setStatus('请先输入两份待比较的数据', true); return; }
  const selected = $('diff-type').value;
  const detected = before.startsWith('<') ? 'xml' : 'json';
  const type = selected === 'auto' ? detected : selected;
  try {
    let result;
    if (type === 'json') {
      result = diffJSON(parseJSONLossless(before), parseJSONLossless(after));
    } else {
      const a = prettyXML(parseXML(before), getIndent(), before);
      const b = prettyXML(parseXML(after), getIndent(), after);
      result = lineDiff(a, b);
    }
    lastDiff = result.changes;
    displayDiff(result.changes, result.clipped, type);
    setStatus(type.toUpperCase() + ' 比较完成 · ' + result.changes.length + ' 处差异' +
      (result.clipped ? '（数据量较大，详见差异摘要）' : ''));
    $('meta').textContent = type === 'json' ? '对象忽略键顺序 · 数组保留顺序' : 'XML 格式化后逐行比较';
  } catch (e) {
    lastDiff = []; $('diff-summary').textContent = '校验失败';
    message(diffContent, '无法比较：' + e.message);
    setStatus('比较失败：' + e.message, true);
  }
}
let currentView = 'format';
function selectView(name) {
  currentView = name;
  for (const target of ['format', 'tree', 'query', 'diff']) {
    $(target + '-workspace').hidden = target !== name;
  }
  document.querySelectorAll('.tab').forEach(button => {
    const active = button.dataset.view === name;
    button.classList.toggle('active', active);
    if (active) button.setAttribute('aria-current', 'page');
    else button.removeAttribute('aria-current');
  });
  if (name === 'tree') renderTree();
  if (name === 'query' && $('query-path').value.trim() && querySourceText().trim()) runPathQuery();
  if (name === 'diff') {
    if (!$('diff-left').value && input.value) $('diff-left').value = input.value;
    if (!$('diff-right').value && output.value) $('diff-right').value = output.value;
    document.dispatchEvent(new Event('parsekit:updated'));
  }
}
document.querySelectorAll('.tab').forEach(button => button.addEventListener('click', () => selectView(button.dataset.view)));
$('tree-source').addEventListener('change', renderTree);
$('tree-refresh').addEventListener('click', renderTree);
$('tree-expand').addEventListener('click', () => expandDepth(treeRoot, 2));
$('tree-collapse').addEventListener('click', () => closeAll(treeRoot));
$('diff-run').addEventListener('click', runDiff);
$('diff-from-input').addEventListener('click', () => { $('diff-left').value = input.value; document.dispatchEvent(new Event('parsekit:updated')); });
$('diff-from-output').addEventListener('click', () => { $('diff-right').value = output.value; document.dispatchEvent(new Event('parsekit:updated')); });
$('diff-copy').addEventListener('click', async () => {
  if (!lastDiff.length) { setStatus('没有可以复制的差异记录', true); return; }
  const text = lastDiff.map(c => [c.kind, c.path, preview(c.before, 1000), preview(c.after, 1000)].join('\t')).join('\n');
  try { await copyText(text); setStatus('已复制 ' + lastDiff.length + ' 条差异'); }
  catch (e) { setStatus(e.message, true); }
});

for (const id of ['diff-left','diff-right']) $(id).addEventListener('input', () => {
  lastDiff = []; $('diff-summary').textContent = '内容已变化 · 请重新比较';
});
document.addEventListener('keydown', e => {
  if (currentView === 'diff' && (e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault(); e.stopImmediatePropagation(); runDiff();
  }
}, true);

const MAX_SEARCH_VISITS = 30000;
function searchTree() {
  const query = $('tree-query').value.trim().toLocaleLowerCase();
  const results = $('tree-search-results');
  results.replaceChildren();
  results.hidden = !query || !treeEntry;
  if (results.hidden) return;
  const stack = [treeEntry];
  let visits = 0, found = 0;
  while (stack.length && visits < MAX_SEARCH_VISITS && found < 100) {
    const entry = stack.pop();
    visits++;
    const label = (entry.key + ' ' + entry.path + ' ' + nodeCaption(entry)).toLocaleLowerCase();
    if (label.includes(query)) {
      found++;
      const button = document.createElement('button');
      button.className = 'tree-match';
      button.type = 'button';
      button.textContent = entry.path + ' · ' + nodeCaption(entry);
      button.title = '复制路径：' + entry.path;
      button.addEventListener('click', async () => {
        try { await copyText(entry.path); setStatus('已复制路径 ' + entry.path); }
        catch (error) { setStatus(error.message, true); }
      });
      results.append(button);
    }
    const children = nodeChildren(entry);
    for (let i = children.length - 1; i >= 0; i--) stack.push(children[i]);
  }
  if (!found) {
    const empty = document.createElement('span');
    empty.textContent = '未找到匹配字段'; results.append(empty);
  }
  if (stack.length) {
    const hint = document.createElement('span');
    hint.textContent = '结果已达上限或扫描超过 ' + MAX_SEARCH_VISITS + ' 个节点，请缩小关键词范围。';
    results.append(hint);
  }
  $('tree-summary').textContent = found + ' 项匹配 · 点击结果复制路径';
}
let treeSearchTimer;
$('tree-query').addEventListener('input', () => {
  clearTimeout(treeSearchTimer);
  treeSearchTimer = setTimeout(searchTree, 180);
});
