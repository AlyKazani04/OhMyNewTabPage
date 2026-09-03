// Temporary: re-export core modules as globals for vim.js during migration
import * as core from './core/index.js';
import * as config from './config/index.js';
import * as chromeApi from './core/chrome-api.js';
import * as bookmarks from './bookmarks/index.js';
import { emit, Events } from './core/events.js';
import { state, mutations } from './core/state.js';

window.state = core.state;
window.getters = core.getters;
window.mutations = core.mutations;

window.columns = core.state.columns;
window.root = core.state.root;
window.coords = core.state.coords;
window.special = core.state.special;
window.vimCursor = core.state.vimCursor;
window.vimEl = core.state.vimEl;
window.vimSelected = core.state.vimSelected;
window.clipboard = core.state.clipboard;
window.vimPendingRestore = core.state.vimPendingRestore;

// Chrome API functions (promise-wrapped)
window.bmGet = chromeApi.bmGet;
window.bmGetSubTree = chromeApi.bmGetSubTree;
window.bmCreate = chromeApi.bmCreate;
window.bmUpdate = chromeApi.bmUpdate;
window.bmMove = chromeApi.bmMove;
window.bmRemove = chromeApi.bmRemove;
window.bmRemoveTree = chromeApi.bmRemoveTree;

// Bookmarks module functions
window.saveColumns = bookmarks.saveColumns;
window.renderColumns = () => emit(Events.RENDER_REQUESTED);  // Will be overridden by render module
window.toggle = (node, anchor) => emit('folder:toggle', { node, anchor });  // Will be overridden by render module
window.getConfig = config.get;
window.setConfig = config.set;
window.themes = config.THEMES;
window.showOptions = config.showOptions;
window.renderMenu = (items, x, y, label) => emit('menu:render', { items, x, y, label });  // Will be overridden by interaction module
window.getChildrenFunction = bookmarks.getChildrenFunction;
window.SPECIAL = core.state.special;
window.clipTargetableId = bookmarks.clipTargetableId;
window.getCoords = core.getters.getCoords;

// Config legacy references
window.config = config.DEFAULTS;
window.theme = {};  // populated by storage.loadAll()
window.loadSettings = config.loadAll;
window.initSettings = config.initSettings;
window.initConfig = config.initConfig;
window.showConfig = config.showConfig;
window.onChange = config.onChange;
window.getStyle = config.generateCSS;
window.scale = config.scale;

// Wire up cross-module dependencies
// tree.js needs removeRow from layout.js
bookmarks.setRemoveRow(bookmarks.removeRow);
// special-nodes.js needs getChildrenFunction from tree.js and renderAll from render module
bookmarks.setGetChildrenFunction(bookmarks.getChildrenFunction);
// layout.js needs scheduleRestore from vim (will be set when vim module loads)
// layout.js needs renderColumns (will be set when render module loads)

// Initialize config on load
config.loadAll();

// Listen for render requests and trigger renderColumns
import { on } from './core/events.js';
on(Events.RENDER_REQUESTED, () => {
  if (window.renderColumns) window.renderColumns();
});

// Listen for folder toggle
on('folder:toggle', ({ node, anchor }) => {
  if (window.toggle) window.toggle(node, anchor);
});

// Listen for menu render
on('menu:render', ({ items, x, y, label }) => {
  if (window.renderMenu) window.renderMenu(items, x, y, label);
});

// Listen for bookmarks:getChildrenFunction
on('bookmarks:getChildrenFunction', (node) => {
  if (window.getChildrenFunction) window.getChildrenFunction(node);
});