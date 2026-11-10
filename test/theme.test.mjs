// Functional check of the ported theme_mode logic (PR #23) into src/config/config.js
// Run: node test/theme.test.mjs  (from the project root)
import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { setupDom } from './helpers/dom.mjs';

// Chrome must have already been set up via setupDom / setupChrome in a parent
// test file, or stub it here. The theme harness stubs its own chrome.
globalThis.localStorage = new Map();

// Proxy so Object.keys(localStorage) returns the STORED keys, like a real Storage.
globalThis.localStorage = new Proxy(globalThis.localStorage, {
  get(target, prop) {
    if (prop === 'getItem') return (k) => (target.has(k) ? target.get(k) : null);
    if (prop === 'setItem') return (k, v) => target.set(k, String(v));
    if (prop === 'removeItem') return (k) => target.delete(k);
    if (prop === 'key') return (i) => [...target.keys()][i] ?? null;
    if (prop === 'length') return target.size;
    return target.get(prop) ?? undefined;
  },
  has(target, prop) { return target.has(prop); },
  ownKeys(target) { return [...target.keys()]; },
  getOwnPropertyDescriptor(target, prop) {
    return target.has(prop)
      ? { enumerable: true, configurable: true, value: target.get(prop) }
      : undefined;
  },
});

// shared by the theme harness
let mediaListeners = [];
let listenerCount = 0;

globalThis.window = {
  matchMedia: (q) => ({ matches: q.includes('dark') ? false : true, // default: light OS
    addEventListener: (ev, fn) => { listenerCount++; mediaListeners.push(fn); },
    removeEventListener: () => {},
  }),
};
globalThis.document = { documentElement: { style: { setProperty: () => {} } } };

const cfg = await import('/home/f4ll3n/Work/Projects/OhMyNewTabPage/src/config/config.js');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); console.log('  PASS  ' + name); pass++; }
  catch (e) { console.log('  FAIL  ' + name + ' :: ' + e.message); fail++; }
}

console.log('--- fresh install (System mode, light OS) ---');
cfg.loadAll();
t('theme_mode default is System', () => assert.equal(cfg.get('theme_mode'), 'System'));
t('theme default is Nord', () => assert.equal(cfg.get('theme'), 'Nord'));
t('theme_light default is Nord Light', () => assert.equal(cfg.get('theme_light'), 'Nord Light'));
t('isLightActive() true on light OS', () => assert.equal(cfg.isLightActive(), true));
t('currentTheme resolves to the LIGHT theme', () => assert.equal(cfg.currentTheme.background_color, '#eceff4'));

console.log('--- forced Dark mode ---');
cfg.set('theme_mode', 'Dark');
t('isLightActive() false when forced Dark', () => assert.equal(cfg.isLightActive(), false));
t('currentTheme resolves to the DARK theme', () => assert.equal(cfg.currentTheme.background_color, '#2e3440'));

console.log('--- forced Light mode ---');
cfg.set('theme_mode', 'Light');
t('isLightActive() true when forced Light', () => assert.equal(cfg.isLightActive(), true));
t('currentTheme resolves to the LIGHT theme', () => assert.equal(cfg.currentTheme.background_color, '#eceff4'));

console.log('--- validation ---');
t('validate(theme_mode, "bogus") falls back to System', () => assert.equal(cfg.validate('theme_mode', 'bogus'), 'System'));
t('validate(theme_mode, "Dark") accepted', () => assert.equal(cfg.validate('theme_mode', 'Dark'), 'Dark'));

console.log('--- migration: existing user with a saved dark theme ---');
const store = new Map();
store.set('options.theme', 'Gruvbox');
store.set('options.font_size', '18');
cfg.loadAll();
t('migration pins mode to Dark', () => assert.equal(store.get('options.theme_mode'), 'Dark'));
t('migration keeps the saved theme', () => assert.equal(store.get('options.theme'), 'Gruvbox'));
t('migration marker written', () => assert.equal(store.get('meta.theme_mode_migrated'), '1'));
t('idempotent: second loadAll does not change mode', () => { cfg.loadAll(); assert.equal(store.get('options.theme_mode'), 'Dark'); });

console.log('--- migration: existing user with a saved LIGHT theme ---');
store.clear();
store.set('options.theme', 'Nord Light');
cfg.loadAll();
t('migration pins mode to Light', () => assert.equal(store.get('options.theme_mode'), 'Light'));
t('migration moves theme -> theme_light', () => assert.equal(store.get('options.theme_light'), 'Nord Light'));
t('migration removes old theme key', () => assert.equal(store.get('options.theme'), null));

console.log('--- legacy import mapping ---');
const entries = { 'options.theme': 'Catppuccin Latte' };
cfg.applyLegacyThemeMode(entries);
t('legacy light theme -> Light mode', () => assert.equal(entries['options.theme_mode'], 'Light'));
t('legacy light theme moved to theme_light', () => assert.equal(entries['options.theme_light'], 'Catppuccin Latte'));
const entries2 = { 'options.theme': 'Gruvbox' };
cfg.applyLegacyThemeMode(entries2);
t('legacy dark theme -> Dark mode', () => assert.equal(entries2['options.theme_mode'], 'Dark'));

console.log('--- OS change listener ---');
store.clear();
store.set('options.theme_mode', 'System');
cfg.loadAll();
t('listener registered at import', () => assert.ok(listenerCount > 0));

console.log('');
console.log(`RESULT: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);