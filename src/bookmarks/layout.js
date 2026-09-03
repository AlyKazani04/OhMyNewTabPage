import { state, mutations } from '../core/state.js';
import { get } from '../config/storage.js';
import { SPECIAL, specialKeys, isSpecial } from './special-nodes.js';
import { getChildrenFunction } from './tree.js';
import * as chromeApi from '../core/chrome-api.js';
import { emit, Events } from '../core/events.js';

// Initialize SPECIAL in state
mutations.setSpecial(SPECIAL);

// Ensure root folders are included
export function verifyColumns() {
  // Default layout
  if (state.columns.length === 0) {
    state.columns.push([]);
    state.columns.push(
      specialKeys.filter(a => get('show_' + a) !== false)
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
    if (get('show_' + missing[i]) !== false) column.push(missing[i]);
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
    scheduleRestore(ids[0]);
    saveColumns(); // triggers the re-render
  } else if (state.vimEl && state.vimEl._vimNode && state.coords && state.coords[state.vimEl._vimNode.id]) {
    // Top level (stored in the layout grid): land the cursor on the first pasted item once rendered
    scheduleRestore(ids[0]);
    const pos = state.coords[state.vimEl._vimNode.id];
    placeInLayout(ids, pos.x, below ? pos.y + 1 : pos.y);
  } else {
    // Nested destination: items leave the page grid; the cursor simply stays where it is
    removeFromLayout(ids);
    saveColumns(); // triggers the re-render
  }
}

// These will be set by shim after all modules load
export let scheduleRestore = null;
export let renderColumns = null;

export function setScheduleRestore(fn) { scheduleRestore = fn; }
export function setRenderColumns(fn) { renderColumns = fn; }