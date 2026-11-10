// Shared jsdom + chrome.* setup for the src/ module tests.
//
// Import this BEFORE importing anything from src/: the extension's modules read
// document/window/localStorage at import time, and vim.js starts a
// MutationObserver as a module side effect. Getting the order wrong produces
// confusing failures that look like bugs in the code under test.
import { JSDOM } from 'jsdom';

export function setupDom(html = '<!DOCTYPE html><html><body><div id="main"></div></body></html>') {
  const dom = new JSDOM(html, { url: 'https://example.com/', pretendToBeVisual: true });

  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.localStorage = dom.window.localStorage;
  globalThis.MutationObserver = dom.window.MutationObserver;
  globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);
  globalThis.cancelAnimationFrame = (id) => clearTimeout(id);

  // jsdom does not implement either of these
  dom.window.HTMLElement.prototype.scrollIntoView = () => {};
  dom.window.matchMedia = () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {},
  });

  return dom;
}

// Installs a chrome.* stub that satisfies chrome-api.js's promise wrappers.
// `nodes` maps id -> bookmark node. Tests that need a failing API override the
// individual method, e.g.
//   chrome.bookmarks.create = (props, cb) => { chrome.runtime.lastError = { message: 'x' }; cb(undefined); };
export function setupChrome(nodes) {
  globalThis.chrome = {
    runtime: { lastError: null },
    bookmarks: {
      get: (id, cb) => setTimeout(() => cb(nodes[id] ? [nodes[id]] : []), 0),
      getSubTree: (id, cb) => setTimeout(() => cb([nodes[id]]), 0),
      getChildren: (id, cb) => setTimeout(() => cb((nodes[id] && nodes[id].children) || []), 0),
      getRecent: (cb) => setTimeout(() => cb([]), 0),
      create: (props, cb) => setTimeout(() => cb({ ...props, id: 'new-id' }), 0),
      update: (id, props, cb) => setTimeout(() => cb({ id, ...props }), 0),
      move: (id, dest, cb) => setTimeout(() => cb({ id, ...dest }), 0),
      remove: (id, cb) => setTimeout(() => cb(undefined), 0),
      removeTree: (id, cb) => setTimeout(() => cb(undefined), 0),
    },
    sessions: {
      getRecentlyClosed: (opts, cb) => setTimeout(() => cb([]), 0),
      getDevices: (cb) => setTimeout(() => cb([]), 0),
      restore: (id, cb) => setTimeout(() => cb(undefined), 0),
    },
    topSites: { get: (cb) => setTimeout(() => cb([]), 0) },
    tabs: {
      create: (props, cb) => setTimeout(() => cb({}), 0),
      update: (id, props, cb) => setTimeout(() => cb({}), 0),
      getCurrent: (cb) => setTimeout(() => cb(null), 0),
    },
    fontSettings: { getFontList: (cb) => setTimeout(() => cb([]), 0) },
  };
  return globalThis.chrome;
}
