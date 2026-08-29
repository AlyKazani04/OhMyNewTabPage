# AGENTS.md — Oh My New Tab Page

## Project Overview
Chrome extension (MV3) replacing new tab page. Vim-style keyboard navigation, multi-column bookmark layout, theming, drag-drop reorganization. Fork of Humble New Tab Page.

## Architecture (Post-Migration)
```
src/
├── core/         # State, events, Chrome API wrappers
├── config/       # Schema, storage, styles, options UI
├── bookmarks/    # Special nodes, tree ops, CRUD, layout
├── render/       # Column, node, folder, icons, tooltips
├── interaction/  # Context menus, drag-drop, keyboard, modals
└── vim/          # Cursor, selection, actions, observer
```

## Key Patterns
- **State**: Single source of truth in `core/state.js` — never mutate directly, use events
- **Events**: `core/events.js` for cross-module communication — `emit('columns:changed')`, `on('bookmark:created', handler)`
- **Chrome APIs**: All async, promise-wrapped in `core/chrome-api.js` — never call `chrome.*` directly
- **Rendering**: Stateless functions receiving state, producing DOM — no side effects
- **Config**: `config/schema.js` defines all keys; `config/storage.js` handles persistence; `config/styles.js` generates CSS

## Development Workflow
1. **Build**: `npm run build` (esbuild → `dist/newtab.js`)
2. **Test**: Load `dist/` as unpacked extension in Chrome
3. **Verify**: Run through verification checklist in `docs/migration-plan.md`

## Common Tasks
| Task | Entry Point |
|------|-------------|
| Add config option | `config/schema.js` → `config/ui.js` → `config/styles.js` |
| Add vim command | `vim/actions.js` → `interaction/keyboard.js` |
| Add special node | `bookmarks/special-nodes.js` → `bookmarks/tree.js` |
| Change rendering | `render/node.js` or `render/folder.js` |
| Modify drag-drop | `interaction/drag-drop.js` |

## Chrome API Permissions (manifest.json)
- `bookmarks` — read/write bookmark tree
- `favicon` — fetch favicons via `/_favicon/`
- `topSites` — "Most visited" section
- `tabs` — open/update tabs
- `fontSettings` — font picker in options
- `sessions` — recently closed, other devices

## Gotchas
- `chrome.bookmarks.getSubTree` returns `[{ children: [...] }]` — unwrap carefully
- `chrome.sessions.getRecentlyClosed` returns windows/tabs mixed — normalize in `bookmarks/special-nodes.js`
- Favicon service: `/_favicon/?pageUrl=<url>&size=16` (Chrome internal)
- MutationObserver on `#main` triggers `vim/cursor.js:resolveCursor()` after render
- `localStorage` keys prefixed with `options.` and `column.X.Y`
- Single-folder columns with `show_root: false` flatten children — handle in `vim/actions.js:syncLayoutAfterPaste()`

## Testing Checklist (Manual)
- [ ] Bookmarks render in columns
- [ ] Folders open/close with animation
- [ ] Context menus (right-click folder/column)
- [ ] Drag-drop reorders columns and folders
- [ ] Vim navigation (h/j/k/l, Enter, o, n/N, e, d, v/V, y/x, p/P, T, /, Esc)
- [ ] Selection + clipboard (yank, cut, paste)
- [ ] Create/edit/delete via vim keys
- [ ] Theme picker (T) switches themes
- [ ] Options panel (/) all settings work
- [ ] Settings persist across reloads
- [ ] Import/export settings
- [ ] Recently closed refreshes on session change

## Migration Status
See `docs/migration-plan.md` for phase breakdown. Current phase: **TBD**