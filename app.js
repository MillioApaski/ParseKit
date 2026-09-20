'use strict';
const $ = id => document.getElementById(id);
const input = $('input');
const output = $('output');
const status = $('status');
const getIndent = () => $('indent').value === 'tab' ? '\t' : ' '.repeat(Number($('indent').value));
const typeOf = text => $('type').value === 'auto' ? (text.trimStart().startsWith('<') ? 'xml' : 'json') : $('type').value;
function updateCounts() {
  document.dispatchEvent(new Event('parsekit:updated'));
  $('input-count').textContent = input.value.length.toLocaleString() + ' 字符';
  $('output-count').textContent = output.value.length.toLocaleString() + ' 字符';
}
function setStatus(message, error = false) {
  status.textContent = (error ? '✕ ' : '● ') + message;
  status.className = error ? 'error' : 'ok';
}
function parseXML(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const err = doc.getElementsByTagName('parsererror')[0];
  if (err) throw new Error('XML 无效：' + err.textContent.replace(/\s+/g, ' ').trim());
  return doc;
}
// Preserve mixed content, text-bearing nodes and xml:space="preserve".
function prettyXML(doc, indent, source) {
  const serialize = node => new XMLSerializer().serializeToString(node);
  function render(node, depth, preserve = false) {
    const pad = indent.repeat(depth);
    if (node.nodeType !== Node.ELEMENT_NODE) return pad + serialize(node);
    const keep = preserve || node.getAttribute('xml:space') === 'preserve';
    const kids = [...node.childNodes];
    const elements = kids.some(child => child.nodeType === Node.ELEMENT_NODE);
    const text = kids.some(child => (child.nodeType === Node.TEXT_NODE || child.nodeType === Node.CDATA_SECTION_NODE) && child.nodeValue.trim());
    if (keep || !elements || text) return pad + serialize(node);
    const full = serialize(node);
    // A '>' inside a quoted attribute is not the end of the opening tag.
    let quote = null;
    let end = -1;
    for (let i = 1; i < full.length; i++) {
      const char = full[i];
      if (quote) {
        if (char === quote) quote = null;
      } else if (char === '"' || char === "'") {
        quote = char;
      } else if (char === '>') {
        end = i;
        break;
      }
    }
    const firstTag = end === -1 ? null : full.slice(0, end + 1);
    if (!firstTag || full.endsWith('/>')) return pad + full;
    const lines = kids.filter(child => child.nodeType !== Node.TEXT_NODE || child.nodeValue.trim())
      .map(child => render(child, depth + 1, keep));
    const closeTag = '</' + node.nodeName + '>';
    return [pad + firstTag, ...lines, pad + closeTag].join('\n');
  }
  const declaration = source.trim().match(/^<\?xml\s[^?]*\?>/i)?.[0];
  const nodes = [...doc.childNodes].filter(node => node.nodeType !== Node.PROCESSING_INSTRUCTION_NODE || node.target.toLowerCase() !== 'xml');
  const content = nodes.map(node => render(node, 0)).join('\n');
  return declaration && !content.startsWith(declaration) ? declaration + '\n' + content : content;
}
function describeJSONError(error, source) {
  // JSON SyntaxError messages differ among browser engines.
  const positional = /position\s+(\d+)/i.exec(error.message);
  let position = positional ? Math.min(source.length, Number(positional[1])) : null;
  if (position === null) {
    const coordinates = /line\s+(\d+)\s+column\s+(\d+)/i.exec(error.message);
    if (coordinates) {
      const line = Number(coordinates[1]), column = Number(coordinates[2]);
      const lines = source.split('\n');
      position = lines.slice(0, line - 1).reduce((sum, value) => sum + value.length + 1, 0) + column - 1;
      position = Math.min(source.length, Math.max(0, position));
    } else if (/end of (?:JSON )?input|unterminated string/i.test(error.message)) {
      position = source.length;
    }
  }
  if (position === null) return null;
  const before = source.slice(0, position).split('\n');
  return { position, line: before.length, column: before[before.length - 1].length + 1 };
}
function run(mode) {
  const raw = input.value;
  const source = typeOf(raw) === 'json' ? raw : raw.trim();
  if (!raw.trim()) { output.value = ''; updateCounts(); setStatus('请先粘贴 JSON 或 XML', true); return; }
  const type = typeOf(source);
  try {
    if (type === 'json') {
      output.value = formatJSONLossless(source, getIndent(), mode === 'minify');
    } else {
      const doc = parseXML(source);
      output.value = mode === 'minify' ? new XMLSerializer().serializeToString(doc) : prettyXML(doc, getIndent(), source);
    }
    setStatus(type.toUpperCase() + ' 校验通过 · ' + (mode === 'minify' ? '已压缩' : '已格式化'));
    $('meta').textContent = type.toUpperCase() + ' · ' + output.value.split('\n').length.toLocaleString() + ' 行';
  } catch (e) {
    output.value = '';
    const location = type === 'json' ? describeJSONError(e, source) : null;
    setStatus((location ? '第 ' + location.line + ' 行，第 ' + location.column + ' 列：' : '') + e.message, true);
    if (location) {
      input.focus();
      input.setSelectionRange(location.position, Math.min(source.length, location.position + 1));
    }
    $('meta').textContent = type.toUpperCase() + ' · 校验失败';
  }
  updateCounts();
}
$('format').addEventListener('click', () => run('format'));
$('minify').addEventListener('click', () => run('minify'));
$('copy').addEventListener('click', async () => {
  if (!output.value) { setStatus('没有可复制的结果', true); return; }
  try {
    if (!navigator.clipboard?.writeText) throw new Error('Clipboard API unavailable');
    await navigator.clipboard.writeText(output.value);
    setStatus('已复制到剪贴板');
  } catch {
    output.focus(); output.select();
    const success = document.execCommand('copy');
    setStatus(success ? '已复制到剪贴板' : '自动复制不可用，请手动复制', !success);
  }
});
$('swap').addEventListener('click', () => {
  if (!output.value) { setStatus('没有可转入的数据', true); return; }
  input.value = output.value; output.value = ''; updateCounts(); setStatus('已将结果放入输入区'); input.focus();
});
$('clear').addEventListener('click', () => { input.value = ''; output.value = ''; updateCounts(); setStatus('准备就绪'); $('meta').textContent = '本地浏览器 · 无依赖'; input.focus(); });
input.addEventListener('input', updateCounts);
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run('format'); } });
updateCounts();
