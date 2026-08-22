"use strict";

// vim.js - Vim-style keyboard navigation, theme picker, clipboard

// State
var vimCursor = { x: 0, y: 0 };
var vimEl = null;
var vimPending = null;
var vimPendingTimer = null;
var vimSelected = new Set();
var clipboard = { ids: [], mode: null };

// Helpers
function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// Depth-first traversal of all visible <a> elements in a column
function getVisibleLinks(x) {
  var column = document.getElementsByClassName("column")[x];
  if (!column) return [];
  var first = column.firstChild;
  if (!first) return [];

  var container;
  if (first.tagName === "UL") {
    container = first;
  } else if (first.tagName === "DIV" && first.firstChild) {
    container = first.firstChild;
  } else {
    return [];
  }

  var links = [];
  collectLinks(container, links);
  return links;
}

function collectLinks(container, links) {
  for (var i = 0; i < container.children.length; i++) {
    var li = container.children[i];
    if (li.tagName !== "LI") continue;
    var a = li.firstChild;
    if (a && a.tagName === "A") {
      links.push(a);
    }
    // recurse into open folder children
    var next = a ? a.nextSibling : null;
    if (next && next.tagName === "DIV" && next.firstChild) {
      collectLinks(next.firstChild, links);
    }
  }
}

function getCursorRow(x) {
  var links = getVisibleLinks(x);
  if (!links || links.length === 0 || vimCursor.y < 0 || vimCursor.y >= links.length) {
    return (columns[x] && columns[x].length) ? columns[x].length : 0;
  }
  var el = links[vimCursor.y];
  var curr = el;
  while (curr && curr !== document.body) {
    if (curr._vimNode && curr._vimNode.id && coords[curr._vimNode.id] !== undefined) {
      return coords[curr._vimNode.id].y;
    }
    if (curr.tagName === "LI" && curr.firstChild && curr.firstChild._vimNode) {
      var id = curr.firstChild._vimNode.id;
      if (coords[id] !== undefined) {
        return coords[id].y;
      }
    }
    curr = curr.parentNode;
  }
  return (columns[x] && columns[x].length) ? columns[x].length : 0;
}

function updateCursorVisuals() {
  if (vimEl) vimEl.classList.remove("vim-cursor");
  vimEl = null;

  var links = getVisibleLinks(vimCursor.x);
  if (vimCursor.y >= 0 && vimCursor.y < links.length) {
    vimEl = links[vimCursor.y];
    vimEl.classList.add("vim-cursor");
    vimEl.scrollIntoView({ block: "nearest" });
  }

  var allLinks = document.querySelectorAll("#main a");
  for (var i = 0; i < allLinks.length; i++) {
    var link = allLinks[i];
    var id = link._vimNode && link._vimNode.id;
    if (id && vimSelected.has(id)) {
      link.classList.add("vim-selected");
    } else {
      link.classList.remove("vim-selected");
    }
  }
}

function resolveCursor() {
  if (!columns || columns.length === 0) return;
  vimCursor.x = clamp(vimCursor.x, 0, columns.length - 1);
  var links = getVisibleLinks(vimCursor.x);
  vimCursor.y = clamp(vimCursor.y, 0, Math.max(0, links.length - 1));
  updateCursorVisuals();
}

function moveCursor(dx, dy) {
  if (dx !== 0) {
    vimCursor.x = clamp(vimCursor.x + dx, 0, columns.length - 1);
    var links = getVisibleLinks(vimCursor.x);
    vimCursor.y = clamp(vimCursor.y, 0, Math.max(0, links.length - 1));
  }
  if (dy !== 0) {
    var curLinks = getVisibleLinks(vimCursor.x);
    vimCursor.y = clamp(vimCursor.y + dy, 0, Math.max(0, curLinks.length - 1));
  }
  updateCursorVisuals();
}

