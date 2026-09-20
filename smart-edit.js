'use strict';
// ParseKit smart editing: no external dependencies and no remote completion service.
function smartMode(text, selected) {
  return selected === 'auto' ? (text.trimStart().startsWith('<') ? 'xml' : 'json') : selected;
}
function smartIndent(text, start, end, unit, shift) {
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  if (shift && start === end) {
    const line = text.slice(lineStart, start);
    const prefix = (/^[ \t]*/.exec(line) || [''])[0];
    const count = prefix.startsWith('\t') ? 1 : Math.min(unit === '\t' ? 1 : unit.length, (/^ */.exec(prefix) || [''])[0].length);
    return count ? { from: lineStart, to: lineStart + count, insert: '', anchor: Math.max(lineStart, start - count), head: Math.max(lineStart, start - count) } : null;
  }
  if (start === end || !text.slice(start, end).includes('\n')) {
    if (shift) return null;
    return { from: start, to: end, insert: unit, anchor: start + unit.length, head: start + unit.length };
  }
  // Do not indent an extra unselected line when the selection ends at its start.
  const last = text[end - 1] === '\n' ? end - 1 : end;
  const lineEnd = text.indexOf('\n', last);
  const to = lineEnd < 0 ? text.length : lineEnd;
  const lines = text.slice(lineStart, to).split('\n');
  const rewritten = lines.map(line => {
    if (!shift) return unit + line;
    if (line.startsWith('\t')) return line.slice(1);
    const spaces = (/^ */.exec(line) || [''])[0].length;
    return line.slice(Math.min(spaces, unit === '\t' ? 1 : unit.length));
  }).join('\n');
  return { from: lineStart, to, insert: rewritten, anchor: lineStart, head: lineStart + rewritten.length };
}
function smartWithinJSONQuote(text, position) {
  let quoted = false, escaped = false;
  for (let i = 0; i < position; i++) {
    const char = text[i];
    if (!quoted) { if (char === '"') quoted = true; }
    else if (escaped) escaped = false;
    else if (char === '\\') escaped = true;
    else if (char === '"') quoted = false;
  }
  return quoted;
}
function smartXMLTag(text, position) {
  const before = text.slice(0, position);
  const start = before.lastIndexOf('<');
  if (start < 0 || before.lastIndexOf('>') > start) return null;
  const fragment = before.slice(start);
  if (!/^<[A-Za-z_:][\w:.-]*/.test(fragment)) return null;
  let quote = null;
  for (let i = 1; i < fragment.length; i++) {
    const char = fragment[i];
    if (quote) { if (char === quote) quote = null; }
    else if (char === '"' || char === "'") quote = char;
  }
  return { fragment, quote };
}
function smartEdit(text, start, end, key, mode, unit, shift = false) {
  const selected = text.slice(start, end);
  const next = text[end] || '';
  const at = start + 1;
  const edit = (insert, caret = at, from = start, to = end, head = caret) =>
    ({ from, to, insert, anchor: caret, head });
  if (key === 'Tab') return smartIndent(text, start, end, unit, shift);
  if (key === 'Backspace' && start === end && start > 0) {
    const pair = text[start - 1] + next;
    if ((mode === 'json' && ['{}', '[]', '""'].includes(pair)) ||
        (mode === 'xml' && ['""', "''"].includes(pair)))
      return edit('', start - 1, start - 1, end + 1);
    return null;
  }
  if (start !== end) {
    if (mode === 'json' && (key === '{' || key === '[' || key === '"')) {
      const close = { '{': '}', '[': ']', '"': '"' }[key];
      return edit(key + selected + close, start + 1, start, end, end + 1);
    }
    if (mode === 'xml' && (key === '"' || key === "'"))
      return edit(key + selected + key, start + 1, start, end, end + 1);
    if (key !== 'Enter') return null;
  }
  const lineStart = text.lastIndexOf('\n', start - 1) + 1;
  const before = text.slice(lineStart, start);
  const after = text.slice(end);
  const base = (/^[ \t]*/.exec(before) || [''])[0];
  if (key === 'Enter') {
    const trimmed = before.trimEnd();
    const matching = mode === 'json' && ((trimmed.endsWith('{') && /^\s*}/.test(after)) ||
      (trimmed.endsWith('[') && /^\s*]/.test(after)));
    const xmlOpen = mode === 'xml' && /<([A-Za-z_:][\w:.-]*)(?:\s[^<>]*)?>$/.exec(trimmed);
    const xmlMatching = xmlOpen && !/\/>$/.test(trimmed) &&
      after.trimStart().startsWith('</' + xmlOpen[1] + '>');
    if (matching || xmlMatching)
      return edit('\n' + base + unit + '\n' + base,
        start + 1 + base.length + unit.length);
    const opens = mode === 'json' && /[{\[]$/.test(trimmed);
    const openXML = mode === 'xml' && xmlOpen && !/\/>$/.test(trimmed);
    const indentation = base + (opens || openXML ? unit : '');
    return edit('\n' + indentation, start + 1 + indentation.length);
  }
  if (mode === 'json') {
    const inString = smartWithinJSONQuote(text, start);
    if (key === '"' && inString) {
      if (next === '"') return edit('', start + 1, start, start);
      return null;
    }
    if (!inString && (key === '{' || key === '[' || key === '"')) {
      const close = { '{': '}', '[': ']', '"': '"' }[key];
      return edit(key + close);
    }
    if (!inString && (key === '}' || key === ']')) {
      if (next === key) return edit('', start + 1, start, start);
      if (/^[ \t]*$/.test(before)) {
        const remove = base.endsWith(unit) ? unit.length : base.endsWith('\t') ? 1 :
          Math.min((/ *$/.exec(base) || [''])[0].length, unit === '\t' ? 1 : unit.length);
        if (remove) {
          const indent = base.slice(0, -remove);
          return edit(indent + key, lineStart + indent.length + 1, lineStart, start);
        }
      }
    }
    if (!inString && key === '"' && next === '"') return edit('', start + 1, start, start);
  }
  if (mode === 'xml') {
    const tag = smartXMLTag(text, start);
    if ((key === '"' || key === "'") && tag) {
      if (tag.quote === key) {
        if (next === key) return edit('', start + 1, start, start);
        return null;
      }
      if (!tag.quote) return edit(key + key);
    }
    if (key === '>' && tag && !tag.quote && !tag.fragment.endsWith('/') &&
        next !== '>') {
      const match = /^<([A-Za-z_:][\w:.-]*)/.exec(tag.fragment);
      if (match) {
        const closing = '</' + match[1] + '>';
        if (!after.trimStart().startsWith(closing) &&
            !after.slice(0, 5000).includes(closing))
          return edit('>' + closing);
      }
    }
  }
  return null;
}
function smartJSONKeys(text) {
  const keys = new Set();
  const regex = /"((?:\\.|[^"\\])*)"\s*:/g;
  let match;
  while ((match = regex.exec(text.slice(0, 120000))) && keys.size < 400) {
    try { keys.add(JSON.parse('"' + match[1] + '"')); } catch (_) { /* Incomplete key */ }
  }
  return [...keys];
}
function smartCandidates(text, position, mode, keys) {
  const prior = text.slice(Math.max(0, position - 180), position);
  if (mode === 'xml') {
    const match = /<([A-Za-z_:][\w:.-]*)$/.exec(prior);
    if (!match) return null;
    const known = [...new Set((text.match(/<\/?([A-Za-z_:][\w:.-]*)/g) || [])
      .map(value => value.replace(/^<\/?/, '')))];
    const options = known.filter(k => k.startsWith(match[1]) && k !== match[1]).slice(0, 8);
    return options.length ? { from: position - match[1].length, to: position, options } : null;
  }
  const quote = /"([A-Za-z0-9_$:-]+)$/.exec(prior);
  if (quote && smartWithinJSONQuote(text, position)) {
    const options = keys.filter(key => key.startsWith(quote[1]) && key !== quote[1]).slice(0, 8);
    return options.length ? { from: position - quote[1].length, to: position, options } : null;
  }
  if (smartWithinJSONQuote(text, position)) return null;
  const literal = /(?:^|[:,\[])\s*([A-Za-z]+)$/.exec(prior);
  if (!literal) return null;
  const options = ['true', 'false', 'null'].filter(k => k.startsWith(literal[1]) && k !== literal[1]);
  return options.length ? { from: position - literal[1].length, to: position, options } : null;
}
function setupSmartEditor(textarea, wrapper) {
  if (textarea.readOnly) return;
  let active = null, index = 0, composing = false, scheduled = false;
  const menu = document.createElement('div');
  menu.className = 'editor-completion';
  menu.setAttribute('role', 'listbox');
  menu.hidden = true;
  wrapper.querySelector('.code-stage').append(menu);
  const hide = () => { active = null; menu.hidden = true; menu.replaceChildren(); };
  function applyEdit(edit) {
    textarea.setRangeText(edit.insert, edit.from, edit.to, 'end');
    textarea.setSelectionRange(edit.anchor, edit.head);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }
  function accept() {
    if (!active) return false;
    const value = active.options[index];
    applyEdit({ from: active.from, to: active.to, insert: value,
      anchor: active.from + value.length, head: active.from + value.length });
    hide();
    return true;
  }
  function refresh() {
    scheduled = false;
    if (composing || document.activeElement !== textarea ||
        textarea.selectionStart !== textarea.selectionEnd || textarea.value.length > 120000) {
      hide(); return;
    }
    const type = smartMode(textarea.value,
      wrapper.dataset.editor.startsWith('diff') ? $('diff-type').value : $('type').value);
    const keys = type === 'json' ? smartJSONKeys(textarea.value) : [];
    active = smartCandidates(textarea.value, textarea.selectionStart, type, keys);
    if (!active) { hide(); return; }
    index = 0; menu.replaceChildren();
    active.options.forEach((candidate, i) => {
      const option = document.createElement('button');
      option.type = 'button'; option.className = 'completion-option';
      option.setAttribute('role', 'option');
      option.textContent = candidate;
      option.addEventListener('mousedown', event => event.preventDefault());
      option.addEventListener('click', () => { index = i; accept(); textarea.focus(); });
      menu.append(option);
    });
    menu.hidden = false;
    const start = textarea.value.lastIndexOf('\n', textarea.selectionStart - 1) + 1;
    const row = textarea.value.slice(0, start).split('\n').length - 1;
    const column = textarea.value.slice(start, textarea.selectionStart).replace(/\t/g, '    ').length;
    const px = parseFloat(getComputedStyle(textarea).fontSize) || 13;
    const height = parseFloat(getComputedStyle(textarea).lineHeight) || 22;
    const x = 20 + column * px * 0.61 - textarea.scrollLeft;
    const y = 19 + (row + 1) * height - textarea.scrollTop;
    menu.style.left = Math.max(5, Math.min(x, wrapper.clientWidth - 240)) + 'px';
    menu.style.top = Math.max(5, Math.min(y, wrapper.clientHeight - 150)) + 'px';
    for (const [i, item] of [...menu.children].entries()) item.classList.toggle('selected', i === index);
  }
  function requestRefresh() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(refresh);
  }
  textarea.addEventListener('compositionstart', () => { composing = true; hide(); });
  textarea.addEventListener('compositionend', () => { composing = false; requestRefresh(); });
  textarea.addEventListener('blur', hide);
  textarea.addEventListener('click', requestRefresh);
  textarea.addEventListener('input', requestRefresh);
  textarea.addEventListener('keydown', event => {
    if (composing || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
    if (active) {
      if (event.key === 'Escape') { event.preventDefault(); hide(); return; }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        index = (index + (event.key === 'ArrowDown' ? 1 : -1) + active.options.length) % active.options.length;
        [...menu.children].forEach((item, i) => item.classList.toggle('selected', i === index));
        return;
      }
      if (event.key === 'Tab') { event.preventDefault(); accept(); return; }
      if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); accept(); return; }
    }
    const mode = smartMode(textarea.value,
      wrapper.dataset.editor.startsWith('diff') ? $('diff-type').value : $('type').value);
    const unit = $('indent').value === 'tab' ? '\t' : ' '.repeat(Number($('indent').value));
    const edit = smartEdit(textarea.value, textarea.selectionStart, textarea.selectionEnd,
      event.key, mode, unit, event.shiftKey);
    if (!edit) return;
    event.preventDefault();
    hide();
    applyEdit(edit);
  });
}
for (const wrapper of document.querySelectorAll('[data-editor]')) {
  setupSmartEditor(wrapper.querySelector('textarea'), wrapper);
}
