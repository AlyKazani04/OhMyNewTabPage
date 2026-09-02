"use strict";

// vim.js - Vim-style keyboard navigation, bookmark CRUD, clipboard and theme picker
//
// Depends on globals from newtab.js (loaded first):
//   columns, root, special, toggle, saveColumns, renderColumns,
//   getConfig, setConfig, themes, showOptions, renderMenu
// Now uses core modules for vim state and Chrome APIs via shim globals

// Vim state is now in core/state.js (exposed via shim as window.state, window.getters, window.mutations):
// state.vimCursor, state.vimEl, state.vimSelected, state.clipboard, state.vimPendingRestore
// Access via state.* or getters.*; mutate via mutations.*

// ---------------------------------------------------------------------------
// traversal and cursor
// ---------------------------------------------------------------------------

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

// depth-first traversal of all visible <a> elements in a column
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

// top-level row (within its column) of the item under the cursor
function getCursorTopLevelRow() {
  var fallback = columns[state.vimCursor.x] ? columns[state.vimCursor.x].length : 0;
  if (!state.vimEl) return fallback;
  // climb to the <ul> that sits directly under the column
  var ul = state.vimEl.parentNode;
  while (
    ul &&
    !(
      ul.tagName === "UL" &&
      ul.parentNode.classList &&
      ul.parentNode.classList.contains("column")
    )
  )
    ul = ul.parentNode;
  if (!ul) return fallback;
  // descend from the anchor to the top-level <li>
  var li = state.vimEl;
  while (li && li.parentNode !== ul) li = li.parentNode;
  if (!li || li.tagName !== "LI") return fallback;
  var row = 0;
  var sibling = li.previousElementSibling;
  while (sibling) {
    if (sibling.tagName === "LI") row++;
    sibling = sibling.previousElementSibling;
  }
  return row;
}

function updateCursorVisuals() {
  if (state.vimEl) state.vimEl.classList.remove("vim-cursor");
  mutations.setVimEl(null);

  var links = getVisibleLinks(state.vimCursor.x);
  if (state.vimCursor.y >= 0 && state.vimCursor.y < links.length) {
    mutations.setVimEl(links[state.vimCursor.y]);
    state.vimEl.classList.add("vim-cursor");
    state.vimEl.scrollIntoView({ block: "nearest" });
  }

  var cutting = state.clipboard.mode === "cut";
  var allLinks = document.querySelectorAll("#main a");
  for (var i = 0; i < allLinks.length; i++) {
    var link = allLinks[i];
    var id = link._vimNode && link._vimNode.id;
    if (id && state.vimSelected.has(id)) {
      link.classList.add("vim-selected");
    } else {
      link.classList.remove("vim-selected");
    }
    if (cutting && id && state.clipboard.ids.indexOf(id) > -1) {
      link.classList.add("vim-cut");
    } else {
      link.classList.remove("vim-cut");
    }
  }
}

function resolveCursor() {
  if (!columns || columns.length === 0) return;
  mutations.setVimCursor(clamp(state.vimCursor.x, 0, columns.length - 1), state.vimCursor.y);
  if (state.vimPendingRestore != null) restoreCursor(state.vimPendingRestore);
  var links = getVisibleLinks(state.vimCursor.x);
  mutations.setVimCursor(state.vimCursor.x, clamp(state.vimCursor.y, 0, Math.max(0, links.length - 1)));
  updateCursorVisuals();
}

// put the cursor back on node id after a re-render (retried until rendered)
function scheduleRestore(id) {
  mutations.setVimPendingRestore(id);
  setTimeout(function () {
    if (state.vimPendingRestore === id) mutations.clearVimPendingRestore();
  }, 2000);
}

function restoreCursor(id) {
  for (var x = 0; x < columns.length; x++) {
    if (columns[x].indexOf(id) === -1) continue;
    mutations.setVimCursor(x, state.vimCursor.y);
    var links = getVisibleLinks(x);
    for (var i = 0; i < links.length; i++) {
      if (links[i]._vimNode && links[i]._vimNode.id === id) {
        mutations.setVimCursor(x, i);
        break;
      }
    }
    mutations.clearVimPendingRestore();
    return;
  }
  // fallback: the id may live inside a rendered folder rather than the
  // layout grid (e.g. a child of a flattened single-folder column)
  for (var x = 0; x < columns.length; x++) {
    var links = getVisibleLinks(x);
    for (var i = 0; i < links.length; i++) {
      if (links[i]._vimNode && links[i]._vimNode.id === id) {
        mutations.setVimCursor(x, i);
        mutations.clearVimPendingRestore();
        return;
      }
    }
  }
}

