# Migration Plan: Modularizing Oh My New Tab Page

> **Status: COMPLETE.** This plan is historical — all six phases shipped and the monolithic
> `newtab.js` / `vim.js` were removed. The current codebase lives under `src/` and is described
> in the root `AGENTS.md`. See "Migration Complete" at the bottom of this file.

## Current State

| File            | Lines | Role                                                             |
| --------------- | ----- | ---------------------------------------------------------------- |
| `newtab.js`     | 1,751 | Monolithic main module (rendering, state, config, bookmarks, UI) |
| `vim.js`        | 965   | Vim navigation, tightly coupled to `newtab.js` globals           |
| `newtab.html`   | 290   | HTML + inline options panel                                      |
| `newtab.css`    | 420   | Styles                                                           |
| `manifest.json` | 32    | Chrome extension manifest v3                                     |

**Key Problems:**

- 15+ globals shared from `newtab.js` → `vim.js` (columns, root, special, toggle, saveColumns, renderColumns, getConfig, setConfig, themes, showOptions, renderMenu, coords, getChildrenFunction, SPECIAL, clipTargetableId)
- Mixed concerns: rendering, state, Chrome APIs, config, UI all intertwined
- No module boundaries, everything in global scope
- Circular dependency: `renderColumns()` triggers `vim.js` MutationObserver

---

## Target Architecture

```
src/
├── core/              # Foundation (3 modules)
│   ├── state.js       # Centralized state store
│   ├── events.js      # Event bus for decoupled communication
│   └── chrome-api.js  # Promise-wrapped Chrome APIs
├── config/            # Configuration system (4 modules)
│   ├── schema.js      # Defaults, themes, validation
│   ├── storage.js     # localStorage read/write/migration
│   ├── styles.js      # CSS generation from config
│   └── ui.js          # Options panel initialization
├── bookmarks/         # Data layer (4 modules)
│   ├── special-nodes.js  # SPECIAL nodes (apps, top, recent, closed, devices)
│   ├── tree.js           # Tree operations (getSubTree, getChildrenFunction)
│   ├── crud.js           # Create, read, update, delete, move, copy
│   └── layout.js         # Column grid layout (addColumn, removeRow, verifyColumns)
├── render/            # Rendering system (6 modules)
│   ├── renderer.js    # Main orchestration (renderColumns)
│   ├── column.js      # Column rendering (renderColumn)
│   ├── node.js        # Single node rendering (render, renderAll)
│   ├── folder.js      # Folder toggle, animation
│   ├── icons.js       # Icon resolution
│   └── tooltips.js    # Tooltip management
├── interaction/       # Input handling (4 modules)
│   ├── context-menu.js  # Context menus (renderMenu, getMenuItems)
│   ├── drag-drop.js     # Drag & drop for columns/folders
│   ├── keyboard.js      # Vim key bindings
│   └── modal.js         # Modal dialogs
└── vim/               # Vim navigation (4 modules)
    ├── cursor.js      # Cursor state, movement, visuals
    ├── selection.js   # Multi-select, clipboard (yank/cut/paste)
    ├── actions.js     # High-level actions (create, edit, delete, theme picker)
    └── observer.js    # MutationObserver re-render hook
```

---

## Dependency Graph (Post-Migration)

```
core/state.js ◄──┐
core/events.js ◄─┼──► config/* ◄──► render/*
core/chrome-api.js     │              │
                       ▼              ▼
              bookmarks/* ◄──► interaction/*
                       │              │
                       ▼              ▼
                    vim/* ◄──────────┘
```

**Principles:**

1. **Unidirectional data flow** — State → Render → DOM
2. **Event-driven decoupling** — Modules communicate via `core/events.js`
3. **No circular dependencies** — `vim/*` imports from others, not vice versa
4. **Single responsibility** — Each module < 200 lines

---

## Phase Breakdown

### Phase 1: Core Infrastructure (Low Risk, High Value)

**Files:** 3 | **Est. Lines:** ~150 | **Duration:** 1-2 sessions

| Module               | Source                                    | Key Exports                                                                                                                       |
| -------------------- | ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `core/state.js`      | `newtab.js:872-874, 912` + `vim.js:13-18` | `state.columns`, `state.root`, `state.coords`, `state.vimCursor`, `state.vimSelected`, `state.clipboard`, `state.special`         |
| `core/events.js`     | New                                       | `on(event, handler)`, `emit(event, data)`, `off(event, handler)`                                                                  |
| `core/chrome-api.js` | `vim.js:289-310` + scattered              | `bmGet(id)`, `bmGetSubTree(id)`, `bmCreate(props)`, `bmMove(id, dest)`, `bmUpdate(id, props)`, `bmRemove(id)`, `bmRemoveTree(id)` |

**Validation:** All existing globals accessible via `state.*`, events work for cross-module communication.

---

