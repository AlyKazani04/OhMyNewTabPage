import { state, mutations } from './state.js';
import { get, set } from './config/index.js';
import {
  isRealBookmarkId,
  normalizeUrl,
  getInsertionContext,
  createBookmarkAt,
  updateBookmark,
  deleteBookmarksByIds,
  syncLayoutAfterPaste,
  getDefaultParentId,
  findParentFolderId,
  copyBookmarkSubtree,
  clipTargetableId
} from './bookmarks.js';
import { toggle } from './render.js';
import { showModal, renderMenu } from './interaction.js';
import { bmGet, bmMove } from './chrome-api.js';


// ----- ACTIONS -----
// Vim activation
export function vimActivate() {
  if (!state.vimEl) return;
  const isFolder = state.vimEl.classList.contains('folder');
  if (isFolder) {
    const node = state.vimEl._vimNode;
    if (node) toggle(node, state.vimEl);
  } else {
    state.vimEl.dispatchEvent(new MouseEvent('click'));
  }
}

export function vimOpenFolder() {
  if (!state.vimEl || !state.vimEl.classList.contains('folder')) return;
  const node = state.vimEl._vimNode;
  if (node) toggle(node, state.vimEl);
}

// Creation and editing
export function createNodeDialog(isFolder) {
  const context = getInsertionContext();
  const fields = isFolder
    ? [{ label: 'Name', placeholder: 'New folder' }]
    : [
      { label: 'Name', placeholder: 'Example' },
      { label: 'URL', placeholder: 'example.com' },
    ];
  showModal({
    title: isFolder ? 'New folder' : 'New bookmark',
    fields,
    submitLabel: 'Create',
    onSubmit: (values) => {
      const title = values[0].trim();
      const props = { parentId: context.parentId };
      if (isFolder) {
        if (!title) return false;
        props.title = title;
      } else {
        const url = normalizeUrl(values[1]);
        if (!url) return false;
        props.title = title || url;
        props.url = url;
      }
      createBookmarkAt(props, context.afterId);
      return true;
    },
  });
}

export function editNodeDialog() {
  if (!state.vimEl || !state.vimEl._vimNode) return;
  const node = state.vimEl._vimNode;
  if (!isRealBookmarkId(node.id)) return; // virtual nodes are not editable
  const isFolder = state.vimEl.classList.contains('folder');
  const fields = isFolder
    ? [{ label: 'Name', placeholder: 'Folder name', value: node.title }]
    : [
      { label: 'Name', placeholder: 'Bookmark name', value: node.title },
      { label: 'URL', placeholder: 'example.com', value: node.url },
    ];
  showModal({
    title: isFolder ? 'Edit folder' : 'Edit bookmark',
    fields,
    submitLabel: 'Save',
    onSubmit: (values) => {
      const props = {};
      if (isFolder) {
        const title = values[0].trim();
        if (!title) return false;
        props.title = title;
      } else {
        const url = normalizeUrl(values[1]);
        if (!url) return false;
        props.title = values[0].trim() || url;
        props.url = url;
      }
      updateBookmark(node.id, props);
      return true;
    },
  });
}

// Deletion
export function vimDelete() {
  if (!state.vimEl || !state.vimEl._vimNode) return;
  const ids = vimGetTargetIds(); // already filtered to real bookmarks
  if (ids.length === 0) return;
  const message = state.vimSelected.size === 0
    ? 'Delete "' + (state.vimEl._vimNode.title || state.vimEl._vimNode.url || 'this item') + '"?'
    : 'Delete ' + ids.length + ' selected item(s)?';
  showModal({
    title: message,
    fields: [],
    submitLabel: 'Delete',
    onSubmit: () => { deleteBookmarksByIds(ids); return true; },
  });
}

// Theme picker
export function vimShowThemePicker() {
  const items = [];
  const current = get('theme');
  const names = Object.keys(window.themes || {});
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    items.push({
      label: (name === current ? '\u25cf ' : '  ') + name,
      selected: name === current,
      action: () => { set('theme', name); },
    });
  }
  let x = 100, y = 100;
  if (state.vimEl) {
    const rect = state.vimEl.getBoundingClientRect();
    x = rect.left + window.scrollX;
    y = rect.bottom + window.scrollY;
  }
  renderMenu(items, x, y, 'Theme picker');
}

// ----- CURSOR -----
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

// ----- OBSERVER -----
let vimRafPending = false;
const vimObserver = new MutationObserver(() => {
  if (vimRafPending) return;
  vimRafPending = true;
  requestAnimationFrame(() => {
    vimRafPending = false;
    resolveCursor();
  });
});

export function vimInit() {
  const main = document.getElementById('main');
  if (main) {
    vimObserver.observe(main, { childList: true, subtree: true });
  }
  resolveCursor();
}

