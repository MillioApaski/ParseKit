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
  const state = { wrapper, textarea, gutter, numbers, highlight, scheduled: false };
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
      highlight.replaceChildren(); numbers.replaceChildren();
    } else {
      wrapper.classList.add('enhanced'); wrapper.classList.remove('large');
      numbers.textContent = Array.from({ length: lines }, (_, i) => i + 1).join('\n');
      const select = wrapper.dataset.editor.startsWith('diff') ? $('diff-type').value : $('type').value;
      const type = select === 'auto' ? (data.trimStart().startsWith('<') ? 'xml' : 'json') : select;
      highlight.innerHTML = (type === 'xml' ? paintXML(data) : paintJSON(data)) + '\n\u200b';
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
  textarea.addEventListener('keydown', event => {
    if (event.key !== 'Tab' || textarea.readOnly || event.ctrlKey || event.metaKey || event.altKey) return;
    event.preventDefault();
    const start = textarea.selectionStart, end = textarea.selectionEnd;
    const tab = $('indent').value === 'tab' ? '\t' : ' '.repeat(Number($('indent').value));
    textarea.setRangeText(tab, start, end, 'end');
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  });
  state.update();
}
document.addEventListener('parsekit:updated', () => editors.forEach(state => state.update()));
$('type').addEventListener('change', () => editors.forEach(state => state.update()));
$('diff-type').addEventListener('change', () => editors.forEach(state => state.update()));
