export const state = {
  // Layout State
  columns: [],
  root: [],
  coords: {},
  special: {},

  // Vim State
  vimCursor: { x: 0, y: 0 },
  vimEl: null,
  vimSelected: new Set(),
  clipboard: { ids: [], mode: null },
  vimPendingRestore: null,

};

// Derived/computed getters
export const getters = {
  getColumnCount: () => state.columns.length,
  getColumn: (x) => state.columns[x],
  getRootId: (x) => state.root[x],
  getCoords: (id) => state.coords[id],
  isSpecial: (id) => id in state.special,
  getSpecialNode: (id) => state.special[id],
  getVimCursor: () => ({ ...state.vimCursor }),
  getVimSelected: () => [...state.vimSelected],
  getClipboard: () => ({ ...state.clipboard }),
};

// Mutators (single write path)
export const mutations = {
  setColumns: (cols) => { state.columns = cols; },
  setRoot: (r) => { state.root = r; },
  setCoords: (id, coord) => { state.coords[id] = coord; },
  deleteCoords: (id) => { delete state.coords[id]; },
  setSpecial: (nodes) => { state.special = nodes; },
  setVimCursor: (x, y) => { state.vimCursor = { x, y }; },
  setVimEl: (el) => { state.vimEl = el; },
  addVimSelected: (id) => { state.vimSelected.add(id); },
  removeVimSelected: (id) => { state.vimSelected.delete(id); },
  clearVimSelected: () => { state.vimSelected.clear(); },
  setClipboard: (ids, mode) => { state.clipboard = { ids, mode }; },
  clearClipboard: () => { state.clipboard = { ids: [], mode: null }; },
  setVimPendingRestore: (id) => { state.vimPendingRestore = id; },
  clearVimPendingRestore: () => { state.vimPendingRestore = null; },
};
