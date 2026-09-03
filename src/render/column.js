import { state } from '../core/state.js';
import { get } from '../config/storage.js';
import { getChildrenFunction, getSubTree } from '../bookmarks/tree.js';
import { renderAll, setGetChildrenFunction as setNodeGetChildrenFunction, setGetConfig as setNodeGetConfig } from './node.js';
import { addColumnHandlers } from '../interaction/context-menu.js'; // Will be created in Phase 5

// Render column with given index
export function renderColumn(index, target) {
  const ids = state.columns[index];
  if (!ids) return;

  if (ids.length === 1 && !get('show_root')) {
    getChildrenFunction({ id: ids[0] })((result) => {
      if (!state.columns[index]) return;
      renderAll(result, target);
      if (addColumnHandlers) addColumnHandlers(index, target);
    });
  } else if (ids.length > 0) {
    let i = 0;
    const nodes = [];
    // Get all nodes for column
    const callback = (result) => {
      if (!state.columns[index]) return;

      for (let j = 0; j < result.length; j++) nodes.push(result[j]);
      i++;
      if (i < ids.length) {
        getSubTree(ids[i], callback);
      } else {
        // Render node list
        renderAll(nodes, target, true);
        if (addColumnHandlers) addColumnHandlers(index, target);
      }
    };
    getSubTree(ids[i], callback);
  }
}

// These will be set by shim after interaction module loads
let addColumnHandlersFn = null;

export function setAddColumnHandlers(fn) {
  addColumnHandlersFn = fn;
}