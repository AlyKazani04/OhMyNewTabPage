// ----- SPECIAL_NODES -----
import { get, DEFAULTS } from './config/config.js';
import * as chromeApi from './chrome-api.js';
import { state, mutations } from './state.js';
import { emit, Events, on } from './events.js';


// Virtual (non-bookmark) top-level entries
export const SPECIAL = {
  apps: {
    label: 'Apps',
    url: 'chrome://apps',
    children: null,
  },
  top: {
    label: 'Most visited',
    children: (callback) => {
      chromeApi.getTopSites().then(
        (result) => callback(result.slice(0, get('number_top'))),
        () => callback([])
      );
    },
  },
  recent: {
    label: 'Recent bookmarks',
    children: (callback) => {
      chromeApi.bmGetRecent(get('number_recent')).then(
        (result) => callback(result),
        () => callback([])
      );
    },
  },
  closed: {
    label: 'Recently closed',
    children: (callback) => {
      getClosed(callback);
    },
  },
  devices: {
    label: 'Other devices',
    children: (callback) => {
      getDevices(callback);
    },
  },
};

export const specialKeys = Object.keys(SPECIAL);

// Get special node by id
export function getSpecialNode(id) {
  return SPECIAL[id];
}

// Check if id is a special node
export function isSpecial(id) {
  return id in SPECIAL;
}

// Get recently closed tabs
function getClosed(callback) {
  const maxResults = get('number_closed');
  chromeApi.getRecentlyClosed(maxResults).then(
    (sessions) => {
      const nodes = [];
      for (let i = 0; i < sessions.length && i < maxResults; i++) {
        const session = sessions[i];
        if (session.window && session.window.tabs.length === 1) {
          session.tab = session.window.tabs[0];
        }
        nodes.push({
          title: session.tab
            ? session.tab.title
            : session.window.tabs.length + ' Tabs',
          url: session.tab ? session.tab.url : null,
          className: session.window ? 'window' : null,
          action: () => {
            chromeApi.restoreSession(
              session.window ? session.window.sessionId : session.tab.sessionId
            ).then(refreshClosed);
            return false;
          },
        });
      }
      callback(nodes);
    },
    () => callback([])
  );
}

// Get other devices
function getDevices(callback) {
  chromeApi.getDevices().then(
    (devices) => {
      const nodes = [];
      for (let i = 0; i < devices.length; i++) {
        const device = devices[i];
        const children = [];
        for (let j = 0; j < device.sessions.length; j++) {
          const session = device.sessions[j];
          const tabs = session.window ? session.window.tabs : [session.tab];
          for (let k = 0; k < tabs.length; k++) {
            children.push({
              title: tabs[k].title,
              url: tabs[k].url,
            });
          }
        }
        nodes.push({
          id: 'device.' + device.deviceName,
          title: device.deviceName,
          children,
        });
      }
      callback(nodes);
    },
    () => callback([])
  );
}

// Refresh recently closed tab lists
export function refreshClosed() {
  const targets = [];
  const folders = document.getElementsByClassName('closed');
  for (let i = 0; i < folders.length; i++) {
    const a = folders[i];
    if (a.nextSibling) {
      a.parentNode.removeChild(a.nextSibling);
      targets.push(a.parentNode);
    }
  }
  if (folders.length === 0 && state.coords && state.coords['closed']) {
    const target = document.getElementsByClassName('column')[state.coords['closed'].x];
    target.removeChild(target.firstChild);
    targets.push(target);
  }

  if (!getChildrenFunction || !renderAll) return;
  getChildrenFunction({ id: 'closed' })((result) => {
    for (let i = 0; i < targets.length; i++) renderAll(result, targets[i]);
  });
}

let renderAll = null;
export function setRenderAll(fn) {
  renderAll = fn;
}

// ----- LAYOUT -----
// Initialize SPECIAL in state
mutations.setSpecial(SPECIAL);

// True unless the node was explicitly hidden (show_<id> stored as 0 or false).
// For dynamic bookmark node ids (e.g. "2" for Other Bookmarks) that aren't in
// DEFAULTS yet, read localStorage directly to respect any stored user preference
// while avoiding the validate() throw on unknown keys.
function isNodeShown(id) {
  const key = 'show_' + id;
  if (key in DEFAULTS) {
    const value = get(key);
    return !(value === 0 || value === false);
  }
  const raw = localStorage.getItem('options.' + key);
  if (raw != null) return !(raw === '0' || raw === 'false');
  return true;
}

