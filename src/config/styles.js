import { get } from './storage.js';
import { on, Events } from '../core/events.js';
import { DEFAULTS } from './schema.js';

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