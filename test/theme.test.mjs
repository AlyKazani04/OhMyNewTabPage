// Functional check of the ported theme_mode logic (PR #23) into src/config/config.js.
// Run via `npm test` (node --test), or directly: node test/theme.test.mjs
//
// This file stubs its own localStorage: the real Storage API is not available
// outside a browser, and config.js reads it three ways — getItem/setItem,
// removeItem, and Object.keys() (to find any stored `options.*` key). The
// Proxy below covers all three; `store` is the SAME Map the Proxy fronts, so
// seeding `store` is visible through `localStorage`.
import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert';

const store = new Map();

globalThis.localStorage = new Proxy(store, {
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

const mediaListeners = [];
let listenerCount = 0;

globalThis.window = {
  matchMedia: (q) => ({
    matches: q.includes('dark') ? false : true, // default: light OS
    addEventListener: (ev, fn) => { listenerCount++; mediaListeners.push(fn); },
    removeEventListener: () => {},
  }),
};
globalThis.document = { documentElement: { style: { setProperty: () => {} } } };

const cfg = await import(
  new URL('../src/config/config.js', import.meta.url).href,
);

describe('fresh install (System mode, light OS)', () => {
  test('defaults resolve', () => {
    cfg.loadAll();
    assert.equal(cfg.get('theme_mode'), 'System');
    assert.equal(cfg.get('theme'), 'Nord');
    assert.equal(cfg.get('theme_light'), 'Nord Light');
    assert.equal(cfg.isLightActive(), true);
    assert.equal(cfg.currentTheme.background_color, '#eceff4');
  });
});

describe('forced modes', () => {
  test('Dark', () => {
    cfg.set('theme_mode', 'Dark');
    assert.equal(cfg.isLightActive(), false);
    assert.equal(cfg.currentTheme.background_color, '#2e3440');
  });

  test('Light', () => {
    cfg.set('theme_mode', 'Light');
    assert.equal(cfg.isLightActive(), true);
    assert.equal(cfg.currentTheme.background_color, '#eceff4');
  });
});

describe('validation', () => {
  test('unknown theme_mode falls back to System', () => {
    assert.equal(cfg.validate('theme_mode', 'bogus'), 'System');
  });
  test('known theme_mode accepted', () => {
    assert.equal(cfg.validate('theme_mode', 'Dark'), 'Dark');
  });
});

describe('migration: existing user with a saved dark theme', () => {
  beforeEach(() => {
    store.clear();
    mediaListeners.length = 0;
    store.set('options.theme', 'Gruvbox');
    store.set('options.font_size', '18');
    cfg.loadAll();
  });

  test('pins mode to Dark', () => {
    assert.equal(store.get('options.theme_mode'), 'Dark');
  });
  test('keeps the saved theme', () => {
    assert.equal(store.get('options.theme'), 'Gruvbox');
  });
  test('writes the migration marker', () => {
    assert.equal(store.get('meta.theme_mode_migrated'), '1');
  });
  test('is idempotent', () => {
    cfg.loadAll();
    assert.equal(store.get('options.theme_mode'), 'Dark');
  });
});

describe('migration: existing user with a saved light theme', () => {
  beforeEach(() => {
    store.clear();
    store.set('options.theme', 'Nord Light');
    cfg.loadAll();
  });

  test('pins mode to Light', () => {
    assert.equal(store.get('options.theme_mode'), 'Light');
  });
  test('moves theme -> theme_light', () => {
    assert.equal(store.get('options.theme_light'), 'Nord Light');
  });
  test('removes the old theme key', () => {
    assert.equal(store.get('options.theme'), undefined);
  });
});

describe('legacy import mapping', () => {
  test('light theme -> Light mode', () => {
    const entries = { 'options.theme': 'Catppuccin Latte' };
    cfg.applyLegacyThemeMode(entries);
    assert.equal(entries['options.theme_mode'], 'Light');
    assert.equal(entries['options.theme_light'], 'Catppuccin Latte');
  });
  test('dark theme -> Dark mode', () => {
    const entries = { 'options.theme': 'Gruvbox' };
    cfg.applyLegacyThemeMode(entries);
    assert.equal(entries['options.theme_mode'], 'Dark');
  });
});

describe('OS change listener', () => {
  test('registered at import', () => {
    store.clear();
    store.set('options.theme_mode', 'System');
    cfg.loadAll();
    assert.ok(listenerCount > 0);
  });
});
