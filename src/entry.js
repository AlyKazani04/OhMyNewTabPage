import * as bookmarks from './bookmarks.js';
import * as render from './render.js';
import * as interaction from './interaction.js';
import * as vim from './vim.js';
import * as config from './config/index.js';
import { Events, on } from './events.js';
import * as core from './state.js';

// Initialize config and keyboard
config.loadAll();
interaction.initKeyboard();

// Handle ?options query parameter (for options page)
if (location.search.includes('options')) {
  config.showOptions(true);
}

// Event listeners for render requests
on(Events.RENDER_REQUESTED, () => {
  if (window.renderColumns) window.renderColumns();
});

// Publish module functions on window (consumed by event handlers and legacy global callers)
window.renderColumns = render.renderColumns;
window.toggle = render.toggle;
window.getConfig = config.get;
window.setConfig = config.set;
window.themes = config.THEMES;
window.showOptions = config.showOptions;
window.renderMenu = interaction.renderMenu;
window.getChildrenFunction = bookmarks.getChildrenFunction;
window.SPECIAL = bookmarks.SPECIAL;
window.clipTargetableId = bookmarks.clipTargetableId;
window.getCoords = (id) => core.getters.getCoords(id);
window.renderAll = render.renderAll;
window.saveColumns = bookmarks.saveColumns;
window.loadSettings = config.loadAll;
window.initSettings = config.initSettings;
window.initConfig = config.initConfig;
window.showConfig = config.showConfig;
window.onChange = config.onChange;
window.getStyle = config.generateCSS;
window.scale = config.scale;

// Kick off the initial layout load (fetches the bookmarks root, builds columns, renders).
// Runs last so the RENDER_REQUESTED listener and window.renderColumns above are ready.
bookmarks.loadColumns();