function moveCursor(dx, dy) {
  if (!columns || columns.length === 0) return;
  if (dx !== 0) {
    mutations.setVimCursor(clamp(state.vimCursor.x + dx, 0, columns.length - 1), state.vimCursor.y);
    var links = getVisibleLinks(state.vimCursor.x);
    mutations.setVimCursor(state.vimCursor.x, clamp(state.vimCursor.y, 0, Math.max(0, links.length - 1)));
  }
  if (dy !== 0) {
    var curLinks = getVisibleLinks(state.vimCursor.x);
    mutations.setVimCursor(state.vimCursor.x, clamp(state.vimCursor.y + dy, 0, Math.max(0, curLinks.length - 1)));
  }
  updateCursorVisuals();
}

// ---------------------------------------------------------------------------
// activation
// ---------------------------------------------------------------------------

function vimActivate() {
  if (!state.vimEl) return;
  var isFolder = state.vimEl.classList.contains("folder");
  if (isFolder) {
    var node = state.vimEl._vimNode;
    if (node) toggle(node, state.vimEl);
  } else {
    state.vimEl.dispatchEvent(new MouseEvent("click"));
  }
}

function vimOpenFolder() {
  if (!state.vimEl || !state.vimEl.classList.contains("folder")) return;
  var node = state.vimEl._vimNode;
  if (node) toggle(node, state.vimEl);
}

// ---------------------------------------------------------------------------
// modal dialog
// ---------------------------------------------------------------------------

function showModal(options) {
  var prevFocus = document.activeElement;

  var backdrop = document.createElement("div");
  backdrop.className = "vim-modal-backdrop";

  var form = document.createElement("form");
  form.className = "vim-modal";

  var heading = document.createElement("div");
  heading.className = "vim-modal-title";
  heading.innerText = options.title;
  form.appendChild(heading);

  var inputs = [];
  for (var i = 0; i < options.fields.length; i++) {
    (function (field) {
      var label = document.createElement("label");
      label.className = "vim-modal-field";
      var p = document.createElement("p");
      p.innerText = field.label;
      var input = document.createElement("input");
      input.type = "text";
      input.placeholder = field.placeholder || "";
      input.value = field.value || "";
      label.appendChild(p);
      label.appendChild(input);
      form.appendChild(label);
      inputs.push(input);
    })(options.fields[i]);
  }

  var buttons = document.createElement("div");
  buttons.className = "vim-modal-buttons";
  var cancel = document.createElement("button");
  cancel.type = "button";
  cancel.innerText = "Cancel";
  cancel.onclick = close;
  var submit = document.createElement("button");
  submit.type = "submit";
  submit.innerText = options.submitLabel || "Submit";
  buttons.appendChild(cancel);
  buttons.appendChild(submit);
  form.appendChild(buttons);

  function close() {
    if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
    document.removeEventListener("keydown", onKeyDown, true);
    if (prevFocus && prevFocus.isConnected && prevFocus.focus) prevFocus.focus();
  }

  function onKeyDown(event) {
    if (event.key === "Escape") {
      event.stopPropagation();
      close();
    }
  }

  form.onsubmit = function (event) {
    event.preventDefault();
    var values = [];
    for (var i = 0; i < inputs.length; i++) values.push(inputs[i].value.trim());
    if (!options.onSubmit(values)) return;
    close();
  };

  backdrop.onmousedown = function (event) {
    if (event.target === backdrop) close();
    return false;
  };

  document.addEventListener("keydown", onKeyDown, true);
  backdrop.appendChild(form);
  document.body.appendChild(backdrop);
  if (inputs.length > 0) inputs[0].focus();
  else cancel.focus();
}

// ---------------------------------------------------------------------------
// bookmark api helpers (now from core/chrome-api.js)
// ---------------------------------------------------------------------------

function isRealBookmarkId(id) {
  return /^\d+$/.test(String(id));
}

function normalizeUrl(url) {
  url = url.trim();
  if (url && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) url = "https://" + url;
  return url;
}

// ---------------------------------------------------------------------------
// creation and editing
// ---------------------------------------------------------------------------

function getDefaultParentId() {
  if (root) {
    for (var i = 0; i < root.length; i++) {
      if (special.indexOf(root[i]) < 0 && /^\d+$/.test(root[i])) return root[i];
    }
  }
  return "1";
}

