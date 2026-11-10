import { get } from '../config/config.js';
import * as chromeApi from '../chrome-api.js';
import { emit, Events } from '../events.js';

// ----- SPECIAL_NODES -----
// Virtual (non-bookmark) top-level entries
export const SPECIAL = {
  apps: {
    label: 'Apps',
    url: 'chrome://apps',
    children: null,
  },
  top: {
    label: 'Most visited',
    children: (callback) => {
      chromeApi.getTopSites().then(
        (result) => callback(result.slice(0, get('number_top'))),
        () => callback([])
      );
    },
  },
  recent: {
    label: 'Recent bookmarks',
    children: (callback) => {
      chromeApi.bmGetRecent(get('number_recent')).then(
        (result) => callback(result),
        () => callback([])
      );
    },
  },
  closed: {
    label: 'Recently closed',
    children: (callback) => {
      getClosed(callback);
    },
  },
  devices: {
    label: 'Other devices',
    children: (callback) => {
      getDevices(callback);
    },
  },
};

export const specialKeys = Object.keys(SPECIAL);

// Get special node by id
export function getSpecialNode(id) {
  return SPECIAL[id];
}

// Check if id is a special node
export function isSpecial(id) {
  return id in SPECIAL;
}

// Get recently closed tabs
function getClosed(callback) {
  const maxResults = get('number_closed');
  chromeApi.getRecentlyClosed(maxResults).then(
    (sessions) => {
      const nodes = [];
      for (let i = 0; i < sessions.length && i < maxResults; i++) {
        const session = sessions[i];
        if (session.window && session.window.tabs.length === 1) {
          session.tab = session.window.tabs[0];
        }
        nodes.push({
          title: session.tab
            ? session.tab.title
            : session.window.tabs.length + ' Tabs',
          url: session.tab ? session.tab.url : null,
          className: session.window ? 'window' : null,
          action: () => {
            chromeApi.restoreSession(
              session.window ? session.window.sessionId : session.tab.sessionId
            ).then(() => emit(Events.CLOSED_REFRESH));
            return false;
          },
        });
      }
      callback(nodes);
    },
    () => callback([])
  );
}

// Get other devices
function getDevices(callback) {
  chromeApi.getDevices().then(
    (devices) => {
      const nodes = [];
      for (let i = 0; i < devices.length; i++) {
        const device = devices[i];
        const children = [];
        for (let j = 0; j < device.sessions.length; j++) {
          const session = device.sessions[j];
          const tabs = session.window ? session.window.tabs : [session.tab];
          for (let k = 0; k < tabs.length; k++) {
            children.push({
              title: tabs[k].title,
              url: tabs[k].url,
            });
          }
        }
        nodes.push({
          id: 'device.' + device.deviceName,
          title: device.deviceName,
          children,
        });
      }
      callback(nodes);
    },
    () => callback([])
  );
}

// Refresh recently closed tab lists lives in render.js: it is DOM work, and
// keeping it here forced this module to import render.js (and tree.js), which
// is what closed the last import cycle. This module now only defines virtual
// nodes and fetches their children; restoring a session emits CLOSED_REFRESH.

