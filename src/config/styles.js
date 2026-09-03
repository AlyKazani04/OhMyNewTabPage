import { get } from './storage.js';
import { on, Events } from '../core/events.js';

const styles = new Map(); // key -> <style> element

// Scale input [0,1,2] to [min,mid,max]
export function scale(value, mid, max, min = 0) {
  return value > 1 ? mid + (value - 1) * (max - mid) : min + value * (mid - min);
}

// Generate CSS string for a config key
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
      return `body { background-image: url(${value}); }`;
    case "background_align":
      return `body { background-position: ${value}; }`;
    case "background_repeat":
      return `body { background-repeat: ${value}; }`;
    case "background_size":
      return `body { background-size: ${value}; }`;
    case "highlight_font_color":
      return ""; // handled via highlight_color TODO: See what's up with this, remove if useless
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

// Apply style to DOM
export function applyStyle(key, css) {
  if (!css) return removeStyle(key);

  let style = styles.get(key);
  if (!style) {
    style = document.createElement("style");
    styles.set(key, style);
    document.head.appendChild(style);
  }
  style.textContent = css;
}

// Remove style from DOM
export function removeStyle(key) {
  const style = styles.get(key);
  if (style) {
    style.remove();
    styles.delete(key);
  }
}

// Handle config change: generate CSS, apply, handle dependencies
export function onChange(key, value) {
  if (value == null) value = get(key);

  const css = generateCSS(key, value);
  if (css !== null) {
    applyStyle(key, css);
  } else {
    removeStyle(key);
  }

  // Dependent keys that need refresh
  if (key === "width") onChange("h_pos");
  else if (key === "shadow_blur") onChange("shadow_color");
  else if (key === "auto_scale") {
    onChange("width");
    onChange("v_margin");
  }

  // Update options panel if initialized
  if (typeof updateOptionsPanel === "function") {
    updateOptionsPanel(key, value);
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