// resolves the real bookmark folder containing the given list item
function findParentFolderId(li) {
  var ul = li.parentNode;
  if (!ul || ul.tagName !== "UL") return null;
  var div = ul.parentNode;
  if (!div || div.tagName !== "DIV") return null;
  var prevA = div.previousElementSibling;
  if (prevA && prevA.tagName === "A" && prevA._vimNode &&
    prevA._vimNode.children && special.indexOf(prevA._vimNode.id) < 0) {
    return prevA._vimNode.id;
  }
  return null;
}

// where a newly created item should go: parent folder + optional anchor node
function getInsertionContext() {
  var context = { parentId: getDefaultParentId(), afterId: null };
  if (!(state.vimEl && state.vimEl._vimNode)) return context;
  var parentId = findParentFolderId(state.vimEl.parentNode);
  if (parentId) context.parentId = parentId;
  if (state.vimEl._vimNode.id !== "empty") context.afterId = state.vimEl._vimNode.id;
  return context;
}

function createNodeDialog(isFolder) {
  var context = getInsertionContext();
  var fields = isFolder
    ? [{ label: "Name", placeholder: "New folder" }]
    : [
      { label: "Name", placeholder: "Example" },
      { label: "URL", placeholder: "example.com" },
    ];
  showModal({
    title: isFolder ? "New folder" : "New bookmark",
    fields: fields,
    submitLabel: "Create",
    onSubmit: function (values) {
      var title = values[0].trim();
      var props = { parentId: context.parentId };
      if (isFolder) {
        if (!title) return false;
        props.title = title;
      } else {
        var url = normalizeUrl(values[1]);
        if (!url) return false;
        props.title = title || url;
        props.url = url;
      }
      createBookmarkAt(props, context.afterId);
      return true;
    },
  });
}

// creates the bookmark, inserting it after afterId when given
function createBookmarkAt(props, afterId) {
  var finish = function (index) {
    if (index != null) props.index = index;
    bmCreate(props).then(function (result) {
      if (!result) {
        console.warn("create failed");
      } else if (result) scheduleRestore(result.id);
      renderColumns();
    });
  };
  if (!afterId) return finish(null);
  bmGet(afterId).then(function (results) {
    // only reuse the anchor index when it belongs to the same parent folder
    var index =
      results &&
        results[0] &&
        results[0].parentId === props.parentId &&
        results[0].index != null
        ? results[0].index + 1
        : null;
    finish(index);
  }, function () {
    finish(null);
  });
}

function editNodeDialog() {
  if (!state.vimEl || !state.vimEl._vimNode) return;
  var node = state.vimEl._vimNode;
  if (!isRealBookmarkId(node.id)) return; // virtual nodes are not editable
  var isFolder = state.vimEl.classList.contains("folder");
  var fields = isFolder
    ? [{ label: "Name", placeholder: "Folder name", value: node.title }]
    : [
      { label: "Name", placeholder: "Bookmark name", value: node.title },
      { label: "URL", placeholder: "example.com", value: node.url },
    ];
  showModal({
    title: isFolder ? "Edit folder" : "Edit bookmark",
    fields: fields,
    submitLabel: "Save",
    onSubmit: function (values) {
      var props = {};
      if (isFolder) {
        var title = values[0].trim();
        if (!title) return false;
        props.title = title;
      } else {
        var url = normalizeUrl(values[1]);
        if (!url) return false;
        props.title = values[0].trim() || url;
        props.url = url;
      }
      bmUpdate(node.id, props).then(function () {
        if (chrome.runtime.lastError)
          console.warn("edit failed:", chrome.runtime.lastError.message);
        else scheduleRestore(node.id);
        renderColumns();
      });
      return true;
    },
  });
}

// ---------------------------------------------------------------------------
// deletion
// ---------------------------------------------------------------------------

function vimDelete() {
  if (!state.vimEl || !state.vimEl._vimNode) return;
  var ids = vimGetTargetIds(); // already filtered to real bookmarks
  if (ids.length === 0) return;
  var message;
  if (state.vimSelected.size === 0) {
    var node = state.vimEl._vimNode;
    message = 'Delete "' + (node.title || node.url || "this item") + '"?';
  } else {
    message = "Delete " + ids.length + " selected item(s)?";
  }
  showModal({
    title: message,
    fields: [],
    submitLabel: "Delete",
    onSubmit: function () {
      deleteBookmarksByIds(ids);
      return true;
    },
  });
}

