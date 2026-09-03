import { state } from '../core/state.js';
import { emit, Events } from '../core/events.js';
import { renderColumn } from './column.js';
import { enableDragColumn, enableDragDrop } from '../interaction/drag-drop.js'; // Will be created in Phase 5

// Render all columns to main div
export function renderColumns() {
  // Clear main div
  const target = document.getElementById('main');
  while (target.hasChildNodes()) target.removeChild(target.lastChild);

  // Render columns
  for (let i = 0; i < state.columns.length; i++) {
    const column = document.createElement('div');
    column.className = 'column';
    column.style.width = (1 / state.columns.length) * 100 + '%';

    // Enable drag and drop
    if (enableDragColumn) enableDragColumn(i, column);

    target.appendChild(column);
    renderColumn(i, column);
  }

  if (enableDragDrop) enableDragDrop();

  // Signal render complete
  emit(Events.RENDER_COMPLETE);
}

// These will be set by shim after interaction module loads
let enableDragColumnFn = null;
let enableDragDropFn = null;

export function setEnableDragColumn(fn) {
  enableDragColumnFn = fn;
}

export function setEnableDragDrop(fn) {
  enableDragDropFn = fn;
}