# AGENTS.md — Oh My New Tab Page

## Project Overview

Chrome extension (MV3) replacing the new tab page. Vim-style keyboard navigation, multi-column bookmark layout, theming, drag-drop reorganization. Fork of Humble New Tab Page.

## Architecture (Modular — post-migration)

```
newtab.html          # UI shell + options panel; loads the bundled temp_output.js
manifest.json        # Chrome extension manifest v3
src/
├── entry.js         # Boot + dependency-injection wiring + event listeners
├── core/            # state.js, events.js, chrome-api.js (promise wrappers)
├── config/          # schema.js, storage.js, styles.js, ui.js
├── bookmarks/       # special-nodes.js, tree.js, crud.js, layout.js
├── render/          # renderer.js, column.js, node.js, folder.js, icons.js, tooltips.js
├── interaction/     # context-menu.js, drag-drop.js, keyboard.js, modal.js
└── vim/             # cursor.js, selection.js, actions.js, observer.js
```

The `index.js` in each folder re-exports its modules. `newtab.html` does NOT load `src/` — it loads the **esbuild bundle** `temp_output.js` produced from `src/entry.js`. See Development Workflow.

## Key Patterns

- **State**: Single source of truth in `core/state.js` (`state.columns`, `state.root`, `state.coords`, `state.vim*`); mutated only via `mutations` / read via `getters`.
- **Events**: `core/events.js` — `on(event, handler)` / `emit(event, data)`. Standard events live in `Events` (e.g. `RENDER_REQUESTED`, `CONFIG_CHANGED`, `COLUMNS_CHANGED`); a custom `'bookmarks:visibility'` event carries `{ id, visible }`.
- **Dependency injection**: Most cross-module deps are set by `src/entry.js` via setters (`render.setGetChildrenFunction(...)`, `bookmarks.setRenderColumnsForCrud(...)`, etc.). Module-private function slots default to `null` and are null-guarded.
- **Boot sequence** (`src/entry.js`): module imports run first (side effects + DI setters), then `loadAll()` (config), `initKeyboard()`, `?options` handling, event listeners, `window.*` exports, and finally `loadColumns()` — which fetches the bookmarks root, builds the column grid and emits `RENDER_REQUESTED` → `renderColumns()`.
- **Chrome APIs**: Promise-wrapped in `core/chrome-api.js` (callback style under the hood). Never call `chrome.*` directly in feature modules.
- **Config**: `config/schema.js` defines `DEFAULTS`/`THEMES`/`validate`; `config/storage.js` `get`/`set`/`loadAll` read/write `localStorage` under the `options.` prefix. `set()` re-emits layout-affecting changes: `lock`/`newtab`/`show_root`/`number_*` → `COLUMNS_CHANGED`; `show_*` → `'bookmarks:visibility'`. Both are consumed in `bookmarks/layout.js` (reload grid / add-or-remove row).
- **Rendering**: Pure-ish render functions receive `state` and produce DOM; cross-cutting styling is applied via CSS custom properties set in `config/styles.js`.

## Development Workflow

1. **Build**: `npm run build` (esbuild bundles `src/entry.js` → `temp_output.js`). Use `npm run dev` for watch mode.
2. **Edit**: Modify files under `src/`. **Always rebuild before testing** — `newtab.html` runs `temp_output.js`, not the `src/` sources, so a stale bundle shows old (or broken) behavior.
3. **Test**: Load the **project root** as an unpacked extension in Chrome (`chrome://extensions` → Load unpacked).
4. **Verify**: Manual checklist below.

## Common Tasks

| Task              | Location                                                                                    |
| ----------------- | ------------------------------------------------------------------------------------------- |
| Add config option | `config/schema.js` (`DEFAULTS`) → `config/ui.js` (input) → `config/styles.js` (css vars)     |
| Add vim command   | `vim/actions.js` → `interaction/keyboard.js` key handler                                     |
| Add special node  | `bookmarks/special-nodes.js` (`SPECIAL`) + `bookmarks/tree.js` handling                      |
| Change rendering  | `render/renderer.js`, `render/column.js`, `render/node.js`, `render/folder.js`               |
| Modify drag-drop  | `interaction/drag-drop.js`                                                                   |
| Wire module dep   | `src/entry.js` (setter calls)                                                               |

## Chrome API Permissions (manifest.json)

- `bookmarks` — read/write bookmark tree
- `favicon` — fetch favicons via `/_favicon/`
- `topSites` — "Most visited" section
- `tabs` — open/update tabs
- `fontSettings` — font picker in options
- `sessions` — recently closed, other devices

## Gotchas

- `chrome.bookmarks.getSubTree` returns `[{ node-with-children }]` — unwrap carefully. `getChildrenFunction` returns children; `getSubTree` returns the node list.
- **A stale `temp_output.js` is the #1 cause of "my change did nothing" / "bookmarks don't load"** — rebuild after any `src/` edit.
- Boot requires `loadColumns()` (runs last in `src/entry.js`); without it nothing renders.
- `chrome.sessions.getRecentlyClosed` returns windows/tabs mixed — normalized in `bookmarks/special-nodes.js`.
- Favicon service: `/_favicon/?pageUrl=<url>&size=16` (Chrome internal).
- MutationObserver on `#main` triggers `vim/cursor.js:resolveCursor()` after render.
- `localStorage` keys prefixed with `options.` and `column.X.Y`.
- Single-folder columns with `show_root: false` flatten children — handled in `bookmarks/layout.js:syncLayoutAfterPaste()`.
- `events.js` swallows handler errors (logs via `console.error`) — an exception in one listener won't break others.

## Testing Checklist (Manual)

- [ ] Bookmarks render in columns
- [ ] Folders open/close with animation
- [ ] Context menus (right-click folder/column)
- [ ] Drag-drop reorders columns and folders
- [ ] Vim navigation (h/j/k/l, Enter, o, n/N, e, d, v/V, y/x, p/P, T, /, Esc)
- [ ] Selection + clipboard (yank, cut, paste)
- [ ] Create/edit/delete via vim keys
- [ ] Theme picker (T) switches themes
- [ ] Options panel (/) all settings work; toggling content visibility adds/removes columns
- [ ] Settings persist across reloads
- [ ] Import/export settings
- [ ] Recently closed refreshes on session change

## Migration Context

Modularization is complete (see `docs/migration-plan.md` for the historical phase breakdown). Migration history and the pre-migration design live in `docs/`.
