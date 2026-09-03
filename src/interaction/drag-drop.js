import { state } from '../core/state.js';
import { get } from '../config/storage.js';
import { addColumn, removeColumn, addRow, removeRow, saveColumns } from '../bookmarks/layout.js';
import { folderMoveDrop, clipTargetableId } from '../bookmarks/crud.js';
import { renderColumns } from '../render/renderer.js';

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

let dragIdsFolder = null;

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