// Ensure root folders are included
export function verifyColumns() {
  // Default layout
  if (state.columns.length === 0) {
    state.columns.push([]);
    state.columns.push(
      specialKeys.filter(a => isNodeShown(a))
    );
  }

  // Find missing root items
  const missing = state.root.slice(0);
  for (let x = 0; x < state.columns.length; x++) {
    for (let y = 0; y < state.columns[x].length; y++) {
      const i = missing.indexOf(state.columns[x][y]);
      if (i > -1) missing.splice(i, 1);
    }
  }

  // Add missing root items
  const column = state.columns[0];
  for (let i = 0; i < missing.length; i++) {
    if (isNodeShown(missing[i])) column.push(missing[i]);
  }

  // Populate coordinate map
  state.coords = {};
  for (let x = 0; x < state.columns.length; x++) {
    for (let y = 0; y < state.columns[x].length; y++) {
      state.coords[state.columns[x][y]] = { x, y };
    }
    if (state.columns[x].length === 0) {
      state.columns.splice(x, 1);
      x--;
    }
  }
}

// Load columns from storage or default
export function loadColumns() {
  state.columns = [];
  for (let x = 0; ; x++) {
    const row = [];
    for (let y = 0; ; y++) {
      const id = localStorage.getItem('column.' + x + '.' + y);
      if (id) row.push(id);
      else break;
    }
    if (row.length > 0) state.columns.push(row);
    else break;
  }

  if (state.root.length > 0) {
    verifyColumns();
    emit(Events.RENDER_REQUESTED);
  } else {
    chromeApi.bmGetSubTree('0').then((result) => {
      if (!result || !result[0]) return;
      const nodes = result[0].children;
      mutations.setRoot(specialKeys.slice(0));
      for (let i = 0; i < nodes.length; i++) state.root.push(nodes[i].id);
      verifyColumns();
      emit(Events.RENDER_REQUESTED);
    });
  }
}

// Saves current column configuration to storage
export function saveColumns() {
  // Clear previous config
  for (let x = 0; ; x++) {
    let hadAny = false;
    for (let y = 0; ; y++) {
      const id = localStorage.getItem('column.' + x + '.' + y);
      if (!id) break;
      if (id) localStorage.removeItem('column.' + x + '.' + y);
      hadAny = true;
    }
    if (!hadAny) break;
  }
  verifyColumns();
  // Save new config
  for (let x = 0; x < state.columns.length; x++) {
    for (let y = 0; y < state.columns[x].length; y++) {
      localStorage.setItem('column.' + x + '.' + y, state.columns[x][y]);
    }
  }
  // Refresh
  loadColumns();
}

// Creates and saves a new column
export function addColumn(ids, index) {
  const column = ids.slice(0);
  // Remove previous locations
  for (let x = 0; x < state.columns.length; x++) {
    for (let y = 0; y < state.columns[x].length; y++) {
      if (ids.indexOf(state.columns[x][y]) > -1) {
        state.columns[x].splice(y, 1);
        y--;
      }
    }
  }
  // Insert new id
  if (index === null) index = state.columns.length;
  state.columns.splice(Math.min(index, state.columns.length), 0, column);
  saveColumns();
}

// Removes given column
export function removeColumn(index) {
  state.columns.splice(index, 1);
  saveColumns();
}

// Creates and saves a new row
export function addRow(id, xpos, ypos) {
  if (ypos === null) ypos = state.columns[xpos].length;

  // Remove previous locations
  for (let x = 0; x < state.columns.length; x++) {
    const i = state.columns[x].indexOf(id);
    if (i > -1) {
      state.columns[x].splice(i, 1);
      if (x === xpos && ypos > i) ypos--;
    }
    if (state.columns[x].length === 0) {
      state.columns.splice(x, 1);
      x--;
      if (xpos > x) xpos--;
    }
  }
  // Insert new id
  state.columns[xpos].splice(Math.min(ypos, state.columns[xpos].length), 0, id);
  saveColumns();
}

// Removes given row
export function removeRow(xpos, ypos) {
  state.columns[xpos].splice(ypos, 1);
  saveColumns();
}

// Removes ids from the column layout
export function removeFromLayout(ids) {
  for (let x = state.columns.length - 1; x >= 0; x--) {
    const col = state.columns[x];
    for (let y = col.length - 1; y >= 0; y--) {
      if (ids.indexOf(col[y]) > -1) col.splice(y, 1);
    }
    if (col.length === 0) state.columns.splice(x, 1);
  }
}

// Moves ids into column x at row y and saves (single re-render)
export function placeInLayout(ids, x, y) {
  for (let i = state.columns.length - 1; i >= 0; i--) {
    const col = state.columns[i];
    for (let j = col.length - 1; j >= 0; j--) {
      if (ids.indexOf(col[j]) > -1) col.splice(j, 1);
    }
    if (col.length === 0) {
      state.columns.splice(i, 1);
      if (i < x) x--;
    }
  }
  while (state.columns.length <= x) state.columns.push([]);
  if (y == null || y > state.columns[x].length) y = state.columns[x].length;
  if (y < 0) y = 0;
  Array.prototype.splice.apply(state.columns[x], [y, 0].concat(ids));
  saveColumns();
}

