var OMNTP = (() => {
  // src/core/state.js
  var state = {
    // Layout State
    columns: [],
    root: [],
    coords: {},
    special: {},
    // Vim State
    vimCursor: { x: 0, y: 0 },
    vimEl: null,
    vimSelected: /* @__PURE__ */ new Set(),
    clipboard: { ids: [], mode: null },
    vimPendingRestore: null
  };
  var getters = {
    getColumnCount: () => state.columns.length,
    getColumn: (x) => state.columns[x],
    getRootId: (x) => state.root[x],
    getCoords: (id) => state.coords[id],
    isSpecial: (id) => id in state.special,
    getSpecialNode: (id) => state.special[id],
    getVimCursor: () => ({ ...state.vimCursor }),
    getVimSelected: () => [...state.vimSelected],
    getClipboard: () => ({ ...state.clipboard })
  };
  var mutations = {
    setColumns: (cols) => {
      state.columns = cols;
    },
    setRoot: (r) => {
      state.root = r;
    },
    setCoords: (id, coord) => {
      state.coords[id] = coord;
    },
    deleteCoords: (id) => {
      delete state.coords[id];
    },
    setSpecial: (nodes) => {
      state.special = nodes;
    },
    setVimCursor: (x, y) => {
      state.vimCursor = { x, y };
    },
    setVimEl: (el) => {
      state.vimEl = el;
    },
    addVimSelected: (id) => {
      state.vimSelected.add(id);
    },
    removeVimSelected: (id) => {
      state.vimSelected.delete(id);
    },
    clearVimSelected: () => {
      state.vimSelected.clear();
    },
    setClipboard: (ids, mode) => {
      state.clipboard = { ids, mode };
    },
    clearClipboard: () => {
      state.clipboard = { ids: [], mode: null };
    },
    setVimPendingRestore: (id) => {
      state.vimPendingRestore = id;
    },
    clearVimPendingRestore: () => {
      state.vimPendingRestore = null;
    }
  };

  // src/core/events.js
  var handlers = /* @__PURE__ */ new Map();
  function emit(event, data) {
    const set = handlers.get(event);
    if (set) set.forEach((h) => h(data));
  }
  var Events = {
    // State Changes
    COLUMNS_CHANGED: "columns:changed",
    ROOT_CHANGED: "root:changed",
    COORDS_CHANGED: "coords:changed",
    SPECIAL_CHANGED: "special:changed",
    // Vim State
    CURSOR_MOVED: "vim:cursor:moved",
    SELECTION_CHANGED: "vim:selection:changed",
    CLIPBOARD_CHANGED: "vim:clipboard:changed",
    // Rendering
    RENDER_REQUESTED: "render:requested",
    RENDER_COMPLETE: "render:complete",
    // Bookmarks
    BOOKMARK_CREATED: "bookmark:created",
    BOOKMARK_UPDATED: "bookmark:updated",
    BOOKMARK_DELETED: "bookmark:deleted",
    BOOKMARK_MOVED: "bookmark:moved",
    // Config
    CONFIG_CHANGED: "config:changed",
    THEME_CHANGED: "theme:changed",
    // UI
    OPTIONS_TOGGLED: "options:toggled",
    MODAL_OPENED: "modal:opened",
    MODAL_CLOSED: "modal:closed"
  };

  // src/core/chrome-api.js
  function bmGet(id) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.get(id, (result) => {
        chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(result);
      });
    });
  }
  function bmGetSubTree(id) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.getSubTree(id, (result) => {
        chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(result);
      });
    });
  }
  function bmCreate(props) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.create(props, (result) => {
        chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(result);
      });
    });
  }
  function bmUpdate(id, props) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.update(id, props, (result) => {
        chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(result);
      });
    });
  }
  function bmMove(id, dest) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.move(id, dest, (result) => {
        chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(result);
      });
    });
  }
  function bmRemove(id) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.remove(id, () => {
        chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve();
      });
    });
  }
  function bmRemoveTree(id) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.removeTree(id, () => {
        chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve();
      });
    });
  }

  // src/shim.js
  window.state = state;
  window.getters = getters;
  window.mutations = mutations;
  window.columns = state.columns;
  window.root = state.root;
  window.coords = state.coords;
  window.special = state.special;
  window.vimCursor = state.vimCursor;
  window.vimEl = state.vimEl;
  window.vimSelected = state.vimSelected;
  window.clipboard = state.clipboard;
  window.vimPendingRestore = state.vimPendingRestore;
  window.bmGet = bmGet;
  window.bmGetSubTree = bmGetSubTree;
  window.bmCreate = bmCreate;
  window.bmUpdate = bmUpdate;
  window.bmMove = bmMove;
  window.bmRemove = bmRemove;
  window.bmRemoveTree = bmRemoveTree;
  window.saveColumns = () => emit(Events.COLUMNS_CHANGED, state.columns);
  window.renderColumns = () => emit(Events.RENDER_REQUESTED);
  window.toggle = (node, anchor) => emit("folder:toggle", { node, anchor });
  window.getConfig = (key) => emit("config:get", key);
  window.setConfig = (key, val) => emit(Events.CONFIG_CHANGED, { key, val });
  window.themes = {};
  window.showOptions = (show) => emit(Events.OPTIONS_TOGGLED, show);
  window.renderMenu = (items, x, y, label) => emit("menu:render", { items, x, y, label });
  window.getChildrenFunction = (node) => emit("bookmarks:getChildrenFunction", node);
  window.SPECIAL = state.special;
  window.clipTargetableId = (id) => getters.isSpecial(id) ? false : true;
  window.getCoords = (id) => getters.getCoords(id);
})();
