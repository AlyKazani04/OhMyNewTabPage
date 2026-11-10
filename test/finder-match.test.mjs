// Finder matcher (src/finder-match.js): bookmark index building, fzf-style
// matching, ranking and reveal column picking. Pure functions, so no DOM setup.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildIndex, fuzzyMatch, rankEntries, pickColumn } from '../src/finder-match.js';

const tree = [{ id: '0', title: '', children: [
  { id: '1', title: 'Bookmarks bar', children: [
    { id: '10', title: 'Dev', children: [
      { id: '100', title: 'GitHub', url: 'https://www.github.com/' },
      { id: '101', title: '', url: 'https://example.com/a' },
    ] },
  ] },
  { id: '2', title: 'Other bookmarks', children: [] },
] }];

test('buildIndex flattens the tree', () => {
  const idx = buildIndex(tree);
  assert.deepEqual(idx.map(e => e.node.id).sort(), ['1', '10', '100', '101', '2']);
  const gh = idx.find(e => e.node.id === '100');
  assert.equal(gh.path, 'Bookmarks bar › Dev');
  assert.deepEqual(gh.ancestors, ['1', '10']);
  assert.equal(gh.urlText, 'github.com/');
  assert.equal(gh.isFolder, false);
  assert.equal(idx.find(e => e.node.id === '101').title, 'https://example.com/a');
  const bar = idx.find(e => e.node.id === '1');
  assert.equal(bar.path, ''); assert.deepEqual(bar.ancestors, []); assert.equal(bar.isFolder, true);
});

test('buildIndex skips separators', () => {
  const idx = buildIndex([{ id: '0', children: [{ id: '1', title: 'A', children: [
    { id: '5', title: '', description: 'separator', url: 'x' }, { id: '6', title: 'B', url: 'http://b' }] }] }]);
  assert.deepEqual(idx.map(e => e.node.id), ['1', '6']);
});

test('fuzzyMatch matches in order, case-insensitively', () => {
  assert.deepEqual(fuzzyMatch('ghac', 'GitHub Actions').positions, [0, 3, 7, 8]);
  assert.equal(fuzzyMatch('hg', 'GitHub'), null);
  assert.equal(fuzzyMatch('xyz', 'GitHub'), null);
  assert.ok(fuzzyMatch('GIT', 'github'));
  assert.ok(fuzzyMatch('c++', 'C++ docs'));
  assert.equal(fuzzyMatch('.*(', 'GitHub'), null);
});

test('fuzzyMatch tightens the match window', () => {
  assert.deepEqual(fuzzyMatch('ab', 'a_xab').positions, [3, 4]);
});

test('fuzzyMatch scoring prefers start/boundary and consecutive', () => {
  assert.ok(fuzzyMatch('rep', 'Repos').score > fuzzyMatch('rep', 'Prepare').score);
  assert.ok(fuzzyMatch('abc', 'xabcx').score > fuzzyMatch('abc', 'xaxbxcx').score);
});

test('rankEntries: title beats url-only, multi-term, blank, limit, tie-breaks', () => {
  const e = (id, title, url, path = '', folder = false) =>
    ({ node: { id, title, url }, isFolder: folder, title, path, ancestors: [], urlText: url || '' });
  const r = rankEntries('github', [e('a', 'Docs', 'github.com/x'), e('b', 'GitHub', 'github.com')]);
  assert.equal(r[0].entry.node.id, 'b');
  const m = rankEntries('dev git', [e('w', 'GitHub', '', 'Work'), e('d', 'GitHub', '', 'Dev')]);
  assert.deepEqual(m.map(x => x.entry.node.id), ['d']);
  assert.deepEqual(rankEntries('   ', [e('a', 'x', '')]), []);
  const many = Array.from({ length: 60 }, (_, i) => e(String(i), 'item ' + i, ''));
  assert.equal(rankEntries('item', many).length, 50);
  const t = rankEntries('git', [e('long', 'git stuff', ''), e('short', 'git', ''), e('f', 'git', '', '', true)]);
  assert.deepEqual(t.map(x => x.entry.node.id).slice(0, 2), ['short', 'f']);
  assert.ok(r[0].highlights.title.length > 0);
});

test('rankEntries is fast on 10k entries', () => {
  const big = Array.from({ length: 10000 }, (_, i) =>
    ({ node: { id: String(i) }, isFolder: false, title: 'Bookmark number ' + i, path: 'Folder ' + (i % 50), ancestors: [], urlText: 'site' + i + '.com/page' }));
  const t0 = performance.now(); rankEntries('bkn 42', big);
  assert.ok(performance.now() - t0 < 100);
});

test('pickColumn', () => {
  const chain = ['1', '10', '100'];
  assert.deepEqual(pickColumn(chain, [['1', '2', '3']], false), { x: 0, start: 0 });
  assert.deepEqual(pickColumn(chain, [['1']], false), { x: 0, start: 1 });
  assert.deepEqual(pickColumn(chain, [['1']], true), { x: 0, start: 0 });
  assert.deepEqual(pickColumn(chain, [['1'], ['10']], false), { x: 1, start: 2 });
  assert.deepEqual(pickColumn(chain, [['1'], ['10']], true), { x: 1, start: 1 });
  assert.equal(pickColumn(chain, [['2']], false), null);
  assert.deepEqual(pickColumn(['1', '10'], [['1'], ['10']], false), { x: 1, start: 2 });
});

test('fuzzyMatch keeps indexes aligned for Turkish dotted/dotless I', () => {
  assert.deepEqual(fuzzyMatch('iş', 'İş').positions, [0, 1]);
  assert.deepEqual(fuzzyMatch('ş', 'Bookmarks bar › İş').positions, [17]);
  assert.deepEqual(fuzzyMatch('istanbul', 'İstanbul').positions, [0, 1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(fuzzyMatch('kitap', 'İş › Kitap').positions, [5, 6, 7, 8, 9]);
  assert.deepEqual(fuzzyMatch('bel', 'İstanbul Belediyesi').positions, [9, 10, 11]);
  assert.deepEqual(fuzzyMatch('İŞ', 'iş').positions, [0, 1]);
  assert.ok(fuzzyMatch('ışık', 'IŞIK'));
  const e = { node: { id: 'f', title: 'İş' }, isFolder: true, title: 'İş', path: 'Bookmarks bar', ancestors: [], urlText: '' };
  assert.deepEqual(rankEntries('iş', [e])[0].highlights.title, [0, 1]);
});