// Activation
function vimActivate() {
  if (!vimEl) return;
  var isFolder = vimEl.classList.contains("folder");
  if (isFolder) {
    var node = vimEl._vimNode;
    if (node) toggle(node, vimEl);
  } else {
    vimEl.dispatchEvent(new MouseEvent("click"));
  }
}

function vimOpenFolder() {
  if (!vimEl || !vimEl.classList.contains("folder")) return;
  var node = vimEl._vimNode;
  if (node) toggle(node, vimEl);
}

// Bookmark duplication
async function copyBookmarkSubtree(sourceId, destParentId) {
  var results = await new Promise(function (resolve) {
    chrome.bookmarks.getSubTree(sourceId, (res) => {
      if (chrome.runtime.lastError) {
        console.warn(chrome.runtime.lastError);
        resolve(null);
      }
      else resolve(res);
    });
  });
  if (!results || results.length === 0) return null;
  var rootNode = results[0];

  async function recursiveClone(node, parentId) {
    var newNode;
    if (node.url) {
      newNode = await chrome.bookmarks.create({
        parentId: parentId,
        title: node.title,
        url: node.url,
      });
    } else {
      newNode = await chrome.bookmarks.create({
        parentId: parentId,
        title: node.title,
      });
      if (node.children) {
        for (var i = 0; i < node.children.length; i++) {
          await recursiveClone(node.children[i], newNode.id);
        }
      }
    }
    return newNode;
  }

  return await recursiveClone(rootNode, destParentId);
}

// Clipboard
function vimGetTargetIds() {
  if (vimSelected.size > 0) return Array.from(vimSelected);
  if (vimEl && vimEl._vimNode) return [vimEl._vimNode.id];
  return [];
}

function vimYank() {
  var ids = vimGetTargetIds();
  if (ids.length > 0) {
    clipboard = { ids: ids, mode: "copy" };
  }
  vimSelected.clear();
  updateCursorVisuals();
}

function vimCut() {
  var ids = vimGetTargetIds();
  if (ids.length === 0) return;
  clipboard = { ids: ids, mode: "cut" };
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    if (coords[id]) removeRow(coords[id].x, coords[id].y);
  }
  vimSelected.clear();
  vimCursor.y = clamp(vimCursor.y - 1, 0, getVisibleLinks(vimCursor.x).length - 1);
  updateCursorVisuals();
}

function vimDelete() {
  if (!vimEl) return;

  var ids = vimGetTargetIds();
  if (ids.length === 0) return;
  clipboard = { ids: ids, mode: "delete" };
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    if (coords[id]) removeRow(coords[id].x, coords[id].y);
  }
  vimSelected.clear();
  vimCursor.y = clamp(vimCursor.y - 1, 0, getVisibleLinks(vimCursor.x).length - 1);
  updateCursorVisuals();
}

async function vimPasteAt(destY) {
  if (clipboard.ids.length === 0) return;
  var destX = vimCursor.x;
  if (clipboard.mode === "cut") {
    for (var i = 0; i < clipboard.ids.length; i++) {
      addRow(clipboard.ids[i], destX, destY + i);
    }
    return;
  }
  for (var i = 0; i < clipboard.ids.length; i++) {
    var id = clipboard.ids[i];
    var added = false;
    if (/^\d+$/.test(id)) {
      try {
        var results = await new Promise(function (resolve) {
          chrome.bookmarks.getSubTree(id, function (res) {
            if (chrome.runtime.lastError) {
              console.warn(chrome.runtime.lastError);
              resolve(null);
            } else resolve(res);
          });
        });
        if (results && results[0]) {
          var parentId = results[0].parentId;
          if (!parentId && columns[0] && columns[0].length > 0) {
            parentId = columns[0][0];
          }
          if (parentId) {
            var newNode = await copyBookmarkSubtree(id, parentId);
            if (newNode && newNode.id) {
              addRow(newNode.id, destX, targetY + i);
              added = true;
            }
          }
        }
      } catch (e) { }
    }
    if (!added) {
      addRow(id, destX, targetY + i);
    }
  }
}

