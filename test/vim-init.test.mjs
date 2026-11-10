// vim.js used to self-initialize at import time: it registered the bookmark
// event listeners, constructed a MutationObserver, and called vimInit() from an
// auto-init block keyed off `document.readyState`. entry.js now calls vimInit()
// explicitly, so importing vim.js must be free of side effects.
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { setupDom, setupChrome } from './helpers/dom.mjs';

setupDom();
setupChrome({ '0': { id: '0', title: 'root', children: [] } });

const importSrc = (p) => import(new URL('../src/' + p, import.meta.url).href);

describe('vim init', () => {
  test('importing vim.js wires nothing', async () => {
    const { Events, listenerCount } = await importSrc('events.js');
    await importSrc('vim.js'); // must not register listeners or touch the DOM

    assert.strictEqual(listenerCount(Events.BOOKMARK_CREATED), 0,
      'BOOKMARK_CREATED must have no listener before vimInit()');
    assert.strictEqual(listenerCount(Events.BOOKMARK_UPDATED), 0);
  });

  test('vimInit() wires the bookmark events', async () => {
    const { state, mutations } = await importSrc('state.js');
    const { emit, Events } = await importSrc('events.js');
    const { vimInit } = await importSrc('vim.js');

    vimInit();
    mutations.setVimPendingRestore(null);
    emit(Events.BOOKMARK_CREATED, 'x');
    assert.strictEqual(state.vimPendingRestore, 'x',
      'vimInit() should make the cursor layer react to writes');
    mutations.setVimPendingRestore(null);
  });

  test('vimInit() is idempotent', async () => {
    const { Events, listenerCount } = await importSrc('events.js');
    const { vimInit } = await importSrc('vim.js');

    vimInit();
    const afterOne = listenerCount(Events.BOOKMARK_CREATED);
    assert.ok(afterOne > 0, 'vimInit() should register the listener');

    vimInit();
    vimInit();
    assert.strictEqual(listenerCount(Events.BOOKMARK_CREATED), afterOne,
      'repeat calls must not add listeners');
  });
});
