import { state, mutations } from '../core/state.js';
import { get } from '../config/storage.js';
import { bmGet, bmCreate, bmMove, bmGetSubTree } from '../core/chrome-api.js';
import { isRealBookmarkId, normalizeUrl, getDefaultParentId, findParentFolderId, getInsertionContext, copyBookmarkSubtree, clipTargetableId } from '../bookmarks/crud.js';
import { removeFromLayout, saveColumns, placeInLayout, syncLayoutAfterPaste, isShowRootEnabled } from '../bookmarks/layout.js';
import { scheduleRestore } from '../bookmarks/layout.js';
import { updateCursorVisuals } from './cursor.js';

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
