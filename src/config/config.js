import { emit, on, Events } from '../events.js';

// ----- SCHEMA -----
export const DEFAULTS = {
  font: "Sans-serif",
  font_size: 16,
  font_weight: 400,
  theme: "Nord",
  font_color: "#555555",
  background_color: "#ffffff",
  highlight_color: "#e4f4ff",
  highlight_font_color: "#000000",
  shadow_color: "#57b0ff",
  background_image_file: "",
  background_image: "",
  background_align: "left top",
  background_repeat: "repeat",
  background_size: "auto",
  shadow_blur: 1,
  highlight_round: 1,
  fade: 1,
  spacing: 1,
  width: 1,
  h_pos: 1,
  v_margin: 1,
  slide: 1,
  hide_options: 0,
  lock: 0,
  show_top: 1,
  show_apps: 1,
  show_recent: 1,
  show_closed: 1,
  show_devices: 1,
  show_root: 0,
  newtab: 0,
  remember_open: 1,
  auto_close: 0,
  auto_scale: 1,
  css: "",
  number_top: 10,
  number_closed: 10,
  number_recent: 10,
};

// Theme definitions (14 themes)
export const THEMES = {
  Nord: { font_color: "#d8dee9", background_color: "#2e3440", highlight_color: "#81a1c1", highlight_font_color: "#2e3440", shadow_color: "#222730" },
  Catppuccin: { font_color: "#cdd6f4", background_color: "#1e1e2e", highlight_color: "#89b4fa", highlight_font_color: "#1e1e2e", shadow_color: "#161622" },
  "Catppuccin Latte": { font_color: "#4c4f69", background_color: "#eff1f5", highlight_color: "#1e66f5", highlight_font_color: "#eff1f5", shadow_color: "#dce0e8" },
  "Rosé Pine Dawn": { font_color: "#575279", background_color: "#faf4ed", highlight_color: "#56949f", highlight_font_color: "#faf4ed", shadow_color: "#f2e9e1" },
  "Rosé Pine": { font_color: "#e0def4", background_color: "#191724", highlight_color: "#c4a7e7", highlight_font_color: "#191724", shadow_color: "#1f1d2e" },
  "Tokyo Night": { font_color: "#c0caf5", background_color: "#1a1b26", highlight_color: "#7aa2f7", highlight_font_color: "#1a1b26", shadow_color: "#13141c" },
  "Tokyo Night Day": { font_color: "#3760bf", background_color: "#e1e2e7", highlight_color: "#2e7de9", highlight_font_color: "#e1e2e7", shadow_color: "#d0d1d7" },
  Gruvbox: { font_color: "#d4be98", background_color: "#282828", highlight_color: "#7daea3", highlight_font_color: "#282828", shadow_color: "#1e1e1e" },
  Everforest: { font_color: "#d3c6aa", background_color: "#2d353b", highlight_color: "#7fbbb3", highlight_font_color: "#2d353b", shadow_color: "#21272c" },
  Hackerman: { font_color: "#ddf7ff", background_color: "#0B0C16", highlight_color: "#82FB9C", highlight_font_color: "#0B0C16", shadow_color: "#080910" },
  "Matte Black": { font_color: "#bebebe", background_color: "#121212", highlight_color: "#e68e0d", highlight_font_color: "#121212", shadow_color: "#0d0d0d" },
  "Osaka Jade": { font_color: "#C1C497", background_color: "#111c18", highlight_color: "#509475", highlight_font_color: "#111c18", shadow_color: "#0c1512" },
  "Nord Light": { font_color: "#2e3440", background_color: "#eceff4", highlight_color: "#5e81ac", highlight_font_color: "#eceff4", shadow_color: "#d8dee9" },
  Solitude: { font_color: "#cacccc", background_color: "#101315", highlight_color: "#798186", highlight_font_color: "#101315", shadow_color: "#0c0e10" },
};

