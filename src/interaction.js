// ----- KEYBOARD -----
import {
  moveCursor,
  vimActivate,
  vimOpenFolder,
  createNodeDialog,
  editNodeDialog,
  vimDelete,
  vimToggleSelect,
  vimClearSelection,
  vimYank,
  vimCut,
  vimCancelClipboard,
  vimPaste,
  vimShowThemePicker
} from './vim.js';
import { state } from './state.js';
import { get } from './config/config.js';
import { getChildrenFunction } from './bookmarks/tree.js';
import { addColumn, removeColumn, addRow, removeRow } from './bookmarks/layout.js';
import { folderMoveDrop } from './bookmarks/crud.js';
import * as chromeApi from './chrome-api.js';
import { openLink, toggle } from './render.js';
import { showOptions } from './config/ui.js';
import { on, Events } from './events.js';
import { renderMenu } from './overlay.js';


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

// ----- MODAL / CONTEXT MENU -----
// The modal dialog and popup menu now live in overlay.js. Keeping them out of
// this module is what lets vim.js use them without importing interaction.js,
// which would close the cycle vim.js -> interaction.js -> vim.js.
// renderMenu is still imported below: addFolderHandlers and addColumnHandlers
// build the context menu item lists and render them here.

// Gets context menu items for given node
export function getMenuItems(node) {
  const items = [];
  items.push({
    label: 'Open all links in folder',
    action: () => { openLinks(node); },
  });
  if (node.id === 'closed')
    items.push({
      label: 'Clear browsing data',
      action: () => { openLink({ url: 'chrome://settings/clearBrowserData' }, 1); },
    });
  if (node.id === 'devices')
    items.push({
      label: 'History',
      action: () => { openLink({ url: 'chrome://history' }, 1); },
    });
  if (node.id && /^\d+$/.test(node.id))
    items.push({
      label: 'Edit bookmarks',
      action: () => { openLink({ url: 'chrome://bookmarks/?id=' + node.id }, 1); },
    });
  return items;
}

// Opens immediate children of given node in new tabs
async function openLinks(node) {
  try {
    await chromeApi.getCurrentTab();
    getChildrenFunction(node)((result) => {
      for (let i = 0; i < result.length; i++) openLink(result[i], 2);
    });
  } catch (err) {
    console.warn('Failed to get current tab:', err);
  }
}

// Enables click and context menu for given folder
export function addFolderHandlers(node, anchor) {
  // Click handler
  anchor.onclick = () => { toggle(node, anchor, getChildrenFunction(node)); return false; };

  // Context menu handler
  let items = getMenuItems(node);

  // Column layout items
  if (!get('lock')) {
    items.push(null); // spacer
    items.push({
      label: 'Create new column',
      action: () => { addColumn([node.id]); },
    });

    if (state.coords[node.id]) {
      const pos = state.coords[node.id];
      if (pos.y > 0)
        items.push({ label: 'Move folder up', action: () => { addRow(node.id, pos.x, pos.y - 1); } });
      if (pos.y < state.columns[pos.x].length - 1)
        items.push({ label: 'Move folder down', action: () => { addRow(node.id, pos.x, pos.y + 2); } });
      if (pos.x > 0)
        items.push({ label: 'Move folder left', action: () => { addRow(node.id, pos.x - 1); } });
      if (pos.x < state.columns.length - 1)
        items.push({ label: 'Move folder right', action: () => { addRow(node.id, pos.x + 1); } });
      if (state.root.indexOf(node.id) < 0)
        items.push({ label: 'Remove folder', action: () => { removeRow(pos.x, pos.y); } });
    }
  }

  anchor.oncontextmenu = (event) => { renderMenu(items, event.pageX, event.pageY); return false; };
}

// Enables context menu for given column
export function addColumnHandlers(index, target) {
  let items = [];
  const ids = state.columns[index];
  if (!ids) return;

  // Single folder items
  if (ids.length === 1) items = getMenuItems({ id: ids[0] });

  // Column layout items
  if (!get('lock') && state.columns.length > 1) {
    items.push(null); // spacer
    if (index > 0)
      items.push({ label: 'Move column left', action: () => { addColumn(ids, index - 1); } });
    if (index < state.columns.length - 1)
      items.push({ label: 'Move column right', action: () => { addColumn(ids, index + 2); } });
    items.push({ label: 'Remove column', action: () => { removeColumn(index); } });
    if (ids.length === 1) {
      if (index > 0)
        items.push({ label: 'Move folder left', action: () => { addRow(ids[0], index - 1); } });
      if (index < state.columns.length - 1)
        items.push({ label: 'Move folder right', action: () => { addRow(ids[0], index + 1); } });
    }
  }

  if (items.length > 0)
    target.oncontextmenu = (event) => {
      if (event.target.tagName === 'A' || event.target.parentNode.tagName === 'A') return true;
      renderMenu(items, event.pageX, event.pageY);
      return false;
    };
}

// ----- DRAG_N_DROP -----
let dragIds = null;
let dropTarget = null;

// Enable drag and drop of column
export function enableDragColumn(id, column) {
  if (get('lock')) return;
  column.draggable = true;
  column.ondragstart = (event) => {
    dragIds = state.columns[id];
    event.dataTransfer.effectAllowed = 'move';
    column.classList.add('dragstart');
  };
  column.ondragend = () => {
    dragIds = null;
    column.classList.remove('dragstart');
    clearDropTarget();
  };
}

