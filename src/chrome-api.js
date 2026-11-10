// Bookmarks API
export function bmGet(id) {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.get(id, (result) => {
      chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(result);
    });
  });
}

export function bmGetSubTree(id) {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.getSubTree(id, (result) => {
      chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(result);
    });
  });
}

export function bmCreate(props) {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.create(props, (result) => {
      chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(result);
    });
  });
}

export function bmUpdate(id, props) {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.update(id, props, (result) => {
      chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(result);
    });
  });
}

export function bmMove(id, dest) {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.move(id, dest, (result) => {
      chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(result);
    });
  });
}

export function bmRemove(id) {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.remove(id, () => {
      chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve();
    });
  });
}

export function bmRemoveTree(id) {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.removeTree(id, () => {
      chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve();
    });
  });
}

// Sessions API (for recently closed / devices)
export function getRecentlyClosed(maxItems = 25) {
  return new Promise((resolve, reject) => {
    chrome.sessions.getRecentlyClosed({ maxResults: maxItems }, (sessions) => {
      chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(sessions);
    });
  });
}

export function getDevices() {
  return new Promise((resolve, reject) => {
    chrome.sessions.getDevices((devices) => {
      chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(devices);
    });
  });
}

// TopSites API
export function getTopSites() {
  return new Promise((resolve, reject) => {
    chrome.topSites.get((sites) => {
      chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(sites);
    });
  });
}

// Tabs API
export function createTab(props) {
  return new Promise((resolve, reject) => {
    chrome.tabs.create(props, (tab) => {
      chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(tab);
    });
  });
}

export function updateTab(id, props) {
  return new Promise((resolve, reject) => {
    chrome.tabs.update(id, props, (tab) => {
      chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(tab);
    });
  });
}

// Favicon helper
export function getFaviconUrl(pageUrl, size = 16) {
  return `/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=${size}`;
}

// Tabs API - getCurrent
export function getCurrentTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.getCurrent((tab) => {
      chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(tab);
    });
  });
}

// Bookmarks API - getRecent
export function bmGetRecent(count) {
  return new Promise((resolve, reject) => {
    chrome.bookmarks.getRecent(count, (result) => {
      chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(result);
    });
  });
}

// Sessions API - restore
export function restoreSession(sessionId) {
  return new Promise((resolve, reject) => {
    chrome.sessions.restore(sessionId, () => {
      chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve();
    });
  });
}
