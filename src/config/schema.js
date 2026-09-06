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
