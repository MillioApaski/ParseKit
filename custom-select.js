'use strict';
// Local, dependency-free select-only combobox. Native selects stay as the source of truth.
// The menu lives under <body> so it isn't clipped by the toolbar or editor panels.
(() => {
  const ids = ['type', 'indent', 'tree-source', 'query-source', 'diff-type'];
  const instances = new Map();
  let opened = null;
  let repositionFrame = 0;

  function close(refocus = false) {
    if (!opened) return;
    const { button, menu } = opened;
    opened = null;
    menu.hidden = true;
    button.setAttribute('aria-expanded', 'false');
    button.removeAttribute('aria-activedescendant');
    if (refocus && button.isConnected && !button.disabled)
      button.focus({ preventScroll: true });
  }

  function position(instance) {
    if (opened !== instance) return;
    // Align the popup to the *whole* labeled control, not just its value button.
    const rect = instance.group.getBoundingClientRect();
    if (!rect.width || !rect.height) { close(); return; }
    const margin = 8;
    const viewportWidth = document.documentElement.clientWidth;
    const viewportHeight = window.innerHeight;
    const menu = instance.menu;

    menu.style.left = '0px';
    menu.style.top = '0px';
    menu.style.width = 'auto';
    menu.style.maxWidth = Math.max(0, viewportWidth - margin * 2) + 'px';
    menu.style.maxHeight = '264px';

    // Match the trigger's outer border width, including the left-hand label.
    // Only shrink when the viewport itself is narrower than the control.
    const width = Math.min(rect.width, Math.max(0, viewportWidth - margin * 2));
    menu.style.width = width + 'px';
    const below = viewportHeight - rect.bottom - margin;
    const above = rect.top - margin;
    const height = Math.min(menu.scrollHeight, 264);
    const placeAbove = below < height + 6 && above > below;
    const room = Math.max(36, placeAbove ? above - 6 : below - 6);
    menu.style.maxHeight = Math.min(264, room) + 'px';
    const renderedHeight = Math.min(height, room);
    menu.style.left = Math.max(margin,
      Math.min(rect.left, viewportWidth - margin - width)) + 'px';
    menu.style.top = Math.max(margin, placeAbove
      ? rect.top - renderedHeight - 6
      : rect.bottom + 6) + 'px';
  }

  function schedulePosition() {
    if (!opened || repositionFrame) return;
    repositionFrame = requestAnimationFrame(() => {
      repositionFrame = 0;
      if (opened) position(opened);
    });
  }

  function updateActive(instance, index) {
    const options = instance.options;
    if (!options.length) return;
    let next = index;
    if (next < 0 || next >= options.length || options[next].disabled) {
      next = options.findIndex(item => !item.disabled);
    }
    if (next < 0) return;
    instance.active = next;
    options.forEach((option, i) => {
      const active = i === next;
      option.element.classList.toggle('is-active', active);
    });
    const id = options[next].element.id;
    instance.button.setAttribute('aria-activedescendant', id);
    // Scroll only inside the menu; scrollIntoView() can unexpectedly move the page.
    const option = options[next].element;
    const top = option.offsetTop;
    if (top < instance.menu.scrollTop) instance.menu.scrollTop = top;
    else if (top + option.offsetHeight > instance.menu.scrollTop + instance.menu.clientHeight)
      instance.menu.scrollTop = top + option.offsetHeight - instance.menu.clientHeight;
  }

  function moveActive(instance, direction) {
    const options = instance.options;
    if (!options.length || options.every(option => option.disabled)) return;
    let next = instance.active;
    for (let i = 0; i < options.length; i++) {
      next = (next + direction + options.length) % options.length;
      if (!options[next].disabled) {
        updateActive(instance, next);
        return;
      }
    }
  }

  function sync(instance) {
    const selected = instance.select.selectedOptions[0];
    const value = selected ? selected.textContent.trim() : '';
    instance.labelValue.textContent = value;
    instance.button.setAttribute('aria-label', instance.caption + '：' + value);
    instance.button.disabled = instance.select.disabled;
    instance.options.forEach(option => {
      const active = option.value === instance.select.value;
      option.element.classList.toggle('is-selected', active);
      option.element.setAttribute('aria-selected', String(active));
      option.check.hidden = !active;
    });
  }

  function choose(instance, index) {
    const option = instance.options[index];
    if (!option || option.disabled) return;
    const changed = instance.select.value !== option.value;
    instance.select.value = option.value;
    sync(instance);
    close(true);
    if (changed) {
      // Keep all existing ParseKit listeners working without changing their APIs.
      instance.select.dispatchEvent(new Event('input', { bubbles: true }));
      instance.select.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  function rebuild(instance) {
    const { select, menu } = instance;
    menu.replaceChildren();
    instance.options = [...select.options].map((option, index) => {
      const element = document.createElement('div');
      element.id = 'pk-select-' + select.id + '-option-' + index;
      element.className = 'pk-select-option';
      element.setAttribute('role', 'option');
      element.setAttribute('aria-selected', String(option.selected));
      element.textContent = option.textContent.trim();
      const check = document.createElement('span');
      check.className = 'pk-select-check';
      check.textContent = '✓';
      check.setAttribute('aria-hidden', 'true');
      check.hidden = !option.selected;
      element.append(check);
      if (option.disabled) {
        element.classList.add('is-disabled');
        element.setAttribute('aria-disabled', 'true');
      } else {
        element.addEventListener('pointerenter', () => updateActive(instance, index));
        element.addEventListener('click', () => choose(instance, index));
      }
      menu.append(element);
      return { element, value: option.value, disabled: option.disabled, check };
    });
    sync(instance);
  }

  function open(instance, step = 0) {
    if (instance.select.disabled) return;
    close();
    rebuild(instance);
    instance.menu.hidden = false;
    opened = instance;
    instance.button.setAttribute('aria-expanded', 'true');
    instance.active = instance.options.findIndex(opt =>
      opt.value === instance.select.value && !opt.disabled);
    updateActive(instance, Math.max(0, instance.active));
    if (step) moveActive(instance, step);
    position(instance);
  }

  function typeahead(instance, key) {
    const now = Date.now();
    instance.search = now - instance.lastKey < 700
      ? instance.search + key.toLocaleLowerCase()
      : key.toLocaleLowerCase();
    instance.lastKey = now;
    const find = term => instance.options.findIndex(opt =>
      !opt.disabled && opt.element.firstChild?.textContent.toLocaleLowerCase().startsWith(term));
    let index = find(instance.search);
    if (index < 0 && instance.search.length > 1) {
      instance.search = key.toLocaleLowerCase();
      index = find(instance.search);
    }
    if (index < 0) return;
    if (opened !== instance) open(instance);
    updateActive(instance, index);
  }

  function mount(select) {
    let group = select.closest('.control-group');
    if (!group) return;
    // A label must not contain both its original select and a clickable button.
    if (group.tagName === 'LABEL') {
      const replacement = document.createElement('div');
      replacement.className = group.className;
      while (group.firstChild) replacement.append(group.firstChild);
      group.replaceWith(replacement);
      group = replacement;
    }
    const caption = group.querySelector('.control-label')?.textContent.trim() || select.id;
    select.setAttribute('aria-label', caption);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pk-select-trigger';
    button.setAttribute('role', 'combobox');
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    const menu = document.createElement('div');
    menu.id = 'pk-select-' + select.id + '-menu';
    menu.className = 'pk-select-menu';
    menu.setAttribute('role', 'listbox');
    menu.setAttribute('aria-label', caption + '选项');
    menu.hidden = true;
    document.body.append(menu);
    button.setAttribute('aria-controls', menu.id);

    const labelValue = document.createElement('span');
    labelValue.className = 'pk-select-value';
    const chevron = document.createElement('span');
    chevron.className = 'pk-select-chevron';
    chevron.setAttribute('aria-hidden', 'true');
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '2');
    icon.setAttribute('stroke-linecap', 'round');
    icon.setAttribute('stroke-linejoin', 'round');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'm6 9 6 6 6-6');
    icon.append(path);
    chevron.append(icon);
    button.append(labelValue, chevron);

    group.append(button);
    const instance = {
      select, group, caption, button, menu, labelValue,
      options: [], active: -1, search: '', lastKey: 0
    };
    instances.set(select.id, instance);
    rebuild(instance);
    select.classList.add('pk-native-select');
    group.classList.add('pk-select-ready');
    select.tabIndex = -1;
    select.setAttribute('aria-hidden', 'true');

    button.addEventListener('click', () => {
      if (opened === instance) close();
      else open(instance);
    });
    button.addEventListener('keydown', event => {
      if (event.isComposing || event.ctrlKey || event.metaKey) return;
      const isOpen = opened === instance;
      if (event.key === 'Escape') {
        if (isOpen) { event.preventDefault(); close(true); }
        return;
      }
      if (event.key === 'Tab') { if (isOpen) close(); return; }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const step = event.key === 'ArrowDown' ? 1 : -1;
        if (!isOpen) open(instance, step);
        else moveActive(instance, step);
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        if (!isOpen) open(instance);
        updateActive(instance, event.key === 'Home' ? 0 : instance.options.length - 1);
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        if (!isOpen) open(instance);
        else choose(instance, instance.active);
      } else if (event.key.length === 1 && !event.altKey) {
        typeahead(instance, event.key);
      }
    });
    select.addEventListener('change', () => {
      sync(instance);
      if (opened === instance) rebuild(instance);
    });
  }

  for (const id of ids) {
    const select = document.getElementById(id);
    if (select) mount(select);
  }

  document.addEventListener('pointerdown', event => {
    if (opened && !opened.group.contains(event.target) &&
        !opened.menu.contains(event.target)) close();
  }, true);
  document.addEventListener('focusin', event => {
    if (opened && !opened.group.contains(event.target) &&
        !opened.menu.contains(event.target)) close();
  });
  window.addEventListener('scroll', schedulePosition, true);
  window.addEventListener('resize', schedulePosition);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) close();
  });

  // For callers that programmatically change a native select without dispatching change.
  window.ParseKitSelects = Object.freeze({
    refresh: id => {
      const instance = instances.get(id);
      if (instance) sync(instance);
    }
  });
})();