function deleteBookmarksByIds(ids) {
  var next = function (i) {
    if (i >= ids.length) {
      // prune layout entries for deleted top-level items instead of letting
      // the renderer discover them missing
      var topLevel = ids.filter(function (id) {
        return state.coords[id];
      });
      if (topLevel.length > 0) {
        removeFromLayout(topLevel);
        saveColumns();
      } else {
        renderColumns();
      }
      return;
    }
    bmGet(ids[i]).then(function (results) {
      if (!results || !results[0]) {
        next(i + 1);
        return;
      }
      var done = function () {
        if (chrome.runtime.lastError)
          console.warn("delete failed:", chrome.runtime.lastError.message);
        next(i + 1);
      };
      if (results[0].url) bmRemove(ids[i]).then(done);
      else bmRemoveTree(ids[i]).then(done);
    });
  };
  next(0);
}

// ---------------------------------------------------------------------------
// layout manipulation (batched: one save + re-render per operation)
// ---------------------------------------------------------------------------

// removes ids from the column layout
function removeFromLayout(ids) {
  for (var x = columns.length - 1; x >= 0; x--) {
    var col = columns[x];
    for (var y = col.length - 1; y >= 0; y--) {
      if (ids.indexOf(col[y]) > -1) col.splice(y, 1);
    }
    if (col.length === 0) columns.splice(x, 1);
  }
}

// moves ids into column x at row y and saves (single re-render)
function placeInLayout(ids, x, y) {
  for (var i = columns.length - 1; i >= 0; i--) {
    var col = columns[i];
    for (var j = col.length - 1; j >= 0; j--) {
      if (ids.indexOf(col[j]) > -1) col.splice(j, 1);
    }
    if (col.length === 0) {
      columns.splice(i, 1);
      if (i < x) x--;
    }
  }
  while (columns.length <= x) columns.push([]);
  if (y == null || y > columns[x].length) y = columns[x].length;
  if (y < 0) y = 0;
  Array.prototype.splice.apply(columns[x], [y, 0].concat(ids));
  saveColumns();
}

// ---------------------------------------------------------------------------
// clipboard
// ---------------------------------------------------------------------------

// only real bookmark folders/items may be clipped; virtual nodes ("top",
// "empty", "device.X") and permanent roots would only produce API errors
function clipTargetableId(id) {
  return isRealBookmarkId(id) && Array.isArray(root) && root.indexOf(id) < 0;
}

function vimGetTargetIds() {
  var ids =
    state.vimSelected.size > 0
      ? Array.from(state.vimSelected)
      : state.vimEl && state.vimEl._vimNode
        ? [state.vimEl._vimNode.id]
        : [];
  return ids.filter(clipTargetableId);
}

function vimToggleSelect() {
  if (!state.vimEl || !state.vimEl._vimNode) return;
  if (!clipTargetableId(state.vimEl._vimNode.id)) return;
  var id = state.vimEl._vimNode.id;
  if (state.vimSelected.has(id)) mutations.removeVimSelected(id);
  else mutations.addVimSelected(id);
  updateCursorVisuals();
}

function vimClearSelection() {
  if (state.vimSelected.size === 0) return;
  mutations.clearVimSelected();
  updateCursorVisuals();
}

function vimCancelClipboard() {
  if (state.clipboard.mode == null && state.clipboard.ids.length === 0) return;
  mutations.clearClipboard();
  updateCursorVisuals();
}

function vimYank() {
  var ids = vimGetTargetIds();
  if (ids.length === 0) return; // keep any pending clipboard untouched
  mutations.setClipboard(ids, "copy");
  vimClearSelection();
  updateCursorVisuals();
}

// cut marks the items; nothing moves until they are pasted somewhere
function vimCut() {
  var ids = vimGetTargetIds();
  if (ids.length === 0) return;
  mutations.setClipboard(ids, "cut");
  vimClearSelection();
  updateCursorVisuals();
}

// paste relative to the item under the cursor, inside whatever folder it
// lives in; folders paste beside as siblings like any other item
function vimPaste(below) {
  if (state.clipboard.mode == null || state.clipboard.ids.length === 0) return;
  pasteBatch(state.clipboard.mode, state.clipboard.ids.slice(0), below);
}

