import { get, scale } from './config/config.js';
import * as chromeApi from './chrome-api.js';
import { state } from './state.js';
import { getChildrenFunction, getSubTree } from './bookmarks/tree.js';
import { on, emit, Events } from './events.js';


// ----- NODE -----
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
export async function openLink(node, newtab) {
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
    const newtab = get('newtab');
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
      (get('remember_open') && localStorage.getItem('open.' + node.id))
    ) {
      setClass(a, node, true);
      a.open = true;
      getChildrenFunction(node)((result) => {
        renderAll(result, li);
      });
    }
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
  // New DOM has been added. Emitted here (not just by renderColumns) because
  // renderAll also runs from un-awaited callbacks: pre-expanded folders on first
  // render, folder toggles, and the recently-closed refresh.
  emit(Events.RENDER_COMPLETE);
  return ul;
}

// ----- RECENTLY CLOSED REFRESH -----
// Re-render the recently-closed children in place after a session restore.
// This used to live in bookmarks/special-nodes.js, which forced that module to
// import render.js and tree.js — the last import cycle. It is DOM work, so it
// belongs here; special-nodes.js just emits CLOSED_REFRESH.
function refreshClosedList() {
  const targets = [];
  const folders = document.getElementsByClassName('closed');
  for (let i = 0; i < folders.length; i++) {
    const a = folders[i];
    if (a.nextSibling) {
      a.parentNode.removeChild(a.nextSibling);
      targets.push(a.parentNode);
    }
  }
  if (folders.length === 0 && state.coords && state.coords['closed']) {
    const target = document.getElementsByClassName('column')[state.coords['closed'].x];
    target.removeChild(target.firstChild);
    targets.push(target);
  }

  getChildrenFunction({ id: 'closed' })((result) => {
    for (let i = 0; i < targets.length; i++) renderAll(result, targets[i]);
  });
}

on(Events.CLOSED_REFRESH, refreshClosedList);

// ----- ICONS -----
// Gets best icon for a node
export function getIcon(node) {
  let url = null;
  let url2x = null;

  if (node.icons) {
    let size;
    for (const i in node.icons) {
      const iconInfo = node.icons[i];
      if (
        iconInfo.url &&
        (!size || (iconInfo.size < size && iconInfo.size > 15))
      ) {
        url = iconInfo.url;
        if (iconInfo.size > 31) url2x = iconInfo.url;
        size = iconInfo.size;
      }
    }
  } else if (node.icon) {
    url = node.icon;
  } else if (node.url) {
    url = chromeApi.getFaviconUrl(node.url, 16);
    url2x = chromeApi.getFaviconUrl(node.url, 32);
  }

  const icon = document.createElement(url ? 'img' : 'div');
  icon.className = 'icon';
  icon.src = url;
  if (url2x) icon.srcset = url2x + ' 2x';
  icon.alt = ' ';
  return icon;
}

// ----- TOOLTIPS -----
// The debounce handle lives on `state.tooltipTimeout` (see state.js) rather than
// in a module-private binding.

// Adds tooltips to truncated text
export function updateTooltips() {
  if (state.tooltipTimeout) clearTimeout(state.tooltipTimeout);

  state.tooltipTimeout = setTimeout(() => {
    state.tooltipTimeout = null;
    const elements = document.querySelectorAll('#main li a');
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i];
      if (element.clientWidth + 1 < element.scrollWidth) {
        element.title = element.title || element.textContent;
      } else if (element.title === element.textContent) {
        element.title = '';
      }
    }
  }, 100);
}