export { vimObserver };

// Auto-initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', vimInit);
} else {
  vimInit();
}

// ----- SELECTION -----
// Re-export clipTargetableId from bookmarks/crud.js
export { clipTargetableId };

export function vimGetTargetIds() {
  const ids = state.vimSelected.size > 0
    ? Array.from(state.vimSelected)
    : state.vimEl && state.vimEl._vimNode
      ? [state.vimEl._vimNode.id]
      : [];
  return ids.filter(clipTargetableId);
}

export function vimToggleSelect() {
  if (!state.vimEl || !state.vimEl._vimNode) return;
  if (!clipTargetableId(state.vimEl._vimNode.id)) return;
  const id = state.vimEl._vimNode.id;
  if (state.vimSelected.has(id)) mutations.removeVimSelected(id);
  else mutations.addVimSelected(id);
  updateCursorVisuals();
}

export function vimClearSelection() {
  if (state.vimSelected.size === 0) return;
  mutations.clearVimSelected();
  updateCursorVisuals();
}

export function vimYank() {
  const ids = vimGetTargetIds();
  if (ids.length === 0) return; // keep any pending clipboard untouched
  mutations.setClipboard(ids, 'copy');
  vimClearSelection();
  updateCursorVisuals();
}

// Cut marks the items; nothing moves until they are pasted somewhere
export function vimCut() {
  const ids = vimGetTargetIds();
  if (ids.length === 0) return;
  mutations.setClipboard(ids, 'cut');
  vimClearSelection();
  updateCursorVisuals();
}

export function vimCancelClipboard() {
  if (state.clipboard.mode == null && state.clipboard.ids.length === 0) return;
  mutations.clearClipboard();
  updateCursorVisuals();
}

// Paste relative to the item under the cursor, inside whatever folder it lives in
export function vimPaste(below) {
  if (state.clipboard.mode == null || state.clipboard.ids.length === 0) return;
  pasteBatch(state.clipboard.mode, state.clipboard.ids.slice(0), below);
}

// Resolves the paste destination from the cursor position
async function getPasteDestination(below) {
  if (!(state.vimEl && state.vimEl._vimNode))
    return { parentId: getDefaultParentId() };
  const node = state.vimEl._vimNode;
  if (node.id === 'empty')
    return { parentId: findParentFolderId(state.vimEl.parentNode) || getDefaultParentId() };
  if (!clipTargetableId(node.id))
    return { parentId: getDefaultParentId() };
  const results = await bmGet(node.id);
  if (!results || !results[0])
    return { parentId: getDefaultParentId() };
  return { anchorId: node.id, below: !!below };
}

async function pasteBatch(mode, ids, below) {
  try {
    const dest = await getPasteDestination(below);

    let parentId = null; // resolved destination folder (set once known)
    let base = null; // copy mode: static insertion index, null = append

    if (!dest.anchorId) {
      parentId = dest.parentId;
    } else if (mode !== 'cut') {
      // Copy mode inserts fresh clones at static positions relative to the anchor
      const anc0 = await bmGet(dest.anchorId);
      if (!anc0 || !anc0[0]) return;
      parentId = anc0[0].parentId;
      base = anc0[0].index + (below ? 1 : 0);
    }

    const par = parentId ? await bmGet(parentId) : null;
    let len = par && par[0] && par[0].children ? par[0].children.length : 0;

    const done = [];
    for (let i = 0; i < ids.length; i++) {
      if (mode === 'cut') {
        const src = await bmGet(ids[i]);
        if (!src || !src[0]) continue;
        let props;
        if (dest.anchorId) {
          // Inserting directly above the live anchor stacks items in order;
          // below the anchor needs the running offset to clear earlier moves
          const anc = await bmGet(dest.anchorId);
          if (!anc || !anc[0]) break;
          props = {
            parentId: anc[0].parentId,
            index: below ? anc[0].index + 1 + i : anc[0].index,
          };
        } else {
          props = { parentId: parentId, index: null };
        }
        if (!parentId) parentId = props.parentId;
        const moved = await bmMove(ids[i], props);
        if (!moved) continue;
        done.push(moved.id);
      } else {
        if (!clipTargetableId(ids[i])) continue;
        const created = await copyBookmarkSubtree(
          ids[i],
          parentId,
          base == null ? null : Math.max(0, Math.min(base + i, len)),
        );
        if (!created) continue;
        len++;
        done.push(created.id);
      }
    }

    mutations.clearClipboard();
    if (done.length > 0) syncLayoutAfterPaste(done, parentId, below);
    else updateCursorVisuals();
  } catch (e) {
    console.error("Error: ", e);
  }
}