// Validation: returns normalized value or throws
export function validate(key, value) {
  const def = DEFAULTS[key];
  if (def === undefined) throw new Error(`Unknown config key: ${key}`);
  if (value === null || value === undefined) return def;
  if (typeof def === "number") return Number(value);
  if (typeof def === "boolean") return Boolean(value);
  return String(value);
}

// Get theme object by name
export function getTheme(name) {
  return THEMES[name] || {};
}

// Get all theme names
export function getThemeNames() {
  return Object.keys(THEMES);
};

// ----- STORAGE -----
const PREFIX = "options.";

// Current theme state
export let currentTheme = {};

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

// ----- STYLES -----
// Scale input [0,1,2] to [min,mid,max]
export function scale(value, mid, max, min = 0) {
  return value > 1 ? mid + (value - 1) * (max - mid) : min + value * (mid - min);
}

// Escape value for safe use in CSS url()
function escapeCssUrl(value) {
  // Validate it's a safe URL (http:, https:, data:image/)
  if (value && !/^(https?:|data:image\/)/i.test(value.trim())) {
    return 'none'; // Empty url for invalid values
  }
  // Escape quotes and backslashes
  return 'url("' + value.replace(/["\\]/g, '\\$&') + '")';
}

// Set a CSS custom property on :root
function setCssVar(name, value) {
  document.documentElement.style.setProperty(name, value);
}

// Generate CSS string for a config key (for export)
export function generateCSS(key, value) {
  switch (key) {
    case "font":
      return `#main a { font-family: "${value}"; }`;
    case "font_size":
      return `#main a { font-size: ${value / 10}em; }`;
    case "font_weight":
      return `#main a { font-weight: ${value}; }`;
    case "font_color":
      return `#main a { color: ${value}; }`;
    case "background_color":
      return `body { background-color: ${value}; }`;
    case "background_image":
    case "background_image_file":
      return `body { background-image: ${escapeCssUrl(value)}; }`;
    case "background_align":
      return `body { background-position: ${value}; }`;
    case "background_repeat":
      return `body { background-repeat: ${value}; }`;
    case "background_size":
      return `body { background-size: ${value}; }`;
    case "highlight_font_color":
      return ""; // part of themes; no standalone rule (text color is driven by --highlight-color)
    case "highlight_color":
      return `#main a:hover { color: ${value}; } #main a.vim-cursor { outline-color: ${value}; } .menu a:hover, .menu a:focus-visible { color: ${value}; }`;
    case "shadow_color":
      return `#main a:hover { box-shadow: 0 0 ${scale(get("shadow_blur"), 7, 100)}px ${value}; }`;
    case "shadow_blur":
      return `#main a:hover { box-shadow: 0 0 ${scale(value, 7, 100)}px ${get("shadow_color")}; }`;
    case "highlight_round":
      return `#main a { border-radius: ${scale(value, 0.2, 1.5)}em; }`;
    case "fade":
      return `#main a { transition-duration: ${scale(value, 0.2, 1)}s; }`;
    case "slide":
      return `.wrap { transition-duration: ${scale(value, 0.2, 1)}s; }`;
    case "spacing":
      return `#main a { line-height: ${scale(value, 2, 5.6, 0.8)}; padding-left: ${scale(value, 0.8, 2, 0.4)}em; padding-right: ${scale(value, 0.8, 2, 0.4)}em; }`;
    case "width":
      return `#main { width: ${get("auto_scale") ? scale(value, 80, 100, 20) + "%" : scale(value, 1000, 3000, 400) + "px"}; }`;
    case "h_pos": {
      const margin = 100 - scale(get("width"), 80, 100, 20);
      return `#main { left: ${scale(value, 0, margin / 2, -margin / 2)}%; }`;
    }
    case "v_margin":
      return `#main { margin-top: ${get("auto_scale") ? scale(value, 5, 20) + "%" : scale(value, 80, 600) + "px"}; }`;
    case "hide_options":
      return `#options_button { opacity: 0; }`;
    case "css":
      return value;
    case "auto_scale":
      return value ? null : `#main { margin-top: 80px; width: 1000px; }`;
    default:
      return null;
  }
}

// Apply config value as CSS custom property
export function applyCssVar(key, value) {
  if (value == null) value = get(key);

  switch (key) {
    case "font":
      setCssVar("--font-family", `"${value}"`);
      break;
    case "font_size":
      setCssVar("--font-size", `${value / 10}em`);
      break;
    case "font_weight":
      setCssVar("--font-weight", value);
      break;
    case "font_color":
      setCssVar("--font-color", value);
      break;
    case "background_color":
      setCssVar("--background-color", value);
      break;
    case "background_image":
    case "background_image_file":
      setCssVar("--background-image", escapeCssUrl(value));
      break;
    case "background_align":
      setCssVar("--background-align", value);
      break;
    case "background_repeat":
      setCssVar("--background-repeat", value);
      break;
    case "background_size":
      setCssVar("--background-size", value);
      break;
    case "highlight_color":
      setCssVar("--highlight-color", value);
      break;
    case "shadow_color":
      setCssVar("--shadow-color", value);
      break;
    case "shadow_blur":
      setCssVar("--shadow-blur", `${scale(value, 7, 100)}px`);
      break;
    case "highlight_round":
      setCssVar("--highlight-round", `${scale(value, 0.2, 1.5)}em`);
      break;
    case "fade":
      setCssVar("--fade-duration", `${scale(value, 0.2, 1)}s`);
      break;
    case "slide":
      setCssVar("--slide-duration", `${scale(value, 0.2, 1)}s`);
      break;
    case "spacing":
      setCssVar("--spacing-line-height", scale(value, 2, 5.6, 0.8));
      setCssVar("--spacing-padding", `${scale(value, 0.8, 2, 0.4)}em`);
      break;
    case "width":
      setCssVar("--width", get("auto_scale") ? scale(value, 80, 100, 20) + "%" : scale(value, 1000, 3000, 400) + "px");
      break;
    case "h_pos": {
      const margin = 100 - scale(get("width"), 80, 100, 20);
      setCssVar("--h-pos", `${scale(value, 0, margin / 2, -margin / 2)}%`);
      break;
    }
    case "v_margin":
      setCssVar("--v-margin", get("auto_scale") ? scale(value, 5, 20) + "%" : scale(value, 80, 600) + "px");
      break;
    case "auto_scale":
      setCssVar("--auto-scale", value);
      break;
    case "hide_options":
      // Handled via CSS: #options_button { opacity: var(--hide-options, 0.6); }
      // But we need to handle 0/1 -> 0/0.6
      setCssVar("--hide-options", value === 1 ? "0" : "0.6");
      break;
    case "css":
      // Custom CSS is applied separately
      break;
  }
}

// Handle config change: apply CSS custom property, handle dependencies
export function onChange(key, value) {
  if (value == null) value = get(key);

  applyCssVar(key, value);

  // Dependent keys that need refresh
  if (key === "width") onChange("h_pos");
  else if (key === "shadow_blur") onChange("shadow_color");
  else if (key === "auto_scale") {
    onChange("width");
    onChange("v_margin");
  }
  else if (key === "background_image_file") {
    // background_image_file and background_image share the same CSS var
    onChange("background_image");
  }
}

// Initialize all CSS custom properties from current config
export function initCssVars() {
  for (const key of Object.keys(DEFAULTS)) {
    if (key !== "css") {
      applyCssVar(key, get(key));
    }
  }
}

// Listen for config changes from the modular storage system
// and apply styles accordingly
on(Events.CONFIG_CHANGED, ({ key, value }) => onChange(key, value));

// Get all generated CSS (for export)
export function getAllCSS() {
  let css = "";
  for (const key of Object.keys(DEFAULTS)) {
    if (key === "css") continue;
    const c = generateCSS(key, get(key));
    if (c && c.length < 1000) css += c + "\n";
  }
  return css;
}
