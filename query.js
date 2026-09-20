'use strict';
// JSONPath-lite: exact paths, * for one level, ..name for recursive descendant lookup.
// The evaluator only reads own data properties; it never evaluates user-supplied code.
const QUERY_VISIT_LIMIT = 30000;
const QUERY_RESULT_LIMIT = 200;
const QUERY_INTERMEDIATE_LIMIT = 5000;
function parseQueryPath(expression) {
  const text = expression.trim();
  if (!text.startsWith('$')) throw Error('路径必须以 $ 开始，例如 $.operations[0].name');
  const steps = [];
  let i = 1;
  while (i < text.length) {
    if (text.startsWith('..', i)) {
      i += 2;
      if (text[i] === '*') { steps.push({ type: 'recursive', key: '*' }); i++; continue; }
      const match = /^[A-Za-z_$][\w$]*/.exec(text.slice(i));
      if (!match) throw Error('.. 后需要字段名称或 *，位置 ' + (i + 1));
      steps.push({ type: 'recursive', key: match[0] }); i += match[0].length; continue;
    }
    if (text[i] === '.') {
      i++;
      if (text[i] === '*') { steps.push({ type: 'wildcard' }); i++; continue; }
      const match = /^[A-Za-z_$][\w$]*/.exec(text.slice(i));
      if (!match) throw Error('. 后需要字段名称或 *，位置 ' + (i + 1));
      steps.push({ type: 'key', key: match[0] }); i += match[0].length; continue;
    }
    if (text[i] === '[') {
      const start = ++i;
      if (text[i] === '*') {
        i++;
        if (text[i] !== ']') throw Error('[*] 后缺少 ]');
        i++; steps.push({ type: 'wildcard' }); continue;
      }
      if (text[i] === '"') {
        i++;
        while (i < text.length) {
          if (text[i] === '\\') { i += 2; continue; }
          if (text[i++] === '"') break;
        }
        if (text[i] !== ']') throw Error('字段名需要用 ["name"] 表示');
        const key = JSON.parse(text.slice(start, i));
        i++; steps.push({ type: 'key', key }); continue;
      }
      const match = /^(0|[1-9]\d*)/.exec(text.slice(i));
      if (!match) throw Error('方括号仅支持数组索引、["字段名"] 或 *');
      i += match[0].length;
      if (text[i] !== ']') throw Error('数组索引后缺少 ]');
      i++;
      const index = Number(match[0]);
      if (!Number.isSafeInteger(index)) throw Error('数组索引超出安全范围');
      steps.push({ type: 'index', index });
      continue;
    }
    throw Error('无法识别路径位置 ' + (i + 1) + ' 附近的内容');
  }
  return steps;
}
function queryKind(value) {
  return value instanceof RawJSONNumber ? 'number' : value === null ? 'null' :
    Array.isArray(value) ? 'array' : typeof value;
}
function queryChildren(value, path) {
  if (value === null || typeof value !== 'object' || value instanceof RawJSONNumber) return [];
  if (Array.isArray(value)) return value.map((child, index) => ({
    value: child, path: path + '[' + index + ']', key: String(index), index
  }));
  return Object.keys(value).map(key => ({
    value: value[key], path: path + (/^[A-Za-z_$][\w$]*$/.test(key) &&
      !['__proto__', 'prototype', 'constructor'].includes(key) ? '.' + key :
      '[' + JSON.stringify(key) + ']'), key, index: null
  }));
}
function executePathQuery(root, expression) {
  const steps = parseQueryPath(expression);
  let current = [{ value: root, path: '$' }];
  let visited = 0, truncated = false;
  const push = (target, entry) => {
    if (target.length >= QUERY_INTERMEDIATE_LIMIT) { truncated = true; return; }
    target.push(entry);
  };
  for (const step of steps) {
    const next = [];
    for (const entry of current) {
      if (visited >= QUERY_VISIT_LIMIT) { truncated = true; break; }
      if (step.type === 'recursive') {
        const stack = [entry];
        while (stack.length) {
          if (++visited > QUERY_VISIT_LIMIT || next.length >= QUERY_INTERMEDIATE_LIMIT) {
            truncated = true; break;
          }
          const node = stack.pop();
          const children = queryChildren(node.value, node.path);
          for (let j = children.length - 1; j >= 0; j--) stack.push(children[j]);
          for (const child of children) {
            if (step.key === '*' || child.key === step.key) push(next, child);
          }
        }
        if (truncated) break;
      } else {
        visited++;
        const children = queryChildren(entry.value, entry.path);
        if (step.type === 'wildcard') {
          for (const child of children) push(next, child);
        } else {
          const found = children.find(child => step.type === 'index'
            ? Array.isArray(entry.value) && child.index === step.index
            : !Array.isArray(entry.value) && child.key === step.key);
          if (found) push(next, found);
        }
      }
    }
    current = next;
    if (truncated || !current.length) break;
  }
  const unique = new Map();
  for (const item of current) {
    if (!unique.has(item.path)) unique.set(item.path, item);
  }
  if (unique.size > QUERY_RESULT_LIMIT) truncated = true;
  return { matches: [...unique.values()].slice(0, QUERY_RESULT_LIMIT), visited, truncated };
}
function stringifyQueryValue(value, indent = '  ') {
  function write(node, depth) {
    if (depth > 500) throw Error('内容嵌套超过导出限制');
    if (node instanceof RawJSONNumber) return node.raw;
    if (node === null || typeof node !== 'object') return Object.is(node, -0) ? '-0' : JSON.stringify(node);
    const array = Array.isArray(node);
    const parts = array ? node.map(child => write(child, depth + 1)) :
      Object.keys(node).map(key => JSON.stringify(key) + ': ' + write(node[key], depth + 1));
    if (!parts.length) return array ? '[]' : '{}';
    const padding = indent.repeat(depth + 1);
    return (array ? '[' : '{') + '\n' + padding + parts.join(',\n' + padding) +
      '\n' + indent.repeat(depth) + (array ? ']' : '}');
  }
  return write(value, 0);
}
function queryPreview(value) {
  if (value instanceof RawJSONNumber) return value.raw;
  if (typeof value === 'string') return JSON.stringify(value);
  if (value === null) return 'null';
  if (Array.isArray(value)) return 'Array(' + value.length + ')';
  if (typeof value === 'object') return 'Object(' + Object.keys(value).length + ')';
  return String(value);
}
function querySourceText() {
  const source = $('query-source').value;
  return source === 'input' ? input.value : source === 'output' ? output.value : $(source).value;
}
let currentQueryMatches = [];
function runPathQuery() {
  const results = $('query-results'), query = $('query-path').value.trim();
  const raw = querySourceText();
  results.replaceChildren();
  currentQueryMatches = [];
  if (!raw.trim()) { $('query-summary').textContent = '等待 JSON'; setStatus('选定的数据来源为空', true); return; }
  if (!query) { setStatus('请输入查询路径', true); return; }
  try {
    const data = parseJSONLossless(raw);
    const response = executePathQuery(data, query);
    currentQueryMatches = response.matches;
    $('query-summary').textContent = response.matches.length + ' 项匹配' +
      (response.truncated ? ' · 已达到保护上限' : '');
    if (!response.matches.length) {
      const empty = document.createElement('p'); empty.className = 'empty-state';
      empty.textContent = '路径有效，但没有匹配的字段。'; results.append(empty);
    }
    response.matches.forEach((match, index) => {
      const item = document.createElement('div'); item.className = 'query-match';
      const heading = document.createElement('div'); heading.className = 'query-match-heading';
      const path = document.createElement('code'); path.textContent = match.path;
      const type = document.createElement('span'); type.className = 'tree-type';
      type.textContent = queryKind(match.value);
      const tools = document.createElement('div'); tools.className = 'query-match-actions';
      const pathCopy = document.createElement('button'); pathCopy.textContent = '复制路径';
      pathCopy.addEventListener('click', () => copyText(match.path).then(
        () => setStatus('已复制 ' + match.path), error => setStatus(error.message, true)));
      const valueCopy = document.createElement('button'); valueCopy.textContent = '复制值';
      valueCopy.addEventListener('click', () => copyText(stringifyQueryValue(match.value, getIndent())).then(
        () => setStatus('已复制匹配值'), error => setStatus(error.message, true)));
      const send = document.createElement('button'); send.textContent = '送到输出';
      send.addEventListener('click', () => {
        output.value = stringifyQueryValue(match.value, getIndent());
        updateCounts(); selectView('format'); setStatus('结果已写入输出区（原输入未修改）');
      });
      tools.append(pathCopy, valueCopy, send);
      heading.append(path, type, tools);
      const preview = document.createElement('pre'); preview.className = 'query-preview';
      const text = stringifyQueryValue(match.value, getIndent());
      preview.textContent = text.length > 1400 ? text.slice(0, 1400) + '\n…（预览已截断，复制值可获取完整内容）' : text;
      item.append(heading, preview); results.append(item);
    });
    setStatus('路径查询完成 · ' + response.matches.length + ' 项匹配' +
      (response.truncated ? '（超过安全上限，结果不完整）' : ''));
    $('meta').textContent = 'JSON 查询 · ' + response.visited + ' 节点检查';
  } catch (error) {
    const p = document.createElement('p'); p.className = 'empty-state';
    p.textContent = '查询失败：' + error.message; results.append(p);
    $('query-summary').textContent = '校验失败';
    setStatus(error.message, true);
  }
}
$('query-run').addEventListener('click', runPathQuery);
$('query-copy-all').addEventListener('click', async () => {
  if (!currentQueryMatches.length) { setStatus('没有可复制的匹配结果', true); return; }
  const payload = stringifyQueryValue(currentQueryMatches.map(match => match.value), getIndent());
  try { await copyText(payload); setStatus('已复制 ' + currentQueryMatches.length + ' 项匹配的 JSON 数组'); }
  catch (error) { setStatus(error.message, true); }
});
$('query-to-output').addEventListener('click', () => {
  if (!currentQueryMatches.length) { setStatus('没有可导出的匹配结果', true); return; }
  output.value = stringifyQueryValue(currentQueryMatches.map(match => match.value), getIndent());
  updateCounts(); selectView('format'); setStatus('已将匹配结果数组写入输出区，输入数据未修改');
});
$('query-path').addEventListener('keydown', event => {
  if (event.key === 'Enter') { event.preventDefault(); runPathQuery(); }
});
for (const chip of document.querySelectorAll('[data-query-example]')) {
  chip.addEventListener('click', () => {
    $('query-path').value = chip.dataset.queryExample;
    runPathQuery();
  });
}

document.addEventListener('keydown', event => {
  if (!$('query-workspace').hidden && (event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault();
    event.stopImmediatePropagation();
    runPathQuery();
  }
}, true);
