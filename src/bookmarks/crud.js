import * as chromeApi from '../core/chrome-api.js';
import { state, mutations } from '../core/state.js';
import { get } from '../config/storage.js';
import { SPECIAL, isSpecial } from './special-nodes.js';
import { removeFromLayout, saveColumns, renderColumns, scheduleRestore } from './layout.js';

// Check if ID is a real bookmark (numeric)
export function isRealBookmarkId(id) {
  return /^\d+$/.test(String(id));
}

// Normalize URL
export function normalizeUrl(url) {
  url = url.trim();
  if (url && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) url = 'https://' + url;
  return url;
}

// Get default parent folder ID
export function getDefaultParentId() {
  if (state.root) {
    for (let i = 0; i < state.root.length; i++) {
      if (!isSpecial(state.root[i]) && /^\d+$/.test(state.root[i])) return state.root[i];
    }
  }
  return '1';
}

// Resolves the real bookmark folder containing the given list item
export function findParentFolderId(li) {
  const ul = li.parentNode;
  if (!ul || ul.tagName !== 'UL') return null;
  const div = ul.parentNode;
  if (!div || div.tagName !== 'DIV') return null;
  const prevA = div.previousElementSibling;
  if (prevA && prevA.tagName === 'A' && prevA._vimNode &&
    prevA._vimNode.children && !isSpecial(prevA._vimNode.id)) {
    return prevA._vimNode.id;
  }
  return null;
}

// Where a newly created item should go: parent folder + optional anchor node
export function getInsertionContext() {
  const context = { parentId: getDefaultParentId(), afterId: null };
  if (!(state.vimEl && state.vimEl._vimNode)) return context;
  const parentId = findParentFolderId(state.vimEl.parentNode);
  if (parentId) context.parentId = parentId;
  if (state.vimEl._vimNode.id !== 'empty') context.afterId = state.vimEl._vimNode.id;
  return context;
}

// Creates the bookmark, inserting it after afterId when given
export async function createBookmarkAt(props, afterId) {
  const finish = async (index) => {
    if (index != null) props.index = index;
    const result = await chromeApi.bmCreate(props);
    if (!result) {
      console.warn('create failed');
    } else {
      scheduleRestore(result.id);
    }
    renderColumns();
  };
  if (!afterId) return finish(null);
  const results = await chromeApi.bmGet(afterId);
  const index = results &&
    results[0] &&
    results[0].parentId === props.parentId &&
    results[0].index != null
    ? results[0].index + 1
    : null;
  return finish(index);
}

// Update bookmark
export async function updateBookmark(id, props) {
  await chromeApi.bmUpdate(id, props);
  if (chrome.runtime.lastError) {
    console.warn('edit failed:', chrome.runtime.lastError.message);
  } else {
    scheduleRestore(id);
  }
  renderColumns();
}

// Delete bookmarks by IDs
export async function deleteBookmarksByIds(ids) {
  for (let i = 0; i < ids.length; i++) {
    const results = await chromeApi.bmGet(ids[i]);
    if (!results || !results[0]) continue;
    if (results[0].url) {
      await chromeApi.bmRemove(ids[i]);
    } else {
      await chromeApi.bmRemoveTree(ids[i]);
    }
    if (chrome.runtime.lastError) {
      console.warn('delete failed:', chrome.runtime.lastError.message);
    }
  }
  // Prune layout entries for deleted top-level items
  const topLevel = ids.filter(id => state.coords[id]);
  if (topLevel.length > 0) {
    removeFromLayout(topLevel);
    saveColumns();
  } else {
    renderColumns();
  }
}

// Move bookmark
export async function moveBookmark(id, dest) {
  return chromeApi.bmMove(id, dest);
}

// Deep-copies a bookmark subtree
export async function copyBookmarkSubtree(sourceId, destParentId, index) {
  async function cloneNode(node, parentId, position) {
    const props = { parentId, title: node.title };
    if (node.url) props.url = node.url;
    if (position != null) props.index = position;
    const created = await chromeApi.bmCreate(props);
    if (!created || !node.children) return created;
    for (const child of node.children) {
      await cloneNode(child, created.id);
    }
    return created;
  }
  const results = await chromeApi.bmGetSubTree(sourceId);
  if (!results || !results[0]) return null;
  return cloneNode(results[0], destParentId, index);
}

// Mouse support: drop a bookmark onto a folder header to move it there
export async function folderMoveDrop(dragIds, folderNodeId) {
  if (!folderNodeId || !isRealBookmarkId(folderNodeId)) return;
  const ids = (dragIds || []).filter(id => clipTargetableId(id) && id !== folderNodeId);
  if (ids.length === 0) return;
  const movedIds = [];
  for (const id of ids) {
    const moved = await chromeApi.bmMove(id, { parentId: folderNodeId });
    if (moved) movedIds.push(id);
  }
  if (movedIds.length > 0) {
    removeFromLayout(movedIds);
    saveColumns();
  }
}

// Only real bookmark folders/items may be clipped
export function clipTargetableId(id) {
  return isRealBookmarkId(id) && Array.isArray(state.root) && state.root.indexOf(id) < 0;
}