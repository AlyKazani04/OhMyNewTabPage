// Temporary: re-export core modules as globals for vim.js during migration
import * as core from './core/index.js';
import * as config from './config/index.js';
import * as chromeApi from './core/chrome-api.js';
import * as bookmarks from './bookmarks/index.js';
import * as render from './render/index.js';
import * as interaction from './interaction/index.js';
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
window.renderColumns = render.renderColumns;
window.toggle = render.toggle;
window.getConfig = config.get;
window.setConfig = config.set;
window.themes = config.THEMES;
window.showOptions = config.showOptions;
window.renderMenu = interaction.renderMenu;
window.getChildrenFunction = bookmarks.getChildrenFunction;
window.SPECIAL = core.state.special;
window.clipTargetableId = bookmarks.clipTargetableId;
window.getCoords = core.getters.getCoords;
window.renderAll = render.renderAll;

// Config legacy references
window.config = config.DEFAULTS;
window.theme = {};
window.loadSettings = config.loadAll;
window.initSettings = config.initSettings;
window.initConfig = config.initConfig;
window.showConfig = config.showConfig;
window.onChange = config.onChange;
window.getStyle = config.generateCSS;
window.scale = config.scale;

// Wire up cross-module dependencies
bookmarks.setRemoveRow(bookmarks.removeRow);
bookmarks.setGetChildrenFunction(bookmarks.getChildrenFunction);
bookmarks.setRenderAll(render.renderAll);
bookmarks.setScheduleRestore(bookmarks.scheduleRestore);
render.setGetChildrenFunction(bookmarks.getChildrenFunction);
render.setGetConfig(config.get);
render.setAddFolderHandlers(interaction.addFolderHandlers);
render.setEnableDragFolder(interaction.enableDragFolder);
render.setAddColumnHandlers(interaction.addColumnHandlers);
render.setEnableDragColumn(interaction.enableDragColumn);
render.setEnableDragDrop(interaction.enableDragDrop);
interaction.setGetChildrenFunction(bookmarks.getChildrenFunction);
interaction.setOpenLink(render.openLink);
interaction.setShowOptions(config.showOptions);

// Initialize
config.loadAll();
interaction.initKeyboard();

// Event listeners
import { on } from './core/events.js';
on(Events.RENDER_REQUESTED, () => { if (window.renderColumns) window.renderColumns(); });
on('folder:toggle', ({ node, anchor }) => { if (window.toggle) window.toggle(node, anchor); });
on('menu:render', ({ items, x, y, label }) => { if (window.renderMenu) window.renderMenu(items, x, y, label); });
on('bookmarks:getChildrenFunction', (node) => { if (window.getChildrenFunction) window.getChildrenFunction(node); });