### Phase 2: Configuration System (Low Risk)

**Files:** 4 | **Est. Lines:** ~300 | **Duration:** 1-2 sessions

| Module              | Source                | Key Exports                                                           |
| ------------------- | --------------------- | --------------------------------------------------------------------- |
| `config/schema.js`  | `newtab.js:1154-1289` | `DEFAULTS`, `THEMES`, `validate(key, value)`                          |
| `config/storage.js` | `newtab.js:1292-1338` | `get(key)`, `set(key, value)`, `loadAll()`, `migrate()`               |
| `config/styles.js`  | `newtab.js:1340-1449` | `generateCSS(key, value)`, `applyStyle(key, css)`, `removeStyle(key)` |
| `config/ui.js`      | `newtab.js:1508-1705` | `initOptionsPanel()`, `showOptions(show)`, `showConfig(key)`          |

**Validation:** Options panel loads, all settings persist, themes switch correctly, custom CSS works.

---

### Phase 3: Bookmarks Data Layer (Medium Risk)

**Files:** 4 | **Est. Lines:** ~400 | **Duration:** 2-3 sessions

| Module                       | Source                             | Key Exports                                                                                                                                                                                     |
| ---------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bookmarks/special-nodes.js` | `newtab.js:876-912`                | `SPECIAL`, `getSpecialNode(id)`, `isSpecial(id)`                                                                                                                                                |
| `bookmarks/tree.js`          | `newtab.js:665-715`                | `getChildren(node)`, `getSubTree(id)`, `getChildrenFunction(node)`                                                                                                                              |
| `bookmarks/crud.js`          | `vim.js:289-425, 469-522, 769-809` | `createBookmark(props)`, `updateBookmark(id, props)`, `deleteBookmark(id)`, `moveBookmark(id, dest)`, `copyBookmarkSubtree(sourceId, destParentId, index)`                                      |
| `bookmarks/layout.js`        | `newtab.js:954-1063`               | `loadColumns()`, `saveColumns()`, `verifyColumns()`, `addColumn(ids, index)`, `removeColumn(index)`, `addRow(id, x, y)`, `removeRow(x, y)`, `removeFromLayout(ids)`, `placeInLayout(ids, x, y)` |

**Validation:** Bookmark tree loads, CRUD operations work, column layout persists, special nodes render.

---

### Phase 4: Rendering System (Medium Risk)

**Files:** 6 | **Est. Lines:** ~500 | **Duration:** 2-3 sessions

| Module               | Source              | Key Exports                                                  |
| -------------------- | ------------------- | ------------------------------------------------------------ |
| `render/renderer.js` | `newtab.js:133-153` | `renderColumns()`                                            |
| `render/column.js`   | `newtab.js:102-131` | `renderColumn(index, target)`                                |
| `render/node.js`     | `newtab.js:3-100`   | `render(node, target)`, `renderAll(nodes, target, toplevel)` |
| `render/folder.js`   | `newtab.js:762-845` | `toggle(node, anchor)`, `animate(node, anchor, isOpen)`      |
| `render/icons.js`    | `newtab.js:730-760` | `getIcon(node)`                                              |
| `render/tooltips.js` | `newtab.js:646-663` | `updateTooltips()`                                           |

**Validation:** All columns render, folders open/close with animation, icons show, tooltips appear on truncation.

---

### Phase 5: Interaction Layer (Medium Risk)

**Files:** 4 | **Est. Lines:** ~400 | **Duration:** 2 sessions

| Module                        | Source              | Key Exports                                                                                                                                |
| ----------------------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `interaction/context-menu.js` | `newtab.js:315-439` | `renderMenu(items, x, y, label)`, `closeMenu(ul)`, `getMenuItems(node)`, `addFolderHandlers(node, anchor)`, `addColumnHandlers(index, ul)` |
| `interaction/drag-drop.js`    | `newtab.js:441-644` | `enableDragColumn(id, column)`, `enableDragFolder(node, anchor)`, `enableDragDrop()`, `folderMoveDrop(dragIds, folderNodeId)`              |
| `interaction/keyboard.js`     | `vim.js:845-937`    | `initKeyboard()` — registers global keydown handler, emits events                                                                          |
| `interaction/modal.js`        | `vim.js:207-283`    | `showModal(options)`                                                                                                                       |

**Validation:** Context menus appear, drag-drop reorders columns/folders, vim keys navigate, modals open/close.

---

### Phase 6: Vim Navigation Refactor (High Risk)

**Files:** 4 | **Est. Lines:** ~350 | **Duration:** 3-4 sessions

| Module             | Source                    | Key Exports                                                                                                                                                     |
| ------------------ | ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vim/cursor.js`    | `vim.js:13-180`           | `vimCursor`, `vimEl`, `moveCursor(dx, dy)`, `resolveCursor()`, `updateCursorVisuals()`, `scheduleRestore(id)`, `restoreCursor(id)`                              |
| `vim/selection.js` | `vim.js:568-701`          | `vimSelected`, `clipboard`, `vimGetTargetIds()`, `vimToggleSelect()`, `vimClearSelection()`, `vimYank()`, `vimCut()`, `vimPaste(below)`, `vimCancelClipboard()` |
| `vim/actions.js`   | `vim.js:334-463, 811-839` | `vimActivate()`, `vimOpenFolder()`, `createNodeDialog(isFolder)`, `editNodeDialog()`, `vimDelete()`, `vimShowThemePicker()`                                     |
| `vim/observer.js`  | `vim.js:943-965`          | `vimInit()`, `vimObserver`                                                                                                                                      |

