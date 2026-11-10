import * as chromeApi from '../chrome-api.js';
import { emit, Events } from '../events.js';
import { isSpecial, getSpecialNode } from './special-nodes.js';


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
          // The bookmark is gone. Report it and let the layout layer drop the
          // grid entry — tree.js must not reach into layout state.
          emit(Events.BOOKMARK_MISSING, node.id);
          callback([]);
        }
      },
      () => {
        emit(Events.BOOKMARK_MISSING, node.id);
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
      else emit(Events.BOOKMARK_MISSING, id);
    },
    () => emit(Events.BOOKMARK_MISSING, id)
  );
}