function vimPaste(asColumn) {
  if (asColumn) return addColumn(clipboard.ids, destX + 1);
  return vimPasterAt(getCursorRow(vimCursor.x));
}

async function vimPasteAbove() {
  return vimPasteAt(getCursorRow(vimCursor.x));
}

// Theme picker
function vimShowThemePicker() {
  var items = [];
  var current = getConfig("theme");
  var names = Object.keys(themes);
  for (var i = 0; i < names.length; i++) {
    (function (name) {
      items.push({
        label: (name === current ? "\u25cf " : "  ") + name,
        action: function () {
          setConfig("theme", name);
        },
      });
    })(names[i]);
  }

  var x = 100,
    y = 100;
  if (vimEl) {
    var rect = vimEl.getBoundingClientRect();
    x = rect.left + window.scrollX;
    y = rect.bottom + window.scrollY;
  }
  renderMenu(items, x, y);
}

// Key handler
document.addEventListener("keydown", function (event) {
  var tag = event.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
  if (document.querySelector(".menu")) return;

  var key = event.key;

  if (event.ctrlKey) {
    return;
  }

  // multi-key buffer: g → gg
  if (vimPending === "g") {
    clearTimeout(vimPendingTimer);
    vimPending = null;
    if (key === "g") {
      vimCursor.x = 0;
      vimCursor.y = 0;
      resolveCursor();
      event.preventDefault();
      return;
    }
    // fall through - first g is discarded
  }

  switch (key) {
    case "ArrowLeft":
    case "h":
      moveCursor(-1, 0);
      event.preventDefault();
      break;
    case "ArrowRight":
    case "l":
      moveCursor(1, 0);
      event.preventDefault();
      break;
    case 'ArrowDown':
    case "j":
      moveCursor(0, 1);
      event.preventDefault();
      break;
    case 'ArrowUp':
    case "k":
      moveCursor(0, -1);
      event.preventDefault();
      break;
    case "Enter":
    case "o":
      vimActivate();
      event.preventDefault();
      break;
    case "O":
      vimOpenFolder();
      event.preventDefault();
      break;
    // TODO: Additional Features, review and implement

    // case "g":
    //   vimPending = "g";
    //   vimPendingTimer = setTimeout(function () {
    //     vimPending = null;
    //   }, 500);
    //   event.preventDefault();
    //   break;
    // case "G":
    //   vimCursor.x = columns.length - 1;
    //   vimCursor.y = Math.max(0, getVisibleLinks(vimCursor.x).length - 1);
    //   resolveCursor();
    //   event.preventDefault();
    //   break;
    // case "v":
    //   if (vimEl && vimEl._vimNode) {
    //     var id = vimEl._vimNode.id;
    //     if (vimSelected.has(id)) vimSelected.delete(id);
    //     else vimSelected.add(id);
    //     updateCursorVisuals();
    //   }
    //   event.preventDefault();
    //   break;
    // case "V":
    //   vimSelected.clear();
    //   updateCursorVisuals();
    //   event.preventDefault();
    //   break;
    // case "y":
    //   vimYank();
    //   event.preventDefault();
    //   break;
    // case "d":
    // case "x":
    //   vimCut();
    //   event.preventDefault();
    //   break;
    // case "C":
    //   removeColumn(vimCursor.x);
    //   break;
    // case "p":
    //   vimPaste(false);
    //   event.preventDefault();
    //   break;
    // case "P":
    //   vimPasteAbove();
    //   event.preventDefault();
    //   break;
    // case "T":
    //   vimShowThemePicker();
    //   event.preventDefault();
    //   break;
    // case "Escape":
    //   vimSelected.clear();
    //   updateCursorVisuals();
    //   break;
  }
});

// Re-render hook
var vimObserver = new MutationObserver(function () {
  resolveCursor();
});

function vimInit() {
  var main = document.getElementById("main");
  if (main) {
    vimObserver.observe(main, { childList: true, subtree: true });
  }
  resolveCursor();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", vimInit);
} else {
  vimInit();
}