// Check if show_root config is enabled (for flattened column detection)
export function isShowRootEnabled() {
  return get('show_root');
}

// True when the id is a stored grid entry
export function inColumns(id) {
  for (let x = 0; x < state.columns.length; x++) {
    if (state.columns[x].indexOf(id) > -1) return true;
  }
  return false;
}

// Sync layout after paste
export function syncLayoutAfterPaste(ids, parentId, below) {
  // Flattened column: a lone root folder rendered as its own contents
  let flatX = -1;
  if (!isShowRootEnabled()) {
    for (let x = 0; x < state.columns.length; x++) {
      if (state.columns[x].length === 1 && state.columns[x][0] === parentId) {
        flatX = x;
        break;
      }
    }
  }
  if (flatX > -1) {
    scheduleRestoreFn(ids[0]);
    saveColumns(); // triggers the re-render
  } else if (state.vimEl && state.vimEl._vimNode && state.coords && state.coords[state.vimEl._vimNode.id]) {
    // Top level (stored in the layout grid): land the cursor on the first pasted item once rendered
    scheduleRestoreFn(ids[0]);
    const pos = state.coords[state.vimEl._vimNode.id];
    placeInLayout(ids, pos.x, below ? pos.y + 1 : pos.y);
  } else {
    // Nested destination: items leave the page grid; the cursor simply stays where it is
    removeFromLayout(ids);
    saveColumns(); // triggers the re-render
  }
}

export let scheduleRestore = null;
export let renderColumns = null;

export function setScheduleRestore(fn) { scheduleRestore = fn; }
export function setRenderColumns(fn) { renderColumns = fn; }

// Reload and re-render the layout when a layout-affecting config key changes
// (lock, newtab, show_root, number_* — see config/storage.js).
on(Events.COLUMNS_CHANGED, loadColumns);

// Show/hide a special node or top-level bookmark folder from the grid.
// Mirrors the legacy setConfig "show_*" handling: hiding removes the row,
// showing lets verifyColumns restore it (respecting its show_<id> config).
on('bookmarks:visibility', ({ id, visible }) => {
  const pos = state.coords[id];
  if (!visible) {
    if (pos) removeRow(pos.x, pos.y);
  } else if (!inColumns(id)) {
    saveColumns();
  }
});

// ----- TREE -----
// Gets function that returns children of node
export function getChildrenFunction(node) {
  if (isSpecial(node.id)) {
    const specialNode = getSpecialNode(node.id);
    const load = specialNode.children;
    return load || ((callback) => callback([]));
  }
  if (node.children) {
    return (callback) => callback(node.children);
  }
  return (callback) => {
    chromeApi.bmGetSubTree(node.id).then(
      (result) => {
        if (result) callback(result[0].children);
        else {
          // remove missing bookmark locations
          if (state.coords[node.id]) removeRow(state.coords[node.id].x, state.coords[node.id].y);
          callback([]);
        }
      },
      () => {
        if (state.coords[node.id]) removeRow(state.coords[node.id].x, state.coords[node.id].y);
        callback([]);
      }
    );
  };
}

// Gets the subtree for given id
export function getSubTree(id, callback) {
  if (isSpecial(id)) {
    const s = getSpecialNode(id);
    const node = { title: s.label, id };
    if (s.url) node.url = s.url;
    else node.children = true;
    callback([node]);
    return;
  }
  chromeApi.bmGetSubTree(id).then(
    (result) => {
      if (result) callback(result);
      else {
        // remove missing bookmark locations
        if (state.coords[id]) removeRow(state.coords[id].x, state.coords[id].y);
      }
    },
    () => {
      if (state.coords[id]) removeRow(state.coords[id].x, state.coords[id].y);
    }
  );
}

// ----- CRUD -----
let renderColumnsFn = null;
let scheduleRestoreFn = null;

export function setRenderColumnsForCrud(fn) { renderColumnsFn = fn; }
export function setScheduleRestoreForCrud(fn) { scheduleRestoreFn = fn; }

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
    } else if (scheduleRestoreFn) {
      scheduleRestoreFn(result.id);
    }
    if (renderColumnsFn) renderColumnsFn();
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
  } else if (scheduleRestoreFn) {
    scheduleRestoreFn(id);
  }
  if (renderColumnsFn) renderColumnsFn();
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
  } else if (renderColumnsFn) {
    renderColumnsFn();
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
