import * as bookmarks from './bookmarks/index.js';
import * as render from './render.js';
import * as interaction from './interaction.js';
import * as config from './config/index.js';
import { Events, on } from './events.js';

// Initialize config and keyboard
config.loadAll();
interaction.initKeyboard();

// Handle ?options query parameter (for options page)
if (location.search.includes('options')) {
  config.showOptions(true);
}

// Event listeners for render requests
on(Events.RENDER_REQUESTED, () => {
  render.renderColumns();
});

// Kick off the initial layout load (fetches the bookmarks root, builds columns, renders).
bookmarks.loadColumns();
