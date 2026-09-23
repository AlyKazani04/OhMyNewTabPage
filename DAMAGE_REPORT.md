# Damage Report: Oh My New Tab Page

**Date:** 2026-09-23  
**Scope:** Full `src/` tree audit across core, config, bookmarks, render, interaction, vim modules

---

## Executive Summary

The modularization commit (`519ed25`) split a working monolith into ~40 modules connected by a setter-injection DI pattern that is **incomplete and fragile**. At least **two functions are permanently `null` and will throw at runtime** under normal usage. The state mutation pattern is bypassed in hot paths, event cascades cause redundant re-renders, and several UI inputs are broken due to a falsy-default bug. The "crashing on second launch" issue is likely caused by cascading re-renders + missing cleanup.

---

## CRITICAL — Will Throw at Runtime

### 1. `tree.js:21,26` — `removeRow` never wired, crashes on missing bookmarks

`src/bookmarks/tree.js` declares `let removeRow = null` and exports `setRemoveRow(fn)`, but **`entry.js` never calls it**. When `getChildrenFunction` fetches a missing bookmark subtree (which happens — bookmarks get deleted externally, sync delays, etc.), it calls `removeRow(...)` and gets:

```
TypeError: removeRow is not a function
```

This crashes the bookmark fetch pipeline. **Every** load with a stale bookmark entry triggers this.

**Fix:** Add to `entry.js`:
```js
bookmarks.setRemoveRow(bookmarks.removeRow);  // also needs removeRow exported from layout.js
```

---

### 2. `layout.js:226,230` — `scheduleRestore` never wired, crashes after paste/cut

`src/bookmarks/layout.js` exports `let scheduleRestore = null` and `setScheduleRestore(fn)`, but **`entry.js` never calls it**. `syncLayoutAfterPaste()` calls `scheduleRestore(ids[0])` on every paste/cut, throwing:

```
TypeError: scheduleRestore is not a function
```

This corrupts the clipboard flow — paste appears to work, then the cursor restore throws, leaving selection in a broken state.

**Fix:** Wire `bookmarks.setScheduleRestore(bookmarks.scheduleRestore)` in `entry.js`, or import from `vim/cursor.js` directly in `crud.js`.

---

### 3. `folder.js:87` — `wrap.className = null` sets literal `"null"` class

```js
wrap.className = null;  // becomes class="null"
```

The `null` coerces to the string `"null"`. This leaves stale animation classes attached. CSS rules targeting `.folder-wrap` or animation states continue matching the element. Subsequent renders stack `"null"` + animation classes.

**Fix:**
```js
wrap.className = '';
```

---

### 4. `renderer.js:15` — Unreachable dead check inside for-loop

```js
for (let i = 0; i < state.columns.length; i++) {
  ...
  if (!state.columns.length) return;  // never reached; loop condition already guards
}
```

This is confusing dead code that suggests the author may have intended bounds protection but placed it incorrectly.

**Fix:** Remove the dead check. If protection is needed, check `state.columns[i]` before processing.

---

## HIGH — Bad Behavior, Cascading Issues

### 5. `layout.js` — Direct state mutation bypasses mutations API

`verifyColumns` and `loadColumns` mutate `state.columns`, `state.coords`, `state.root` directly instead of via `mutations.setColumns/setCoords/setRoot`. This breaks the single-write-path pattern, making state changes invisible to debugging and future hooks.

```js
state.columns.push([]);   // line 31
state.coords = {};        // line 53
state.columns = [];       // line 67
state.root.push(...);     // line 87
```

**Fix:** Use `mutations.setColumns([...])`, `mutations.setCoords(id, coord)`, `mutations.setRoot([...])`. Add incremental mutations like `pushColumn` if needed.

---

### 6. `layout.js:165` — `removeRow` missing bounds check

```js
export function removeRow(xpos, ypos) {
  state.columns[xpos].splice(ypos, 1);  // throws if xpos out of range
  saveColumns();
}
```

Stale `state.coords` (from deleted bookmarks) can cause out-of-range `xpos`. Throws `TypeError: Cannot read properties of undefined`.

**Fix:**
```js
if (!state.columns[xpos]) return;
```

---

### 7. `layout.js:115` — `saveColumns()` triggers redundant full reload