**Validation:** Vim navigation works end-to-end, cursor restores after re-render, selection/clipboard works, theme picker opens.

---

## Migration Strategy

### 1. Build System Setup

- Add `esbuild` or `rollup` for bundling ES modules → single `newtab.js` output
- Update `newtab.html` to load bundled script
- Keep `manifest.json` pointing to `newtab.html`

### 2. Incremental Extraction Pattern

For each module:

1. Create new module file in `src/`
2. Move code, update imports/exports
3. Add barrel export (`src/core/index.js`, etc.)
4. Update dependent modules to import from barrel
5. Run verification (manual test in Chrome)
6. Delete extracted code from monolith

### 3. Global Shim (Transition Period)

Create `src/shim.js` that re-exports new modules as globals for `vim.js` during transition:

```js
// Temporary bridge during migration
import * as state from "./core/state.js";
import * as bookmarks from "./bookmarks/index.js";
import * as render from "./render/index.js";
// ...
window.columns = state.columns;
window.root = state.root;
// etc.
```

### 4. Final Cleanup

- Remove shim
- Ensure `vim.js` imports from modules, not globals
- Bundle everything

---

## Verification Checklist Per Phase

- [ ] Extension loads without errors
- [ ] Bookmarks render in columns
- [ ] Folders open/close with animation
- [ ] Context menus work (right-click folders/columns)
- [ ] Drag-drop reorders columns and folders
- [ ] Vim keys navigate (h/j/k/l, Enter, o, n/N, e, d, v/V, y/x, p/P, T, /, Esc)
- [ ] Selection works (v to select, V to clear)
- [ ] Clipboard works (yank, cut, paste above/below)
- [ ] Create/edit/delete bookmarks/folders via vim keys
- [ ] Theme picker opens (T) and switches themes
- [ ] Options panel opens (/) and all settings work
- [ ] Settings persist across reloads
- [ ] Import/export settings works
- [ ] Recently closed tabs refresh on session change

---

## Risk Mitigation

| Risk                         | Mitigation                                                              |
| ---------------------------- | ----------------------------------------------------------------------- |
| Breaking vim during refactor | Keep shim until Phase 6 complete; test vim after each phase             |
| Event timing issues          | Use `requestAnimationFrame` in `resolveCursor()`; test rapid re-renders |
| Chrome API promise rejection | Wrap all `chrome.*` calls in try/catch; log errors                      |
| CSS conflicts                | Namespace generated styles; test all themes                             |
| Layout corruption            | `verifyColumns()` runs on every `saveColumns()`; add integration test   |

---

## Estimated Total Effort

| Phase          | Sessions  | Risk   |
| -------------- | --------- | ------ |
| 1. Core        | 1-2       | Low    |
| 2. Config      | 1-2       | Low    |
| 3. Bookmarks   | 2-3       | Medium |
| 4. Render      | 2-3       | Medium |
| 5. Interaction | 2         | Medium |
| 6. Vim         | 3-4       | High   |
| **Total**      | **11-16** | —      |

**Recommendation:** Complete Phases 1-2 first (foundation), then 3-4 (data + render), then 5-6 (interaction + vim). Each phase should be verified in Chrome before proceeding.

---

## Migration Complete

All phases shipped. The last residual defect from the modularization was:

- **Missing boot trigger**: `src/entry.js` initialized config and keyboard but never called
  `loadColumns()`, so the bookmarks root was never fetched and nothing rendered. Fixed by invoking
  `loadColumns()` as the final boot step (after event listeners and `window.*` exports are ready).
- **Orphaned config events**: `config/storage.js` emitted `COLUMNS_CHANGED` (for `lock`/`newtab`/
  `show_root`/`number_*`) and `'bookmarks:visibility'` (for `show_*`), but nothing subscribed.
  `bookmarks/layout.js` now subscribes: `COLUMNS_CHANGED` reloads the grid; `'bookmarks:visibility'`
  adds/removes the special node or top-level folder row (mirroring the legacy `setConfig` `show_*`
  handling).

Both fixes land in the modular code and were validated via the bundling workflow (`npm run build` →
`temp_output.js`).
