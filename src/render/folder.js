import { state } from '../core/state.js';
import { get } from '../config/storage.js';
import { scale } from '../config/styles.js';
import { setClass } from './node.js';
import { renderAll } from './node.js';

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
    } else {
      getChildrenFunction(node)((result) => {
        if (!anchor.nextSibling && anchor.open) {
          renderAll(result, anchor.parentNode);
          animate(node, anchor, isOpen);
        }
      });
    }
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
  } else {
    // Start animation
    wrap.style.height = isOpen ? wrap.firstChild.clientHeight + 'px' : '0';
    wrap.style.opacity = isOpen ? '1' : '0';
  }

  // requestAnimationFrame twice to ensure at least one frame has passed
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (wrap) {
        wrap.className = 'wrap';
        wrap.style.height = isOpen ? '0' : wrap.firstChild.clientHeight + 'px';
        wrap.style.opacity = isOpen ? '0' : '1';
        wrap.style.pointerEvents = isOpen ? 'none' : null;
      }
    });
  });

  const duration = scale(get('slide'), 0.2, 1) * 1000;
  anchor.animationHandle = setTimeout(() => {
    anchor.animationHandle = null;
    if (isOpen) {
      anchor.parentNode.removeChild(wrap);
    } else {
      wrap.className = null;
      wrap.removeAttribute('style');
    }
  }, duration);
}

// This will be set by node.js after it loads
let getChildrenFunction = null;

export function setGetChildrenFunctionForFolder(fn) {
  getChildrenFunction = fn;
}