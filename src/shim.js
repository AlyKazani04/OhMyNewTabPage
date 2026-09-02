// Temporary: re-export core modules as globals for vim.js during migration
import * as core from './core/index.js';
import * as chromeApi from './core/chrome-api.js';

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

// Mutator shims
window.saveColumns = () => core.emit(core.Events.COLUMNS_CHANGED, core.state.columns);
window.renderColumns = () => core.emit(core.Events.RENDER_REQUESTED);
window.toggle = (node, anchor) => core.emit('folder:toggle', { node, anchor });
window.getConfig = (key) => core.emit('config:get', key);  // async via event
window.setConfig = (key, val) => core.emit(core.Events.CONFIG_CHANGED, { key, val });
window.themes = {};  // populated after config module loads
window.showOptions = (show) => core.emit(core.Events.OPTIONS_TOGGLED, show);
window.renderMenu = (items, x, y, label) => core.emit('menu:render', { items, x, y, label });
window.getChildrenFunction = (node) => core.emit('bookmarks:getChildrenFunction', node);
window.SPECIAL = core.state.special;
window.clipTargetableId = (id) => core.getters.isSpecial(id) ? false : true;
window.getCoords = (id) => core.getters.getCoords(id);
