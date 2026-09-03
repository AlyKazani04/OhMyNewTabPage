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
  function getFaviconUrl(pageUrl, size = 16) {
    return `/_favicon/?pageUrl=${encodeURIComponent(pageUrl)}&size=${size}`;
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
  function setRenderAll(fn) {
    renderAll = fn;
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
  function getSubTree(id, callback2) {
    if (isSpecial(id)) {
      const s = getSpecialNode(id);
      const node = { title: s.label, id };
      if (s.url) node.url = s.url;
      else node.children = true;
      callback2([node]);
      return;
    }
    bmGetSubTree(id).then(
      (result) => {
        if (result) callback2(result);
        else {
          if (state.coords[id]) removeRow(state.coords[id].x, state.coords[id].y);
        }
      },
      () => {
        if (state.coords[id]) removeRow(state.coords[id].x, state.coords[id].y);
      }
    );
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
  function addColumn(ids, index) {
    const column = ids.slice(0);
    for (let x = 0; x < state.columns.length; x++) {
      for (let y = 0; y < state.columns[x].length; y++) {
        if (ids.indexOf(state.columns[x][y]) > -1) {
          state.columns[x].splice(y, 1);
          y--;
        }
      }
    }
    if (index === null) index = state.columns.length;
    state.columns.splice(Math.min(index, state.columns.length), 0, column);
    saveColumns();
  }
  function removeColumn(index) {
    state.columns.splice(index, 1);
    saveColumns();
  }
  function addRow(id, xpos, ypos) {
    if (ypos === null) ypos = state.columns[xpos].length;
    for (let x = 0; x < state.columns.length; x++) {
      const i = state.columns[x].indexOf(id);
      if (i > -1) {
        state.columns[x].splice(i, 1);
        if (x === xpos && ypos > i) ypos--;
      }
      if (state.columns[x].length === 0) {
        state.columns.splice(x, 1);
        x--;
        if (xpos > x) xpos--;
      }
    }
    state.columns[xpos].splice(Math.min(ypos, state.columns[xpos].length), 0, id);
    saveColumns();
  }
  function removeRow2(xpos, ypos) {
    state.columns[xpos].splice(ypos, 1);
    saveColumns();
  }
  function removeFromLayout(ids) {
    for (let x = state.columns.length - 1; x >= 0; x--) {
      const col = state.columns[x];
      for (let y = col.length - 1; y >= 0; y--) {
        if (ids.indexOf(col[y]) > -1) col.splice(y, 1);
      }
      if (col.length === 0) state.columns.splice(x, 1);
    }
  }
  function placeInLayout(ids, x, y) {
    for (let i = state.columns.length - 1; i >= 0; i--) {
      const col = state.columns[i];
      for (let j = col.length - 1; j >= 0; j--) {
        if (ids.indexOf(col[j]) > -1) col.splice(j, 1);
      }
      if (col.length === 0) {
        state.columns.splice(i, 1);
        if (i < x) x--;
      }
    }
    while (state.columns.length <= x) state.columns.push([]);
    if (y == null || y > state.columns[x].length) y = state.columns[x].length;
    if (y < 0) y = 0;
    Array.prototype.splice.apply(state.columns[x], [y, 0].concat(ids));
    saveColumns();
  }
  function isShowRootEnabled() {
    return get("show_root");
  }
  function syncLayoutAfterPaste(ids, parentId, below) {
    let flatX = -1;
    if (!isShowRootEnabled()) {
      for (let x = 0; x < state.columns.length; x++) {
        if (state.columns[x].length === 1 && state.columns[x][0] === parentId) {
          flatX = x;
          break;
        }
      }
    }
    if (flatX > -1) {
      scheduleRestore(ids[0]);
      saveColumns();
    } else if (state.vimEl && state.vimEl._vimNode && state.coords && state.coords[state.vimEl._vimNode.id]) {
      scheduleRestore(ids[0]);
      const pos = state.coords[state.vimEl._vimNode.id];
      placeInLayout(ids, pos.x, below ? pos.y + 1 : pos.y);
    } else {
      removeFromLayout(ids);
      saveColumns();
    }
  }
  var scheduleRestore = null;
  var renderColumns = null;
  function setScheduleRestore(fn) {
    scheduleRestore = fn;
  }

  // src/bookmarks/crud.js
  function isRealBookmarkId(id) {
    return /^\d+$/.test(String(id));
  }
  function normalizeUrl(url) {
    url = url.trim();
    if (url && !/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(url)) url = "https://" + url;
    return url;
  }
  function getDefaultParentId() {
    if (state.root) {
      for (let i = 0; i < state.root.length; i++) {
        if (!isSpecial(state.root[i]) && /^\d+$/.test(state.root[i])) return state.root[i];
      }
    }
    return "1";
  }
  function findParentFolderId(li) {
    const ul = li.parentNode;
    if (!ul || ul.tagName !== "UL") return null;
    const div = ul.parentNode;
    if (!div || div.tagName !== "DIV") return null;
    const prevA = div.previousElementSibling;
    if (prevA && prevA.tagName === "A" && prevA._vimNode && prevA._vimNode.children && !isSpecial(prevA._vimNode.id)) {
      return prevA._vimNode.id;
    }
    return null;
  }
  function getInsertionContext() {
    const context = { parentId: getDefaultParentId(), afterId: null };
    if (!(state.vimEl && state.vimEl._vimNode)) return context;
    const parentId = findParentFolderId(state.vimEl.parentNode);
    if (parentId) context.parentId = parentId;
    if (state.vimEl._vimNode.id !== "empty") context.afterId = state.vimEl._vimNode.id;
    return context;
  }
  async function createBookmarkAt(props, afterId) {
    const finish = async (index2) => {
      if (index2 != null) props.index = index2;
      const result = await bmCreate(props);
      if (!result) {
        console.warn("create failed");
      } else {
        scheduleRestore(result.id);
      }
      renderColumns();
    };
    if (!afterId) return finish(null);
    const results = await bmGet(afterId);
    const index = results && results[0] && results[0].parentId === props.parentId && results[0].index != null ? results[0].index + 1 : null;
    return finish(index);
  }
  async function updateBookmark(id, props) {
    await bmUpdate(id, props);
    if (chrome.runtime.lastError) {
      console.warn("edit failed:", chrome.runtime.lastError.message);
    } else {
      scheduleRestore(id);
    }
    renderColumns();
  }
  async function deleteBookmarksByIds(ids) {
    for (let i = 0; i < ids.length; i++) {
      const results = await bmGet(ids[i]);
      if (!results || !results[0]) continue;
      if (results[0].url) {
        await bmRemove(ids[i]);
      } else {
        await bmRemoveTree(ids[i]);
      }
      if (chrome.runtime.lastError) {
        console.warn("delete failed:", chrome.runtime.lastError.message);
      }
    }
    const topLevel = ids.filter((id) => state.coords[id]);
    if (topLevel.length > 0) {
      removeFromLayout(topLevel);
      saveColumns();
    } else {
      renderColumns();
    }
  }
  async function copyBookmarkSubtree(sourceId, destParentId, index) {
    async function cloneNode(node, parentId, position) {
      const props = { parentId, title: node.title };
      if (node.url) props.url = node.url;
      if (position != null) props.index = position;
      const created = await bmCreate(props);
      if (!created || !node.children) return created;
      for (const child of node.children) {
        await cloneNode(child, created.id);
      }
      return created;
    }
    const results = await bmGetSubTree(sourceId);
    if (!results || !results[0]) return null;
    return cloneNode(results[0], destParentId, index);
  }
  async function folderMoveDrop(dragIds2, folderNodeId) {
    if (!folderNodeId || !isRealBookmarkId(folderNodeId)) return;
    const ids = (dragIds2 || []).filter((id) => clipTargetableId(id) && id !== folderNodeId);
    if (ids.length === 0) return;
    const movedIds = [];
    for (const id of ids) {
      const moved = await bmMove(id, { parentId: folderNodeId });
      if (moved) movedIds.push(id);
    }
    if (movedIds.length > 0) {
      removeFromLayout(movedIds);
      saveColumns();
    }
  }
  function clipTargetableId(id) {
    return isRealBookmarkId(id) && Array.isArray(state.root) && state.root.indexOf(id) < 0;
  }

  // src/render/icons.js
  function getIcon(node) {
    let url = null;
    let url2x = null;
    if (node.icons) {
      let size;
      for (const i in node.icons) {
        const iconInfo = node.icons[i];
        if (iconInfo.url && (!size || iconInfo.size < size && iconInfo.size > 15)) {
          url = iconInfo.url;
          if (iconInfo.size > 31) url2x = iconInfo.url;
          size = iconInfo.size;
        }
      }
    } else if (node.icon) {
      url = node.icon;
    } else if (node.url) {
      url = getFaviconUrl(node.url, 16);
      url2x = getFaviconUrl(node.url, 32);
    }
    const icon = document.createElement(url ? "img" : "div");
    icon.className = "icon";
    icon.src = url;
    if (url2x) icon.srcset = url2x + " 2x";
    icon.alt = " ";
    return icon;
  }

  // src/render/tooltips.js
  var tooltipTimeout = null;
  function updateTooltips() {
    if (tooltipTimeout) clearTimeout(tooltipTimeout);
    tooltipTimeout = setTimeout(() => {
      tooltipTimeout = null;
      const elements = document.querySelectorAll("#main li a");
      for (let i = 0; i < elements.length; i++) {
        const element = elements[i];
        if (element.clientWidth + 1 < element.scrollWidth) {
          element.title = element.title || element.textContent;
        } else if (element.title === element.textContent) {
          element.title = "";
        }
      }
    }, 100);
  }

  // src/render/folder.js
  function toggle(node, anchor) {
    const isOpen = anchor.open;
    setClass(anchor, node, !isOpen);
    anchor.open = !isOpen;
    if (isOpen) {
      localStorage.removeItem("open." + node.id);
      if (anchor.nextSibling) {
        if (get("auto_close")) {
          const children = (anchor.nextSibling.tagName === "DIV" ? anchor.nextSibling.firstChild : anchor.nextSibling).children;
          for (let i = 0; i < children.length; i++) {
            const child = children[i].firstChild;
            if (child.open) child.onclick();
          }
        }
        animate(node, anchor, isOpen);
      }
    } else {
      localStorage.setItem("open." + node.id, "true");
      if (get("auto_close")) {
        const siblings = anchor.parentNode.parentNode.children;
        for (let i = 0; i < siblings.length; i++) {
          const sibling = siblings[i].firstChild;
          if (sibling !== anchor && sibling.open) sibling.onclick();
        }
      }
      if (anchor.nextSibling) {
        animate(node, anchor, isOpen);
      } else {
        getChildrenFunction3(node)((result) => {
          if (!anchor.nextSibling && anchor.open) {
            renderAll2(result, anchor.parentNode);
            animate(node, anchor, isOpen);
          }
        });
      }
    }
  }
  function animate(node, anchor, isOpen) {
    const wrap = anchor.nextSibling;
    if (anchor.animationHandle) {
      clearTimeout(anchor.animationHandle);
      anchor.animationHandle = null;
    } else {
      wrap.style.height = isOpen ? wrap.firstChild.clientHeight + "px" : "0";
      wrap.style.opacity = isOpen ? "1" : "0";
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (wrap) {
          wrap.className = "wrap";
          wrap.style.height = isOpen ? "0" : wrap.firstChild.clientHeight + "px";
          wrap.style.opacity = isOpen ? "0" : "1";
          wrap.style.pointerEvents = isOpen ? "none" : null;
        }
      });
    });
    const duration = scale(get("slide"), 0.2, 1) * 1e3;
    anchor.animationHandle = setTimeout(() => {
      anchor.animationHandle = null;
      if (isOpen) {
        anchor.parentNode.removeChild(wrap);
      } else {
        wrap.className = null;
        wrap.removeAttribute("style");
      }
    }, duration);
  }
  var getChildrenFunction3 = null;
  function setGetChildrenFunctionForFolder(fn) {
    getChildrenFunction3 = fn;
  }

  // src/render/node.js
  function setClass(target, node, isOpen) {
    if (node.className) target.classList.add(node.className);
    if (node.children) target.classList.add("folder");
    if (isOpen) target.classList.add("open");
    else target.classList.remove("open");
    if (node.id && (node.id.startsWith("device.") || node.id === "empty" || node.id === "apps" || node.id === "top" || node.id === "recent" || node.id === "closed" || node.id === "devices")) {
      target.classList.add(node.id);
      target.setAttribute("tabindex", "-1");
    }
  }
  function openLink2(node, newtab) {
    const url = node.url;
    if (url) {
      chrome.tabs.getCurrent((tab) => {
        if (newtab) {
          chrome.tabs.create({
            url,
            active: newtab === 1,
            openerTabId: tab.id
          });
        } else {
          chrome.tabs.update(tab.id, { url });
        }
      });
    }
  }
  var getChildrenFunction4 = null;
  var getConfig = get;
  var addFolderHandlers = null;
  var enableDragFolder = null;
  function setGetChildrenFunction2(fn) {
    getChildrenFunction4 = fn;
    setGetChildrenFunctionForFolder(fn);
  }
  function setGetConfig(fn) {
    getConfig = fn;
  }
  function setAddFolderHandlers(fn) {
    addFolderHandlers = fn;
  }
  function setEnableDragFolder(fn) {
    enableDragFolder = fn;
  }
  function render(node, target) {
    if (node.description === "separator") return;
    const li = document.createElement("li");
    const a = document.createElement("a");
    const url = node.url;
    if (url) a.href = url;
    else a.tabIndex = -1;
    let text = node.title || "";
    if (!text && url) text = url;
    a.innerText = text;
    if (node.tooltip) a.title = node.tooltip;
    setClass(a, node);
    a.insertBefore(getIcon(node), a.firstChild);
    if (node.action) {
      a.onclick = (event) => node.action(event);
    } else if (url) {
      const newtab = getConfig("newtab");
      if (newtab === 1) {
        a.target = "_blank";
      } else if (newtab === 2) {
        a.onclick = (e) => {
          openLink2(node, newtab);
          return false;
        };
      }
      const urlStart = url.substring(0, 6);
      if (urlStart === "chrome" || urlStart === "file:/") {
        a.onclick = (e) => {
          openLink2(node, newtab || (e.ctrlKey ? 2 : 0));
          return false;
        };
        a.onauxclick = (e) => {
          if (e.button === 1) {
            openLink2(node, 2);
            return false;
          }
        };
      }
    } else if (!node.children) {
      a.style.pointerEvents = "none";
    }
    li.appendChild(a);
    a._vimNode = node;
    if (node.children) {
      if (a.open || getConfig("remember_open") && localStorage.getItem("open." + node.id)) {
        setClass(a, node, true);
        a.open = true;
        getChildrenFunction4(node)((result) => {
          renderAll2(result, li);
        });
      }
      if (addFolderHandlers) addFolderHandlers(node, a);
      if (enableDragFolder) enableDragFolder(node, a);
    } else if (node.id === "apps" && enableDragFolder) {
      enableDragFolder(node, a);
    }
    target.appendChild(li);
    return li;
  }
  function renderAll2(nodes, target, toplevel) {
    const ul = document.createElement("ul");
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (toplevel || !state.coords[node.id]) render(node, ul);
    }
    if (ul.childNodes.length === 0) {
      render({ id: "empty", title: "< Empty >" }, ul);
    }
    if (toplevel) target.appendChild(ul);
    else {
      const wrap = document.createElement("div");
      wrap.appendChild(ul);
      target.appendChild(wrap);
    }
    updateTooltips();
    return ul;
  }

  // src/interaction/drag-drop.js
  var dragIds = null;
  var dropTarget = null;
  function enableDragColumn(id, column) {
    if (get("lock")) return;
    column.draggable = true;
    column.ondragstart = (event) => {
      dragIds = state.columns[id];
      event.dataTransfer.effectAllowed = "move";
      column.classList.add("dragstart");
    };
    column.ondragend = () => {
      dragIds = null;
      column.classList.remove("dragstart");
      clearDropTarget();
    };
  }
  function enableDragFolder2(node, anchor) {
    if (get("lock")) return;
    anchor.draggable = true;
    anchor.ondragstart = (event) => {
      dragIds = [node.id];
      event.stopPropagation();
      event.dataTransfer.effectAllowed = "move copy";
      anchor.classList.add("dragstart");
    };
    anchor.ondragend = () => {
      dragIds = null;
      anchor.classList.remove("dragstart");
      clearDropTarget();
    };
  }
  function enableDragDrop() {
    const main = document.getElementById("main");
    if (get("lock")) {
      main.ondragover = null;
      main.ondragleave = null;
      main.ondrop = null;
      return;
    }
    main.ondragover = (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      const target = getDropTarget(event);
      if (target) {
        clearDropTarget();
        dropTarget = target;
        const bordercss = "solid 2px " + get("font_color");
        if (target.tagName === "LI" || target.tagName === "UL") {
          if (isAbove(event.pageY, target)) {
            target.style.borderBottom = bordercss;
            target.style.margin = "0 0 -2px 0";
          } else {
            target.style.borderTop = bordercss;
            target.style.margin = "-2px 0 0 0";
          }
        } else if (target.className === "column") {
          if (event.pageX - target.offsetLeft > target.clientWidth / 2) {
            target.style.borderRight = bordercss;
            target.style.margin = "0";
          } else {
            target.style.borderLeft = bordercss;
            target.style.margin = "0 2px 0 -2px";
          }
        } else if (target.tagName === "A") {
          target.style.border = bordercss;
        }
      }
      return false;
    };
    main.ondragleave = () => {
      clearDropTarget();
    };
    main.ondrop = (event) => {
      event.stopPropagation();
      const target = getDropTarget(event);
      if (!target) return false;
      if (target.tagName === "A" && target.classList.contains("folder")) {
        folderMoveDrop(dragIds, target._vimNode ? target._vimNode.id : null);
        return false;
      }
      let x = getDropX(target, event);
      const y = getDropY(target, event);
      if (dragIds.length === 1 && y != null) addRow(dragIds[0], x, y);
      else {
        if (event.pageX - target.offsetLeft > target.clientWidth / 2) x++;
        addColumn(dragIds, x);
      }
      return false;
    };
  }
  function getDropTarget(event) {
    if (!dragIds) return null;
    let target = event.target;
    let a = target && target.tagName === "A" ? target : target.parentNode && target.parentNode.tagName === "A" ? target.parentNode : null;
    if (a && a.classList.contains("folder") && dragIds.length === 1) {
      const rect = a.getBoundingClientRect();
      const cy = event.clientY;
      if (cy - rect.top > 6 && rect.bottom - cy > 6) return a;
    }
    if (target && (target.tagName === "A" || target.parentNode.tagName === "A") && dragIds.length === 1) {
      while (target && target.parentNode.parentNode && target.parentNode.parentNode.className !== "column") {
        target = target.parentNode;
      }
      if (target && target.tagName === "LI" && state.columns[getDropX(target, event)].length === 1)
        target = target.parentNode;
    } else {
      while (target && target.className !== "column") target = target.parentNode;
    }
    return target;
  }
  function getDropX(target, event) {
    let x = null;
    while (target && target.className !== "column") target = target.parentNode;
    if (target) {
      x = 0;
      for (; target.previousSibling; x++) target = target.previousSibling;
    }
    return x;
  }
  function getDropY(target, event) {
    let y = null;
    if (target.tagName === "LI") {
      y = 0;
      if (isAbove(event.pageY, target)) y++;
      for (; target.previousSibling; y++) target = target.previousSibling;
    } else if (target.tagName === "UL") {
      y = 0;
      if (isAbove(event.pageY, target)) y++;
    }
    return y;
  }
  function isAbove(pageY, target) {
    return pageY - window.scrollY - target.getBoundingClientRect().top > target.clientHeight / 2;
  }
  function clearDropTarget() {
    if (dropTarget) {
      dropTarget.style.border = null;
      dropTarget.style.margin = null;
    }
    dropTarget = null;
  }

  // src/render/renderer.js
  function renderColumns2() {
    const target = document.getElementById("main");
    while (target.hasChildNodes()) target.removeChild(target.lastChild);
    for (let i = 0; i < state.columns.length; i++) {
      const column = document.createElement("div");
      column.className = "column";
      column.style.width = 1 / state.columns.length * 100 + "%";
      if (enableDragColumn) enableDragColumn(i, column);
      target.appendChild(column);
      renderColumn(i, column);
    }
    if (enableDragDrop) enableDragDrop();
    emit(Events.RENDER_COMPLETE);
  }
  var enableDragColumnFn = null;
  var enableDragDropFn = null;
  function setEnableDragColumn(fn) {
    enableDragColumnFn = fn;
  }
  function setEnableDragDrop(fn) {
    enableDragDropFn = fn;
  }

  // src/interaction/context-menu.js
  function onMenuClick(item, ul) {
    return function() {
      item.action();
      closeMenu(ul);
      return false;
    };
  }
  function renderMenu2(items, x, y, label) {
    const ul = document.createElement("ul");
    ul.className = "menu";
    ul.setAttribute("role", "menu");
    if (label) ul.setAttribute("aria-label", label);
    const prevFocus = document.activeElement;
    ul._prevFocus = prevFocus;
    let selectedAnchor = null;
    for (let i = 0; i < items.length; i++) {
      const li = document.createElement("li");
      if (items[i]) {
        const a = document.createElement("a");
        a.innerText = items[i].label;
        a.tabIndex = -1;
        a.setAttribute("role", "menuitem");
        if (items[i].selected === true) {
          a.setAttribute("aria-checked", "true");
          selectedAnchor = a;
        }
        a.onclick = onMenuClick(items[i], ul);
        li.appendChild(a);
      } else if (i > 0 && i < items.length - 1) {
        li.appendChild(document.createElement("hr"));
      } else continue;
      ul.appendChild(li);
    }
    document.body.appendChild(ul);
    const firstAnchor = ul.querySelector("a");
    if (selectedAnchor) selectedAnchor.focus();
    else if (firstAnchor) firstAnchor.focus();
    ul.style.left = Math.max(Math.min(x, window.innerWidth + window.scrollX - ul.clientWidth), 0) + "px";
    ul.style.top = Math.max(Math.min(y, window.innerHeight + window.scrollY - ul.clientHeight), 0) + "px";
    ul.onmousedown = (event) => {
      event.stopPropagation();
      return true;
    };
    setTimeout(() => {
      document.onclick = () => {
        closeMenu(ul);
        return true;
      };
      document.onmousedown = () => {
        closeMenu(ul);
        return true;
      };
      document.oncontextmenu = () => {
        closeMenu(ul);
        return true;
      };
      document.onkeydown = (event) => {
        if (event.code === "Escape") {
          closeMenu(ul);
          return true;
        }
        const anchors = ul.querySelectorAll('a[role="menuitem"]');
        if (!anchors.length) return true;
        let idx = -1;
        for (let i = 0; i < anchors.length; i++) {
          if (anchors[i] === document.activeElement) {
            idx = i;
            break;
          }
        }
        if (event.code === "ArrowDown") {
          event.preventDefault();
          const next = idx < 0 ? 0 : (idx + 1) % anchors.length;
          anchors[next].focus();
        } else if (event.code === "ArrowUp") {
          event.preventDefault();
          const prev = idx < 0 ? anchors.length - 1 : (idx - 1 + anchors.length) % anchors.length;
          anchors[prev].focus();
        } else if (event.code === "Home") {
          event.preventDefault();
          anchors[0].focus();
        } else if (event.code === "End") {
          event.preventDefault();
          anchors[anchors.length - 1].focus();
        } else if (event.code === "Enter" || event.code === "Space") {
          event.preventDefault();
          const target = event.target;
          if (target && target.getAttribute && target.getAttribute("role") === "menuitem") {
            target.click();
          } else {
            const focused = ul.querySelector("a:focus");
            if (focused) focused.click();
          }
        }
        return true;
      };
    }, 20);
    return ul;
  }
  function closeMenu(ul) {
    if (ul && ul.parentNode) ul.parentNode.removeChild(ul);
    document.onclick = null;
    document.onmousedown = null;
    document.oncontextmenu = null;
    document.onkeydown = null;
    if (ul && ul._prevFocus && ul._prevFocus.focus) ul._prevFocus.focus();
  }
  function getMenuItems(node) {
    const items = [];
    items.push({
      label: "Open all links in folder",
      action: () => {
        openLinks(node);
      }
    });
    if (node.id === "closed")
      items.push({
        label: "Clear browsing data",
        action: () => {
          openLink({ url: "chrome://settings/clearBrowserData" }, 1);
        }
      });
    if (node.id === "devices")
      items.push({
        label: "History",
        action: () => {
          openLink({ url: "chrome://history" }, 1);
        }
      });
    if (node.id && /^\d+$/.test(node.id))
      items.push({
        label: "Edit bookmarks",
        action: () => {
          openLink({ url: "chrome://bookmarks/?id=" + node.id }, 1);
        }
      });
    return items;
  }
  function openLinks(node) {
    chrome.tabs.getCurrent((tab) => {
      getChildrenFunction5(node)((result) => {
        for (let i = 0; i < result.length; i++) openLinkFn(result[i], 2);
      });
    });
  }
  var getChildrenFunction5 = null;
  var openLinkFn = null;
  function setGetChildrenFunction3(fn) {
    getChildrenFunction5 = fn;
  }
  function setOpenLink(fn) {
    openLinkFn = fn;
  }
  function addFolderHandlers2(node, anchor) {
    anchor.onclick = () => {
      toggle(node, anchor, getChildrenFunction5(node));
      return false;
    };
    let items = getMenuItems(node);
    if (!get("lock")) {
      items.push(null);
      items.push({
        label: "Create new column",
        action: () => {
          addColumn([node.id]);
        }
      });
      if (state.coords[node.id]) {
        const pos = state.coords[node.id];
        if (pos.y > 0)
          items.push({ label: "Move folder up", action: () => {
            addRow(node.id, pos.x, pos.y - 1);
          } });
        if (pos.y < state.columns[pos.x].length - 1)
          items.push({ label: "Move folder down", action: () => {
            addRow(node.id, pos.x, pos.y + 2);
          } });
        if (pos.x > 0)
          items.push({ label: "Move folder left", action: () => {
            addRow(node.id, pos.x - 1);
          } });
        if (pos.x < state.columns.length - 1)
          items.push({ label: "Move folder right", action: () => {
            addRow(node.id, pos.x + 1);
          } });
        if (state.root.indexOf(node.id) < 0)
          items.push({ label: "Remove folder", action: () => {
            removeRow2(pos.x, pos.y);
          } });
      }
    }
    anchor.oncontextmenu = (event) => {
      renderMenu2(items, event.pageX, event.pageY);
      return false;
    };
  }
  function addColumnHandlers(index, target) {
    let items = [];
    const ids = state.columns[index];
    if (!ids) return;
    if (ids.length === 1) items = getMenuItems({ id: ids[0] });
    if (!get("lock") && state.columns.length > 1) {
      items.push(null);
      if (index > 0)
        items.push({ label: "Move column left", action: () => {
          addColumn(ids, index - 1);
        } });
      if (index < state.columns.length - 1)
        items.push({ label: "Move column right", action: () => {
          addColumn(ids, index + 2);
        } });
      items.push({ label: "Remove column", action: () => {
        removeColumn(index);
      } });
      if (ids.length === 1) {
        if (index > 0)
          items.push({ label: "Move folder left", action: () => {
            addRow(ids[0], index - 1);
          } });
        if (index < state.columns.length - 1)
          items.push({ label: "Move folder right", action: () => {
            addRow(ids[0], index + 1);
          } });
      }
    }
    if (items.length > 0)
      target.oncontextmenu = (event) => {
        if (event.target.tagName === "A" || event.target.parentNode.tagName === "A") return true;
        renderMenu2(items, event.pageX, event.pageY);
        return false;
      };
  }

  // src/render/column.js
  function renderColumn(index, target) {
    const ids = state.columns[index];
    if (!ids) return;
    if (ids.length === 1 && !get("show_root")) {
      getChildrenFunction2({ id: ids[0] })((result) => {
        if (!state.columns[index]) return;
        renderAll2(result, target);
        if (addColumnHandlers) addColumnHandlers(index, target);
      });
    } else if (ids.length > 0) {
      let i = 0;
      const nodes = [];
      const callback2 = (result) => {
        if (!state.columns[index]) return;
        for (let j = 0; j < result.length; j++) nodes.push(result[j]);
        i++;
        if (i < ids.length) {
          getSubTree(ids[i], callback2);
        } else {
          renderAll2(nodes, target, true);
          if (addColumnHandlers) addColumnHandlers(index, target);
        }
      };
      getSubTree(ids[i], callback2);
    }
  }
  var addColumnHandlersFn = null;
  function setAddColumnHandlers(fn) {
    addColumnHandlersFn = fn;
  }

  // src/interaction/modal.js
  function showModal(options) {
    const prevFocus = document.activeElement;
    const backdrop = document.createElement("div");
    backdrop.className = "vim-modal-backdrop";
    const form = document.createElement("form");
    form.className = "vim-modal";
    const heading = document.createElement("div");
    heading.className = "vim-modal-title";
    heading.innerText = options.title;
    form.appendChild(heading);
    const inputs = [];
    for (let i = 0; i < options.fields.length; i++) {
      const field = options.fields[i];
      const label = document.createElement("label");
      label.className = "vim-modal-field";
      const p = document.createElement("p");
      p.innerText = field.label;
      const input = document.createElement("input");
      input.type = "text";
      input.placeholder = field.placeholder || "";
      input.value = field.value || "";
      label.appendChild(p);
      label.appendChild(input);
      form.appendChild(label);
      inputs.push(input);
    }
    const buttons = document.createElement("div");
    buttons.className = "vim-modal-buttons";
    const cancel = document.createElement("button");
    cancel.type = "button";
    cancel.innerText = "Cancel";
    cancel.onclick = close;
    const submit = document.createElement("button");
    submit.type = "submit";
    submit.innerText = options.submitLabel || "Submit";
    buttons.appendChild(cancel);
    buttons.appendChild(submit);
    form.appendChild(buttons);
    function close() {
      if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
      document.removeEventListener("keydown", onKeyDown, true);
      if (prevFocus && prevFocus.isConnected && prevFocus.focus) prevFocus.focus();
    }
    function onKeyDown(event) {
      if (event.key === "Escape") {
        event.stopPropagation();
        close();
      }
    }
    form.onsubmit = (event) => {
      event.preventDefault();
      const values = inputs.map((input) => input.value.trim());
      if (!options.onSubmit(values)) return;
      close();
    };
    backdrop.onmousedown = (event) => {
      if (event.target === backdrop) close();
      return false;
    };
    document.addEventListener("keydown", onKeyDown, true);
    backdrop.appendChild(form);
    document.body.appendChild(backdrop);
    if (inputs.length > 0) inputs[0].focus();
    else cancel.focus();
  }

  // src/interaction/keyboard.js
  function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
  }
  function getVisibleLinks(x) {
    const column = document.getElementsByClassName("column")[x];
    if (!column) return [];
    const first = column.firstChild;
    if (!first) return [];
    let container;
    if (first.tagName === "UL") container = first;
    else if (first.tagName === "DIV" && first.firstChild) container = first.firstChild;
    else return [];
    const links = [];
    collectLinks(container, links);
    return links;
  }
  function collectLinks(container, links) {
    for (let i = 0; i < container.children.length; i++) {
      const li = container.children[i];
      if (li.tagName !== "LI") continue;
      const a = li.firstChild;
      if (a && a.tagName === "A") links.push(a);
      const next = a ? a.nextSibling : null;
      if (next && next.tagName === "DIV" && next.firstChild) collectLinks(next.firstChild, links);
    }
  }
  function updateCursorVisuals() {
    if (state.vimEl) state.vimEl.classList.remove("vim-cursor");
    mutations.setVimEl(null);
    const links = getVisibleLinks(state.vimCursor.x);
    if (state.vimCursor.y >= 0 && state.vimCursor.y < links.length) {
      mutations.setVimEl(links[state.vimCursor.y]);
      state.vimEl.classList.add("vim-cursor");
      state.vimEl.scrollIntoView({ block: "nearest" });
    }
    const cutting = state.clipboard.mode === "cut";
    const allLinks = document.querySelectorAll("#main a");
    for (let i = 0; i < allLinks.length; i++) {
      const link = allLinks[i];
      const id = link._vimNode && link._vimNode.id;
      if (id && state.vimSelected.has(id)) link.classList.add("vim-selected");
      else link.classList.remove("vim-selected");
      if (cutting && id && state.clipboard.ids.indexOf(id) > -1) link.classList.add("vim-cut");
      else link.classList.remove("vim-cut");
    }
  }
  function moveCursor(dx, dy) {
    if (!state.columns || state.columns.length === 0) return;
    if (dx !== 0) {
      mutations.setVimCursor(clamp(state.vimCursor.x + dx, 0, state.columns.length - 1), state.vimCursor.y);
      const links = getVisibleLinks(state.vimCursor.x);
      mutations.setVimCursor(state.vimCursor.x, clamp(state.vimCursor.y, 0, Math.max(0, links.length - 1)));
    }
    if (dy !== 0) {
      const curLinks = getVisibleLinks(state.vimCursor.x);
      mutations.setVimCursor(state.vimCursor.x, clamp(state.vimCursor.y + dy, 0, Math.max(0, curLinks.length - 1)));
    }
    updateCursorVisuals();
  }
  function vimActivate() {
    if (!state.vimEl) return;
    const isFolder = state.vimEl.classList.contains("folder");
    if (isFolder) {
      const node = state.vimEl._vimNode;
      if (node) toggle(node, state.vimEl);
    } else {
      state.vimEl.dispatchEvent(new MouseEvent("click"));
    }
  }
  function vimOpenFolder() {
    if (!state.vimEl || !state.vimEl.classList.contains("folder")) return;
    const node = state.vimEl._vimNode;
    if (node) toggle(node, state.vimEl);
  }
  function createNodeDialog(isFolder) {
    const context = getInsertionContext();
    const fields = isFolder ? [{ label: "Name", placeholder: "New folder" }] : [{ label: "Name", placeholder: "Example" }, { label: "URL", placeholder: "example.com" }];
    showModal({
      title: isFolder ? "New folder" : "New bookmark",
      fields,
      submitLabel: "Create",
      onSubmit: (values) => {
        const title = values[0].trim();
        const props = { parentId: context.parentId };
        if (isFolder) {
          if (!title) return false;
          props.title = title;
        } else {
          const url = normalizeUrl(values[1]);
          if (!url) return false;
          props.title = title || url;
          props.url = url;
        }
        createBookmarkAt(props, context.afterId);
        return true;
      }
    });
  }
  function editNodeDialog() {
    if (!state.vimEl || !state.vimEl._vimNode) return;
    const node = state.vimEl._vimNode;
    if (!isRealBookmarkId(node.id)) return;
    const isFolder = state.vimEl.classList.contains("folder");
    const fields = isFolder ? [{ label: "Name", placeholder: "Folder name", value: node.title }] : [{ label: "Name", placeholder: "Bookmark name", value: node.title }, { label: "URL", placeholder: "example.com", value: node.url }];
    showModal({
      title: isFolder ? "Edit folder" : "Edit bookmark",
      fields,
      submitLabel: "Save",
      onSubmit: (values) => {
        const props = {};
        if (isFolder) {
          const title = values[0].trim();
          if (!title) return false;
          props.title = title;
        } else {
          const url = normalizeUrl(values[1]);
          if (!url) return false;
          props.title = values[0].trim() || url;
          props.url = url;
        }
        updateBookmark(node.id, props);
        return true;
      }
    });
  }
  function vimDelete() {
    if (!state.vimEl || !state.vimEl._vimNode) return;
    const ids = vimGetTargetIds();
    if (ids.length === 0) return;
    const message = state.vimSelected.size === 0 ? 'Delete "' + (state.vimEl._vimNode.title || state.vimEl._vimNode.url || "this item") + '"?' : "Delete " + ids.length + " selected item(s)?";
    showModal({
      title: message,
      fields: [],
      submitLabel: "Delete",
      onSubmit: () => {
        deleteBookmarksByIds(ids);
        return true;
      }
    });
  }
  function vimGetTargetIds() {
    const ids = state.vimSelected.size > 0 ? Array.from(state.vimSelected) : state.vimEl && state.vimEl._vimNode ? [state.vimEl._vimNode.id] : [];
    return ids.filter(clipTargetableId);
  }
  function vimToggleSelect() {
    if (!state.vimEl || !state.vimEl._vimNode) return;
    if (!clipTargetableId(state.vimEl._vimNode.id)) return;
    const id = state.vimEl._vimNode.id;
    if (state.vimSelected.has(id)) mutations.removeVimSelected(id);
    else mutations.addVimSelected(id);
    updateCursorVisuals();
  }
  function vimClearSelection() {
    if (state.vimSelected.size === 0) return;
    mutations.clearVimSelected();
    updateCursorVisuals();
  }
  function vimYank() {
    const ids = vimGetTargetIds();
    if (ids.length === 0) return;
    mutations.setClipboard(ids, "copy");
    vimClearSelection();
    updateCursorVisuals();
  }
  function vimCut() {
    const ids = vimGetTargetIds();
    if (ids.length === 0) return;
    mutations.setClipboard(ids, "cut");
    vimClearSelection();
    updateCursorVisuals();
  }
  function vimCancelClipboard() {
    if (state.clipboard.mode == null && state.clipboard.ids.length === 0) return;
    mutations.clearClipboard();
    updateCursorVisuals();
  }
  async function vimPaste(below) {
    if (state.clipboard.mode == null || state.clipboard.ids.length === 0) return;
    await pasteBatch(state.clipboard.mode, state.clipboard.ids.slice(0), below);
  }
  async function pasteBatch(mode, ids, below) {
    const dest = await getPasteDestination(below);
    let parentId = null;
    let base = null;
    if (!dest.anchorId) {
      parentId = dest.parentId;
    } else if (mode !== "cut") {
      const anc0 = await bmGet(dest.anchorId);
      if (!anc0 || !anc0[0]) return;
      parentId = anc0[0].parentId;
      base = anc0[0].index + (below ? 1 : 0);
    }
    const par = parentId ? await bmGet(parentId) : null;
    let len = par && par[0] && par[0].children ? par[0].children.length : 0;
    const done = [];
    for (let i = 0; i < ids.length; i++) {
      if (mode === "cut") {
        const src = await bmGet(ids[i]);
        if (!src || !src[0]) continue;
        let props;
        if (dest.anchorId) {
          const anc = await bmGet(dest.anchorId);
          if (!anc || !anc[0]) break;
          props = { parentId: anc[0].parentId, index: below ? anc[0].index + 1 + i : anc[0].index };
        } else {
          props = { parentId, index: null };
        }
        if (!parentId) parentId = props.parentId;
        const moved = await bmMove(ids[i], props);
        if (!moved) continue;
        done.push(moved.id);
      } else {
        if (!clipTargetableId(ids[i])) continue;
        const created = await copyBookmarkSubtree(ids[i], parentId, base == null ? null : Math.max(0, Math.min(base + i, len)));
        if (!created) continue;
        len++;
        done.push(created.id);
      }
    }
    mutations.clearClipboard();
    if (done.length > 0) syncLayoutAfterPaste(done, parentId, below);
    else updateCursorVisuals();
  }
  async function getPasteDestination(below) {
    if (!(state.vimEl && state.vimEl._vimNode)) return { parentId: getDefaultParentId() };
    const node = state.vimEl._vimNode;
    if (node.id === "empty") return { parentId: findParentFolderId(state.vimEl.parentNode) || getDefaultParentId() };
    if (!clipTargetableId(node.id)) return { parentId: getDefaultParentId() };
    const results = await bmGet(node.id);
    if (!results || !results[0]) return { parentId: getDefaultParentId() };
    return { anchorId: node.id, below: !!below };
  }
  function vimShowThemePicker() {
    const items = [];
    const current = get("theme");
    const names = Object.keys(window.themes || {});
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      items.push({
        label: (name === current ? "\u25CF " : "  ") + name,
        selected: name === current,
        action: () => {
          setConfig("theme", name);
        }
      });
    }
    let x = 100, y = 100;
    if (state.vimEl) {
      const rect = state.vimEl.getBoundingClientRect();
      x = rect.left + window.scrollX;
      y = rect.bottom + window.scrollY;
    }
    renderMenu(items, x, y, "Theme picker");
  }
  function initKeyboard() {
    document.addEventListener("keydown", (event) => {
      if (document.getElementById("options").style.display === "block") {
        if (event.key === "Escape") {
          showOptions2(false);
          event.preventDefault();
        }
        return;
      }
      const tag = event.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (document.querySelector(".menu") || document.querySelector(".vim-modal-backdrop")) return;
      if (event.ctrlKey || event.altKey || event.metaKey) return;
      let handled = true;
      switch (event.key) {
        case "ArrowLeft":
        case "h":
          moveCursor(-1, 0);
          break;
        case "ArrowRight":
        case "l":
          moveCursor(1, 0);
          break;
        case "ArrowDown":
        case "j":
          moveCursor(0, 1);
          break;
        case "ArrowUp":
        case "k":
          moveCursor(0, -1);
          break;
        case "Enter":
        case "o":
          vimActivate();
          break;
        case "O":
          vimOpenFolder();
          break;
        case "n":
          createNodeDialog(false);
          break;
        case "N":
          createNodeDialog(true);
          break;
        case "e":
          editNodeDialog();
          break;
        case "d":
          vimDelete();
          break;
        case "v":
          vimToggleSelect();
          break;
        case "V":
          vimClearSelection();
          break;
        case "y":
          vimYank();
          break;
        case "x":
          vimCut();
          break;
        case "p":
          vimPaste(true);
          break;
        case "P":
          vimPaste(false);
          break;
        case "T":
          vimShowThemePicker();
          break;
        case "/":
          showOptions2(true);
          break;
        case "Escape":
          vimClearSelection();
          vimCancelClipboard();
          break;
        default:
          handled = false;
      }
      if (handled) event.preventDefault();
    });
  }
  var showOptions2 = null;
  function setShowOptions(fn) {
    showOptions2 = fn;
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
  window.renderColumns = renderColumns2;
  window.toggle = toggle;
  window.getConfig = get;
  window.setConfig = set;
  window.themes = THEMES;
  window.showOptions = showOptions;
  window.renderMenu = renderMenu2;
  window.getChildrenFunction = getChildrenFunction2;
  window.SPECIAL = state.special;
  window.clipTargetableId = clipTargetableId;
  window.getCoords = getters.getCoords;
  window.renderAll = renderAll2;
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
  setRenderAll(renderAll2);
  setScheduleRestore(scheduleRestore);
  setGetChildrenFunction2(getChildrenFunction2);
  setGetConfig(get);
  setAddFolderHandlers(addFolderHandlers2);
  setEnableDragFolder(enableDragFolder2);
  setAddColumnHandlers(addColumnHandlers);
  setEnableDragColumn(enableDragColumn);
  setEnableDragDrop(enableDragDrop);
  setGetChildrenFunction3(getChildrenFunction2);
  setOpenLink(openLink2);
  setShowOptions(showOptions);
  loadAll();
  initKeyboard();
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
