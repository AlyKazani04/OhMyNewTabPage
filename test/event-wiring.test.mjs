// The crud -> event -> vim wiring that replaced the crud.js -> vim.js import,
// the overlay primitives that moved out of interaction.js, and the error
// handling on the crud write paths.
import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setupDom, setupChrome } from './helpers/dom.mjs';

const src = (p) => fileURLToPath(new URL('../src/' + p, import.meta.url));
const readSrc = (p) => readFileSync(src(p), 'utf8');

setupDom();
setupChrome({ '1': { id: '1', title: 'Bookmarks Bar', children: [] } });

const { state, mutations } = await import(src('state.js'));
const { emit, on, Events } = await import(src('events.js'));
// Imported before vim.js on purpose: the source tree still has the
// special-nodes <-> render cycle, and layout.js runs
// `mutations.setSpecial(SPECIAL)` at module scope. Entering the graph via
// render.js evaluates special-nodes.js first, so SPECIAL is initialized in
// time. Entering via bookmarks/index.js — the real boot order — does not,
// and native ESM throws "Cannot access 'SPECIAL' before initialization".
await import(src('render.js'));
const vim = await import(src('vim.js'));
const crud = await import(src('bookmarks/crud.js'));
const overlay = await import(src('overlay.js'));

describe('module boundaries (source level)', () => {
  test('crud.js no longer imports vim.js', () => {
    assert.ok(!/from '\.\.\/vim\.js'/.test(readSrc('bookmarks/crud.js')));
  });
  test('layout.js no longer calls scheduleRestore', () => {
    assert.ok(!/scheduleRestore\(/.test(readSrc('bookmarks/layout.js')));
  });
  test('vim.js imports the overlay, not interaction.js', () => {
    const source = readSrc('vim.js');
    assert.ok(/from '\.\/overlay\.js'/.test(source), 'should import overlay.js');
    assert.ok(!/from '\.\/interaction\.js'/.test(source), 'must not import interaction.js');
  });
  test('interaction.js imports the overlay', () => {
    assert.ok(/from '\.\/overlay\.js'/.test(readSrc('interaction.js')));
  });
  test('overlay.js has no imports of its own (cannot participate in a cycle)', () => {
    assert.ok(!/^\s*import\s/m.test(readSrc('overlay.js')));
  });
});

describe('crud -> event -> vim wiring', () => {
  test('vimPendingRestore starts empty', () => {
    assert.equal(state.vimPendingRestore, null);
  });
  test('BOOKMARK_CREATED schedules a cursor restore', () => {
    emit(Events.BOOKMARK_CREATED, '999');
    assert.equal(state.vimPendingRestore, '999');
  });
  test('BOOKMARK_UPDATED schedules a cursor restore', () => {
    emit(Events.BOOKMARK_UPDATED, '888');
    assert.equal(state.vimPendingRestore, '888');
  });
  test('scheduleRestore is idempotent and self-clearing', () => {
    mutations.clearVimPendingRestore();
    vim.scheduleRestore('777');
    assert.equal(state.vimPendingRestore, '777');
  });
  test('an event with no listeners does not throw', () => {
    emit(Events.BOOKMARK_DELETED, '1');
    emit(Events.BOOKMARK_MOVED, { id: '1' });
  });
});

describe('overlay primitives still work after the move', () => {
  test('showModal builds a dialog and submits trimmed values', () => {
    let submitted = null;
    overlay.showModal({
      title: 'New bookmark',
      fields: [{ label: 'Name', value: 'a' }, { label: 'URL', value: 'b' }],
      submitLabel: 'Create',
      onSubmit: (values) => { submitted = values; return true; },
    });
    const form = document.querySelector('form.vim-modal');
    assert.ok(form, 'modal form should exist');
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
    assert.deepEqual(submitted, ['a', 'b']);
    assert.equal(document.querySelector('.vim-modal-backdrop'), null, 'backdrop removed after submit');
  });

  test('showModal keeps the dialog open when onSubmit returns false', () => {
    overlay.showModal({ title: 'x', fields: [], onSubmit: () => false });
    const backdrop = document.querySelector('.vim-modal-backdrop');
    assert.ok(backdrop, 'backdrop should remain');
    backdrop.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }));
    assert.equal(document.querySelector('.vim-modal-backdrop'), null, 'backdrop removed on backdrop click');
  });

  test('renderMenu renders items and closeMenu removes it', () => {
    const ul = overlay.renderMenu(
      [{ label: 'One', action: () => {} }, { label: 'Two', action: () => {} }],
      10, 10,
    );
    assert.equal(ul.tagName, 'UL');
    assert.equal(ul.querySelectorAll('a[role="menuitem"]').length, 2);
    overlay.closeMenu(ul);
    assert.equal(document.querySelector('ul.menu'), null);
  });

  test('closeMenu is a no-op on a missing node', () => {
    overlay.closeMenu(null);
  });
});

