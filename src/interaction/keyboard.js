import { state, mutations } from '../core/state.js';
import { get } from '../config/storage.js';
import { emit, Events } from '../core/events.js';
import { renderColumns } from '../render/renderer.js';
import { toggle } from '../render/folder.js';
import { showModal } from './modal.js';
import { bmGet, bmCreate, bmUpdate, bmMove, bmRemove, bmRemoveTree, bmGetSubTree } from '../core/chrome-api.js';
import { isRealBookmarkId, normalizeUrl, getDefaultParentId, findParentFolderId, getInsertionContext, createBookmarkAt, updateBookmark, deleteBookmarksByIds, clipTargetableId, folderMoveDrop, copyBookmarkSubtree } from '../bookmarks/crud.js';
import { removeFromLayout, saveColumns, placeInLayout, syncLayoutAfterPaste, isShowRootEnabled } from '../bookmarks/layout.js';
import { SPECIAL, isSpecial, getSpecialNode, refreshClosed } from '../bookmarks/special-nodes.js';
import { getChildrenFunction } from '../bookmarks/tree.js';

// For now, inline the vim actions that keyboard.js needs
// These will be replaced when vim/actions.js is created in Phase 6

function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }

function getVisibleLinks(x) {
  const column = document.getElementsByClassName('column')[x];
  if (!column) return [];
  const first = column.firstChild;
  if (!first) return [];
  let container;
  if (first.tagName === 'UL') container = first;
  else if (first.tagName === 'DIV' && first.firstChild) container = first.firstChild;
  else return [];
  const links = [];
  collectLinks(container, links);
  return links;
}

function collectLinks(container, links) {
  for (let i = 0; i < container.children.length; i++) {
    const li = container.children[i];
    if (li.tagName !== 'LI') continue;
    const a = li.firstChild;
    if (a && a.tagName === 'A') links.push(a);
    const next = a ? a.nextSibling : null;
    if (next && next.tagName === 'DIV' && next.firstChild) collectLinks(next.firstChild, links);
  }
}

function updateCursorVisuals() {
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
    if (id && state.vimSelected.has(id)) link.classList.add('vim-selected');
    else link.classList.remove('vim-selected');
    if (cutting && id && state.clipboard.ids.indexOf(id) > -1) link.classList.add('vim-cut');
    else link.classList.remove('vim-cut');
  }
}

function resolveCursor() {
  if (!state.columns || state.columns.length === 0) return;
  mutations.setVimCursor(clamp(state.vimCursor.x, 0, state.columns.length - 1), state.vimCursor.y);
  if (state.vimPendingRestore != null) restoreCursor(state.vimPendingRestore);
  const links = getVisibleLinks(state.vimCursor.x);
  mutations.setVimCursor(state.vimCursor.x, clamp(state.vimCursor.y, 0, Math.max(0, links.length - 1)));
  updateCursorVisuals();
}

function scheduleRestore(id) {
  mutations.setVimPendingRestore(id);
  setTimeout(() => { if (state.vimPendingRestore === id) mutations.clearVimPendingRestore(); }, 2000);
}