// Enable drag and drop of folder
export function enableDragFolder(node, anchor) {
  if (get('lock')) return;
  anchor.draggable = true;
  anchor.ondragstart = (event) => {
    dragIds = [node.id];
    event.stopPropagation();
    event.dataTransfer.effectAllowed = 'move copy';
    anchor.classList.add('dragstart');
  };
  anchor.ondragend = () => {
    dragIds = null;
    anchor.classList.remove('dragstart');
    clearDropTarget();
  };
}

// Init drag and drop handlers
export function enableDragDrop() {
  const main = document.getElementById('main');
  if (get('lock')) {
    main.ondragover = null;
    main.ondragleave = null;
    main.ondrop = null;
    return;
  }

  main.ondragover = (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const target = getDropTarget(event);
    if (target) {
      clearDropTarget();
      dropTarget = target;
      const bordercss = 'solid 2px ' + get('font_color');
      if (target.tagName === 'LI' || target.tagName === 'UL') {
        if (isAbove(event.pageY, target)) {
          target.style.borderBottom = bordercss;
          target.style.margin = '0 0 -2px 0';
        } else {
          target.style.borderTop = bordercss;
          target.style.margin = '-2px 0 0 0';
        }
      } else if (target.className === 'column') {
        if (event.pageX - target.offsetLeft > target.clientWidth / 2) {
          target.style.borderRight = bordercss;
          target.style.margin = '0';
        } else {
          target.style.borderLeft = bordercss;
          target.style.margin = '0 2px 0 -2px';
        }
      } else if (target.tagName === 'A') {
        target.style.border = bordercss;
      }
    }
    return false;
  };

  main.ondragleave = () => { clearDropTarget(); };

  main.ondrop = (event) => {
    event.stopPropagation();
    const target = getDropTarget(event);
    if (!target) return false;

    // Drop into a folder container
    if (target.tagName === 'A' && target.classList.contains('folder')) {
      folderMoveDrop(dragIds, target._vimNode ? target._vimNode.id : null);
      return false;
    }

    // Calculate drop coordinates
    let x = getDropX(target, event);
    const y = getDropY(target, event);

    if (dragIds.length === 1 && y != null) addRow(dragIds[0], x, y);
    else {
      if (event.pageX - target.offsetLeft > target.clientWidth / 2) x++;
      addColumn(dragIds, x);
    }
    return false;
  };
}

// Gets proper drop target element
export function getDropTarget(event) {
  if (!dragIds) return null;
  let target = event.target;

  // Dropping a single item directly on a folder header uses the folder as container
  let a = target && target.tagName === 'A' ? target :
    target.parentNode && target.parentNode.tagName === 'A' ? target.parentNode : null;
  if (a && a.classList.contains('folder') && dragIds.length === 1) {
    const rect = a.getBoundingClientRect();
    const cy = event.clientY;
    if (cy - rect.top > 6 && rect.bottom - cy > 6) return a;
  }

  if (target && (target.tagName === 'A' || target.parentNode.tagName === 'A') && dragIds.length === 1) {
    // Get parent folder until toplevel
    while (target && target.parentNode.parentNode && target.parentNode.parentNode.className !== 'column') {
      target = target.parentNode;
    }
    // If single-folder column, get the UL
    if (target && target.tagName === 'LI' && state.columns[getDropX(target, event)].length === 1)
      target = target.parentNode;
  } else {
    while (target && target.className !== 'column') target = target.parentNode;
  }
  return target;
}

// Gets x coordinate of drop target
export function getDropX(target, event) {
  let x = null;
  while (target && target.className !== 'column') target = target.parentNode;
  if (target) {
    x = 0;
    for (; target.previousSibling; x++) target = target.previousSibling;
  }
  return x;
}

// Gets y coordinate of drop target
export function getDropY(target, event) {
  let y = null;
  if (target.tagName === 'LI') {
    y = 0;
    if (isAbove(event.pageY, target)) y++;
    for (; target.previousSibling; y++) target = target.previousSibling;
  } else if (target.tagName === 'UL') {
    y = 0;
    if (isAbove(event.pageY, target)) y++;
  }
  return y;
}

// Returns true if y position is above target element midpoint
export function isAbove(pageY, target) {
  return (pageY - window.scrollY - target.getBoundingClientRect().top) > target.clientHeight / 2;
}

// Clears droptarget styles
export function clearDropTarget() {
  if (dropTarget) {
    dropTarget.style.border = null;
    dropTarget.style.margin = null;
  }
  dropTarget = null;
}

// ----- RENDER WIRING -----
// The render layer emits RENDER_COMPLETE once it has produced DOM. Attaching
// behavior here (instead of inside render.js) keeps the dependency one-way:
// interaction.js -> render.js, never the reverse.
export function attachRenderHandlers() {
  // Columns: context menu + drag source
  const columns = document.getElementsByClassName('column');
  for (let i = 0; i < columns.length; i++) {
    addColumnHandlers(i, columns[i]);
    enableDragColumn(i, columns[i]);
  }

  // Anchors: folder click/context menu + drag source
  const anchors = document.querySelectorAll('#main a');
  for (let i = 0; i < anchors.length; i++) {
    const anchor = anchors[i];
    const node = anchor._vimNode;
    if (!node) continue;
    if (node.children) {
      addFolderHandlers(node, anchor);
      enableDragFolder(node, anchor);
    } else if (node.id === 'apps') {
      enableDragFolder(node, anchor);
    }
  }

  enableDragDrop();
}

on(Events.RENDER_COMPLETE, attachRenderHandlers);
