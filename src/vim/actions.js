import { state, mutations } from '../core/state.js';
import { get, set } from '../config/storage.js';
import { bmGet, bmCreate, bmUpdate, bmRemove, bmRemoveTree } from '../core/chrome-api.js';
import { isRealBookmarkId, normalizeUrl, getDefaultParentId, findParentFolderId, getInsertionContext, createBookmarkAt, updateBookmark, deleteBookmarksByIds, clipTargetableId } from '../bookmarks/crud.js';
import { vimGetTargetIds } from './selection.js';
import { scheduleRestore } from '../bookmarks/layout.js';
import { toggle } from '../render/folder.js';
import { showModal } from '../interaction/modal.js';
import { renderMenu } from '../interaction/context-menu.js';
import { renderColumns } from '../render/renderer.js';
import { updateCursorVisuals } from './cursor.js';

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