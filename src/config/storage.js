import { DEFAULTS, THEMES, validate } from './schema.js';
import { emit, Events } from '../core/events.js';

const PREFIX = "options.";

// Current theme state
let currentTheme = {};

// Get config value
export function get(key) {
  const stored = localStorage.getItem(PREFIX + key);
  if (stored != null) return validate(key, stored);
  return currentTheme.hasOwnProperty(key) ? currentTheme[key] : DEFAULTS[key];
}

// Set config value
export function set(key, value) {
  const validated = validate(key, value);

  if (value != null) {
    localStorage.setItem(PREFIX + key, validated);
  } else {
    localStorage.removeItem(PREFIX + key);
  }

  // Handle special cases that trigger layout reload
  if (key === "lock" || key === "newtab" || key === "show_root" || key.startsWith("number")) {
    emit(Events.COLUMNS_CHANGED, null);
  } else if (key === "theme") {
    currentTheme = THEMES[validated] || {};
    // Re-apply all config values
    for (const k of Object.keys(DEFAULTS)) {
      if (k !== key) emit(Events.CONFIG_CHANGED, { key: k, value: get(k) });
    }
  } else if (key.startsWith("show")) {
    const id = key.substring(5);
    emit('bookmarks:visibility', { id, visible: validated });
  }

  emit(Events.CONFIG_CHANGED, { key, value: validated });
  return validated;
}

// Load all settings and apply theme
export function loadAll() {
  currentTheme = THEMES[get("theme")] || {};
  for (const key of Object.keys(DEFAULTS)) {
    if (key === "background_image_file") {
      // Deferred for file input
      setTimeout(() => emit(Events.CONFIG_CHANGED, { key, value: get(key) }), 0);
    } else {
      emit(Events.CONFIG_CHANGED, { key, value: get(key) });
    }
  }
}

// Migration for future schema changes
export function migrate() {
  // Placeholder for future migrations
}
