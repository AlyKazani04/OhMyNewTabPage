// ----- FINDER -----
// Ctrl+K / Cmd+K bookmark finder overlay
import { bmGetTree } from './chrome-api.js';
import { openLink, getIcon, toggle } from './render.js';
import { getVisibleLinks, updateCursorVisuals } from './vim.js';
import { state, mutations } from './state.js';
import { get } from './config/config.js';
import { buildIndex, rankEntries, pickColumn } from './finder-match.js';

const HINT = 'Enter open · Ctrl+Enter background · Tab reveal · Esc close';

let close = null; // set while the overlay is open
let opening = false;

function isShortcut(event) {
  return (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k';
}

export function initFinder() {
  document.addEventListener('keydown', (event) => {
    if (!isShortcut(event)) return;
    if (document.getElementById('options').style.display === 'block') return;
    if (document.querySelector('.menu') || document.querySelector('.vim-modal-backdrop')) return;
    const tag = event.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    event.preventDefault();
    openFinder();
  });
}

// Text with <mark> around the given indices, built from text nodes only
function highlight(el, text, positions) {
  const marked = new Set(positions);
  let i = 0;
  while (i < text.length) {
    const isMark = marked.has(i);
    let j = i;
    while (j < text.length && marked.has(j) === isMark) j++;
    const chunk = document.createTextNode(text.slice(i, j));
    if (isMark) {
      const mark = document.createElement('mark');
      mark.appendChild(chunk);
      el.appendChild(mark);
    } else el.appendChild(chunk);
    i = j;
  }
}

async function openFinder() {
  if (close || opening) return;
  opening = true;
  const prevFocus = document.activeElement;
  let entries;
  try {
    entries = buildIndex(await bmGetTree());
  } catch (err) {
    console.warn('Failed to read bookmarks:', err);
    return;
  } finally {
    opening = false;
  }

  const backdrop = document.createElement('div');
  backdrop.className = 'vim-modal-backdrop finder-backdrop';
  const panel = document.createElement('div');
  panel.className = 'finder';
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'finder-input';
  input.placeholder = 'Search bookmarks…';
  input.setAttribute('aria-label', 'Search bookmarks');
  const list = document.createElement('ul');
  list.className = 'finder-results';
  const hint = document.createElement('div');
  hint.className = 'finder-hint';
  hint.textContent = HINT;
  panel.append(input, list, hint);
  backdrop.appendChild(panel);

  let results = [];
  let selected = 0;

  function select(index) {
    const rows = list.children;
    if (!rows.length) return;
    if (rows[selected]) rows[selected].classList.remove('selected');
    selected = Math.max(0, Math.min(index, rows.length - 1));
    rows[selected].classList.add('selected');
    rows[selected].scrollIntoView({ block: 'nearest' });
  }

  function renderResults() {
    results = rankEntries(input.value, entries);
    list.textContent = '';
    results.forEach((result, i) => {
      const { entry, highlights } = result;
      const li = document.createElement('li');
      li.className = 'finder-row';
      if (entry.isFolder) li.classList.add('folder');
      li.appendChild(getIcon(entry.node));
      const title = document.createElement('span');
      title.className = 'finder-title';
      highlight(title, entry.title, highlights.title);
      const path = document.createElement('span');
      path.className = 'finder-path';
      highlight(path, entry.path, highlights.path);
      li.append(title, path);
      li.onclick = () => { select(i); activate(false); };
      list.appendChild(li);
    });
    selected = 0;
    select(0);
  }

  function activate(background) {
    const result = results[selected];
    if (!result) return;
    const { entry } = result;
    if (entry.isFolder) {
      if (!background) revealEntry(entry, true);
      return;
    }
    closeFinder();
    openLink(entry.node, background ? 2 : get('newtab'));
  }

  function onKeyDown(event) {
    // Keys that commit or steer an IME composition belong to the IME
    if (event.isComposing || event.keyCode === 229) return;
    let handled = true;
    if (isShortcut(event) || event.key === 'Escape') closeFinder();
    else if (event.key === 'ArrowDown') select(selected + 1);
    else if (event.key === 'ArrowUp') select(selected - 1);
    else if (event.key === 'Tab' || (event.key === 'Enter' && event.shiftKey)) {
      if (results[selected]) revealEntry(results[selected].entry, false);
    } else if (event.key === 'Enter') activate(event.ctrlKey || event.metaKey);
    else handled = false;
    if (handled) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function closeFinder() {
    if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    document.removeEventListener('keydown', onKeyDown, true);
    close = null;
    if (prevFocus && prevFocus.isConnected && prevFocus.focus) prevFocus.focus();
  }

  input.addEventListener('input', renderResults);
  // Keep focus in the input when clicking rows; clicking the dim area closes
  backdrop.onmousedown = (event) => {
    if (event.target === backdrop) closeFinder();
    return false;
  };

  close = closeFinder;
  document.addEventListener('keydown', onKeyDown, true);
  document.body.appendChild(backdrop);
  input.focus();
}

let noticeTimer = null;

// Transient message at the bottom of the page
function showNotice(text) {
  const old = document.querySelector('.finder-notice');
  if (old) old.remove();
  clearTimeout(noticeTimer);
  const notice = document.createElement('div');
  notice.className = 'finder-notice';
  notice.setAttribute('role', 'status');
  notice.textContent = text;
  document.body.appendChild(notice);
  noticeTimer = setTimeout(() => notice.remove(), 2500);
}

// Polls fn on animation frames until it returns non-null or the deadline passes,
// in case children render late
async function poll(fn, end) {
  for (;;) {
    const v = fn();
    if (v != null || performance.now() > end) return v ?? null;
    await new Promise(requestAnimationFrame);
  }
}

// Anchor for id inside scope
function findAnchor(scope, id, end) {
  return poll(() => [...scope.querySelectorAll('a')].find(a => a._vimNode && a._vimNode.id === id), end);
}

// Open the entry's ancestor folders in its column and put the vim cursor on it
async function revealEntry(entry, openFolder) {
  if (close) close();
  const end = performance.now() + 2000;
  const chain = [...entry.ancestors, entry.node.id];
  const pick = pickColumn(chain, state.columns, !!get('show_root'));
  if (!pick) {
    showNotice('Not shown in your layout');
    return;
  }
  const col = document.getElementsByClassName('column')[pick.x];
  if (pick.start === chain.length) {
    mutations.setVimCursor(pick.x, 0);
    updateCursorVisuals();
    return;
  }
  // Each step searches only under the previous anchor, so a stale copy elsewhere
  // (the Recent bookmarks section, or the item's old folder) is never picked.
  let scope = col;
  for (const id of chain.slice(pick.start, -1)) {
    const a = scope && await findAnchor(scope, id, end);
    if (!a) {
      showNotice("Couldn't reveal it — reload the page");
      return;
    }
    if (!a.open) toggle(a._vimNode, a);
    scope = a.parentNode;
  }
  const target = scope && await findAnchor(scope, entry.node.id, end);
  // auto_close may be collapsing a sibling folder: its rows stay in the DOM (and in
  // getVisibleLinks) until the slide animation ends, which would skew the index
  const index = target && await poll(() => {
    if (col.querySelector('.wrap.closing')) return null;
    const i = getVisibleLinks(pick.x).indexOf(target);
    return i < 0 ? null : i;
  }, end);
  if (index == null) {
    showNotice("Couldn't reveal it — reload the page");
    return;
  }
  mutations.setVimCursor(pick.x, index);
  updateCursorVisuals();
  if (openFolder && entry.isFolder && !target.open) {
    toggle(target._vimNode, target);
    // Opening it can collapse a sibling above it; place the cursor again once that ends
    await poll(() => (col.querySelector('.wrap.closing') ? null : true), performance.now() + 1500);
    const i = getVisibleLinks(pick.x).indexOf(target);
    if (i >= 0 && state.vimEl === target) {
      mutations.setVimCursor(pick.x, i);
      updateCursorVisuals();
    }
  }
}
