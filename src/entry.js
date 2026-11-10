import * as bookmarks from './bookmarks/index.js';
import * as render from './render.js';
import * as interaction from './interaction.js';
import * as config from './config/index.js';
import { vimInit } from './vim.js';
import { Events, on } from './events.js';

// Initialize config, keyboard, and the vim cursor layer
config.loadAll();
interaction.initKeyboard();
vimInit();

// Handle ?options query parameter (for options page)
if (location.search.includes('options')) {
  config.showOptions(true);
}

// Options button opens the options panel
document.getElementById('options_button').addEventListener('click', () => config.showOptions(true));

// Event listeners for render requests
on(Events.RENDER_REQUESTED, () => {
  render.renderColumns();
});

// Kick off the initial layout load (fetches the bookmarks root, builds columns, renders).
bookmarks.loadColumns();
