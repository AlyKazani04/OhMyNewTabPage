# AGENTS.md — Oh My New Tab Page

## Project Overview

Chrome extension (MV3) replacing new tab page. Vim-style keyboard navigation, multi-column bookmark layout, theming, drag-drop reorganization. Fork of Humble New Tab Page.

## Current Architecture (Monolithic)

```
├── newtab.js      # 1,751 lines — rendering, state, config, bookmarks, UI
├── vim.js         # 965 lines — vim navigation, CRUD, clipboard, theme picker
├── newtab.html    # 290 lines — HTML + inline options panel
├── newtab.css     # 420 lines — styles
└── manifest.json  # Chrome extension manifest v3
```

## Key Patterns (Current)

- **State**: Global variables in `newtab.js` (`columns`, `root`, `coords`, `special`, `config`, `themes`, `theme`) and `vim.js` (`vimCursor`, `vimEl`, `vimSelected`, `clipboard`, `vimPendingRestore`)
- **Coupling**: `vim.js` depends on 15+ globals from `newtab.js` — no module boundaries
- **Chrome APIs**: Called directly via callbacks (`chrome.bookmarks.getSubTree`, `chrome.sessions.getRecentlyClosed`, etc.) — not promise-wrapped
- **Rendering**: Functions mutate DOM directly, mixed with business logic
- **Config**: `config` object + `themes` object in `newtab.js`; `getConfig()`/`setConfig()` read/write `localStorage` with `options.` prefix
- **Events**: None — direct function calls and global mutation

## Development Workflow

1. **Build**: None (raw JS loaded directly via `newtab.html`)
2. **Test**: Load project root as unpacked extension in Chrome
3. **Verify**: Manual checklist below

## Common Tasks (Current)

| Task              | Location                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------ |
| Add config option | `newtab.js` — `config` object, `getConfig`/`setConfig`, `getStyle`, `initConfig`, `initSettings` |
| Add vim command   | `vim.js` — key handler switch + action function                                                  |
| Add special node  | `newtab.js` — `SPECIAL` object + `getChildrenFunction`                                           |
| Change rendering  | `newtab.js` — `render`, `renderAll`, `renderColumn`, `renderColumns`                             |
| Modify drag-drop  | `newtab.js` — `enableDragColumn`, `enableDragFolder`, `enableDragDrop`                           |

## Chrome API Permissions (manifest.json)

- `bookmarks` — read/write bookmark tree
- `favicon` — fetch favicons via `/_favicon/`
- `topSites` — "Most visited" section
- `tabs` — open/update tabs
- `fontSettings` — font picker in options
- `sessions` — recently closed, other devices

## Gotchas (Current)

- `chrome.bookmarks.getSubTree` returns `[{ children: [...] }]` — unwrap carefully
- `chrome.sessions.getRecentlyClosed` returns windows/tabs mixed — normalized in `getDevices`/`getClosed`
- Favicon service: `/_favicon/?pageUrl=<url>&size=16` (Chrome internal)
- MutationObserver on `#main` triggers `vim.js:resolveCursor()` after render
- `localStorage` keys prefixed with `options.` and `column.X.Y`
- Single-folder columns with `show_root: false` flatten children — handled in `vim.js:syncLayoutAfterPaste()`
- **No build step** — edit files directly, reload extension to test
- **Global namespace pollution** — all functions/variables on `window`

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

## Migration Context

See `docs/migration-plan.md` for 6-phase modularization plan. Target architecture documented in `docs/AGENTS-post-migration.md`.