`saveColumns()` calls `verifyColumns()` (line 107), writes to storage, then calls `loadColumns()` at the end. `loadColumns()` itself calls `verifyColumns()` again and emits `RENDER_REQUESTED`. Result: every layout mutation causes **two** verify passes + a full reload + re-render.

**Fix:** Replace trailing `loadColumns()` with `emit(Events.RENDER_REQUESTED)`.

---

### 8. `layout.js:248` — Event cascade with no debounce

`on(Events.COLUMNS_CHANGED, loadColumns)` + `loadColumns` emits `RENDER_REQUESTED` + `saveColumns` triggers more reloads. Rapid layout changes (e.g., drag-drop reordering) cause cascading re-renders.

**Fix:** Debounce render emissions. Split `loadColumns` into storage-read and render-trigger phases.

---

### 9. `special-nodes.js:128-132` — Unsafe DOM access without bounds check

```js
const target = document.getElementsByClassName('column')[state.coords['closed'].x];
target.removeChild(target.firstChild);  // throws if index invalid
```

If `coords['closed'].x` is stale or layout hasn't rendered, this crashes. Also blindly removes `firstChild` which may be the folder header, not content.

**Fix:**
```js
const columns = document.getElementsByClassName('column');
const x = state.coords['closed']?.x;
if (x == null || x >= columns.length) return;
const target = columns[x];
const content = target.querySelector('[data-folder-content]');
if (content) content.remove();
```

---

### 10. `config/ui.js:186,211` — `isDefault` check broken for falsy defaults

```js
const isDefault = value === (DEFAULTS[key] || (currentTheme && currentTheme[key]));
```

For keys with falsy defaults (`hide_options: 0`, `lock: 0`, `newtab: 0`, `show_root: 0`, `background_image: ''`), `DEFAULTS[key] || ...` evaluates to `currentTheme[key]` even when the value IS at default. Reset button always shows as active.

**Fix:**
```js
const isDefault = value === (key in (currentTheme || {}) ? currentTheme[key] : DEFAULTS[key]);
```

---

### 11. `config/storage.js:40` — Reset emits wrong value

When `set(key, null)` (reset to default), emits `CONFIG_CHANGED` with `validated = DEFAULTS[key]`. For theme-overridable keys, the effective value is `currentTheme[key]`, not `DEFAULTS[key]`. This causes `applyCssVar` to set CSS to hardcoded default instead of active theme value.

**Fix:**
```js
emit(Events.CONFIG_CHANGED, { key, value: get(key) });
```

---

### 12. `drag-drop.js:14,32,102` — Single-item column drag misinterpreted as row drag

`dragIds` is shared between `enableDragColumn` (sets `dragIds = state.columns[id]`) and `enableDragFolder` (sets `dragIds = [node.id]`). The drop handler branches on `dragIds.length === 1`. A single-item column drag is misinterpreted as a row drop, corrupting the layout.

```js
if (dragIds.length === 1 && y != null) addRow(dragIds[0], x, y);
else addColumn(dragIds, x);
```

**Fix:** Use separate state variables or a discriminator payload: `{ type: 'column'|'folder', ids: [...] }`.

---

### 13. `render/column.js:18-34` — Silent failure on getSubTree rejection

Multi-ID column rendering chains sequential `getSubTree` calls. If any rejects, the chain terminates silently — `renderAll` never fires, column permanently empty.

**Fix:** Use `Promise.allSettled` and render whatever results came back, with error placeholders for failures.

---

### 14. `render/node.js:118` — `_vimNode` retains entire bookmark subtree

```js
a._vimNode = node;  // node may have deeply nested children arrays
```

Every anchor holds a reference to the full bookmark node (including children), preventing GC of large trees for the lifetime of the DOM element.

**Fix:** Store minimal reference `{ id, url, title }` or use a `WeakMap`.

---

### 15. `config/ui.js:101` — Import/export handler accumulates onclicks

The `imports.onchange` handler is assigned inside the tab click handler. Clicking Import/Export tab multiple times stacks handlers, executing import logic multiple times per change.

**Fix:** Assign once outside the click loop, or null out before reassigning.

---

### 16. `config/ui.js:98` — Export dumps all localStorage

```js
exports.value = JSON.stringify(localStorage, replacer);
```

