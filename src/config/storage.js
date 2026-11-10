import { DEFAULTS, THEMES, LIGHT_THEMES, validate } from './schema.js';
import { emit, Events } from '../core/events.js';

const PREFIX = "options.";

// Current theme state
export let currentTheme = {};

export const MIGRATED_KEY = "meta.theme_mode_migrated";

const darkQuery = typeof window.matchMedia === "function" ? window.matchMedia("(prefers-color-scheme: dark)") : null;

// True when the light theme slot is active (Light, or System with a light OS)
export function isLightActive() {
  const mode = get("theme_mode");
  return mode === "Light" || (mode === "System" && !!darkQuery && !darkQuery.matches);
}

// Resolve the active theme from theme_mode (System follows the OS)
function resolveTheme() {
  return THEMES[get(isLightActive() ? "theme_light" : "theme")] || {};
}

// Re-resolve the theme and re-apply all config values
function reapplyTheme() {
  currentTheme = resolveTheme();
  for (const k of Object.keys(DEFAULTS)) emit(Events.CONFIG_CHANGED, { key: k, value: get(k) });
}

// Saves from before theme_mode: the saved theme decides the mode (mutates entries keyed by localStorage key)
export function applyLegacyThemeMode(entries) {
  if (LIGHT_THEMES.includes(entries[PREFIX + "theme"])) {
    entries[PREFIX + "theme_light"] = entries[PREFIX + "theme"];
    delete entries[PREFIX + "theme"];
    entries[PREFIX + "theme_mode"] = "Light";
  } else {
    entries[PREFIX + "theme_mode"] = "Dark";
  }
  return entries;
}

// Existing users keep their saved theme: pin the mode to match it. Runs once, tracked by its own marker.
function migrateThemeMode() {
  if (localStorage.getItem(MIGRATED_KEY) != null) return;
  const saved = localStorage.getItem(PREFIX + "theme");
  const hasSettings = Object.keys(localStorage).some((k) => k.startsWith(PREFIX));
  if (hasSettings && localStorage.getItem(PREFIX + "theme_mode") == null) {
    if (LIGHT_THEMES.includes(saved)) {
      localStorage.setItem(PREFIX + "theme_light", saved);
      localStorage.removeItem(PREFIX + "theme");
      localStorage.setItem(PREFIX + "theme_mode", "Light");
    } else {
      localStorage.setItem(PREFIX + "theme_mode", "Dark");
    }
  }
  localStorage.setItem(MIGRATED_KEY, "1");
}

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
  } else if (key === "theme" || key === "theme_light" || key === "theme_mode") {
    reapplyTheme();
    return validated;
  } else if (key.startsWith("show")) {
    const id = key.substring(5);
    emit('bookmarks:visibility', { id, visible: validated });
  }

  emit(Events.CONFIG_CHANGED, { key, value: validated });
  return validated;
}

// Load all settings and apply theme
export function loadAll() {
  migrateThemeMode();
  currentTheme = resolveTheme();
  for (const key of Object.keys(DEFAULTS)) {
    if (key === "background_image_file") {
      // Deferred for file input
      setTimeout(() => emit(Events.CONFIG_CHANGED, { key, value: get(key) }), 0);
    } else {
      emit(Events.CONFIG_CHANGED, { key, value: get(key) });
    }
  }
}

// Follow OS light/dark changes live
if (darkQuery) {
  darkQuery.addEventListener("change", () => {
    if (get("theme_mode") === "System") reapplyTheme();
  });
}
