// The real boot order enters the module graph via bookmarks/index.js, whose
// barrel evaluates special-nodes.js first. While the special-nodes <-> render
// cycle existed, native ESM threw here:
//
//   ReferenceError: Cannot access 'SPECIAL' before initialization
//     at bookmarks/layout.js:9  (mutations.setSpecial(SPECIAL))
//
// The esbuild bundle reorders modules and never hit it, so this only fails
// under native ESM — which is exactly the case worth pinning.
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { setupDom, setupChrome } from './helpers/dom.mjs';

setupDom();
setupChrome({ '0': { id: '0', title: 'root', children: [] } });

const url = (p) => new URL('../src/' + p, import.meta.url).href;

describe('real boot order (bookmarks/index.js first)', () => {
  test('evaluates without a temporal-dead-zone error', async () => {
    // Throws before the last cycle was broken; a throw here fails the test.
    const bookmarks = await import(url('bookmarks/index.js'));
    assert.ok(bookmarks, 'the barrel should load');
  });

  test('layout.js module scope seeds state.special', async () => {
    const { state } = await import(url('state.js'));
    // layout.js runs `mutations.setSpecial(SPECIAL)` at module scope; if SPECIAL
    // were still in its TDZ this import would have thrown above.
    assert.ok(state.special, 'state.special should be set');
    assert.ok(Object.keys(state.special).length > 0, 'state.special should not be empty');
  });
});
