# AGENTS.md — Oh My New Tab Page

## Project Overview

Chrome extension (MV3) replacing the new tab page. Vim-style keyboard navigation, multi-column bookmark layout, theming, drag-drop reorganization. Fork of Humble New Tab Page.

## Architecture (post-refactor)

The tree is mostly flat — one module per domain — with `config/` and `bookmarks/` still split by responsibility.

```
newtab.html          # UI shell + options panel; loads the bundled output.js
manifest.json        # Chrome extension manifest v3
src/
├── entry.js         # Boot only (no wiring, no DI)
├── state.js         # Single state object + getters + mutations
├── events.js        # Pub/sub bus (on/off/emit/once) + Events constants
├── chrome-api.js    # Promise wrappers for chrome.* (never call chrome.* directly)
├── config/
│   ├── config.js    # Schema (DEFAULTS/THEMES/validate) + storage (get/set/loadAll) + styles
│   ├── ui.js        # Options panel DOM, tabs, import/export
│   └── index.js     # Barrel
├── bookmarks/
│   ├── tree.js      # getChildrenFunction, getSubTree
│   ├── crud.js      # Create/update/delete/move/copy bookmarks
│   ├── layout.js    # Column grid: load/save/add/remove/verify/sync
│   ├── special-nodes.js  # Virtual nodes: apps, top, recent, closed, devices
│   └── index.js     # Barrel
├── render.js        # renderColumns/renderColumn/renderAll/toggle/animate/tooltips
├── overlay.js       # Modal dialog + popup menu (imports nothing — cannot cycle)
├── interaction.js   # Keyboard, drag-drop, context menu item lists
└── vim.js           # Cursor, selection, yank/cut/paste, theme picker, dialogs
```

There is **no dependency injection**. Modules import each other directly; `config/index.js` and `bookmarks/index.js` are barrels, everything else imports the module file. One circular import remains — see Gotchas.

## Build & Development

1. **Build**: `npm run build` (esbuild bundles `src/entry.js` → `output.js`, iife, chrome104). Use `npm run dev` for watch mode.
2. **Edit** files under `src/`. **Always rebuild before testing** — `newtab.html` runs `output.js`, not `src/`.
3. **Test**: load the **project root** as an unpacked extension in Chrome (`chrome://extensions` → Load unpacked).
4. `npm test` is a no-op echo — there is no automated suite yet.

## Key Patterns

- **State**: single source of truth in `state.js` (`state.columns`, `state.root`, `state.coords`, `state.special`, `state.vim*`). Mutate via `mutations.*`, read via `getters.*`. Direct assignment still happens in a few places (see Gotchas).
- **Events**: `events.js` — `on(event, handler)` / `emit(event, data)`. Constants live in `Events` (`RENDER_REQUESTED`, `RENDER_COMPLETE`, `BOOKMARK_CREATED`, `CONFIG_CHANGED`, `COLUMNS_CHANGED`, …); a custom `'bookmarks:visibility'` event carries `{ id, visible }`.
- **Data → event → cursor**: `bookmarks/crud.js` never imports `vim.js`. It emits `BOOKMARK_CREATED`/`BOOKMARK_UPDATED`; `vim.js` listens and calls `scheduleRestore`. Paste follows the same shape: `layout.js` places the items, then its caller (`vim.js`) restores the cursor. This is deliberate — it keeps the data layer free of cursor concerns and is what breaks the `crud.js` → `vim.js` edge.
- **Chrome APIs**: promise-wrapped in `chrome-api.js`. Never call `chrome.*` directly in feature modules.
- **Config**: `config/config.js` holds `DEFAULTS`/`THEMES`/`LIGHT_THEMES`/`validate` (schema), `get`/`set`/`loadAll` (localStorage under the `options.` prefix), and `applyCssVar`/`initCssVars`/`getAllCSS` (styling). `set()` re-emits: layout keys (`lock`/`newtab`/`show_root`/`number_*`) → `COLUMNS_CHANGED`; `show_*` → `'bookmarks:visibility'`; theme keys (`theme`/`theme_light`/`theme_mode`) → re-resolve and re-apply everything.
- **Theming**: `theme_mode` is System/Light/Dark. System follows `prefers-color-scheme` live; `theme` and `theme_light` are separate slots. A one-time migration (marked by `meta.theme_mode_migrated`) pins pre-existing users to Dark or Light.
- **Rendering**: render functions read `state` and produce DOM; cross-cutting styling is applied via CSS custom properties set in `config/config.js`.

