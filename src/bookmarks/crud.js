import * as chromeApi from '../chrome-api.js';
import { isSpecial } from './special-nodes.js';
import { state } from '../state.js';
import { emit, Events } from '../events.js';
import { renderColumns } from '../render.js';
import { removeFromLayout, saveColumns } from './layout.js';

// ----- CRUD -----
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
    let result;
    try {
      result = await chromeApi.bmCreate(props);
    } catch (err) {
      // chrome-api.js rejects when chrome.runtime.lastError is set, so the
      // `!result` guard below is the second failure mode, not the first.
      console.warn('create failed:', err?.message || err);
      return;
    }
    if (!result) {
      console.warn('create failed');
      return;
    }
    emit(Events.BOOKMARK_CREATED, result.id);
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
  try {
    await chromeApi.bmUpdate(id, props);
  } catch (err) {
    // chrome-api.js rejects on lastError, so a post-await `lastError` check
    // here could never be true — it was dead code.
    console.warn('edit failed:', err?.message || err);
    return;
  }
  emit(Events.BOOKMARK_UPDATED, id);
  renderColumns();
}

// Delete bookmarks by IDs. One failure must not abort the rest of the batch.
export async function deleteBookmarksByIds(ids) {
  for (let i = 0; i < ids.length; i++) {
    let results;
    try {
      results = await chromeApi.bmGet(ids[i]);
    } catch (err) {
      console.warn('delete failed:', err?.message || err);
      continue;
    }
    if (!results || !results[0]) continue;
    try {
      if (results[0].url) await chromeApi.bmRemove(ids[i]);
      else await chromeApi.bmRemoveTree(ids[i]);
    } catch (err) {
      console.warn('delete failed:', err?.message || err);
    }
  }
  // Prune layout entries for deleted top-level items
  const topLevel = ids.filter(id => state.coords[id]);
  if (topLevel.length > 0) {
    removeFromLayout(topLevel);
    saveColumns();
  }
  renderColumns();
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