// resolves the paste destination from the cursor position:
//   {anchorId, below} - insert before/after that bookmark node
//   {parentId}        - append to that folder
function getPasteDestination(below) {
  if (!(state.vimEl && state.vimEl._vimNode))
    return Promise.resolve({ parentId: getDefaultParentId() });
  var node = state.vimEl._vimNode;
  if (node.id === "empty")
    return Promise.resolve({
      parentId: findParentFolderId(state.vimEl.parentNode) || getDefaultParentId(),
    });
  if (!clipTargetableId(node.id))
    return Promise.resolve({ parentId: getDefaultParentId() });
  return bmGet(node.id).then(function (results) {
    if (!results || !results[0])
      return { parentId: getDefaultParentId() };
    return { anchorId: node.id, below: !!below };
  });
}

async function pasteBatch(mode, ids, below) {
  var dest = await getPasteDestination(below);

  var parentId = null; // resolved destination folder (set once known)
  var base = null; // copy mode: static insertion index, null = append

  if (!dest.anchorId) {
    parentId = dest.parentId;
  } else if (mode !== "cut") {
    // copy mode inserts fresh clones at static positions relative to the
    // anchor; cut mode re-reads the live anchor before every move instead
    var anc0 = await bmGet(dest.anchorId);
    if (!anc0 || !anc0[0]) return;
    parentId = anc0[0].parentId;
    base = anc0[0].index + (below ? 1 : 0);
  }

  var par = parentId ? await bmGet(parentId) : null;
  var len = par && par[0] && par[0].children ? par[0].children.length : 0;

  var done = [];
  for (var i = 0; i < ids.length; i++) {
    if (mode === "cut") {
      var src = await bmGet(ids[i]);
      if (!src || !src[0]) continue;
      var props;
      if (dest.anchorId) {
        // inserting directly above the live anchor stacks items in order;
        // below the anchor needs the running offset to clear earlier moves
        var anc = await bmGet(dest.anchorId);
        if (!anc || !anc[0]) break;
        props = {
          parentId: anc[0].parentId,
          index: below ? anc[0].index + 1 + i : anc[0].index,
        };
      } else {
        props = { parentId: parentId, index: null };
      }
      if (!parentId) parentId = props.parentId;
      var moved = await bmMove(ids[i], props);
      if (!moved) continue;
      done.push(moved.id);
    } else {
      if (!clipTargetableId(ids[i])) continue;
      var created = await copyBookmarkSubtree(
        ids[i],
        parentId,
        base == null ? null : Math.max(0, Math.min(base + i, len)),
      );
      if (!created) continue;
      len++;
      done.push(created.id);
    }
  }

  mutations.clearClipboard();
  if (done.length > 0) syncLayoutAfterPaste(done, parentId, below);
  else updateCursorVisuals();
}

// keeps the page layout grid in step with tree-level changes:
// items pasted at top level show up at the cursor's spot, items pasted
// inside a folder leave the top level
function syncLayoutAfterPaste(ids, parentId, below) {
  // flattened column: a lone root folder rendered as its own contents
  // (single-folder column with "show top-level folders" off); pasted items
  // become children of that folder, not stored grid entries
  var flatX = -1;
  if (!getConfig("show_root")) {
    for (var x = 0; x < columns.length; x++) {
      if (columns[x].length === 1 && columns[x][0] === parentId) {
        flatX = x;
        break;
      }
    }
  }
  if (flatX > -1) {
    scheduleRestore(ids[0]);
    saveColumns(); // triggers the re-render
  } else if (state.vimEl && state.vimEl._vimNode && state.coords && state.coords[state.vimEl._vimNode.id]) {
    // top level (stored in the layout grid): land the cursor on the first pasted item once rendered
    scheduleRestore(ids[0]);
    var pos = state.coords[state.vimEl._vimNode.id];
    placeInLayout(ids, pos.x, below ? pos.y + 1 : pos.y);
  } else {
    // nested destination: items leave the page grid; the cursor simply
    // stays where it is
    removeFromLayout(ids);
    saveColumns(); // triggers the re-render
  }
}

// true when the id is a stored grid entry
function inColumns(id) {
  for (var x = 0; x < columns.length; x++) {
    if (columns[x].indexOf(id) > -1) return true;
  }
  return false;
}