## Boot Sequence (`src/entry.js`)

1. Module imports run first (module side effects — including `vim.js`'s observer, see Gotchas).
2. `config.loadAll()` — loads config, runs the theme migration, applies CSS vars.
3. `interaction.initKeyboard()` — attaches the global keydown handler.
4. `?options` handling — opens the panel if the URL requests it.
5. `#options_button` click → `config.showOptions(true)`.
6. `on(RENDER_REQUESTED, …)` → `render.renderColumns()`.
7. `bookmarks.loadColumns()` — fetches the bookmarks root, builds the grid, emits `RENDER_REQUESTED`.

`loadColumns()` runs last; without it nothing renders.

## Common Tasks

| Task | Location |
| --- | --- |
| Add config option | `config/config.js` (`DEFAULTS`) → `newtab.html` (input) → `config/config.js` (`applyCssVar`) |
| Add vim command | `vim.js` (action) → `interaction.js` (key handler) |
| Add special node | `bookmarks/special-nodes.js` (`SPECIAL`) + `bookmarks/tree.js` |
| Change rendering | `render.js` |
| Change modal / popup menu UI | `overlay.js` |
| Modify drag-drop | `interaction.js` |
| Add a Chrome API call | `chrome-api.js` (wrapper) → call the wrapper |

## Chrome API Permissions (manifest.json)

- `bookmarks` — read/write bookmark tree
- `favicon` — fetch favicons via `/_favicon/`
- `topSites` — "Most visited" section
- `tabs` — open/update tabs
- `fontSettings` — font picker in options
- `sessions` — recently closed, other devices

## Gotchas

- **A stale `output.js` is the #1 cause of "my change did nothing"** — rebuild after any `src/` edit.
- `chrome.bookmarks.getSubTree` returns `[{ node-with-children }]` — unwrap carefully.
- Boot requires `loadColumns()` (runs last in `src/entry.js`).
- `chrome.sessions.getRecentlyClosed` returns windows/tabs mixed — normalized in `bookmarks/special-nodes.js`.
- Favicon service: `/_favicon/?pageUrl=<url>&size=16` (Chrome internal).
- `localStorage` keys prefixed with `options.` and `column.X.Y`.
- **One circular import remains**: `render.js` → `bookmarks/tree.js` → `bookmarks/layout.js` → `bookmarks/special-nodes.js` → `render.js`. ES modules tolerate it, but it makes initialization order fragile — do not add new ones.
- **`layout.js` runs `mutations.setSpecial(SPECIAL)` at module scope**, and `SPECIAL` comes from `special-nodes.js`. Under native ESM the real boot order (`entry.js` → `bookmarks/index.js`, whose barrel evaluates `special-nodes.js` first) throws `Cannot access 'SPECIAL' before initialization`. The esbuild bundle reorders modules and does not hit it, so the shipped extension is unaffected — but anything importing `src/` directly must enter the graph via `render.js` first. Breaking the cycle above fixes this properly.
- **`vim.js` has an import-time side effect**: it creates a `MutationObserver` on `#main` and calls `vimInit()` at module scope. Importing `vim.js` is not free.
- **DOM expandos still carry state**: `anchor._vimNode` (full bookmark node) and `anchor.open` (folder expanded flag) are set in `render.js` and read in `bookmarks/crud.js`, `bookmarks/layout.js`, `interaction.js`. Module-private `dragIds`/`dropTarget` (`interaction.js`) and `tooltipTimeout` (`render.js`) also remain outside `state.js`.
- `events.js` swallows handler errors (logs via `console.error`) — an exception in one listener won't break others.
- Chrome's "Other Bookmarks" has id=2 with a dynamic `show_2` config key that is not in `DEFAULTS` — `isNodeShown` (`bookmarks/layout.js`) falls back to localStorage.

## Testing Checklist (Manual)

- [ ] Bookmarks render in columns
- [ ] Folders open/close with animation
- [ ] Context menus (right-click folder/column)
- [ ] Drag-drop reorders columns and folders
- [ ] Vim navigation (h/j/k/l, Enter, o, n/N, e, d, v/V, y/x, p/P, T, /, Esc)
- [ ] Selection + clipboard (yank, cut, paste)
- [ ] Create/edit/delete via vim keys
- [ ] Theme picker (T) switches themes; Mode (System/Light/Dark) follows the OS
- [ ] Options panel (/) all settings work; toggling content visibility adds/removes columns
- [ ] Settings persist across reloads
- [ ] Import/export settings
- [ ] Recently closed refreshes on session change