function restoreCursor(id) {
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

function moveCursor(dx, dy) {
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

// Vim action functions (inlined for now, will move to vim/actions.js in Phase 6)
function vimActivate() {
  if (!state.vimEl) return;
  const isFolder = state.vimEl.classList.contains('folder');
  if (isFolder) {
    const node = state.vimEl._vimNode;
    if (node) toggle(node, state.vimEl);
  } else {
    state.vimEl.dispatchEvent(new MouseEvent('click'));
  }
}

function vimOpenFolder() {
  if (!state.vimEl || !state.vimEl.classList.contains('folder')) return;
  const node = state.vimEl._vimNode;
  if (node) toggle(node, state.vimEl);
}

function createNodeDialog(isFolder) {
  const context = getInsertionContext();
  const fields = isFolder
    ? [{ label: 'Name', placeholder: 'New folder' }]
    : [{ label: 'Name', placeholder: 'Example' }, { label: 'URL', placeholder: 'example.com' }];
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

function editNodeDialog() {
  if (!state.vimEl || !state.vimEl._vimNode) return;
  const node = state.vimEl._vimNode;
  if (!isRealBookmarkId(node.id)) return;
  const isFolder = state.vimEl.classList.contains('folder');
  const fields = isFolder
    ? [{ label: 'Name', placeholder: 'Folder name', value: node.title }]
    : [{ label: 'Name', placeholder: 'Bookmark name', value: node.title }, { label: 'URL', placeholder: 'example.com', value: node.url }];
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

function vimDelete() {
  if (!state.vimEl || !state.vimEl._vimNode) return;
  const ids = vimGetTargetIds();
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

function vimGetTargetIds() {
  const ids = state.vimSelected.size > 0
    ? Array.from(state.vimSelected)
    : state.vimEl && state.vimEl._vimNode ? [state.vimEl._vimNode.id] : [];
  return ids.filter(clipTargetableId);
}

function vimToggleSelect() {
  if (!state.vimEl || !state.vimEl._vimNode) return;
  if (!clipTargetableId(state.vimEl._vimNode.id)) return;
  const id = state.vimEl._vimNode.id;
  if (state.vimSelected.has(id)) mutations.removeVimSelected(id);
  else mutations.addVimSelected(id);
  updateCursorVisuals();
}

function vimClearSelection() {
  if (state.vimSelected.size === 0) return;
  mutations.clearVimSelected();
  updateCursorVisuals();
}

function vimYank() {
  const ids = vimGetTargetIds();
  if (ids.length === 0) return;
  mutations.setClipboard(ids, 'copy');
  vimClearSelection();
  updateCursorVisuals();
}

function vimCut() {
  const ids = vimGetTargetIds();
  if (ids.length === 0) return;
  mutations.setClipboard(ids, 'cut');
  vimClearSelection();
  updateCursorVisuals();
}

function vimCancelClipboard() {
  if (state.clipboard.mode == null && state.clipboard.ids.length === 0) return;
  mutations.clearClipboard();
  updateCursorVisuals();
}

async function vimPaste(below) {
  if (state.clipboard.mode == null || state.clipboard.ids.length === 0) return;
  await pasteBatch(state.clipboard.mode, state.clipboard.ids.slice(0), below);
}

async function pasteBatch(mode, ids, below) {
  const dest = await getPasteDestination(below);
  let parentId = null;
  let base = null;

  if (!dest.anchorId) {
    parentId = dest.parentId;
  } else if (mode !== 'cut') {
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
        const anc = await bmGet(dest.anchorId);
        if (!anc || !anc[0]) break;
        props = { parentId: anc[0].parentId, index: below ? anc[0].index + 1 + i : anc[0].index };
      } else {
        props = { parentId, index: null };
      }
      if (!parentId) parentId = props.parentId;
      const moved = await bmMove(ids[i], props);
      if (!moved) continue;
      done.push(moved.id);
    } else {
      if (!clipTargetableId(ids[i])) continue;
      const created = await copyBookmarkSubtree(ids[i], parentId, base == null ? null : Math.max(0, Math.min(base + i, len)));
      if (!created) continue;
      len++;
      done.push(created.id);
    }
  }

  mutations.clearClipboard();
  if (done.length > 0) syncLayoutAfterPaste(done, parentId, below);
  else updateCursorVisuals();
}

async function getPasteDestination(below) {
  if (!(state.vimEl && state.vimEl._vimNode)) return { parentId: getDefaultParentId() };
  const node = state.vimEl._vimNode;
  if (node.id === 'empty') return { parentId: findParentFolderId(state.vimEl.parentNode) || getDefaultParentId() };
  if (!clipTargetableId(node.id)) return { parentId: getDefaultParentId() };
  const results = await bmGet(node.id);
  if (!results || !results[0]) return { parentId: getDefaultParentId() };
  return { anchorId: node.id, below: !!below };
}

function vimShowThemePicker() {
  const items = [];
  const current = get('theme');
  const names = Object.keys(window.themes || {});
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    items.push({
      label: (name === current ? '● ' : '  ') + name,
      selected: name === current,
      action: () => { setConfig('theme', name); },
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

// Keyboard handler
export function initKeyboard() {
  document.addEventListener('keydown', (event) => {
    if (document.getElementById('options').style.display === 'block') {
      if (event.key === 'Escape') { showOptions(false); event.preventDefault(); }
      return;
    }
    const tag = event.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (document.querySelector('.menu') || document.querySelector('.vim-modal-backdrop')) return;
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    let handled = true;
    switch (event.key) {
      case 'ArrowLeft': case 'h': moveCursor(-1, 0); break;
      case 'ArrowRight': case 'l': moveCursor(1, 0); break;
      case 'ArrowDown': case 'j': moveCursor(0, 1); break;
      case 'ArrowUp': case 'k': moveCursor(0, -1); break;
      case 'Enter': case 'o': vimActivate(); break;
      case 'O': vimOpenFolder(); break;
      case 'n': createNodeDialog(false); break;
      case 'N': createNodeDialog(true); break;
      case 'e': editNodeDialog(); break;
      case 'd': vimDelete(); break;
      case 'v': vimToggleSelect(); break;
      case 'V': vimClearSelection(); break;
      case 'y': vimYank(); break;
      case 'x': vimCut(); break;
      case 'p': vimPaste(true); break;
      case 'P': vimPaste(false); break;
      case 'T': vimShowThemePicker(); break;
      case '/': showOptions(true); break;
      case 'Escape': vimClearSelection(); vimCancelClipboard(); break;
      default: handled = false;
    }
    if (handled) event.preventDefault();
  });
}

let showOptions = null;
export function setShowOptions(fn) { showOptions = fn; }