// mouse support (#2): drop a bookmark onto a folder header to move it there
function folderMoveDrop(dragIds, folderNodeId) {
  if (!folderNodeId || !isRealBookmarkId(folderNodeId)) return;
  var ids = (dragIds || []).filter(function (id) {
    return clipTargetableId(id) && id !== folderNodeId;
  });
  if (ids.length === 0) return;
  var movedIds = [];
  var next = function (i) {
    if (i >= ids.length) {
      // only prune layout entries that actually moved - failed moves (e.g.
      // dropping a folder into its own descendant) must stay on the page
      if (movedIds.length > 0) {
        removeFromLayout(movedIds);
        saveColumns(); // triggers the re-render
      }
      return;
    }
    bmMove(ids[i], { parentId: folderNodeId }).then(function (moved) {
      if (moved) movedIds.push(ids[i]);
      next(i + 1);
    });
  };
  next(0);
}

// deep-copies a bookmark subtree, resolves to the new root node (or null);
// index optionally positions the clone within destParentId
function copyBookmarkSubtree(sourceId, destParentId, index) {
  function cloneNode(node, parentId, position) {
    var props = { parentId: parentId, title: node.title };
    if (node.url) props.url = node.url;
    if (position != null) props.index = position;
    return bmCreate(props).then(function (created) {
      if (!created || !node.children) return created;
      var chain = Promise.resolve(null);
      node.children.forEach(function (child) {
        chain = chain.then(function () {
          return cloneNode(child, created.id);
        });
      });
      return chain.then(function () {
        return created;
      });
    });
  }
  return bmGetSubTree(sourceId).then(
    function (results) {
      if (!results || !results[0]) return null;
      return cloneNode(results[0], destParentId, index);
    },
    function () {
      return null;
    },
  );
}

// ---------------------------------------------------------------------------
// theme picker
// ---------------------------------------------------------------------------

function vimShowThemePicker() {
  var items = [];
  var current = getConfig("theme");
  var names = Object.keys(themes);
  for (var i = 0; i < names.length; i++) {
    (function (name) {
      items.push({
        label: (name === current ? "\u25cf " : "  ") + name,
        selected: name === current,
        action: function () {
          setConfig("theme", name);
        },
      });
    })(names[i]);
  }

  var x = 100,
    y = 100;
  if (state.vimEl) {
    var rect = state.vimEl.getBoundingClientRect();
    x = rect.left + window.scrollX;
    y = rect.bottom + window.scrollY;
  }
  renderMenu(items, x, y, "Theme picker");
}

// ---------------------------------------------------------------------------
// key bindings
// ---------------------------------------------------------------------------

document.addEventListener("keydown", function (event) {
  // options panel: Esc closes it, other keys are ignored while it is open
  // (checked before the input guard so Esc works from inside panel controls)
  if (document.getElementById("options").style.display === "block") {
    if (event.key === "Escape") {
      showOptions(false);
      event.preventDefault();
    }
    return;
  }

  var tag = event.target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

  // popup menus and modals handle their own keys
  if (
    document.querySelector(".menu") ||
    document.querySelector(".vim-modal-backdrop")
  )
    return;

  if (event.ctrlKey || event.altKey || event.metaKey) return;

  var handled = true;
  switch (event.key) {
    case "ArrowLeft":
    case "h":
      moveCursor(-1, 0);
      break;
    case "ArrowRight":
    case "l":
      moveCursor(1, 0);
      break;
    case "ArrowDown":
    case "j":
      moveCursor(0, 1);
      break;
    case "ArrowUp":
    case "k":
      moveCursor(0, -1);
      break;
    case "Enter":
    case "o":
      vimActivate();
      break;
    case "O":
      vimOpenFolder();
      break;
    case "n":
      createNodeDialog(false);
      break;
    case "N":
      createNodeDialog(true);
      break;
    case "e":
      editNodeDialog();
      break;
    case "d":
      vimDelete();
      break;
    case "v":
      vimToggleSelect();
      break;
    case "V":
      vimClearSelection();
      break;
    case "y":
      vimYank();
      break;
    case "x":
      vimCut();
      break;
    case "p":
      vimPaste(true); // below / after
      break;
    case "P":
      vimPaste(false); // above / before
      break;
    case "T":
      vimShowThemePicker();
      break;
    case "/":
      showOptions(true);
      break;
    case "Escape":
      vimClearSelection();
      vimCancelClipboard();
      break;
    default:
      handled = false;
  }
  if (handled) event.preventDefault();
});

// ---------------------------------------------------------------------------
// re-render hook
// ---------------------------------------------------------------------------

var vimRafPending = false;
var vimObserver = new MutationObserver(function () {
  if (vimRafPending) return;
  vimRafPending = true;
  requestAnimationFrame(function () {
    vimRafPending = false;
    resolveCursor();
  });
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
