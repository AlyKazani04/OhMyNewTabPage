import { get, set, loadAll, currentTheme } from './storage.js';
import { DEFAULTS, getThemeNames } from './schema.js';
import { emit, Events, on } from '../core/events.js';
import * as chromeApi from '../core/chrome-api.js';
import { getAllCSS, initCssVars } from './styles.js';

let settingsInitialized = false;

// Initialize a single config input
export function initConfig(key) {
  const input = document.getElementById("options_" + key);
  if (!input) return;

  // Color picker enhancement
  if (input.type === "color") {
    input.type = "text";
    input.className = "color";
    const swatch = document.createElement("input");
    swatch.type = "color";
    swatch.value = input.value;
    swatch.oninput = (event) => {
      input.value = event.target.value;
      input.onchange(event);
    };
    input.swatch = swatch;
    input.parentNode.appendChild(swatch);
  }

  // Change handler
  input.onchange = (event) => {
    if (input.type === "file") {
      if (event.target.files.length === 1) {
        const file = event.target.files[0];
        if (file.size > 2097152) {
          input.value = null;
          alert("Image must be less than 2 MB.");
          return;
        }
        const reader = new FileReader();
        reader.onload = (f) => { if (f.target.result) set(key, f.target.result); };
        reader.readAsDataURL(file);
      }
    } else {
      set(key, input.type === "checkbox" ? Number(input.checked) : input.value);
    }
  };

  // Reset button
  const reset = document.createElement("a");
  reset.className = "revert";
  reset.title = "Reset to default";
  reset.tabIndex = -1;
  reset.onclick = () => { set(key, null); showConfig(key); return false; };
  input.reset = reset;
  input.parentNode.appendChild(reset);

  showConfig(key);
}

// Initialize options panel (called on first open)
export function initSettings() {
  if (settingsInitialized) return;
  settingsInitialized = true;

  // Initialize CSS custom properties
  initCssVars();

  // Close button
  document.getElementById("options_close_button").onclick = () => { showOptions(false); return false; };

  // Tab navigation
  const options = document.getElementById("options");
  const nav = document.getElementById("options_nav");
  let activeIndex = 0;

  for (let i = 0; i < nav.children.length; i++) {
    const btn = nav.children[i].firstChild;
    btn.onclick = (e) => {
      nav.children[activeIndex].firstChild.classList.remove("current");
      nav.children[activeIndex].firstChild.setAttribute("aria-selected", "false");
      options.getElementsByClassName("section")[activeIndex].classList.remove("current");
      activeIndex = Array.prototype.indexOf.call(nav.children, e.target.parentNode);
      nav.children[activeIndex].firstChild.classList.add("current");
      nav.children[activeIndex].firstChild.setAttribute("aria-selected", "true");
      options.getElementsByClassName("section")[activeIndex].classList.add("current");

      // Advanced tab: show generated CSS
      if (activeIndex === nav.children.length - 1) {
        const allcss = document.getElementById("all_css");
        allcss.value = getAllCSS();
      }

      // Import/Export tab
      if (activeIndex === nav.children.length - 2) {
        const exports = document.getElementById("options_export");
        const imports = document.getElementById("options_import");
        const replacer = (k, v) => k === "options.background_image_file" ? undefined : v;
        exports.value = JSON.stringify(localStorage, replacer);
        imports.value = "";
        imports.placeholder = "Paste exported settings here";
        imports.onchange = () => {
          try {
            const imported = JSON.parse(imports.value);
            for (const k in imported) localStorage.setItem(k, imported[k]);
            imports.value = "";
            imports.placeholder = "Import successful!";
            exports.value = JSON.stringify(localStorage, replacer);
            loadAll();
            emit(Events.COLUMNS_CHANGED, null);
          } catch (e) {
            imports.value = "";
            imports.placeholder = "Import error! Please check if your settings are valid JSON.";
          }
        };
      }
      return false;
    };
  }

  // Dynamic bookmark folder visibility checkboxes
  chromeApi.bmGetSubTree("0").then((result) => {
    if (!result || !result[0]) return;
    const placeholder = document.getElementById("options_show_bookmarks");
    const nodes = result[0].children;
    for (const node of nodes) {
      const key = "show_" + node.id;
      DEFAULTS[key] = 1; // extend defaults dynamically

      const span = document.createElement("span");
      span.textContent = node.title;
      const input = document.createElement("input");
      input.type = "checkbox";
      input.id = "options_" + key;
      const label = document.createElement("label");
      label.appendChild(span);
      label.appendChild(input);
      placeholder.appendChild(label);
    }

    // Font list (if fontSettings API available)
    if (chrome.fontSettings) {
      const input = document.getElementById("options_font");
      const select = document.createElement("select");
      input.parentNode.replaceChild(select, input);
      select.id = input.id;
      chrome.fontSettings.getFontList((fonts) => {
        fonts.unshift({ fontId: "Sans-serif" });
        for (const font of fonts) {
          const option = document.createElement("option");
          option.textContent = font.fontId;
          if (font.fontId === get("font")) option.selected = true;
          select.appendChild(option);
        }
      });
    }

    // Initialize all config inputs
    for (const key of Object.keys(DEFAULTS)) initConfig(key);

    // Load settings (applies theme + all styles)
    loadAll();

    // Populate theme selector
    const select = document.getElementById("options_theme");
    if (select.childNodes.length === 0) {
      for (const name of getThemeNames()) {
        const option = document.createElement("option");
        option.textContent = name;
        if (name === get("theme")) option.selected = true;
        select.appendChild(option);
      }
    }
  });
}

// Apply config value to input control
export function showConfig(key) {
  const input = document.getElementById("options_" + key);
  if (!input || input.type === "file") return;

  const value = get(key);
  if (input.type === "checkbox") input.checked = Boolean(value);
  else input.value = value;

  // Show/hide reset button
  const isDefault = value === (DEFAULTS[key] || (currentTheme && currentTheme[key]));
  if (input.reset) input.reset.style.visibility = isDefault ? "hidden" : "visible";
  if (input.swatch) input.swatch.value = value;
}

// Show/hide options panel
export function showOptions(show) {
  const options = document.getElementById("options");
  const optionsButton = document.getElementById("options_button");
  options.style.display = show ? "block" : "none";
  options.setAttribute("aria-hidden", show ? "false" : "true");
  if (optionsButton) {
    optionsButton.setAttribute("aria-expanded", show ? "true" : "false");
  }
  if (show) {
    if (!settingsInitialized) initSettings();
    for (const key of Object.keys(DEFAULTS)) showConfig(key);
  }
}

// Expose for styles.js dependency
export function updateOptionsPanel(key, value) {
  const input = document.getElementById("options_" + key);
  if (input) {
    const isDefault = value === (DEFAULTS[key] || (currentTheme && currentTheme[key]));
    if (input.reset) input.reset.style.visibility = isDefault ? "hidden" : "visible";
    if (input.swatch) input.swatch.value = value;
  }
}

// Listen for config changes to update options panel
on(Events.CONFIG_CHANGED, ({ key, value }) => updateOptionsPanel(key, value));
