import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';

// Render all columns to main div
export function renderColumns() {
  // Clear main div
  const target = document.getElementById('main');
  while (target.hasChildNodes()) target.removeChild(target.lastChild);

  // Render columns
  for (let i = 0; i < state.columns.length; i++) {
    const column = document.createElement('div');
    column.className = 'column';

    if (!state.columns.length) return;
    column.style.width = (1 / state.columns.length) * 100 + '%';

    // Enable drag and drop
    if (enableDragColumnFn) enableDragColumnFn(i, column);

    target.appendChild(column);
    if (renderColumnFn) renderColumnFn(i, column);
  }

  if (enableDragDropFn) enableDragDropFn();

  // Signal render complete
  emit(Events.RENDER_COMPLETE);
}

let enableDragColumnFn = null;
let enableDragDropFn = null;
let renderColumnFn = null;

export function setEnableDragColumn(fn) {
  enableDragColumnFn = fn;
}

export function setEnableDragDrop(fn) {
  enableDragDropFn = fn;
}

export function setRenderColumn(fn) {
  renderColumnFn = fn;
}
