import * as chromeApi from '../chrome-api.js';
import { removeRow } from './layout.js';
import { isSpecial, getSpecialNode } from './special-nodes.js';
import { state } from '../state.js';


// ----- TREE -----
// Gets function that returns children of node
export function getChildrenFunction(node) {
  if (isSpecial(node.id)) {
    const specialNode = getSpecialNode(node.id);
    const load = specialNode.children;
    return load || ((callback) => callback([]));
  }
  if (node.children) {
    return (callback) => callback(node.children);
  }
  return (callback) => {
    chromeApi.bmGetSubTree(node.id).then(
      (result) => {
        if (result) callback(result[0].children);
        else {
          // remove missing bookmark locations
          if (state.coords[node.id]) removeRow(state.coords[node.id].x, state.coords[node.id].y);
          callback([]);
        }
      },
      () => {
        if (state.coords[node.id]) removeRow(state.coords[node.id].x, state.coords[node.id].y);
        callback([]);
      }
    );
  };
}

// Gets the subtree for given id
export function getSubTree(id, callback) {
  if (isSpecial(id)) {
    const s = getSpecialNode(id);
    const node = { title: s.label, id };
    if (s.url) node.url = s.url;
    else node.children = true;
    callback([node]);
    return;
  }
  chromeApi.bmGetSubTree(id).then(
    (result) => {
      if (result) callback(result);
      else {
        // remove missing bookmark locations
        if (state.coords[id]) removeRow(state.coords[id].x, state.coords[id].y);
      }
    },
    () => {
      if (state.coords[id]) removeRow(state.coords[id].x, state.coords[id].y);
    }
  );
}

