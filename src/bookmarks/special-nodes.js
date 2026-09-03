import { get } from '../config/storage.js';
import * as chromeApi from '../core/chrome-api.js';

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
      if (chrome.topSites) {
        chrome.topSites.get((result) => {
          callback(result.slice(0, get('number_top')));
        });
      } else {
        callback([]);
      }
    },
  },
  recent: {
    label: 'Recent bookmarks',
    children: (callback) => {
      chrome.bookmarks.getRecent(get('number_recent'), callback);
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
  chrome.sessions.getRecentlyClosed(
    { maxResults },
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
            chrome.sessions.restore(
              session.window ? session.window.sessionId : session.tab.sessionId,
              () => {
                refreshClosed();
              }
            );
            return false;
          },
        });
      }
      callback(nodes);
    }
  );
}

// Get other devices
function getDevices(callback) {
  chrome.sessions.getDevices(
    { maxResults: get('number_closed') },
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
    }
  );
}

// Refresh recently closed tab lists
export function refreshClosed() {
  const targets = [];
  const folders = document.getElementsByClassName('closed');
  for (let i = 0; i < folders.length; i++) {
    const a = folders[i];
    if (a.nextSibling) {
      a.parentNode.removeChild(a.nextSibling);
      targets.push(a.parentNode);
    }
  }
  if (folders.length === 0 && window.coords && window.coords['closed']) {
    const target = document.getElementsByClassName('column')[window.coords['closed'].x];
    target.removeChild(target.firstChild);
    targets.push(target);
  }

  getChildrenFunction({ id: 'closed' })( (result) => {
    for (let i = 0; i < targets.length; i++) renderAll(result, targets[i]);
  });
}

// These will be set by the shim after all modules load
let getChildrenFunction = null;
let renderAll = null;

export function setGetChildrenFunction(fn) {
  getChildrenFunction = fn;
}

export function setRenderAll(fn) {
  renderAll = fn;
}