Serializes ALL localStorage entries, including data from other extensions/browser internals. Importing this can corrupt state.

**Fix:** Filter to `options.` prefix only.

---

## MEDIUM — Performance, Correctness, Maintainability

### 17. `layout.js:67-77,97-106` — Infinite loop risk in load/save

```js
for (let x = 0; ; x++) {
  const id = localStorage.getItem('column.' + x + '.' + y);
  if (id) row.push(id);
  else break;
}
```

If localStorage is corrupted and returns a truthy unexpected value (e.g., `'null'` string), this loops forever, freezing the extension.

**Fix:** Add safety bound `x < 1000` or iterate `Object.keys(localStorage)` with prefix filter.

---

### 18. `layout.js:206-211` — `inColumns` is O(n×m) on every call

Linear scan of all columns invoked from `verifyColumns`, `syncLayoutAfterPaste`, and visibility handler. Quadratic in grid size.

**Fix:** Build and cache a `Set` of all column IDs, or use `state.coords` which is already a lookup map.

---

### 19. `special-nodes.js:65` — Mutates shared session object

```js
session.tab = session.window.tabs[0];
```

Mutates the object from `chromeApi.getRecentlyClosed`. If cached/shared, the mutation leaks across consumers.

**Fix:** Use a local copy: `const tab = session.window ? session.window.tabs[0] : session.tab;`

---

### 20. `render/icons.js:29-31` — Inconsistent img/div handling

```js
const icon = document.createElement(url ? 'img' : 'div');
icon.className = 'icon';
icon.src = url;  // sets .src on div; sets src="" on img if url falsy
```

For div case, adds meaningless `.src` property. For img with falsy url, triggers broken-image request.

**Fix:**
```js
if (icon.tagName === 'IMG' && url) icon.src = url;
```

---

### 21. `render/tooltips.js:10` — Full DOM scan on every render

`document.querySelectorAll('#main li a')` runs on every `renderAll`. For large bookmark sets, this is expensive.

**Fix:** Cache NodeList or use event delegation.

---

### 22. `render/folder.js:22-24,35-38` — Fragile positional DOM traversal

Auto-close logic accesses `children[i].firstChild` assuming fixed `ul > li > a` structure. Any structural change silently breaks it.

**Fix:** Use stable data attribute selectors.

---

### 23. `render/folder.js:85` — Memory leak on folder close

Removing `wrap` via `removeChild` doesn't nullify `onclick`/`_vimNode` on child anchors. Closures capturing `node` objects and scope references are retained until GC collects cyclic DOM→JS references.

**Fix:** Null out expandos before removal, or use event delegation.

---

### 24. `render/node.js:100-101` — Magic number URL prefix check

```js
const urlStart = url.substring(0, 6);
if (urlStart === 'chrome' || urlStart === 'file:/')
```

Magic number 6 is arbitrary and fragile.

**Fix:** Use `url.startsWith('chrome:')` and `url.startsWith('file:')`.

---

### 25. `render/node.js:168` — Duplicate import

`import { state } from '../core/state.js'` at line 168 despite already imported at line 1. Confusing dead code.

**Fix:** Remove the duplicate.

---

### 26. `crud.js:108` — Missing validation

```js
const topLevel = ids.filter(id => state.coords[id]);
```

No check if `id` is defined or valid type.

**Fix:** Filter to real bookmark IDs first.

---

## LOW — Maintainability, Minor

| # | File | Issue |
|---|------|-------|
| 27 | `core/state.js:46` | No `reset()` function — can't clean state for tests/reinit |
| 28 | `entry.js:74-95` | 15+ `window.*` assignments pollute global scope |
| 29 | `config/styles.js:48` | `highlight_font_color` returns empty string — configurable but no-op |
| 30 | `config/storage.js:50` | `setTimeout(0)` deferral for `background_image_file` — fragile timing |
| 31 | `render/renderer.js:7-8` | `removeChild` loop doesn't nullify expandos; `textContent = ''` cleaner |
| 32 | `layout.js:10` | `mutations.setSpecial(SPECIAL)` runs at import time — order-dependent |
| 33 | `render/node.js:13` | Hardcoded special IDs duplicates `special-nodes.js` |
| 34 | `special-nodes.js:118` | Direct DOM query in bookmarks module violates layer separation |
| 35 | `layout.js:100` | Redundant `if (id)` guard after `if (!id) break` |

