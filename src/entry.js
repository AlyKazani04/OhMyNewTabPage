import './core/index.js';
import './config/index.js';
import './bookmarks/index.js';
import './render/index.js';
import './interaction/index.js';
import './vim/index.js';

// Initialize the application
import { loadAll } from './config/storage.js';
import { initKeyboard } from './interaction/keyboard.js';

// Initialize config and keyboard
loadAll();
initKeyboard();