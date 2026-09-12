import { state } from '../core/state.js';
import { get } from '../config/storage.js';
import { scale } from '../config/styles.js';

// Toggle folder open state
export function toggle(node, anchor) {
  const isOpen = anchor.open;
  if (setClassFn) setClassFn(anchor, node, !isOpen);
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
    } else if (getChildrenFunction && renderAllFn) {
      getChildrenFunction(node)((result) => {
        if (!anchor.nextSibling && anchor.open) {
          renderAllFn(result, anchor.parentNode);
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
      wrap.className = null;
      wrap.removeAttribute('style');
    }
  }, duration);
}

let getChildrenFunction = null;
let renderAllFn = null;
let setClassFn = null;

export function setGetChildrenFunctionForFolder(fn) {
  getChildrenFunction = fn;
}

export function setRenderAllForFolder(fn) {
  renderAllFn = fn;
}

export function setSetClassForFolder(fn) {
  setClassFn = fn;
}