---

## Architectural Issues

### A. Incomplete DI Wiring (Root Cause of Runtime Crashes)

The setter-injection pattern is the project's biggest risk. Functions declared `let fn = null` with `setFn(fn)` setters must be wired manually in `entry.js`. Two are **not wired** (`removeRow`, `scheduleRestore`), causing runtime crashes. This is a foot-gun — there's no compile-time or runtime check for unbound setters.

**Recommendation:** Replace with a proper DI container that fails fast on unresolved deps, or consolidate circularly-dependent modules.

### B. No Error Boundaries

A crash anywhere in the render pipeline kills the entire extension. No try/catch around render, no fallback UI, no error recovery.

### C. No Test Infrastructure

`npm test` echoes a manual instruction. The modularization cannot be validated automatically. Every refactor is a gamble.

### D. temp_output.js Tracking

The build artifact is gitignored but has been committed/deleted multiple times (`3a29c9f`, `d421623`). This causes confusion about whether the bundled output should be present.

---

## Fix Plan

### Phase 1: Stop the Bleeding (CRITICAL fixes — ~30 min)

1. Wire `setRemoveRow` in `entry.js` + export `removeRow` from `layout.js`
2. Wire `setScheduleRestore` in `entry.js`
3. Fix `wrap.className = null` → `wrap.className = ''` in `folder.js`
4. Remove dead check in `renderer.js`

**Validation:** Load extension, verify no console errors on bookmark load.

### Phase 2: HIGH fixes (~2-3 hours)

5. Replace direct state mutations in `layout.js` with `mutations.*` API
6. Add bounds check to `removeRow` in `layout.js`
7. Remove redundant `loadColumns()` call from `saveColumns()`
8. Debounce `COLUMNS_CHANGED` handler or split loadColumns
9. Fix `special-nodes.js` DOM access with bounds checking
10. Fix `isDefault` check in `config/ui.js` (both occurrences)
11. Fix `config/storage.js` reset emission
12. Fix `drag-drop.js` column vs row discrimination
13. Use `Promise.allSettled` in `column.js`
14. Use minimal reference / WeakMap for `_vimNode` in `node.js`
15. Fix import/export handler accumulation in `ui.js`
16. Filter localStorage export to `options.` prefix

### Phase 3: MEDIUM fixes (~2-3 hours)

17. Add safety bounds to `loadColumns`/`saveColumns` loops
18. Cache column ID lookup (use `state.coords` Set)
19. Fix session mutation in `special-nodes.js`
20. Fix icon element handling in `icons.js`
21. Cache or delegate tooltip queries
22. Use stable selectors in `folder.js`
23. Nullify expandos on folder close
24. Replace magic number with `startsWith`
25. Remove duplicate import in `node.js`
26. Add ID validation in `crud.js`

### Phase 4: Architecture & Debt (~1 day)

- **A.** Replace setter-injection DI with a fail-fast DI container or merge circular modules
- **B.** Add try/catch around render pipeline with error UI fallback
- **C.** Add unit tests for state mutations and DI wiring (vitest + jsdom)
- **D.** Remove `temp_output.js` from any tracking; ensure `.gitignore` is correct
- **E.** Remove `window.*` global assignments; migrate to explicit imports
- **F.** Add `state.reset()` for clean reinitialization

---

## Estimated Total Effort

| Phase | Time | Risk |
|-------|------|------|
| 1 — Critical | 30 min | Low — isolated fixes |
| 2 — High | 2-3 hrs | Medium — state API changes need testing |
| 3 — Medium | 2-3 hrs | Low — mostly isolated improvements |
| 4 — Architecture | 1 day | High — DI refactor touches many files |
| **Total** | **~2 days** | |

---

## Risk Assessment

The extension is currently **non-functional** under any of these conditions:
- Any bookmark in the column grid is externally deleted (triggers crash #1)
- Any paste or cut operation (triggers crash #2)
- Any folder toggle (applies stale `"null"` class, crash #3)

The DI system is the root cause: incomplete wiring + no validation = silent failures that manifest as runtime crashes weeks after the code was written. The fix plan prioritizes unblocking runtime correctness before architectural cleanup.
