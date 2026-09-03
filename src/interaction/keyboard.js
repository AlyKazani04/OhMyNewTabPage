import { state, mutations } from '../core/state.js';
import { get, set } from '../config/storage.js';
import { emit, Events } from '../core/events.js';
import { renderColumns } from '../render/renderer.js';
import { toggle } from '../render/folder.js';
import { showModal } from './modal.js';
import { renderMenu } from './context-menu.js';
import { 
  moveCursor, 
  resolveCursor, 
  updateCursorVisuals, 
  scheduleRestore, 
  restoreCursor,
  vimActivate,
  vimOpenFolder,
  createNodeDialog,
  editNodeDialog,
  vimDelete,
  vimGetTargetIds,
  vimToggleSelect,
  vimClearSelection,
  vimYank,
  vimCut,
  vimCancelClipboard,
  vimPaste,
  vimShowThemePicker
} from '../vim/index.js';

// Keyboard handler
export function initKeyboard() {
  document.addEventListener('keydown', (event) => {
    if (document.getElementById('options').style.display === 'block') {
      if (event.key === 'Escape') { showOptions(false); event.preventDefault(); }
      return;
    }
    const tag = event.target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (document.querySelector('.menu') || document.querySelector('.vim-modal-backdrop')) return;
    if (event.ctrlKey || event.altKey || event.metaKey) return;
    let handled = true;
    switch (event.key) {
      case 'ArrowLeft': case 'h': moveCursor(-1, 0); break;
      case 'ArrowRight': case 'l': moveCursor(1, 0); break;
      case 'ArrowDown': case 'j': moveCursor(0, 1); break;
      case 'ArrowUp': case 'k': moveCursor(0, -1); break;
      case 'Enter': case 'o': vimActivate(); break;
      case 'O': vimOpenFolder(); break;
      case 'n': createNodeDialog(false); break;
      case 'N': createNodeDialog(true); break;
      case 'e': editNodeDialog(); break;
      case 'd': vimDelete(); break;
      case 'v': vimToggleSelect(); break;
      case 'V': vimClearSelection(); break;
      case 'y': vimYank(); break;
      case 'x': vimCut(); break;
      case 'p': vimPaste(true); break;
      case 'P': vimPaste(false); break;
      case 'T': vimShowThemePicker(); break;
      case '/': showOptions(true); break;
      case 'Escape': vimClearSelection(); vimCancelClipboard(); break;
      default: handled = false;
    }
    if (handled) event.preventDefault();
  });
}

let showOptions = null;
export function setShowOptions(fn) { showOptions = fn; }