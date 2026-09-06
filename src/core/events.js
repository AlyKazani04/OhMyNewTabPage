const handlers = new Map();

export function on(event, handler) {
  if (!handlers.has(event)) handlers.set(event, new Set());
  handlers.get(event).add(handler);
  return () => off(event, handler);
};

export function off(event, handler) {
  const set = handlers.get(event);
  if (set) set.delete(handler);
};

export function emit(event, data) {
  const set = handlers.get(event);
  if (set) {
    for (const handler of set) {
      try {
        handler(data);
      } catch (err) {
        console.error(`Error in event handler for ${event}:`, err);
      }
    }
  }
};

// one-time listener
export function once(event, handler) {
  const unsub = on(event, (data) => {
    unsub();
    handler(data);
  });
  return unsub;
};

export const Events = {
  // State Changes
  COLUMNS_CHANGED: 'columns:changed',
  ROOT_CHANGED: 'root:changed',
  COORDS_CHANGED: 'coords:changed',
  SPECIAL_CHANGED: 'special:changed',

  // Vim State
  CURSOR_MOVED: 'vim:cursor:moved',
  SELECTION_CHANGED: 'vim:selection:changed',
  CLIPBOARD_CHANGED: 'vim:clipboard:changed',

  // Rendering
  RENDER_REQUESTED: 'render:requested',
  RENDER_COMPLETE: 'render:complete',

  // Bookmarks
  BOOKMARK_CREATED: 'bookmark:created',
  BOOKMARK_UPDATED: 'bookmark:updated',
  BOOKMARK_DELETED: 'bookmark:deleted',
  BOOKMARK_MOVED: 'bookmark:moved',

  // Config
  CONFIG_CHANGED: 'config:changed',
  THEME_CHANGED: 'theme:changed',

  // UI
  OPTIONS_TOGGLED: 'options:toggled',
  MODAL_OPENED: 'modal:opened',
  MODAL_CLOSED: 'modal:closed',
};
