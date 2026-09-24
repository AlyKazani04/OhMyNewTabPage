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
import { folderMoveDrop, addColumn, removeColumn, addRow, removeRow } from './bookmarks.js';
import * as chromeApi from './chrome-api.js';


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

// ----- MODAL -----
// Modal dialog
export function showModal(options) {
  const prevFocus = document.activeElement;

  const backdrop = document.createElement('div');
  backdrop.className = 'vim-modal-backdrop';

  const form = document.createElement('form');
  form.className = 'vim-modal';

  const heading = document.createElement('div');
  heading.className = 'vim-modal-title';
  heading.innerText = options.title;
  form.appendChild(heading);

  const inputs = [];
  for (let i = 0; i < options.fields.length; i++) {
    const field = options.fields[i];
    const label = document.createElement('label');
    label.className = 'vim-modal-field';
    const p = document.createElement('p');
    p.innerText = field.label;
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = field.placeholder || '';
    input.value = field.value || '';
    label.appendChild(p);
    label.appendChild(input);
    form.appendChild(label);
    inputs.push(input);
  }

  const buttons = document.createElement('div');
  buttons.className = 'vim-modal-buttons';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.innerText = 'Cancel';
  cancel.onclick = close;
  const submit = document.createElement('button');
  submit.type = 'submit';
  submit.innerText = options.submitLabel || 'Submit';
  buttons.appendChild(cancel);
  buttons.appendChild(submit);
  form.appendChild(buttons);

  function close() {
    if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    document.removeEventListener('keydown', onKeyDown, true);
    if (prevFocus && prevFocus.isConnected && prevFocus.focus) prevFocus.focus();
  }

  function onKeyDown(event) {
    if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    }
  }

  form.onsubmit = (event) => {
    event.preventDefault();
    const values = inputs.map(input => input.value.trim());
    if (!options.onSubmit(values)) return;
    close();
  };

  backdrop.onmousedown = (event) => {
    if (event.target === backdrop) close();
    return false;
  };

  document.addEventListener('keydown', onKeyDown, true);
  backdrop.appendChild(form);
  document.body.appendChild(backdrop);
  if (inputs.length > 0) inputs[0].focus();
  else cancel.focus();
}
// ----- CONTEXT_MENU -----
// Wraps click handler for menu items
function onMenuClick(item, ul) {
  return function () {
    item.action();
    closeMenu(ul);
    return false;
  };
}

// Renders a popup menu at given coordinates
export function renderMenu(items, x, y, label) {
  const ul = document.createElement('ul');
  ul.className = 'menu';
  ul.setAttribute('role', 'menu');
  if (label) ul.setAttribute('aria-label', label);
  const prevFocus = document.activeElement;
  ul._prevFocus = prevFocus;
  let selectedAnchor = null;

  for (let i = 0; i < items.length; i++) {
    const li = document.createElement('li');
    if (items[i]) {
      const a = document.createElement('a');
      a.innerText = items[i].label;
      a.tabIndex = -1;
      a.setAttribute('role', 'menuitem');
      if (items[i].selected === true) {
        a.setAttribute('aria-checked', 'true');
        selectedAnchor = a;
      }
      a.onclick = onMenuClick(items[i], ul);
      li.appendChild(a);
    } else if (i > 0 && i < items.length - 1) {
      li.appendChild(document.createElement('hr'));
    } else continue;
    ul.appendChild(li);
  }

  document.body.appendChild(ul);
  const firstAnchor = ul.querySelector('a');
  if (selectedAnchor) selectedAnchor.focus();
  else if (firstAnchor) firstAnchor.focus();

  ul.style.left = Math.max(Math.min(x, window.innerWidth + window.scrollX - ul.clientWidth), 0) + 'px';
  ul.style.top = Math.max(Math.min(y, window.innerHeight + window.scrollY - ul.clientHeight), 0) + 'px';

  ul.onmousedown = (event) => { event.stopPropagation(); return true; };

  setTimeout(() => {
    document.onclick = () => { closeMenu(ul); return true; };
    document.onmousedown = () => { closeMenu(ul); return true; };
    document.oncontextmenu = () => { closeMenu(ul); return true; };
    document.onkeydown = (event) => {
      if (event.code === 'Escape') { closeMenu(ul); return true; }
      const anchors = ul.querySelectorAll('a[role="menuitem"]');
      if (!anchors.length) return true;
      let idx = -1;
      for (let i = 0; i < anchors.length; i++) {
        if (anchors[i] === document.activeElement) { idx = i; break; }
      }
      if (event.code === 'ArrowDown') {
        event.preventDefault();
        const next = idx < 0 ? 0 : (idx + 1) % anchors.length;
        anchors[next].focus();
      } else if (event.code === 'ArrowUp') {
        event.preventDefault();
        const prev = idx < 0 ? anchors.length - 1 : (idx - 1 + anchors.length) % anchors.length;
        anchors[prev].focus();
      } else if (event.code === 'Home') {
        event.preventDefault();
        anchors[0].focus();
      } else if (event.code === 'End') {
        event.preventDefault();
        anchors[anchors.length - 1].focus();
      } else if (event.code === 'Enter' || event.code === 'Space') {
        event.preventDefault();
        const target = event.target;
        if (target && target.getAttribute && target.getAttribute('role') === 'menuitem') {
          target.click();
        } else {
          const focused = ul.querySelector('a:focus');
          if (focused) focused.click();
        }
      }
      return true;
    };
  }, 20);
  return ul;
}

// Removes the given popup menu
export function closeMenu(ul) {
  if (ul && ul.parentNode) ul.parentNode.removeChild(ul);
  document.onclick = null;
  document.onmousedown = null;
  document.oncontextmenu = null;
  document.onkeydown = null;
  if (ul && ul._prevFocus && ul._prevFocus.focus) ul._prevFocus.focus();
}

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
      for (let i = 0; i < result.length; i++) openLinkFn(result[i], 2);
    });
  } catch (err) {
    console.warn('Failed to get current tab:', err);
  }
}

let getChildrenFunction = null;
let openLinkFn = null;
let toggleFn = null;
let renderColumnsFn = null;

export function setGetChildrenFunction(fn) { getChildrenFunction = fn; }
export function setOpenLink(fn) { openLinkFn = fn; }
export function setToggle(fn) { toggleFn = fn; }
export function setRenderColumns(fn) { renderColumnsFn = fn; }

// Enables click and context menu for given folder
export function addFolderHandlers(node, anchor) {
  // Click handler
  anchor.onclick = () => { if (toggleFn) toggleFn(node, anchor, getChildrenFunction(node)); return false; };

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
