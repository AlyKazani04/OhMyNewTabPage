import { state, mutations } from '../core/state.js';
import { emit, Events } from '../core/events.js';

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// Depth-first traversal of all visible <a> elements in a column
export function getVisibleLinks(x) {
  const column = document.getElementsByClassName('column')[x];
  if (!column) return [];
  const first = column.firstChild;
  if (!first) return [];

  let container;
  if (first.tagName === 'UL') {
    container = first;
  } else if (first.tagName === 'DIV' && first.firstChild) {
    container = first.firstChild;
  } else {
    return [];
  }

  const links = [];
  collectLinks(container, links);
  return links;
}

function collectLinks(container, links) {
  for (let i = 0; i < container.children.length; i++) {
    const li = container.children[i];
    if (li.tagName !== 'LI') continue;
    const a = li.firstChild;
    if (a && a.tagName === 'A') {
      links.push(a);
    }
    // Recurse into open folder children
    const next = a ? a.nextSibling : null;
    if (next && next.tagName === 'DIV' && next.firstChild) {
      collectLinks(next.firstChild, links);
    }
  }
}

export function updateCursorVisuals() {
  if (state.vimEl) state.vimEl.classList.remove('vim-cursor');
  mutations.setVimEl(null);

  const links = getVisibleLinks(state.vimCursor.x);
  if (state.vimCursor.y >= 0 && state.vimCursor.y < links.length) {
    mutations.setVimEl(links[state.vimCursor.y]);
    state.vimEl.classList.add('vim-cursor');
    state.vimEl.scrollIntoView({ block: 'nearest' });
  }

  const cutting = state.clipboard.mode === 'cut';
  const allLinks = document.querySelectorAll('#main a');
  for (let i = 0; i < allLinks.length; i++) {
    const link = allLinks[i];
    const id = link._vimNode && link._vimNode.id;
    if (id && state.vimSelected.has(id)) {
      link.classList.add('vim-selected');
    } else {
      link.classList.remove('vim-selected');
    }
    if (cutting && id && state.clipboard.ids.indexOf(id) > -1) {
      link.classList.add('vim-cut');
    } else {
      link.classList.remove('vim-cut');
    }
  }
}

export function resolveCursor() {
  if (!state.columns || state.columns.length === 0) return;
  mutations.setVimCursor(clamp(state.vimCursor.x, 0, state.columns.length - 1), state.vimCursor.y);
  if (state.vimPendingRestore != null) restoreCursor(state.vimPendingRestore);
  const links = getVisibleLinks(state.vimCursor.x);
  mutations.setVimCursor(state.vimCursor.x, clamp(state.vimCursor.y, 0, Math.max(0, links.length - 1)));
  updateCursorVisuals();
}

// Put the cursor back on node id after a re-render (retried until rendered)
export function scheduleRestore(id) {
  mutations.setVimPendingRestore(id);
  setTimeout(() => {
    if (state.vimPendingRestore === id) mutations.clearVimPendingRestore();
  }, 2000);
}

export function restoreCursor(id) {
  for (let x = 0; x < state.columns.length; x++) {
    if (state.columns[x].indexOf(id) === -1) continue;
    mutations.setVimCursor(x, state.vimCursor.y);
    const links = getVisibleLinks(x);
    for (let i = 0; i < links.length; i++) {
      if (links[i]._vimNode && links[i]._vimNode.id === id) {
        mutations.setVimCursor(x, i);
        break;
      }
    }
    mutations.clearVimPendingRestore();
    return;
  }
  // Fallback: the id may live inside a rendered folder rather than the layout grid
  for (let x = 0; x < state.columns.length; x++) {
    const links = getVisibleLinks(x);
    for (let i = 0; i < links.length; i++) {
      if (links[i]._vimNode && links[i]._vimNode.id === id) {
        mutations.setVimCursor(x, i);
        mutations.clearVimPendingRestore();
        return;
      }
    }
  }
}

export function moveCursor(dx, dy) {
  if (!state.columns || state.columns.length === 0) return;
  if (dx !== 0) {
    mutations.setVimCursor(clamp(state.vimCursor.x + dx, 0, state.columns.length - 1), state.vimCursor.y);
    const links = getVisibleLinks(state.vimCursor.x);
    mutations.setVimCursor(state.vimCursor.x, clamp(state.vimCursor.y, 0, Math.max(0, links.length - 1)));
  }
  if (dy !== 0) {
    const curLinks = getVisibleLinks(state.vimCursor.x);
    mutations.setVimCursor(state.vimCursor.x, clamp(state.vimCursor.y + dy, 0, Math.max(0, curLinks.length - 1)));
  }
  updateCursorVisuals();
}