// ----- FOLDER -----
// Toggle folder open state
export function toggle(node, anchor) {
  const isOpen = anchor.open;
  setClass(anchor, node, !isOpen);
  anchor.open = !isOpen;

  if (isOpen) {
    // Close folder
    localStorage.removeItem('open.' + node.id);
    if (anchor.nextSibling) {
      // Auto-close child folders
      if (get('auto_close')) {
        const children = (
          anchor.nextSibling.tagName === 'DIV'
            ? anchor.nextSibling.firstChild
            : anchor.nextSibling
        ).children;
        for (let i = 0; i < children.length; i++) {
          const child = children[i].firstChild;
          if (child.open) child.onclick();
        }
      }
      // Close folder
      animate(node, anchor, isOpen);
    }
  } else {
    // Open folder
    localStorage.setItem('open.' + node.id, 'true');
    // Auto-close sibling folders
    if (get('auto_close')) {
      const siblings = anchor.parentNode.parentNode.children;
      for (let i = 0; i < siblings.length; i++) {
        const sibling = siblings[i].firstChild;
        if (sibling !== anchor && sibling.open) sibling.onclick();
      }
    }
    // Open folder
    if (anchor.nextSibling) {
      animate(node, anchor, isOpen);
    }
    getChildrenFunction(node)((result) => {
      if (!anchor.nextSibling && anchor.open) {
        renderAll(result, anchor.parentNode);
        animate(node, anchor, isOpen);
        // New nodes need behavior attached; render.js must not import interaction.js.
        emit(Events.RENDER_COMPLETE);
      }
    });
  }
}

// Smoothly open or close folder
export function animate(node, anchor, isOpen) {
  // Wrapper needed for inner height value
  const wrap = anchor.nextSibling;
  if (anchor.animationHandle) {
    // Clear last animation
    clearTimeout(anchor.animationHandle);
    anchor.animationHandle = null;
  }

  // Use CSS transform-based animation
  wrap.className = 'wrap';
  wrap.style.transformOrigin = 'top';

  if (isOpen) {
    // Closing: scale from 1 to 0
    wrap.classList.add('closing');
    wrap.classList.remove('opening');
  } else {
    // Opening: start squashed, then transition to expanded
    wrap.classList.add('closing');
    void wrap.offsetHeight; // Force recalculation to register scaleY(0)
    wrap.classList.add('opening');
    wrap.classList.remove('closing');
  }

  const duration = scale(get('slide'), 0.2, 1) * 1000;
  anchor.animationHandle = setTimeout(() => {
    anchor.animationHandle = null;
    if (isOpen) {
      anchor.parentNode.removeChild(wrap);
    } else {
      wrap.className = '';
      wrap.removeAttribute('style');
    }
  }, duration);
}

// ----- COLUMN -----
// Promisify the callback-style tree readers so a column render can be awaited.
function getSubTreeAsync(id) {
  return new Promise((resolve) => getSubTree(id, resolve));
}

function getChildrenAsync(node) {
  return new Promise((resolve) => getChildrenFunction(node)(resolve));
}

// Render column with given index
export async function renderColumn(index, target) {
  const ids = state.columns[index];
  if (!ids) return;

  if (ids.length === 1 && !get('show_root')) {
    const result = await getChildrenAsync({ id: ids[0] });
    if (!state.columns[index]) return;
    renderAll(result, target);
  } else if (ids.length > 0) {
    const nodes = [];
    // Get all nodes for column
    for (let i = 0; i < ids.length; i++) {
      const result = await getSubTreeAsync(ids[i]);
      if (!state.columns[index]) return;
      for (let j = 0; j < result.length; j++) nodes.push(result[j]);
    }
    // Render node list
    renderAll(nodes, target, true);
  }
}

// ----- RENDERER -----
// Render all columns to main div
export async function renderColumns() {
  // Clear main div
  const target = document.getElementById('main');
  while (target.hasChildNodes()) target.removeChild(target.lastChild);

  // Render columns (content is fetched asynchronously, as before)
  const renders = [];
  for (let i = 0; i < state.columns.length; i++) {
    const column = document.createElement('div');
    column.className = 'column';

    column.style.width = (1 / state.columns.length) * 100 + '%';

    target.appendChild(column);
    renders.push(renderColumn(i, column));
  }

  await Promise.all(renders);

  // Signal render complete — only once every column's content has been fetched,
  // so behaviour attached by listeners sees the full DOM.
  emit(Events.RENDER_COMPLETE);
}
