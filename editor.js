'use strict';
// Minimal, dependency-free editor enhancement. This does not implement Monaco.
const highlightEscape = value => value.replace(/[&<>"']/g, char => ({
  '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
})[char]);
function paintJSON(text) {
  const expression = /"(?:\\.|[^"\\])*"(?=\s*:)|"(?:\\.|[^"\\])*"|-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\b(?:true|false|null)\b|[{}\[\],:]/g;
  let last = 0, html = '', match;
  while ((match = expression.exec(text))) {
    html += highlightEscape(text.slice(last, match.index));
    const token = match[0];
    let lookahead = expression.lastIndex;
    while (lookahead < text.length && /\s/.test(text[lookahead])) lookahead++;
    const category = token[0] === '"' ? text[lookahead] === ':' ? 'syntax-key' : 'syntax-string'
      : /^(?:true|false|null)$/.test(token) ? 'syntax-keyword'
      : /^-?\d/.test(token) ? 'syntax-number' : 'syntax-punct';
    html += '<span class="' + category + '">' + highlightEscape(token) + '</span>';
    last = expression.lastIndex;
  }
  return html + highlightEscape(text.slice(last));
}
function paintXML(text) {
  // Token-based highlighting; all user text is escaped before it reaches innerHTML.
  const expression = /<!--[\s\S]*?-->|<!\[CDATA\[[\s\S]*?\]\]>|<\?[\s\S]*?\?>|<\/?[\w:.-]+|\/?>|\b[\w:.-]+(?=\s*=)|"(?:\\.|[^"])*"|'(?:\\.|[^'])*'/g;
  let last = 0, html = '', match;
  while ((match = expression.exec(text))) {
    html += highlightEscape(text.slice(last, match.index));
    const token = match[0];
    const category = token.startsWith('<!--') ? 'syntax-comment'
      : token.startsWith('<') ? 'syntax-tag'
      : /^[A-Za-z_:][\w:.-]*$/.test(token) ? 'syntax-attr'
      : token.startsWith('"') || token.startsWith("'") ? 'syntax-string' : 'syntax-punct';
    html += '<span class="' + category + '">' + highlightEscape(token) + '</span>';
    last = expression.lastIndex;
  }
  return html + highlightEscape(text.slice(last));
}
const editors = [];
for (const wrapper of document.querySelectorAll('[data-editor]')) {
  const textarea = wrapper.querySelector('textarea');
  const gutter = document.createElement('div'); gutter.className = 'line-gutter';
  gutter.setAttribute('aria-hidden', 'true');
  const numbers = document.createElement('div'); numbers.className = 'line-numbers';
  gutter.append(numbers);
  const stage = document.createElement('div'); stage.className = 'code-stage';
  const highlight = document.createElement('pre'); highlight.className = 'code-highlight';
  highlight.setAttribute('aria-hidden', 'true');
  stage.append(highlight, textarea);
  wrapper.append(gutter, stage);
  wrapper.classList.add('enhanced');
  const state = { wrapper, textarea, gutter, numbers, highlight, scheduled: false, errorMarker: null };
  editors.push(state);
  const sync = () => {
    numbers.style.transform = 'translateY(' + -textarea.scrollTop + 'px)';
    highlight.style.transform = 'translate(' + -textarea.scrollLeft + 'px,' + -textarea.scrollTop + 'px)';
  };
  const update = () => {
    state.scheduled = false;
    const data = textarea.value;
    const lines = data.split('\n').length;
    // Large inputs remain usable as native textarea instead of locking the tab.
    if (data.length > 160000 || lines > 5000) {
      wrapper.classList.remove('enhanced'); wrapper.classList.add('large');
      highlight.replaceChildren(); numbers.replaceChildren(); state.errorMarker = null;
    } else {
      wrapper.classList.add('enhanced'); wrapper.classList.remove('large');
      const errorLine = wrapper.dataset.editor === 'input' && activeInputError
        ? activeInputError.line - 1 : -1;
      numbers.innerHTML = Array.from({ length: lines }, (_, i) =>
        i === errorLine ? '<span class="editor-error-line" title="此行包含语法错误">' +
          (i + 1) + '</span>' : String(i + 1)).join('\n');
      const select = wrapper.dataset.editor.startsWith('diff') ? $('diff-type').value : $('type').value;
      const type = select === 'auto' ? (data.trimStart().startsWith('<') ? 'xml' : 'json') : select;
      highlight.innerHTML = (type === 'xml' ? paintXML(data) : paintJSON(data)) + '\n\u200b';
      state.errorMarker = wrapper.dataset.editor === 'input' && activeInputError
        ? markEditorError(highlight, activeInputError.position) : null;
      sync();
    }
    if (wrapper.dataset.editor === 'diff-left' || wrapper.dataset.editor === 'diff-right') {
      $(wrapper.dataset.editor + '-count').textContent = data.length.toLocaleString() + ' 字符';
    }
  };
  state.update = () => {
    if (state.scheduled) return;
    state.scheduled = true;
    requestAnimationFrame(update);
  };
  textarea.addEventListener('scroll', sync, { passive: true });
  textarea.addEventListener('input', state.update);
  state.update();
}
document.addEventListener('parsekit:updated', () => editors.forEach(state => state.update()));
$('type').addEventListener('change', () => editors.forEach(state => state.update()));
$('diff-type').addEventListener('change', () => editors.forEach(state => state.update()));