describe('crud write failures', () => {
  // chrome-api.js rejects when chrome.runtime.lastError is set, so a failing
  // Chrome call surfaces as a rejected promise — not as a null result.
  const makeFail = (method, message) => {
    const original = chrome.bookmarks[method];
    chrome.bookmarks[method] = (id, props, cb) => {
      chrome.runtime.lastError = { message };
      (typeof props === 'function' ? props : cb)(undefined);
    };
    return () => { chrome.bookmarks[method] = original; chrome.runtime.lastError = null; };
  };

  const collect = (event) => {
    const seen = [];
    const off = on(event, (data) => seen.push(data));
    return { seen, off };
  };

  test('a rejecting bmCreate does not throw and does not emit', async () => {
    const restore = makeFail('create', 'create failed');
    const { seen, off } = collect(Events.BOOKMARK_CREATED);
    try {
      await crud.createBookmarkAt({ parentId: '1', title: 'x' });
    } finally {
      off(); restore();
    }
    assert.deepEqual(seen, []);
  });

  test('a bmCreate resolving undefined does not throw and does not emit', async () => {
    const original = chrome.bookmarks.create;
    chrome.bookmarks.create = (props, cb) => cb(undefined);
    const { seen, off } = collect(Events.BOOKMARK_CREATED);
    try {
      await crud.createBookmarkAt({ parentId: '1', title: 'x' });
    } finally {
      off(); chrome.bookmarks.create = original;
    }
    assert.deepEqual(seen, []);
  });

  test('a successful create emits BOOKMARK_CREATED with the new id', async () => {
    const { seen, off } = collect(Events.BOOKMARK_CREATED);
    try {
      await crud.createBookmarkAt({ parentId: '1', title: 'ok' });
    } finally {
      off();
    }
    assert.deepEqual(seen, ['new-id']);
  });

  test('a rejecting bmUpdate does not throw and does not emit', async () => {
    const restore = makeFail('update', 'update failed');
    const { seen, off } = collect(Events.BOOKMARK_UPDATED);
    try {
      await crud.updateBookmark('1', { title: 'y' });
    } finally {
      off(); restore();
    }
    assert.deepEqual(seen, []);
  });

  test('delete handles a missing bmGet gracefully (loop continues)', async () => {
    const originalGet = chrome.bookmarks.get;
    chrome.bookmarks.get = (id, cb) => {
      // First id's get returns empty; others return a result
      if (id === 'missing') cb([]);
      else cb([{ id, title: 't', url: 'https://x' }]);
    };
    try {
      await crud.deleteBookmarksByIds(['missing', 'keep']);
    } finally {
      chrome.bookmarks.get = originalGet;
    }
    // Loop should have continued past the missing id
  });
});

describe('last cycle: tree.js / special-nodes.js boundaries', () => {
  test('tree.js no longer imports layout.js', () => {
    assert.ok(!/from '\.\/layout\.js'/.test(readSrc('bookmarks/tree.js')));
  });
  test('special-nodes.js no longer imports render.js or tree.js (it is a leaf)', () => {
    const source = readSrc('bookmarks/special-nodes.js');
    assert.ok(!/from '\.\.\/render\.js'/.test(source), 'must not import render.js');
    assert.ok(!/from '\.\/tree\.js'/.test(source), 'must not import tree.js');
  });

  test('BOOKMARK_MISSING drops the stale grid entry', () => {
    state.columns = [['f1', 'f2']];
    state.coords = { f1: { x: 0, y: 0 }, f2: { x: 0, y: 1 } };
    emit(Events.BOOKMARK_MISSING, 'f1');
    const all = state.columns.flat();
    assert.ok(!all.includes('f1'), 'f1 should be gone from the grid');
    assert.ok(all.includes('f2'), 'f2 should remain');
  });

  test('CLOSED_REFRESH re-renders the recently-closed list in place', async () => {
    const main = document.getElementById('main');
    main.innerHTML = '';
    const col = document.createElement('div');
    const a = document.createElement('a');
    a.className = 'closed';
    const stale = document.createElement('div');
    col.appendChild(a);
    col.appendChild(stale);
    main.appendChild(col);

    emit(Events.CLOSED_REFRESH);
    await new Promise((r) => setTimeout(r, 20));

    assert.ok(!col.contains(stale), 'the stale child list should be removed');
    assert.ok(col.querySelector('ul'), 'a fresh list should be rendered');
  });
});
