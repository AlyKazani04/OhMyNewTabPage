var OMNTP = (() => {
  // src/core/state.js
  var state = {
    // Layout State
    columns: [],
    root: [],
    coords: {},
    special: {},
    // Vim State
    vimCursor: { x: 0, y: 0 },
    vimEl: null,
    vimSelected: /* @__PURE__ */ new Set(),
    clipboard: { ids: [], mode: null },
    vimPendingRestore: null
  };
  var getters = {
    getColumnCount: () => state.columns.length,
    getColumn: (x) => state.columns[x],
    getRootId: (x) => state.root[x],
    getCoords: (id) => state.coords[id],
    isSpecial: (id) => id in state.special,
    getSpecialNode: (id) => state.special[id],
    getVimCursor: () => ({ ...state.vimCursor }),
    getVimSelected: () => [...state.vimSelected],
    getClipboard: () => ({ ...state.clipboard })
  };
  var mutations = {
    setColumns: (cols) => {
      state.columns = cols;
    },
    setRoot: (r) => {
      state.root = r;
    },
    setCoords: (id, coord) => {
      state.coords[id] = coord;
    },
    deleteCoords: (id) => {
      delete state.coords[id];
    },
    setSpecial: (nodes) => {
      state.special = nodes;
    },
    setVimCursor: (x, y) => {
      state.vimCursor = { x, y };
    },
    setVimEl: (el) => {
      state.vimEl = el;
    },
    addVimSelected: (id) => {
      state.vimSelected.add(id);
    },
    removeVimSelected: (id) => {
      state.vimSelected.delete(id);
    },
    clearVimSelected: () => {
      state.vimSelected.clear();
    },
    setClipboard: (ids, mode) => {
      state.clipboard = { ids, mode };
    },
    clearClipboard: () => {
      state.clipboard = { ids: [], mode: null };
    },
    setVimPendingRestore: (id) => {
      state.vimPendingRestore = id;
    },
    clearVimPendingRestore: () => {
      state.vimPendingRestore = null;
    }
  };

  // src/core/events.js
  var handlers = /* @__PURE__ */ new Map();
  function on(event, handler) {
    if (!handlers.has(event)) handlers.set(event, /* @__PURE__ */ new Set());
    handlers.get(event).add(handler);
    return () => off(event, handler);
  }
  function off(event, handler) {
    const set2 = handlers.get(event);
    if (set2) set2.delete(handler);
  }
  function emit(event, data) {
    const set2 = handlers.get(event);
    if (set2) set2.forEach((h) => h(data));
  }
  var Events = {
    // State Changes
    COLUMNS_CHANGED: "columns:changed",
    ROOT_CHANGED: "root:changed",
    COORDS_CHANGED: "coords:changed",
    SPECIAL_CHANGED: "special:changed",
    // Vim State
    CURSOR_MOVED: "vim:cursor:moved",
    SELECTION_CHANGED: "vim:selection:changed",
    CLIPBOARD_CHANGED: "vim:clipboard:changed",
    // Rendering
    RENDER_REQUESTED: "render:requested",
    RENDER_COMPLETE: "render:complete",
    // Bookmarks
    BOOKMARK_CREATED: "bookmark:created",
    BOOKMARK_UPDATED: "bookmark:updated",
    BOOKMARK_DELETED: "bookmark:deleted",
    BOOKMARK_MOVED: "bookmark:moved",
    // Config
    CONFIG_CHANGED: "config:changed",
    THEME_CHANGED: "theme:changed",
    // UI
    OPTIONS_TOGGLED: "options:toggled",
    MODAL_OPENED: "modal:opened",
    MODAL_CLOSED: "modal:closed"
  };

  // src/config/schema.js
  var DEFAULTS2 = {
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
    number_recent: 10
  };
  var THEMES = {
    Nord: { font_color: "#d8dee9", background_color: "#2e3440", highlight_color: "#81a1c1", highlight_font_color: "#2e3440", shadow_color: "#222730" },
    Catppuccin: { font_color: "#cdd6f4", background_color: "#1e1e2e", highlight_color: "#89b4fa", highlight_font_color: "#1e1e2e", shadow_color: "#161622" },
    "Catppuccin Latte": { font_color: "#4c4f69", background_color: "#eff1f5", highlight_color: "#1e66f5", highlight_font_color: "#eff1f5", shadow_color: "#dce0e8" },
    "Ros\xE9 Pine Dawn": { font_color: "#575279", background_color: "#faf4ed", highlight_color: "#56949f", highlight_font_color: "#faf4ed", shadow_color: "#f2e9e1" },
    "Ros\xE9 Pine": { font_color: "#e0def4", background_color: "#191724", highlight_color: "#c4a7e7", highlight_font_color: "#191724", shadow_color: "#1f1d2e" },
    "Tokyo Night": { font_color: "#c0caf5", background_color: "#1a1b26", highlight_color: "#7aa2f7", highlight_font_color: "#1a1b26", shadow_color: "#13141c" },
    "Tokyo Night Day": { font_color: "#3760bf", background_color: "#e1e2e7", highlight_color: "#2e7de9", highlight_font_color: "#e1e2e7", shadow_color: "#d0d1d7" },
    Gruvbox: { font_color: "#d4be98", background_color: "#282828", highlight_color: "#7daea3", highlight_font_color: "#282828", shadow_color: "#1e1e1e" },
    Everforest: { font_color: "#d3c6aa", background_color: "#2d353b", highlight_color: "#7fbbb3", highlight_font_color: "#2d353b", shadow_color: "#21272c" },
    Hackerman: { font_color: "#ddf7ff", background_color: "#0B0C16", highlight_color: "#82FB9C", highlight_font_color: "#0B0C16", shadow_color: "#080910" },
    "Matte Black": { font_color: "#bebebe", background_color: "#121212", highlight_color: "#e68e0d", highlight_font_color: "#121212", shadow_color: "#0d0d0d" },
    "Osaka Jade": { font_color: "#C1C497", background_color: "#111c18", highlight_color: "#509475", highlight_font_color: "#111c18", shadow_color: "#0c1512" },
    "Nord Light": { font_color: "#2e3440", background_color: "#eceff4", highlight_color: "#5e81ac", highlight_font_color: "#eceff4", shadow_color: "#d8dee9" }
  };
  function validate(key, value) {
    const def = DEFAULTS2[key];
    if (def === void 0) throw new Error(`Unknown config key: ${key}`);
    if (value === null || value === void 0) return def;
    if (typeof def === "number") return Number(value);
    if (typeof def === "boolean") return Boolean(value);
    return String(value);
  }
  function getThemeNames() {
    return Object.keys(THEMES);
  }

  // src/config/storage.js
  var PREFIX = "options.";
  var currentTheme2 = {};
  function get(key) {
    const stored = localStorage.getItem(PREFIX + key);
    if (stored != null) return validate(key, stored);
    return currentTheme2.hasOwnProperty(key) ? currentTheme2[key] : DEFAULTS2[key];
  }
  function set(key, value) {
    const validated = validate(key, value);
    if (value != null) {
      localStorage.setItem(PREFIX + key, validated);
    } else {
      localStorage.removeItem(PREFIX + key);
    }
    if (key === "lock" || key === "newtab" || key === "show_root" || key.startsWith("number")) {
      emit(Events.COLUMNS_CHANGED, null);
    } else if (key === "theme") {
      currentTheme2 = THEMES[validated] || {};
      for (const k of Object.keys(DEFAULTS2)) {
        if (k !== key) emit(Events.CONFIG_CHANGED, { key: k, value: get(k) });
      }
    } else if (key.startsWith("show")) {
      const id = key.substring(5);
      emit("bookmarks:visibility", { id, visible: validated });
    }
    emit(Events.CONFIG_CHANGED, { key, value: validated });
    return validated;
  }
  function loadAll() {
    currentTheme2 = THEMES[get("theme")] || {};
    for (const key of Object.keys(DEFAULTS2)) {
      if (key === "background_image_file") {
        setTimeout(() => emit(Events.CONFIG_CHANGED, { key, value: get(key) }), 0);
      } else {
        emit(Events.CONFIG_CHANGED, { key, value: get(key) });
      }
    }
  }

  // src/config/styles.js
  var styles = /* @__PURE__ */ new Map();
  function scale(value, mid, max, min = 0) {
    return value > 1 ? mid + (value - 1) * (max - mid) : min + value * (mid - min);
  }
  function generateCSS2(key, value) {
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
        return "";
      // handled via highlight_color TODO: See what's up with this, remove if useless
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
        return `#main { width: ${get("auto_scale") ? scale(value, 80, 100, 20) + "%" : scale(value, 1e3, 3e3, 400) + "px"}; }`;
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
  function applyStyle(key, css) {
    if (!css) return removeStyle(key);
    let style = styles.get(key);
    if (!style) {
      style = document.createElement("style");
      styles.set(key, style);
      document.head.appendChild(style);
    }
    style.textContent = css;
  }
  function removeStyle(key) {
    const style = styles.get(key);
    if (style) {
      style.remove();
      styles.delete(key);
    }
  }
  function onChange(key, value) {
    if (value == null) value = get(key);
    const css = generateCSS2(key, value);
    if (css !== null) {
      applyStyle(key, css);
    } else {
      removeStyle(key);
    }
    if (key === "width") onChange("h_pos");
    else if (key === "shadow_blur") onChange("shadow_color");
    else if (key === "auto_scale") {
      onChange("width");
      onChange("v_margin");
    }
    if (typeof updateOptionsPanel === "function") {
      updateOptionsPanel(key, value);
    }
  }
  on(Events.CONFIG_CHANGED, ({ key, value }) => onChange(key, value));

  // src/core/chrome-api.js
  function bmGet(id) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.get(id, (result) => {
        chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(result);
      });
    });
  }
  function bmGetSubTree(id) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.getSubTree(id, (result) => {
        chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(result);
      });
    });
  }
  function bmCreate(props) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.create(props, (result) => {
        chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(result);
      });
    });
  }
  function bmUpdate(id, props) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.update(id, props, (result) => {
        chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(result);
      });
    });
  }
  function bmMove(id, dest) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.move(id, dest, (result) => {
        chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve(result);
      });
    });
  }
  function bmRemove(id) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.remove(id, () => {
        chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve();
      });
    });
  }
  function bmRemoveTree(id) {
    return new Promise((resolve, reject) => {
      chrome.bookmarks.removeTree(id, () => {
        chrome.runtime.lastError ? reject(chrome.runtime.lastError) : resolve();
      });
    });
  }

  // src/config/ui.js
  var settingsInitialized = false;
  function initConfig(key) {
    const input = document.getElementById("options_" + key);
    if (!input) return;
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
          reader.onload = (f) => {
            if (f.target.result) set(key, f.target.result);
          };
          reader.readAsDataURL(file);
        }
      } else {
        set(key, input.type === "checkbox" ? Number(input.checked) : input.value);
      }
    };
    const reset = document.createElement("a");
    reset.className = "revert";
    reset.title = "Reset to default";
    reset.tabIndex = -1;
    reset.onclick = () => {
      set(key, null);
      showConfig(key);
      return false;
    };
    input.reset = reset;
    input.parentNode.appendChild(reset);
    showConfig(key);
  }
  function initSettings() {
    if (settingsInitialized) return;
    settingsInitialized = true;
    document.getElementById("options_close_button").onclick = () => {
      showOptions(false);
      return false;
    };
    const options = document.getElementById("options");
    const nav = document.getElementById("options_nav");
    let activeIndex = 0;
    for (let i = 0; i < nav.children.length; i++) {
      const a = nav.children[i].firstChild;
      a.onclick = (e) => {
        nav.children[activeIndex].firstChild.classList.remove("current");
        options.getElementsByClassName("section")[activeIndex].classList.remove("current");
        activeIndex = Array.prototype.indexOf.call(nav.children, e.target.parentNode);
        nav.children[activeIndex].firstChild.classList.add("current");
        options.getElementsByClassName("section")[activeIndex].classList.add("current");
        if (activeIndex === nav.children.length - 1) {
          const allcss = document.getElementById("all_css");
          allcss.value = getAllCSS();
        }
        if (activeIndex === nav.children.length - 2) {
          const exports = document.getElementById("options_export");
          const imports = document.getElementById("options_import");
          const replacer = (k, v) => k === "options.background_image_file" ? void 0 : v;
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
            } catch (e2) {
              imports.value = "";
              imports.placeholder = "Import error! Please check if your settings are valid JSON.";
            }
          };
        }
        return false;
      };
    }
    bmGetSubTree("0").then((result) => {
      if (!result || !result[0]) return;
      const placeholder = document.getElementById("options_show_bookmarks");
      const nodes = result[0].children;
      for (const node of nodes) {
        const key = "show_" + node.id;
        DEFAULTS2[key] = 1;
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
      if (chrome.fontSettings) {
        const input = document.getElementById("options_font");
        const select2 = document.createElement("select");
        input.parentNode.replaceChild(select2, input);
        select2.id = input.id;
        chrome.fontSettings.getFontList((fonts) => {
          fonts.unshift({ fontId: "Sans-serif" });
          for (const font of fonts) {
            const option = document.createElement("option");
            option.textContent = font.fontId;
            if (font.fontId === get("font")) option.selected = true;
            select2.appendChild(option);
          }
        });
      }
      for (const key of Object.keys(DEFAULTS2)) initConfig(key);
      loadAll();
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
  function showConfig(key) {
    const input = document.getElementById("options_" + key);
    if (!input || input.type === "file") return;
    const value = get(key);
    if (input.type === "checkbox") input.checked = Boolean(value);
    else input.value = value;
    const isDefault = value === (DEFAULTS2[key] || currentTheme && currentTheme[key]);
    if (input.reset) input.reset.style.visibility = isDefault ? "hidden" : "visible";
    if (input.swatch) input.swatch.value = value;
  }
  function showOptions(show) {
    document.getElementById("options").style.display = show ? "block" : "none";
    if (show) {
      if (!settingsInitialized) initSettings();
      for (const key of Object.keys(DEFAULTS2)) showConfig(key);
    }
  }
  function getAllCSS() {
    let css = "";
    for (const key of Object.keys(DEFAULTS2)) {
      if (key === "css") continue;
      const c = generateCSS(key, get(key));
      if (c && c.length < 1e3) css += c + "\n";
    }
    return css;
  }

  // src/bookmarks/special-nodes.js
  var SPECIAL = {
    apps: {
      label: "Apps",
      url: "chrome://apps",
      children: null
    },
    top: {
      label: "Most visited",
      children: (callback2) => {
        if (chrome.topSites) {
          chrome.topSites.get((result) => {
            callback2(result.slice(0, get("number_top")));
          });
        } else {
          callback2([]);
        }
      }
    },
    recent: {
      label: "Recent bookmarks",
      children: (callback2) => {
        chrome.bookmarks.getRecent(get("number_recent"), callback2);
      }
    },
    closed: {
      label: "Recently closed",
      children: (callback2) => {
        getClosed(callback2);
      }
    },
    devices: {
      label: "Other devices",
      children: (callback2) => {
        getDevices(callback2);
      }
    }
  };
  var specialKeys = Object.keys(SPECIAL);
  function getSpecialNode(id) {
    return SPECIAL[id];
  }
  function isSpecial(id) {
    return id in SPECIAL;
  }
  function getClosed(callback2) {
    const maxResults = get("number_closed");
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
            title: session.tab ? session.tab.title : session.window.tabs.length + " Tabs",
            url: session.tab ? session.tab.url : null,
            className: session.window ? "window" : null,
            action: () => {
              chrome.sessions.restore(
                session.window ? session.window.sessionId : session.tab.sessionId,
                () => {
                  refreshClosed();
                }
              );
              return false;
            }
          });
        }
        callback2(nodes);
      }
    );
  }
  function getDevices(callback2) {
    chrome.sessions.getDevices(
      { maxResults: get("number_closed") },
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
                url: tabs[k].url
              });
            }
          }
          nodes.push({
            id: "device." + device.deviceName,
            title: device.deviceName,
            children
          });
        }
        callback2(nodes);
      }
    );
  }
  function refreshClosed() {
    const targets = [];
    const folders = document.getElementsByClassName("closed");
    for (let i = 0; i < folders.length; i++) {
      const a = folders[i];
      if (a.nextSibling) {
        a.parentNode.removeChild(a.nextSibling);
        targets.push(a.parentNode);
      }
    }
    if (folders.length === 0 && window.coords && window.coords["closed"]) {
      const target = document.getElementsByClassName("column")[window.coords["closed"].x];
      target.removeChild(target.firstChild);
      targets.push(target);
    }
    getChildrenFunction({ id: "closed" })((result) => {
      for (let i = 0; i < targets.length; i++) renderAll(result, targets[i]);
    });
  }
  var getChildrenFunction = null;
  var renderAll = null;
  function setGetChildrenFunction(fn) {
    getChildrenFunction = fn;
  }

  // src/bookmarks/tree.js
  function getChildrenFunction2(node) {
    if (isSpecial(node.id)) {
      const specialNode = getSpecialNode(node.id);
      const load = specialNode.children;
      return load || (() => callback([]));
    }
    if (node.children) {
      return (callback2) => callback2(node.children);
    }
    return (callback2) => {
      bmGetSubTree(node.id).then(
        (result) => {
          if (result) callback2(result[0].children);
          else {
            if (state.coords[node.id]) removeRow(state.coords[node.id].x, state.coords[node.id].y);
            callback2([]);
          }
        },
        () => {
          if (state.coords[node.id]) removeRow(state.coords[node.id].x, state.coords[node.id].y);
          callback2([]);
        }
      );
    };
  }
  var removeRow = null;
  function setRemoveRow(fn) {
    removeRow = fn;
  }

  // src/bookmarks/layout.js
  mutations.setSpecial(SPECIAL);
  function verifyColumns() {
    if (state.columns.length === 0) {
      state.columns.push([]);
      state.columns.push(
        specialKeys.filter((a) => get("show_" + a) !== false)
      );
    }
    const missing = state.root.slice(0);
    for (let x = 0; x < state.columns.length; x++) {
      for (let y = 0; y < state.columns[x].length; y++) {
        const i = missing.indexOf(state.columns[x][y]);
        if (i > -1) missing.splice(i, 1);
      }
    }
    const column = state.columns[0];
    for (let i = 0; i < missing.length; i++) {
      if (get("show_" + missing[i]) !== false) column.push(missing[i]);
    }
    state.coords = {};
    for (let x = 0; x < state.columns.length; x++) {
      for (let y = 0; y < state.columns[x].length; y++) {
        state.coords[state.columns[x][y]] = { x, y };
      }
      if (state.columns[x].length === 0) {
        state.columns.splice(x, 1);
        x--;
      }
    }
  }
  function loadColumns() {
    state.columns = [];
    for (let x = 0; ; x++) {
      const row = [];
      for (let y = 0; ; y++) {
        const id = localStorage.getItem("column." + x + "." + y);
        if (id) row.push(id);
        else break;
      }
      if (row.length > 0) state.columns.push(row);
      else break;
    }
    if (state.root.length > 0) {
      verifyColumns();
      emit(Events.RENDER_REQUESTED);
    } else {
      bmGetSubTree("0").then((result) => {
        if (!result || !result[0]) return;
        const nodes = result[0].children;
        mutations.setRoot(specialKeys.slice(0));
        for (let i = 0; i < nodes.length; i++) state.root.push(nodes[i].id);
        verifyColumns();
        emit(Events.RENDER_REQUESTED);
      });
    }
  }
  function saveColumns() {
    for (let x = 0; ; x++) {
      let hadAny = false;
      for (let y = 0; ; y++) {
        const id = localStorage.getItem("column." + x + "." + y);
        if (!id) break;
        if (id) localStorage.removeItem("column." + x + "." + y);
        hadAny = true;
      }
      if (!hadAny) break;
    }
    verifyColumns();
    for (let x = 0; x < state.columns.length; x++) {
      for (let y = 0; y < state.columns[x].length; y++) {
        localStorage.setItem("column." + x + "." + y, state.columns[x][y]);
      }
    }
    loadColumns();
  }
  function removeRow2(xpos, ypos) {
    state.columns[xpos].splice(ypos, 1);
    saveColumns();
  }

  // src/bookmarks/crud.js
  function isRealBookmarkId(id) {
    return /^\d+$/.test(String(id));
  }
  function clipTargetableId(id) {
    return isRealBookmarkId(id) && Array.isArray(state.root) && state.root.indexOf(id) < 0;
  }

  // src/shim.js
  window.state = state;
  window.getters = getters;
  window.mutations = mutations;
  window.columns = state.columns;
  window.root = state.root;
  window.coords = state.coords;
  window.special = state.special;
  window.vimCursor = state.vimCursor;
  window.vimEl = state.vimEl;
  window.vimSelected = state.vimSelected;
  window.clipboard = state.clipboard;
  window.vimPendingRestore = state.vimPendingRestore;
  window.bmGet = bmGet;
  window.bmGetSubTree = bmGetSubTree;
  window.bmCreate = bmCreate;
  window.bmUpdate = bmUpdate;
  window.bmMove = bmMove;
  window.bmRemove = bmRemove;
  window.bmRemoveTree = bmRemoveTree;
  window.saveColumns = saveColumns;
  window.renderColumns = () => emit(Events.RENDER_REQUESTED);
  window.toggle = (node, anchor) => emit("folder:toggle", { node, anchor });
  window.getConfig = get;
  window.setConfig = set;
  window.themes = THEMES;
  window.showOptions = showOptions;
  window.renderMenu = (items, x, y, label) => emit("menu:render", { items, x, y, label });
  window.getChildrenFunction = getChildrenFunction2;
  window.SPECIAL = state.special;
  window.clipTargetableId = clipTargetableId;
  window.getCoords = getters.getCoords;
  window.config = DEFAULTS2;
  window.theme = {};
  window.loadSettings = loadAll;
  window.initSettings = initSettings;
  window.initConfig = initConfig;
  window.showConfig = showConfig;
  window.onChange = onChange;
  window.getStyle = generateCSS2;
  window.scale = scale;
  setRemoveRow(removeRow2);
  setGetChildrenFunction(getChildrenFunction2);
  loadAll();
  on(Events.RENDER_REQUESTED, () => {
    if (window.renderColumns) window.renderColumns();
  });
  on("folder:toggle", ({ node, anchor }) => {
    if (window.toggle) window.toggle(node, anchor);
  });
  on("menu:render", ({ items, x, y, label }) => {
    if (window.renderMenu) window.renderMenu(items, x, y, label);
  });
  on("bookmarks:getChildrenFunction", (node) => {
    if (window.getChildrenFunction) window.getChildrenFunction(node);
  });
})();
