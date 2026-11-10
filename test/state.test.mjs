// Step 6 (single state object): state that used to live in module-private `let`
// bindings now lives on the shared state object.
//
// These tests are a regression guard. They fail if a module re-introduces its
// own private copy, which is exactly the drift Step 6 exists to prevent.
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { setupDom, setupChrome } from './helpers/dom.mjs';

const src = (p) => fileURLToPath(new URL('../src/' + p, import.meta.url));
const readSrc = (p) => readFileSync(src(p), 'utf8');
const importSrc = (p) => import(new URL('../src/' + p, import.meta.url).href);

setupDom();
setupChrome({ '0': { id: '0', title: 'root', children: [] } });

describe('state centralisation', () => {
  test('drag + tooltip state live on the state object', async () => {
    const { state } = await importSrc('state.js');
    assert.ok(state.drag, 'state.drag should exist');
    assert.ok('ids' in state.drag && 'target' in state.drag);
    assert.strictEqual(state.drag.ids, null);
    assert.strictEqual(state.drag.target, null);
    assert.ok('tooltipTimeout' in state);
  });

  test('interaction.js and render.js keep no private copies', () => {
    assert.ok(!/^\s*let dragIds\b/m.test(readSrc('interaction.js')));
    assert.ok(!/^\s*let dropTarget\b/m.test(readSrc('interaction.js')));
    assert.ok(!/^\s*let tooltipTimeout\b/m.test(readSrc('render.js')));
  });

  test('a drag lifecycle writes only to state.drag', async () => {
    const { state } = await importSrc('state.js');
    const { enableDragColumn, clearDropTarget } = await importSrc('interaction.js');

    const column = document.createElement('div');
    document.getElementById('main').appendChild(column);
    state.columns = [['1', '2']];

    // jsdom has no DragEvent; the handlers only touch event.dataTransfer.
    enableDragColumn(0, column);
    column.ondragstart({ dataTransfer: {} });
    assert.deepEqual(state.drag.ids, ['1', '2'], 'dragstart should record the dragged ids');

    clearDropTarget();
    column.ondragend();
    assert.strictEqual(state.drag.ids, null, 'dragend should clear the dragged ids');
    assert.strictEqual(state.drag.target, null);
  });
});
