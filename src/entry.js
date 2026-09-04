import './core/index.js';
import './config/index.js';
import './bookmarks/index.js';
import './render/index.js';
import './interaction/index.js';
import './vim/index.js';

import * as bookmarks from './bookmarks/index.js';
import * as render from './render/index.js';
import * as interaction from './interaction/index.js';
import * as vim from './vim/index.js';
import * as config from './config/index.js';
import * as core from './core/index.js';
import { emit, Events, on } from './core/events.js';
import { loadAll } from './config/storage.js';
import { initKeyboard } from './interaction/keyboard.js';

// Wire up cross-module dependencies
// bookmarks/special-nodes.js needs getChildrenFunction and renderAll
bookmarks.setGetChildrenFunction(bookmarks.getChildrenFunction);
bookmarks.setRenderAll(render.renderAll);

// render/node.js needs getChildrenFunction, getConfig, addFolderHandlers, enableDragFolder, toggle
render.setGetChildrenFunction(bookmarks.getChildrenFunction);
render.setGetConfig(config.get);
render.setAddFolderHandlers(interaction.addFolderHandlers);
render.setEnableDragFolder(interaction.enableDragFolder);
render.setToggle(render.toggle); // from folder.js via render

// render/folder.js needs getChildrenFunction, renderAll, setClass
render.setGetChildrenFunctionForFolder(bookmarks.getChildrenFunction);
render.setRenderAllForFolder(render.renderAll);
render.setSetClassForFolder(render.setClass);

// render/column.js needs addColumnHandlers
render.setAddColumnHandlers(interaction.addColumnHandlers);

// render/renderer.js needs enableDragColumn, enableDragDrop, renderColumn
render.setEnableDragColumn(interaction.enableDragColumn);
render.setEnableDragDrop(interaction.enableDragDrop);
render.setRenderColumn(render.renderColumn);

// interaction/context-menu.js needs getChildrenFunction, openLink, toggle, renderColumns
interaction.setGetChildrenFunction(bookmarks.getChildrenFunction);
interaction.setOpenLink(render.openLink);
interaction.setToggle(render.toggle); // from folder.js via render
interaction.setRenderColumns(render.renderColumns);

// interaction/keyboard.js needs showOptions
interaction.setShowOptions(config.showOptions);

// bookmarks/crud.js needs renderColumns, scheduleRestore
bookmarks.setRenderColumnsForCrud(render.renderColumns);
bookmarks.setScheduleRestoreForCrud(bookmarks.scheduleRestore); // from layout.js via bookmarks

// bookmarks/layout.js needs scheduleRestore, renderColumns
// scheduleRestore is set by vim module directly (vim/actions.js imports from layout.js)
// renderColumns is already set via bookmarks.setRenderColumns (layout.js version)

// Initialize config and keyboard
loadAll();
initKeyboard();

// Handle ?options query parameter (for options page)
if (location.search.includes('options')) {
  config.showOptions(true);
}

// Event listeners for render requests
on(Events.RENDER_REQUESTED, () => {
  if (window.renderColumns) window.renderColumns();
});

// Export key functions to window for any remaining legacy code
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