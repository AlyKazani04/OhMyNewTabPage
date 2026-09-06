# AGENTS.md — Oh My New Tab Page (post-migration reference)

This file documents the state **after** the modularization. The historical plan and per-phase breakdown live in `docs/migration-plan.md`. This is a companion to the root `AGENTS.md`, which should be treated as authoritative.

## Project Overview

Chrome extension (MV3) replacing the new tab page. Vim-style keyboard navigation, multi-column bookmark layout, theming, drag-drop reorganization. Fork of Humble New Tab Page.

## Architecture

```
src/
├── entry.js         # Boot + dependency-injection wiring + event listeners
├── core/            # state.js, events.js, chrome-api.js
├── config/          # schema.js, storage.js, styles.js, ui.js
├── bookmarks/       # special-nodes.js, tree.js, crud.js, layout.js
├── render/          # renderer.js, column.js, node.js, folder.js, icons.js, tooltips.js
├── interaction/     # context-menu.js, drag-drop.js, keyboard.js, modal.js
└── vim/             # cursor.js, selection.js, actions.js, observer.js
```

`newtab.html` loads the esbuild bundle **`temp_output.js`** (from `src/entry.js`), not the `src/` sources directly.

## Key Patterns

- **State**: Single source of truth in `core/state.js`; mutated only via `mutations`, read via `getters`.
- **Events**: `core/events.js` for cross-module communication — `on(event, handler)` / `emit(event, data)`. Standard events in `Events`; plus a custom `'bookmarks:visibility'` event carrying `{ id, visible }`.
- **Dependency injection**: Cross-module deps wired in `src/entry.js` via setter functions; module-private slots default to `null` and are null-guarded.
- **Boot** (`src/entry.js`): module imports → DI wiring → `loadAll()` → `initKeyboard()` → listeners/`window.*` exports → `loadColumns()` (fetches bookmarks root, builds columns, emits `RENDER_REQUESTED`).
- **Chrome APIs**: Promise-wrapped in `core/chrome-api.js` — never call `chrome.*` directly.
- **Config**: `config/schema.js` defines `DEFAULTS`/`THEMES`/`validate`; `config/storage.js` handles `localStorage` (`options.` prefix). `set()` routes layout-affecting keys → `COLUMNS_CHANGED` and `show_*` → `'bookmarks:visibility'`; `bookmarks/layout.js` consumes both.
- **Rendering**: Functions receive state and produce DOM; styling via CSS custom properties set in `config/styles.js`.

## Development Workflow

1. **Build**: `npm run build` (esbuild → root `temp_output.js`). `npm run dev` for watch mode.
2. **Edit**: Modify files under `src/`. **Rebuild before testing** — `newtab.html` runs the bundle, so a stale `temp_output.js` shows old/broken behavior.
3. **Test**: Load the **project root** as an unpacked extension in Chrome.
4. **Verify**: Run through the manual checklist in the root `AGENTS.md`.

## Common Tasks

| Task              | Entry Point                                              |
| ----------------- | -------------------------------------------------------- |
| Add config option | `config/schema.js` → `config/ui.js` → `config/styles.js` |
| Add vim command   | `vim/actions.js` → `interaction/keyboard.js`             |
| Add special node  | `bookmarks/special-nodes.js` → `bookmarks/tree.js`       |
| Change rendering  | `render/node.js` or `render/folder.js`                   |
| Modify drag-drop  | `interaction/drag-drop.js`                               |
| Wire module dep   | `src/entry.js` (setter calls)                            |

## Chrome API Permissions (manifest.json)

- `bookmarks` — read/write bookmark tree
- `favicon` — fetch favicons via `/_favicon/`
- `topSites` — "Most visited" section
- `tabs` — open/update tabs
- `fontSettings` — font picker in options
- `sessions` — recently closed, other devices

## Gotchas

- `chrome.bookmarks.getSubTree` returns `[{ node-with-children }]` — unwrap carefully.
- **Stale `temp_output.js`** is the most common cause of "my change did nothing" — rebuild after any `src/` edit.
- Boot requires `loadColumns()` (last step in `src/entry.js`); without it nothing renders.
- `chrome.sessions.getRecentlyClosed` returns windows/tabs mixed — normalize in `bookmarks/special-nodes.js`.
- Favicon service: `/_favicon/?pageUrl=<url>&size=16` (Chrome internal).
- MutationObserver on `#main` triggers `vim/cursor.js:resolveCursor()` after render.
- `localStorage` keys prefixed with `options.` and `column.X.Y`.
- Single-folder columns with `show_root: false` flatten children — handled in `bookmarks/layout.js:syncLayoutAfterPaste()`.

## Migration Status

**Complete.** All six phases of the plan in `docs/migration-plan.md` have shipped; the monolithic `newtab.js`/`vim.js` are gone. The final residual defect — the modular `entry.js` never invoking `loadColumns()`, so bookmarks did not load — was fixed and is documented there.
