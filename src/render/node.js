import { get } from '../config/storage.js';
import { getIcon } from './icons.js';
import { updateTooltips } from './tooltips.js';
import * as chromeApi from '../core/chrome-api.js';

// Sets CSS classes for node
export function setClass(target, node, isOpen) {
  if (node.className) target.classList.add(node.className);
  if (node.children) target.classList.add('folder');
  if (isOpen) target.classList.add('open');
  else target.classList.remove('open');

  if (node.id && (node.id.startsWith('device.') || node.id === 'empty' || node.id === 'apps' || node.id === 'top' || node.id === 'recent' || node.id === 'closed' || node.id === 'devices')) {
    target.classList.add(node.id);
    target.setAttribute('tabindex', '-1');
  }
}

// Opens given node in a tab
async function openLink(node, newtab) {
  const url = node.url;
  if (!url) return;
  try {
    const tab = await chromeApi.getCurrentTab();
    if (newtab) {
      await chromeApi.createTab({
        url,
        active: newtab === 1,
        openerTabId: tab.id,
      });
    } else {
      await chromeApi.updateTab(tab.id, { url });
    }
  } catch (err) {
    console.warn('Failed to open link:', err);
  }
}

let getChildrenFunction = null;
let getConfig = get; // default to config.get
let addFolderHandlers = null;
let enableDragFolder = null;
let toggleFn = null;

export function setGetChildrenFunction(fn) {
  getChildrenFunction = fn;
}

export function setGetConfig(fn) {
  getConfig = fn;
}

export function setAddFolderHandlers(fn) {
  addFolderHandlers = fn;
}

export function setEnableDragFolder(fn) {
  enableDragFolder = fn;
}

export function setToggle(fn) {
  toggleFn = fn;
}

// Render a single bookmark node
export function render(node, target) {
  if (node.description === 'separator') return;

  const li = document.createElement('li');
  const a = document.createElement('a');

  const url = node.url;
  if (url) a.href = url;
  else a.tabIndex = -1;

  let text = node.title || '';
  if (!text && url) text = url;
  a.innerText = text;

  if (node.tooltip) a.title = node.tooltip;
  setClass(a, node);

  a.insertBefore(getIcon(node), a.firstChild);

  if (node.action) {
    a.onclick = (event) => node.action(event);
  } else if (url) {
    const newtab = getConfig('newtab');
    if (newtab === 1) {
      // New foreground tab
      a.target = '_blank';
    } else if (newtab === 2) {
      // New background tab
      a.onclick = (e) => {
        openLink(node, newtab);
        return false;
      };
    }
    // Fix opening chrome:// and file:/// urls
    const urlStart = url.substring(0, 6);
    if (urlStart === 'chrome' || urlStart === 'file:/') {
      a.onclick = (e) => {
        openLink(node, newtab || (e.ctrlKey ? 2 : 0));
        return false;
      };
      a.onauxclick = (e) => {
        if (e.button === 1) {
          openLink(node, 2);
          return false;
        }
      };
    }
  } else if (!node.children) {
    a.style.pointerEvents = 'none';
  }

  li.appendChild(a);
  a._vimNode = node;

  // Folder
  if (node.children) {
    // Render children
    if (
      a.open ||
      (getConfig('remember_open') && localStorage.getItem('open.' + node.id))
    ) {
      setClass(a, node, true);
      a.open = true;
      getChildrenFunction(node)((result) => {
        renderAll(result, li);
      });
    }

    // Click handlers
    if (addFolderHandlers) addFolderHandlers(node, a);
    if (enableDragFolder) enableDragFolder(node, a);
  } else if (node.id === 'apps' && enableDragFolder) {
    enableDragFolder(node, a);
  }

  target.appendChild(li);
  return li;
}

// Render an array of bookmark nodes
export function renderAll(nodes, target, toplevel) {
  const ul = document.createElement('ul');
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    // Skip extensions and duplicated child folders
    if (toplevel || !state.coords[node.id]) render(node, ul);
  }
  if (ul.childNodes.length === 0) {
    render({ id: 'empty', title: '< Empty >' }, ul);
  }
  if (toplevel) target.appendChild(ul);
  else {
    // Wrap child ul for animation
    const wrap = document.createElement('div');
    wrap.appendChild(ul);
    target.appendChild(wrap);
  }
  updateTooltips();
  return ul;
}

// Need to import state for coords check
import { state } from '../core/state.js';

// Export openLink for context-menu.js
export { openLink };