// Highlight one raw source character inside the already escaped syntax DOM.
// This preserves token coloring and never inserts unescaped source HTML.
let activeInputError = null;
function markEditorError(pre, position) {
  const walker = document.createTreeWalker(pre, NodeFilter.SHOW_TEXT);
  let offset = Math.max(0, position);
  let node;
  while ((node = walker.nextNode())) {
    if (offset >= node.length) { offset -= node.length; continue; }
    const segment = node.splitText(offset);
    const mark = document.createElement('span');
    mark.className = 'syntax-error-character';
    mark.title = 'JSON/XML 语法错误位置';
    if (segment.data[0] === '\n' || segment.data[0] === '\u200b') {
      mark.textContent = '\u00a0';
      mark.classList.add('syntax-error-insertion');
      segment.before(mark);
    } else {
      segment.splitText(1);
      mark.textContent = segment.data;
      segment.replaceWith(mark);
    }
    return mark;
  }
  return null;
}
function inputEditorState() {
  return editors.find(e => e.wrapper.dataset.editor === 'input');
}
function jumpToInputError() {
  if (!activeInputError) return;
  const state = inputEditorState();
  if (!state) return;
  const textarea = state.textarea;
  const position = Math.min(textarea.value.length, activeInputError.position);
  textarea.focus({ preventScroll: true });
  textarea.setSelectionRange(position, position);
  state.update();
  requestAnimationFrame(() => {
    const marker = state.errorMarker;
    if (!marker) {
      // Native fallback for documents that exceed the highlighting threshold.
      const lineHeight = parseFloat(getComputedStyle(textarea).lineHeight) || 22;
      textarea.scrollTop = Math.max(0, (activeInputError.line - 4) * lineHeight);
      textarea.scrollLeft = Math.max(0, (activeInputError.column - 25) * 7.8);
      return;
    }
    const rect = marker.getBoundingClientRect();
    const viewport = state.wrapper.querySelector('.code-stage').getBoundingClientRect();
    const padding = 40;
    if (rect.right > viewport.right - padding)
      textarea.scrollLeft += rect.right - viewport.right + padding;
    else if (rect.left < viewport.left + padding)
      textarea.scrollLeft = Math.max(0, textarea.scrollLeft - (viewport.left + padding - rect.left));
    if (rect.bottom > viewport.bottom - padding)
      textarea.scrollTop += rect.bottom - viewport.bottom + padding;
    else if (rect.top < viewport.top + padding)
      textarea.scrollTop = Math.max(0, textarea.scrollTop - (viewport.top + padding - rect.top));
    state.numbers.style.transform = 'translateY(' + -textarea.scrollTop + 'px)';
    state.highlight.style.transform = 'translate(' +
      -textarea.scrollLeft + 'px,' + -textarea.scrollTop + 'px)';
  });
}
function clearInputError() {
  const bar = $('input-error-bar');
  const hadError = activeInputError !== null || !bar.hidden;
  activeInputError = null;
  bar.hidden = true;
  $('input-error-jump').hidden = false;
  if (hadError) inputEditorState()?.update();
}
function showInputError(location, message) {
  clearInputError();
  const bar = $('input-error-bar');
  if (!location) {
    bar.hidden = false;
    $('input-error-jump').hidden = true;
    $('input-error-message').textContent = message;
    $('input-error-message').title = message;
    return;
  }
  const source = $('input').value;
  const position = Math.max(0, Math.min(location.position, source.length));
  const prefix = source.slice(0, position).split('\n');
  activeInputError = {
    position, line: prefix.length, column: prefix[prefix.length - 1].length + 1
  };
  bar.hidden = false;
  $('input-error-jump').textContent = '第 ' + activeInputError.line +
    ' 行 · 第 ' + activeInputError.column + ' 列 ↗';
  $('input-error-message').textContent = message;
  $('input-error-message').title = message;
  inputEditorState()?.update();
  requestAnimationFrame(jumpToInputError);
}
$('input-error-jump').addEventListener('click', jumpToInputError);
$('input').addEventListener('input', clearInputError);
$('type').addEventListener('change', clearInputError);
