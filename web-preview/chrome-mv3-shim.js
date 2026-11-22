/*
 * Web Preview MV3 Chrome/Firefox Extension Runtime Shim
 * Used ONLY by the local Express preview workbench (port 3000) so the real
 * MV3 popup.html + background-sw.js execute interactively inside the browser.
 */
(function () {
  "use strict";

  var messages = window.__PREVIEW_LOCALE_MESSAGES__ || {};
  var targetBrowser = window.__PREVIEW_BROWSER__ || "chrome";
  var listeners = {
    onMessage: [],
    onStorageChanged: [],
    onAlarm: [],
    onNotifClick: []
  };

  var STORAGE_PREFIX = "tc_mv3_preview_";

  function readArea(area) {
    try {
      var raw = localStorage.getItem(STORAGE_PREFIX + area);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  function writeArea(area, obj) {
    try {
      localStorage.setItem(STORAGE_PREFIX + area, JSON.stringify(obj));
    } catch (e) {}
  }

  function makeStorageArea(area) {
    return {
      get: function (keys, cb) {
        var all = readArea(area);
        var out = {};
        if (!keys) {
          out = all;
        } else if (typeof keys === "string") {
          if (Object.prototype.hasOwnProperty.call(all, keys)) out[keys] = all[keys];
        } else if (Array.isArray(keys)) {
          keys.forEach(function (k) {
            if (Object.prototype.hasOwnProperty.call(all, k)) out[k] = all[k];
          });
        } else if (typeof keys === "object") {
          Object.keys(keys).forEach(function (k) {
            out[k] = Object.prototype.hasOwnProperty.call(all, k) ? all[k] : keys[k];
          });
        }
        if (typeof cb === "function") cb(out);
        return Promise.resolve(out);
      },
      set: function (items, cb) {
        var all = readArea(area);
        var changes = {};
        Object.keys(items || {}).forEach(function (k) {
          changes[k] = { oldValue: all[k], newValue: items[k] };
          all[k] = items[k];
        });
        writeArea(area, all);
        listeners.onStorageChanged.forEach(function (fn) {
          try { fn(changes, area); } catch (e) {}
        });
        if (typeof cb === "function") cb();
        return Promise.resolve();
      }
    };
  }

  function notifyHost(eventType, detail) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ source: "tc-preview", type: eventType, detail: detail }, "*");
      }
    } catch (e) {}
  }

  // Seed realistic sample preview data on first run so every popup view is interactive
  var initialLocal = readArea("local");
  if (!initialLocal.__seeded_v3) {
    var now = Date.now();
    var svgThumb = function (label, bg) {
      return "data:image/svg+xml," + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="134" height="70" viewBox="0 0 134 70">' +
        '<rect width="134" height="70" fill="' + bg + '"/>' +
        '<text x="67" y="40" font-family="sans-serif" font-size="11" font-weight="bold" fill="#fff" text-anchor="middle">' + label + '</text>' +
        '</svg>'
      );
    };
    var svgBox = function (label, bg) {
      return "data:image/svg+xml," + encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="136" height="190" viewBox="0 0 136 190">' +
        '<rect width="136" height="190" fill="' + bg + '"/>' +
        '<text x="68" y="98" font-family="sans-serif" font-size="13" font-weight="bold" fill="#fff" text-anchor="middle">' + label + '</text>' +
        '</svg>'
      );
    };

    initialLocal.__seeded_v3 = true;
    initialLocal.oauth2_twitch = { accessToken: "preview_demo_token" };
    initialLocal.user = {
      authenticated: true,
      id: "1001",
      login: "preview_viewer",
      name: "PreviewViewer",
      logo: "/build/" + targetBrowser + "/common/icons/user_default.png"
    };
    initialLocal.following = [
      {
        _id: "s1", id: "s1", user_id: "u1", user_login: "kamet0", user_name: "Kamet0", name: "Kamet0",
        game_id: "21779", game_name: "League of Legends", title: "LEC Playoffs Watch Party & SoloQ",
        viewer_count: 42850, started_at: new Date(now - 7400000).toISOString(), language: "fr",
        thumbnail_url: svgThumb("LIVE 42.8K", "#4c1d95"), type: "live", vodcast: false, favorite: true,
        channel: { _id: "u1", display_name: "Kamet0" }
      },
      {
        _id: "s2", id: "s2", user_id: "u2", user_login: "caedrel", user_name: "Caedrel", name: "Caedrel",
        game_id: "21779", game_name: "League of Legends", title: "Draft Review + Live Co-Stream",
        viewer_count: 68120, started_at: new Date(now - 11200000).toISOString(), language: "en",
        thumbnail_url: svgThumb("LIVE 68.1K", "#312e81"), type: "live", vodcast: false, favorite: true,
        channel: { _id: "u2", display_name: "Caedrel" }
      },
      {
        _id: "s3", id: "s3", user_id: "u3", user_login: "theprimeagen", user_name: "ThePrimeagen", name: "ThePrimeagen",
        game_id: "1469308723", game_name: "Software and Game Development", title: "Building MV3 Extensions & Rust CLI",
        viewer_count: 9410, started_at: new Date(now - 3800000).toISOString(), language: "en",
        thumbnail_url: svgThumb("DEV 9.4K", "#1e3a5f"), type: "live", vodcast: false, favorite: true,
        channel: { _id: "u3", display_name: "ThePrimeagen" }
      }
    ];
    initialLocal.topstreams = initialLocal.following.concat([
      {
        _id: "s4", id: "s4", user_id: "u4", user_login: "ibai", user_name: "ibai", name: "ibai",
        game_id: "509658", game_name: "Just Chatting", title: "Kings League Special Evening",
        viewer_count: 91400, started_at: new Date(now - 5400000).toISOString(), language: "es",
        thumbnail_url: svgThumb("LIVE 91.4K", "#581c87"), type: "live", vodcast: false, favorite: false,
        channel: { _id: "u4", display_name: "ibai" }
      },
      {
        _id: "s5", id: "s5", user_id: "u5", user_login: "shroud", user_name: "shroud", name: "shroud",
        game_id: "516575", game_name: "VALORANT", title: "Radiant Ranked Grind",
        viewer_count: 23700, started_at: new Date(now - 14500000).toISOString(), language: "en",
        thumbnail_url: svgThumb("FPS 23.7K", "#7c2d12"), type: "live", vodcast: false, favorite: false,
        channel: { _id: "u5", display_name: "shroud" }
      }
    ]);
    initialLocal.games = [
      { _id: "509658", id: "509658", name: "Just Chatting", box_art_url: svgBox("Just Chatting", "#5b21b6"), viewers: 342100, channels: 4120, game: { _id: "509658", name: "Just Chatting" } },
      { _id: "21779", id: "21779", name: "League of Legends", box_art_url: svgBox("League of Legends", "#1d4ed8"), viewers: 215400, channels: 2310, game: { _id: "21779", name: "League of Legends" } },
      { _id: "516575", id: "516575", name: "VALORANT", box_art_url: svgBox("VALORANT", "#be123c"), viewers: 148900, channels: 1840, game: { _id: "516575", name: "VALORANT" } },
      { _id: "1469308723", id: "1469308723", name: "Software & Dev", box_art_url: svgBox("Software & Dev", "#0f766e"), viewers: 28600, channels: 490, game: { _id: "1469308723", name: "Software & Dev" } }
    ];
    initialLocal.followedChannels = initialLocal.following.map(function (s) {
      return {
        _id: s.user_id,
        to_id: s.user_id,
        to_login: s.user_login,
        to_name: s.user_name,
        logo: "/build/" + targetBrowser + "/common/icons/user_default.png",
        channel: { display_name: s.user_name, logo: "/build/" + targetBrowser + "/common/icons/user_default.png" }
      };
    });
    writeArea("local", initialLocal);
  }

  var chromeShim = {
    runtime: {
      getURL: function (rel) {
        if (!rel) return "";
        if (/^(https?:|data:|\/)/i.test(rel)) return rel;
        return "/build/" + targetBrowser + "/" + rel.replace(/^\/+/, "");
      },
      getManifest: function () {
        return { version: "3.0.0", manifest_version: 3 };
      },
      onInstalled: { addListener: function () {} },
      onStartup: { addListener: function () {} },
      onMessage: {
        addListener: function (fn) { listeners.onMessage.push(fn); }
      },
      sendMessage: function (msg, cb) {
        // Intercept preview-safe offline updates for demo token so clicking Refresh/Search works smoothly
        if (msg && msg.type === "UPDATE_COLLECTION") {
          var local = readArea("local");
          if (local.oauth2_twitch && local.oauth2_twitch.accessToken === "preview_demo_token") {
            var items = [];
            if (msg.name === "following") items = local.following || [];
            else if (msg.name === "topstreams") items = local.topstreams || [];
            else if (msg.name === "games") items = local.games || [];
            else if (msg.name === "followedChannels") items = local.followedChannels || [];
            else if (msg.name === "search") {
              var q = (msg.query || "").toLowerCase();
              items = (local.topstreams || []).filter(function (s) {
                return s.user_name.toLowerCase().includes(q) || s.game_name.toLowerCase().includes(q) || s.title.toLowerCase().includes(q);
              });
            } else if (msg.name === "gameStreams") {
              items = (local.topstreams || []).filter(function (s) { return String(s.game_id) === String(msg.gameId); });
            }
            var demoRes = { error: "", items: items };
            if (typeof cb === "function") setTimeout(function () { cb(demoRes); }, 120);
            return Promise.resolve(demoRes);
          }
        }

        if (msg && msg.type === "AUTH_LOGIN") {
          notifyHost("action", { label: "OAuth2 Login triggered (MV3 chrome.tabs.create + chrome.scripting.executeScript)" });
        }

        return new Promise(function (resolve) {
          var responded = false;
          function done(res) {
            if (responded) return;
            responded = true;
            if (typeof cb === "function") cb(res);
            resolve(res);
          }
          listeners.onMessage.forEach(function (fn) {
            try { fn(msg, {}, done); } catch (e) {}
          });
          setTimeout(function () { done({}); }, 1500);
        });
      }
    },
    storage: {
      local: makeStorageArea("local"),
      sync: makeStorageArea("sync"),
      onChanged: {
        addListener: function (fn) { listeners.onStorageChanged.push(fn); }
      }
    },
    action: {
      setBadgeText: function (opts) {
        notifyHost("badge", { text: opts && opts.text ? opts.text : "" });
      },
      setBadgeBackgroundColor: function () {}
    },
    alarms: {
      create: function () {},
      onAlarm: { addListener: function (fn) { listeners.onAlarm.push(fn); } }
    },
    notifications: {
      create: function (id, opts) {
        notifyHost("notification", { id: id, title: opts.title, message: opts.message });
      },
      clear: function () {},
      onClicked: { addListener: function (fn) { listeners.onNotifClick.push(fn); } }
    },
    tabs: {
      create: function (opts) {
        notifyHost("tab", { url: opts && opts.url });
      },
      update: function () {},
      query: function (opts, cb) { if (cb) cb([]); },
      remove: function () {},
      onUpdated: { addListener: function () {} }
    },
    windows: {
      create: function (opts) {
        notifyHost("tab", { url: opts && opts.url, popup: true });
      }
    },
    scripting: {
      executeScript: function () { return Promise.resolve([]); }
    },
    i18n: {
      getMessage: function (key) {
        if (key === "@@bidi_dir") return "ltr";
        return messages[key] && messages[key].message ? messages[key].message : key;
      }
    }
  };

  window.chrome = chromeShim;
  if (targetBrowser === "firefox") {
    window.browser = chromeShim;
  }
})();
