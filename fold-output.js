'use strict';
// Folded output viewer. The source textarea always keeps all bytes, including hidden lines.
// Folding never changes the value used by Copy, Download, Diff or Path Query.
function jsonFoldRanges(text) {
  const stack = [], ranges = [];
  let line = 0, quoted = false, escaped = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '\n') { line++; continue; }
    if (quoted) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') quoted = false;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === '{' || ch === '[') stack.push({ ch, start: line });
    else if (ch === '}' || ch === ']') {
      if (!stack.length) continue;
      const top = stack[stack.length - 1];
      if ((top.ch === '{' && ch === '}') || (top.ch === '[' && ch === ']')) {
        stack.pop();
        if (line > top.start) ranges.push({ start: top.start, end: line });
      }
    }
  }
  return ranges;
}
function xmlFoldRanges(text) {
  const stack = [], ranges = [];
  let line = 0, i = 0;
  while (i < text.length) {
    if (text[i] !== '<') { if (text[i] === '\n') line++; i++; continue; }
    const startLine = line;
    let end;
    if (text.startsWith('<!--', i)) {
      const close = text.indexOf('-->', i + 4);
      end = close < 0 ? text.length : close + 3;
    } else if (text.startsWith('<![CDATA[', i)) {
      const close = text.indexOf(']]>', i + 9);
      end = close < 0 ? text.length : close + 3;
    } else if (text.startsWith('<?', i)) {
      const close = text.indexOf('?>', i + 2);
      end = close < 0 ? text.length : close + 2;
    } else {
      let quote = null;
      end = i + 1;
      for (; end < text.length; end++) {
        const ch = text[end];
        if (quote) { if (ch === quote) quote = null; }
        else if (ch === '"' || ch === "'") quote = ch;
        else if (ch === '>') { end++; break; }
      }
    }
    const token = text.slice(i, end);
    for (let j = 0; j < token.length; j++) if (token[j] === '\n') line++;
    const match = /^<\/?\s*([A-Za-z_][\w.:-]*)/.exec(token);
    if (match && !token.startsWith('<!') && !token.startsWith('<?')) {
      const name = match[1];
      if (token.startsWith('</')) {
        const top = stack.at(-1);
        if (top && top.name === name) {
          stack.pop();
          if (line > top.start) ranges.push({ start: top.start, end: line });
        }
      } else if (!/\/\s*>$/.test(token)) {
        stack.push({ name, start: startLine });
      }
    }
    i = end;
  }
  return ranges;
}
function foldRanges(text, type) {
  const raw = type === 'xml' ? xmlFoldRanges(text) : jsonFoldRanges(text);
  const byStart = new Map();
  for (const range of raw) {
    const previous = byStart.get(range.start);
    if (!previous || previous.end < range.end) byStart.set(range.start, range);
  }
  return byStart;
}
function visibleFoldLines(lineCount, ranges, collapsed) {
  const visible = [];
  for (let i = 0; i < lineCount; i++) {
    visible.push(i);
    if (collapsed.has(i) && ranges.has(i)) i = ranges.get(i).end;
  }
  return visible;
}
function initFoldedOutput() {
  const source = document.getElementById('output');
  const viewer = document.getElementById('output-fold-view');
  const pane = document.getElementById('output-pane');
  const controls = {
    collapse: document.getElementById('output-fold-all'),
    expand: document.getElementById('output-expand-all'),
    full: document.getElementById('output-maximize')
  };
  const LINE_HEIGHT = 22;
  const OVERSCAN = 22;
  let original = null, lines = [], folds = new Map(), collapsed = new Set(), visible = [];
  let language = 'json', maximized = false;
  let updateFrame = 0, scrollFrame = 0, lastWindowStart = -1, lastWindowEnd = -1;
  let top = document.createElement('div');
  let bottom = document.createElement('div');
  const rows = document.createElement('div');
  rows.className = 'fold-rows';
  top.className = 'fold-spacer';
  bottom.className = 'fold-spacer';
  viewer.replaceChildren(top, rows, bottom);

  function syncControls() {
    controls.collapse.disabled = !folds.size;
    controls.expand.disabled = !collapsed.size;
    controls.full.textContent = maximized ? '退出全屏' : '全屏';
    controls.full.setAttribute('aria-pressed', String(maximized));
  }
  function rowFor(lineNumber) {
    const row = document.createElement('div');
    row.className = 'fold-row';
    row.style.height = LINE_HEIGHT + 'px';
    const gutter = document.createElement('div');
    gutter.className = 'fold-gutter';
    const range = folds.get(lineNumber);
    if (range) {
      const toggle = document.createElement('button');
      const isCollapsed = collapsed.has(lineNumber);
      toggle.className = 'fold-toggle';
      toggle.type = 'button';
      toggle.textContent = isCollapsed ? '▸' : '▾';
      toggle.title = (isCollapsed ? '展开' : '折叠') + '第 ' + (lineNumber + 1) + ' 行的结构';
      toggle.setAttribute('aria-label', toggle.title);
      toggle.setAttribute('aria-expanded', String(!isCollapsed));
      toggle.addEventListener('click', () => {
        if (collapsed.has(lineNumber)) collapsed.delete(lineNumber);
        else collapsed.add(lineNumber);
        rebuildVisible(false);
        syncControls();
        viewer.focus({ preventScroll: true });
      });
      gutter.append(toggle);
    } else {
      const placeholder = document.createElement('span');
      placeholder.className = 'fold-toggle-placeholder';
      gutter.append(placeholder);
    }
    const number = document.createElement('span');
    number.className = 'fold-line-number';
    number.textContent = String(lineNumber + 1);
    gutter.append(number);
    const code = document.createElement('code');
    code.className = 'fold-line-code';
    // paintJSON and paintXML escape all input before inserting markup.
    code.innerHTML = language === 'xml' ? paintXML(lines[lineNumber]) : paintJSON(lines[lineNumber]);
    if (range && collapsed.has(lineNumber)) {
      const summary = document.createElement('span');
      summary.className = 'fold-summary';
      summary.textContent = ' … ' + (range.end - range.start) + ' 行已折叠';
      code.append(summary);
    }
    row.append(gutter, code);
    return row;
  }
  function paint(force = false) {
    const total = visible.length;
    const first = Math.max(0, Math.floor(viewer.scrollTop / LINE_HEIGHT) - OVERSCAN);
    const last = Math.min(total,
      Math.ceil((viewer.scrollTop + Math.max(viewer.clientHeight, 440)) / LINE_HEIGHT) + OVERSCAN);
    if (!force && first === lastWindowStart && last === lastWindowEnd) return;
    lastWindowStart = first;
    lastWindowEnd = last;
    top.style.height = first * LINE_HEIGHT + 'px';
    bottom.style.height = (total - last) * LINE_HEIGHT + 'px';
    const fragment = document.createDocumentFragment();
    for (let k = first; k < last; k++) fragment.append(rowFor(visible[k]));
    rows.replaceChildren(fragment);
  }
  function rebuildVisible(resetScroll = true) {
    visible = visibleFoldLines(lines.length, folds, collapsed);
    if (resetScroll) { viewer.scrollTop = 0; viewer.scrollLeft = 0; }
    lastWindowStart = -1;
    lastWindowEnd = -1;
    paint(true);
  }
  function syncSource() {
    const raw = source.value;
    if (raw === original) return;
    original = raw;
    lines = raw ? raw.split('\n') : [];
    language = raw.trimStart().startsWith('<') ? 'xml' : 'json';
    folds = raw ? foldRanges(raw, language) : new Map();
    collapsed.clear();
    if (raw) {
      viewer.classList.remove('fold-empty');
      // Reserve horizontal scroll space for the longest line, including offscreen lines.
      let length = 0;
      for (const line of lines) if (line.length > length) length = line.length;
      rows.style.minWidth = 'max(100%, ' + Math.min(length + 12, 12000) + 'ch)';
    } else {
      viewer.classList.add('fold-empty');
      rows.style.minWidth = '';
    }
    rebuildVisible();
    if (!raw) {
      const placeholder = document.createElement('div');
      placeholder.className = 'fold-placeholder';
      placeholder.textContent = '格式化后的完整文本会显示在这里。点击行号旁的箭头折叠结构。';
      rows.replaceChildren(placeholder);
    }
    syncControls();
  }
  function scheduleUpdate() {
    if (updateFrame) return;
    updateFrame = requestAnimationFrame(() => {
      updateFrame = 0;
      syncSource();
    });
  }
  viewer.addEventListener('scroll', () => {
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => {
      scrollFrame = 0;
      paint();
    });
  }, { passive: true });
  controls.collapse.addEventListener('click', () => {
    collapsed = new Set(folds.keys());
    rebuildVisible();
    syncControls();
  });
  controls.expand.addEventListener('click', () => {
    collapsed.clear();
    rebuildVisible();
    syncControls();
  });
  controls.full.addEventListener('click', () => {
    maximized = !maximized;
    pane.classList.toggle('output-maximized', maximized);
    document.body.classList.toggle('output-fullscreen-active', maximized);
    syncControls();
    requestAnimationFrame(() => paint(true));
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && maximized) controls.full.click();
  });
  document.addEventListener('parsekit:updated', scheduleUpdate);
  document.getElementById('type').addEventListener('change', scheduleUpdate);
  syncControls();
  scheduleUpdate();
}
initFoldedOutput();
