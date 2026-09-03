import { state } from '../core/state.js';
import { get } from '../config/storage.js';
import { addColumn, removeColumn, addRow, removeRow, saveColumns } from '../bookmarks/layout.js';
import { renderColumns } from '../render/renderer.js';
import { toggle } from '../render/folder.js';

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
function openLinks(node) {
  chrome.tabs.getCurrent((tab) => {
    getChildrenFunction(node)((result) => {
      for (let i = 0; i < result.length; i++) openLinkFn(result[i], 2);
    });
  });
}

// These will be set by shim
let getChildrenFunction = null;
let openLinkFn = null;

export function setGetChildrenFunction(fn) { getChildrenFunction = fn; }
export function setOpenLink(fn) { openLinkFn = fn; }

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
