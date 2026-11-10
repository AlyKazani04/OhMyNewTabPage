// render.js -> RENDER_COMPLETE -> interaction.js attachRenderHandlers.
// Guards the cycle-A break: render.js produces DOM and emits; interaction.js
// attaches behavior. Neither may import the other's direction back.
import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';
import { setupDom, setupChrome } from './helpers/dom.mjs';

const src = (p) => fileURLToPath(new URL('../src/' + p, import.meta.url));

setupDom();

const nodes = {
  f1: { id: 'f1', title: 'Folder 1', children: [
    { id: 'c1', title: 'Child 1', url: 'https://a.com' },
    { id: 'f3', title: 'Nested Folder', children: [ { id: 'c2', title: 'Child 2', url: 'https://b.com' } ] },
  ] },
  f2: { id: 'f2', title: 'Folder 2', children: [] },
  f4: { id: 'f4', title: 'Folder 4', children: [] },
  f5: { id: 'f5', title: 'Folder 5', children: [] },
};
setupChrome(nodes);

const { state } = await import(src('state.js'));
const render = await import(src('render.js'));
const interaction = await import(src('interaction.js'));

// Shared DOM handles, assigned by the first describe's before() hook.
let columns, anchors, main;

describe('initial render (2 columns)', () => {
  before(async () => {
    state.columns = [['f1', 'f2'], ['f4', 'f5']];
    await render.renderColumns();
    columns = document.getElementsByClassName('column');
    anchors = [...document.querySelectorAll('#main a')];
    main = document.getElementById('main');
  });

  test('two columns rendered', () => assert.equal(columns.length, 2));
  test('four top-level anchors rendered', () => assert.equal(anchors.length, 4));
  test('folder anchor 1 has onclick', () => assert.equal(typeof anchors[0].onclick, 'function'));
  test('folder anchor 1 has oncontextmenu', () => assert.equal(typeof anchors[0].oncontextmenu, 'function'));
  test('folder anchor 1 is draggable', () => assert.equal(anchors[0].draggable, true));
  test('folder anchor 2 has onclick', () => assert.equal(typeof anchors[1].onclick, 'function'));
  test('folder anchor 4 has onclick', () => assert.equal(typeof anchors[2].onclick, 'function'));
  test('folder anchor 5 has onclick', () => assert.equal(typeof anchors[3].onclick, 'function'));
  test('column 0 has oncontextmenu', () => assert.equal(typeof columns[0].oncontextmenu, 'function'));
  test('column 1 has oncontextmenu', () => assert.equal(typeof columns[1].oncontextmenu, 'function'));
  test('column 0 is draggable', () => assert.equal(columns[0].draggable, true));
  test('main has ondragover', () => assert.equal(typeof main.ondragover, 'function'));
  test('main has ondragleave', () => assert.equal(typeof main.ondragleave, 'function'));
  test('main has ondrop', () => assert.equal(typeof main.ondrop, 'function'));
});

describe('folder expansion (nested render)', () => {
  let after, f3, c1;

  before(() => {
    const a1 = anchors.find((a) => a._vimNode && a._vimNode.id === 'f1');
    render.toggle(nodes.f1, a1);
    after = [...document.querySelectorAll('#main a')];
    f3 = after.find((a) => a._vimNode && a._vimNode.id === 'f3');
    c1 = after.find((a) => a._vimNode && a._vimNode.id === 'c1');
  });

  test('children rendered (6 anchors total)', () => assert.equal(after.length, 6));
  test('nested folder f3 exists', () => assert.ok(f3));
  test('nested folder f3 got onclick after expansion', () => assert.equal(typeof f3.onclick, 'function'));
  test('nested folder f3 got oncontextmenu', () => assert.equal(typeof f3.oncontextmenu, 'function'));
  test('nested folder f3 is draggable', () => assert.equal(f3.draggable, true));
  test('plain link c1 has no folder onclick', () => assert.equal(c1.onclick, null));
});

describe('pre-expanded folder on first render (un-awaited nested render)', () => {
  let pre, preF3;

  before(async () => {
    localStorage.setItem('open.f1', 'true');
    state.columns = [['f1', 'f2'], ['f4', 'f5']];
    await render.renderColumns();
    // the nested render for a pre-expanded folder resolves in its own callback
    await new Promise((r) => setTimeout(r, 20));
    pre = [...document.querySelectorAll('#main a')];
    preF3 = pre.find((a) => a._vimNode && a._vimNode.id === 'f3');
  });

  test('nested children rendered for pre-expanded folder', () => assert.ok(preF3));
  test('pre-expanded nested folder got onclick', () => assert.equal(typeof preF3.onclick, 'function'));
  test('pre-expanded nested folder is draggable', () => assert.equal(preF3.draggable, true));
});

describe('attachRenderHandlers is idempotent', () => {
  let after2;

  before(() => {
    interaction.attachRenderHandlers();
    after2 = [...document.querySelectorAll('#main a')];
  });

  test('re-running does not change anchor count', () => assert.equal(after2.length, 6));
  test('re-running keeps handlers attached', () => {
    assert.equal(typeof after2.find((a) => a._vimNode.id === 'f3').onclick, 'function');
  });
});
