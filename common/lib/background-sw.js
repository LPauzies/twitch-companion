/*
 * Twitch Companion — Manifest V3 Background Worker
 * Runs as a Service Worker in Chrome MV3 and as an Event Page in Firefox MV3.
 * Zero DOM / jQuery / XMLHttpRequest / localStorage / eval dependencies.
 */
(function () {
  "use strict";

  var root = typeof globalThis !== "undefined" ? globalThis : self;
  var api = typeof browser !== "undefined" && browser.runtime ? browser : chrome;

  var HELIX_BASE = "https://api.twitch.tv/helix";
  var ALARMS = {
    FOLLOWING: "tc_refresh_following",
    TOP_STREAMS: "tc_refresh_topstreams",
    GAMES: "tc_refresh_games",
    CLEAR_NOTIFIED: "tc_clear_notified"
  };

  var OFFSCREEN_URL = "common/html/offscreen.html";

  var DEFAULT_SETTINGS = [
    {
      id: "streamLanguage2",
      desc: "__MSG_m102__",
      type: "select",
      select: true,
      opts: [
        { id: "any", name: "Any" },
        { id: "ru", name: "Русский" },
        { id: "en", name: "English" },
        { id: "da", name: "Dansk" },
        { id: "de", name: "Deutsch" },
        { id: "es", name: "Español" },
        { id: "fr", name: "Français" },
        { id: "it", name: "Italiano" },
        { id: "hu", name: "Magyar" },
        { id: "nl", name: "Nederlands" },
        { id: "no", name: "Norsk" },
        { id: "pl", name: "Polski" },
        { id: "pt", name: "Português" },
        { id: "sk", name: "Slovenčina" },
        { id: "fi", name: "Suomi" },
        { id: "sv", name: "Svenska" },
        { id: "vi", name: "Tiếng Việt" },
        { id: "tr", name: "Türkçe" },
        { id: "cs", name: "Čeština" },
        { id: "el", name: "Ελληνικά" },
        { id: "bg", name: "Български" },
        { id: "ar", name: "العربية" },
        { id: "th", name: "ภาษาไทย" },
        { id: "zh", name: "中文" },
        { id: "ja", name: "日本語" },
        { id: "ko", name: "한국어" },
        { id: "asl", name: "American Sign Language" },
        { id: "other", name: "__MSG_m106__" }
      ],
      show: true,
      value: "any"
    },
    {
      id: "defaultTab",
      desc: "__MSG_m66__",
      type: "select",
      select: true,
      opts: [
        { id: "following", name: "__MSG_m67__" },
        { id: "browse", name: "__MSG_m68__" },
        { id: "topstreams", name: "__MSG_m69__" }
      ],
      show: true,
      value: "following"
    },
    {
      id: "viewSort",
      desc: "__MSG_m1__",
      type: "select",
      select: true,
      opts: [
        { id: "viewer_count|1", name: "__MSG_m10__" },
        { id: "viewer_count|-1", name: "__MSG_m11__" },
        { id: "user_login|1", name: "__MSG_m12__" },
        { id: "user_login|-1", name: "__MSG_m13__" },
        { id: "game_name|1", name: "__MSG_m82__" },
        { id: "started_at|-1", name: "__MSG_m14__" }
      ],
      show: true,
      value: "viewer_count|-1"
    },
    {
      id: "themeType",
      desc: "__MSG_m55__",
      type: "radio",
      radio: true,
      opts: [
        { id: "dark", name: "__MSG_m56__" },
        { id: "white", name: "__MSG_m57__" }
      ],
      show: true,
      value: "white"
    },
    {
      id: "simpleView",
      desc: "__MSG_m65__",
      checkbox: true,
      type: "checkbox",
      show: true,
      value: false
    },
    {
      id: "openStreamIn",
      desc: "__MSG_m2__",
      type: "radio",
      radio: true,
      opts: [
        { id: "newlayout", name: "__MSG_m16__" },
        { id: "popout", name: "__MSG_m17__" },
        { id: "theatrelayout", name: "__MSG_m88__" },
        { id: "html5", name: "__MSG_m101__" }
      ],
      show: true,
      value: "newlayout"
    },
    {
      id: "openChatIn",
      desc: "__MSG_m3__",
      type: "radio",
      radio: true,
      opts: [
        { id: "newwindow", name: "__MSG_m18__" },
        { id: "newtab", name: "__MSG_m19__" }
      ],
      show: true,
      value: "newwindow"
    },
    {
      id: "showBadge",
      desc: "__MSG_m4__",
      checkbox: true,
      type: "checkbox",
      show: true,
      value: true
    },
    {
      id: "hideVodcasts",
      desc: "__MSG_m110__",
      checkbox: true,
      type: "checkbox",
      show: true,
      value: false
    },
    {
      id: "showDesktopNotification",
      desc: "__MSG_m5__",
      checkbox: true,
      type: "checkbox",
      show: true,
      value: true
    },
    {
      id: "invertNotification",
      desc: "__MSG_m115__",
      checkbox: true,
      type: "checkbox",
      show: true,
      value: true
    },
    {
      id: "notifyCount",
      desc: "__MSG_m113__",
      type: "select",
      select: true,
      opts: [
        { id: "0", name: "0" },
        { id: "1", name: "1" },
        { id: "2", name: "2" },
        { id: "3", name: "3" },
        { id: "4", name: "4" },
        { id: "5", name: "5" }
      ],
      show: true,
      value: "3"
    },
    {
      id: "playNotificationSound",
      desc: "__MSG_m7__",
      checkbox: true,
      show: true,
      type: "checkbox",
      value: false
    },
    {
      id: "notificationSound",
      desc: "__MSG_m8__",
      type: "radio",
      radio: true,
      show: true,
      opts: [
        { id: "common/audio/ding.ogg", name: "ding" },
        { id: "common/audio/chime.mp3", name: "chime" },
        { id: "common/audio/click.wav", name: "click" },
        { id: "customsound", name: "__MSG_m76__" }
      ],
      value: "common/audio/ding.ogg"
    },
    {
      id: "notificationVolume",
      desc: "__MSG_m86__",
      range: true,
      show: true,
      type: "range",
      tip: "%",
      min: 1,
      max: 100,
      value: 100
    },
    {
      id: "customNotificationSound",
      desc: "__MSG_m75__",
      button: true,
      show: true,
      type: "button",
      value: ""
    },
    {
      id: "refreshInterval",
      desc: "__MSG_m9__",
      range: true,
      show: true,
      type: "range",
      tip: "min",
      min: 1,
      max: 60,
      value: 5
    }
  ];

  // ---------------------------------------------------------------------------
  // Storage Helpers (Promise-based wrapper compatible with Chrome & Firefox)
  // ---------------------------------------------------------------------------
  function storageGet(area, keys) {
    return new Promise(function (resolve) {
      var target = api.storage && api.storage[area] ? api.storage[area] : api.storage.local;
      if (!target) return resolve({});
      try {
        var result = target.get(keys, function (items) {
          resolve(items || {});
        });
        if (result && typeof result.then === "function") {
          result.then(function (items) { resolve(items || {}); }).catch(function () { resolve({}); });
        }
      } catch (e) {
        resolve({});
      }
    });
  }

  function storageSet(area, obj) {
    return new Promise(function (resolve) {
      var target = api.storage && api.storage[area] ? api.storage[area] : api.storage.local;
      if (!target) return resolve();
      try {
        var result = target.set(obj, function () {
          resolve();
        });
        if (result && typeof result.then === "function") {
          result.then(function () { resolve(); }).catch(function () { resolve(); });
        }
      } catch (e) {
        resolve();
      }
    });
  }

  function getActionApi() {
    return api.action || api.browserAction;
  }

  function getConstants() {
    return root.constants || {
      browserTarget: "chrome",
      twitchApi: {
        api: "https://id.twitch.tv/oauth2/authorize",
        response_type: "token",
        client_id: "nhrhocc8g5gfm8w98oi9ozuuo4ser2",
        client_secret: "",
        scope: "user:read:follows user:read:email",
        redirect_uri: "https://ndragomirov.github.io/twitch.html"
      }
    };
  }

  function getContributors() {
    return Array.isArray(root.contributorList) ? root.contributorList : [];
  }

  // ---------------------------------------------------------------------------
  // State & Settings Management
  // ---------------------------------------------------------------------------
  async function getSettings() {
    var data = await storageGet("local", ["settings"]);
    var saved = Array.isArray(data.settings) ? data.settings : [];
    var savedMap = {};
    saved.forEach(function (item) {
      if (item && item.id) savedMap[item.id] = item.value;
    });

    return DEFAULT_SETTINGS.map(function (def) {
      var clone = JSON.parse(JSON.stringify(def));
      if (Object.prototype.hasOwnProperty.call(savedMap, def.id)) {
        clone.value = savedMap[def.id];
      }
      return clone;
    });
  }

  async function getSettingValue(id) {
    var settings = await getSettings();
    var match = settings.find(function (s) { return s.id === id; });
    return match ? match.value : undefined;
  }

  async function saveSettings(updates) {
    var current = await getSettings();
    var map = {};
    (updates || []).forEach(function (u) {
      if (u && u.id) map[u.id] = u.value;
    });
    var merged = current.map(function (s) {
      if (Object.prototype.hasOwnProperty.call(map, s.id)) {
        s.value = map[s.id];
      }
      return s;
    });
    await storageSet("local", { settings: merged });

    if (Object.prototype.hasOwnProperty.call(map, "showBadge")) {
      var st = await storageGet("local", ["following"]);
      var count = Array.isArray(st.following) ? st.following.length : 0;
      await updateBadge(map.showBadge ? count : 0);
    }

    if (Object.prototype.hasOwnProperty.call(map, "refreshInterval")) {
      await scheduleAlarms();
    }

    return merged;
  }

  async function getAuthState() {
    var local = await storageGet("local", ["oauth2_twitch", "user"]);
    var token = local.oauth2_twitch && local.oauth2_twitch.accessToken ? local.oauth2_twitch.accessToken : "";
    if (!token) {
      var sync = await storageGet("sync", ["oauth2_twitch"]);
      if (sync.oauth2_twitch && sync.oauth2_twitch.accessToken) {
        token = sync.oauth2_twitch.accessToken;
        await storageSet("local", { oauth2_twitch: sync.oauth2_twitch });
      }
    }
    var user = local.user || {
      authenticated: false,
      id: "",
      login: "",
      name: "",
      logo: api.runtime.getURL("common/icons/user_default.png")
    };
    return { token: token, user: user };
  }

  async function setAccessToken(token) {
    var payload = token ? { accessToken: token } : {};
    await storageSet("local", { oauth2_twitch: payload });
    await storageSet("sync", { oauth2_twitch: payload });

    if (token) {
      await fetchCurrentUser(token);
      await refreshFollowingStreams();
    } else {
      await storageSet("local", {
        user: {
          authenticated: false,
          id: "",
          login: "",
          name: "",
          logo: api.runtime.getURL("common/icons/user_default.png")
        },
        following: [],
        followedChannels: [],
        followedgames: []
      });
      await updateBadge(0);
    }
  }

  // ---------------------------------------------------------------------------
  // Badge Helper (MV3 Action API)
  // ---------------------------------------------------------------------------
  async function updateBadge(count) {
    var action = getActionApi();
    if (!action) return;
    var showBadge = await getSettingValue("showBadge");
    var text = showBadge && count > 0 ? String(count) : "";
    try {
      action.setBadgeBackgroundColor({ color: [100, 100, 100, 255] });
      action.setBadgeText({ text: text });
    } catch (e) {
      // Ignore badge errors in headless/preview contexts
    }
  }

  // ---------------------------------------------------------------------------
  // Audio Playback (Chrome Offscreen Document + Firefox Event Page fallback)
  // ---------------------------------------------------------------------------
  var localAudio = null;

  async function ensureOffscreenDocument() {
    if (!api.offscreen || !api.offscreen.createDocument) return false;
    var offscreenUrl = api.runtime.getURL(OFFSCREEN_URL);
    if (api.runtime.getContexts) {
      var contexts = await api.runtime.getContexts({
        contextTypes: ["OFFSCREEN_DOCUMENT"],
        documentUrls: [offscreenUrl]
      });
      if (contexts && contexts.length > 0) return true;
    }
    try {
      await api.offscreen.createDocument({
        url: OFFSCREEN_URL,
        reasons: ["AUDIO_PLAYBACK"],
        justification: "Play Twitch live stream notification sound"
      });
      return true;
    } catch (e) {
      return false;
    }
  }

  async function playNotificationSound(explicitPath, explicitVolume) {
    var soundPath = explicitPath;
    if (!soundPath) {
      var selected = await getSettingValue("notificationSound");
      if (selected === "customsound") {
        var stored = await storageGet("local", ["customSound"]);
        soundPath = stored.customSound || "common/audio/ding.ogg";
      } else {
        soundPath = selected || "common/audio/ding.ogg";
      }
    }

    var vol = typeof explicitVolume === "number"
      ? explicitVolume
      : ((await getSettingValue("notificationVolume")) || 100) / 100;

    if (!/^data:audio/.test(soundPath) && !/^https?:/i.test(soundPath)) {
      soundPath = api.runtime.getURL(soundPath);
    }

    if (api.offscreen && api.offscreen.createDocument) {
      var ready = await ensureOffscreenDocument();
      if (ready) {
        api.runtime.sendMessage({
          target: "offscreen",
          type: "PLAY_SOUND",
          path: soundPath,
          volume: vol
        });
        return;
      }
    }

    // Firefox MV3 Event Page or Web Preview fallback
    if (typeof Audio !== "undefined") {
      try {
        if (!localAudio) localAudio = new Audio();
        localAudio.src = soundPath;
        localAudio.volume = Math.max(0, Math.min(1, vol));
        localAudio.play().catch(function () {});
      } catch (e) {
        // Autoplay restriction or unsupported audio format
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Twitch Helix API Client (Modern Fetch, Zero Kraken v5 Headers)
  // ---------------------------------------------------------------------------
  async function helixFetch(endpoint, params) {
    var cfg = getConstants().twitchApi;
    var auth = await getAuthState();
    var url = new URL(endpoint.startsWith("http") ? endpoint : HELIX_BASE + endpoint);

    if (params) {
      Object.keys(params).forEach(function (k) {
        if (params[k] !== undefined && params[k] !== null && params[k] !== "") {
          url.searchParams.append(k, String(params[k]));
        }
      });
    }

    var headers = new Headers();
    headers.set("Client-Id", cfg.client_id);
    if (auth.token) {
      headers.set("Authorization", "Bearer " + auth.token);
    }

    var res = await fetch(url.toString(), {
      method: "GET",
      headers: headers
    });

    if (res.status === 401) {
      await setAccessToken("");
      var authErr = new Error("auth");
      authErr.status = 401;
      throw authErr;
    }

    if (!res.ok) {
      var apiErr = new Error("api");
      apiErr.status = res.status;
      throw apiErr;
    }

    return res.json();
  }

  function normalizeStream(s, isFavorite) {
    var thumb = s.thumbnail_url || "";
    if (thumb) {
      thumb = thumb.replace("{width}", "134").replace("{height}", "70");
    }
    var userName = s.user_name || s.display_name || s.user_login || s.broadcaster_login || "";
    var userLogin = s.user_login || s.broadcaster_login || userName.toLowerCase();
    var streamType = s.type || "live";
    return {
      _id: s.id || s.user_id || userLogin,
      id: s.id || s.user_id || userLogin,
      user_id: s.user_id || s.id || "",
      user_login: userLogin,
      user_name: userName,
      name: userName,
      game_id: s.game_id || "",
      game_name: s.game_name || "",
      title: s.title || "",
      viewer_count: typeof s.viewer_count === "number" ? s.viewer_count : 0,
      started_at: s.started_at || new Date().toISOString(),
      language: s.language || s.broadcaster_language || "en",
      thumbnail_url: thumb,
      type: streamType,
      vodcast: streamType === "rerun" || streamType === "watch_party",
      favorite: !!isFavorite,
      channel: { _id: s.user_id || s.id || userLogin, display_name: userName }
    };
  }

  function normalizeGame(g) {
    var boxArt = (g.box_art_url || "").replace("{width}", "136").replace("{height}", "190");
    return {
      _id: g.id,
      id: g.id,
      name: g.name,
      box_art_url: boxArt,
      viewers: g.viewers || 0,
      channels: g.channels || 0,
      game: { _id: g.id, name: g.name }
    };
  }

  function normalizeVideo(v) {
    var thumb = (v.thumbnail_url || "").replace("%{width}", "134").replace("%{height}", "70");
    return {
      _id: v.id,
      id: v.id,
      url: v.url,
      title: v.title,
      length: v.duration || 0,
      recorded_at: v.created_at || v.published_at,
      game: v.game || "",
      preview: { medium: thumb },
      channel: { display_name: v.user_name || v.user_login || "" }
    };
  }

  async function fetchCurrentUser(explicitToken) {
    try {
      var data = await helixFetch("/users");
      if (data && Array.isArray(data.data) && data.data[0]) {
        var u = data.data[0];
        var user = {
          authenticated: true,
          id: u.id,
          login: u.login,
          name: u.display_name || u.login,
          logo: u.profile_image_url || api.runtime.getURL("common/icons/user_default.png")
        };
        await storageSet("local", { user: user });
        return user;
      }
    } catch (e) {
      // Token invalid or offline
    }
    return null;
  }

  async function refreshFollowingStreams() {
    var auth = await getAuthState();
    if (!auth.token) {
      return { error: "auth", items: [] };
    }
    var user = auth.user;
    if (!user || !user.id) {
      user = await fetchCurrentUser(auth.token);
      if (!user || !user.id) return { error: "auth", items: [] };
    }

    try {
      var prevData = await storageGet("local", ["following", "notifiedIds"]);
      var prevIds = Array.isArray(prevData.following)
        ? prevData.following.map(function (s) { return s.id; })
        : [];
      var notifiedIds = Array.isArray(prevData.notifiedIds) ? prevData.notifiedIds : [];

      var res = await helixFetch("/streams/followed", { user_id: user.id, first: 100 });
      var hideVodcasts = await getSettingValue("hideVodcasts");
      var streams = (res.data || [])
        .map(function (s) { return normalizeStream(s, true); })
        .filter(function (s) { return !hideVodcasts || !s.vodcast; });

      await storageSet("local", { following: streams, followingError: "" });
      await updateBadge(streams.length);

      // Detect newly live streams for notifications
      if (prevIds.length > 0) {
        var newlyLive = streams.filter(function (s) {
          return prevIds.indexOf(s.id) === -1 && notifiedIds.indexOf(s.id) === -1;
        });
        if (newlyLive.length > 0) {
          await dispatchNotifications(newlyLive, user.login);
          var updatedNotified = Array.from(new Set(notifiedIds.concat(newlyLive.map(function (s) { return s.id; }))));
          await storageSet("local", { notifiedIds: updatedNotified });
        }
      }

      return { error: "", items: streams };
    } catch (err) {
      var code = err.message === "auth" ? "auth" : "api";
      await storageSet("local", { followingError: code });
      return { error: code, items: [] };
    }
  }

  async function refreshTopStreams(opts) {
    var lang = await getSettingValue("streamLanguage2");
    var hideVodcasts = await getSettingValue("hideVodcasts");
    var params = { first: 50 };
    if (lang && lang !== "any") params.language = lang;
    if (opts && opts.after) params.after = opts.after;

    try {
      var res = await helixFetch("/streams", params);
      var items = (res.data || [])
        .map(function (s) { return normalizeStream(s, false); })
        .filter(function (s) { return !hideVodcasts || !s.vodcast; });

      var cursor = res.pagination && res.pagination.cursor ? res.pagination.cursor : "";
      if (opts && opts.append) {
        var existing = await storageGet("local", ["topstreams"]);
        var merged = (existing.topstreams || []).concat(items);
        await storageSet("local", { topstreams: merged, topstreamsCursor: cursor, topstreamsError: "" });
        return { error: "", items: items, all: merged, cursor: cursor };
      }

      await storageSet("local", { topstreams: items, topstreamsCursor: cursor, topstreamsError: "" });
      return { error: "", items: items, cursor: cursor };
    } catch (err) {
      var code = err.message === "auth" ? "auth" : "api";
      await storageSet("local", { topstreamsError: code });
      return { error: code, items: [] };
    }
  }

  async function refreshTopGames(opts) {
    var params = { first: 50 };
    if (opts && opts.after) params.after = opts.after;

    try {
      var res = await helixFetch("/games/top", params);
      var items = (res.data || []).map(normalizeGame);
      var cursor = res.pagination && res.pagination.cursor ? res.pagination.cursor : "";

      if (opts && opts.append) {
        var existing = await storageGet("local", ["games"]);
        var merged = (existing.games || []).concat(items);
        await storageSet("local", { games: merged, gamesCursor: cursor, gamesError: "" });
        return { error: "", items: items, all: merged, cursor: cursor };
      }

      await storageSet("local", { games: items, gamesCursor: cursor, gamesError: "" });
      return { error: "", items: items, cursor: cursor };
    } catch (err) {
      var code = err.message === "auth" ? "auth" : "api";
      await storageSet("local", { gamesError: code });
      return { error: code, items: [] };
    }
  }

  async function searchStreams(query) {
    if (!query || !query.trim()) {
      return { error: "nosearchquery", items: [] };
    }
    try {
      var res = await helixFetch("/search/channels", { query: query.trim(), first: 50, live_only: true });
      var items = (res.data || []).map(function (c) {
        return normalizeStream({
          id: c.id,
          user_id: c.id,
          user_login: c.broadcaster_login,
          user_name: c.display_name,
          game_id: c.game_id,
          game_name: c.game_name,
          title: c.title,
          viewer_count: 0,
          started_at: c.started_at,
          language: c.broadcaster_language,
          thumbnail_url: c.thumbnail_url,
          type: c.is_live ? "live" : ""
        }, false);
      });
      await storageSet("local", { search: items });
      return { error: "", items: items };
    } catch (err) {
      return { error: err.message === "auth" ? "auth" : "api", items: [] };
    }
  }

  async function fetchFollowedChannels() {
    var auth = await getAuthState();
    if (!auth.token || !auth.user || !auth.user.id) {
      return { error: "auth", items: [] };
    }
    try {
      // Updated from deprecated /users/follows to Helix /channels/followed
      var res = await helixFetch("/channels/followed", { user_id: auth.user.id, first: 100 });
      var defaultAvatar = api.runtime.getURL("common/icons/user_default.png");
      var items = (res.data || []).map(function (c) {
        return {
          _id: c.broadcaster_id,
          to_id: c.broadcaster_id,
          to_login: c.broadcaster_login,
          to_name: c.broadcaster_name,
          logo: defaultAvatar,
          channel: {
            display_name: c.broadcaster_name,
            logo: defaultAvatar
          }
        };
      });
      await storageSet("local", { followedChannels: items });
      return { error: "", items: items };
    } catch (err) {
      return { error: err.message === "auth" ? "auth" : "api", items: [] };
    }
  }

  async function fetchGameStreams(gameId, disableLang) {
    if (!gameId) return { error: "", items: [] };
    var params = { game_id: gameId, first: 50 };
    if (!disableLang) {
      var lang = await getSettingValue("streamLanguage2");
      if (lang && lang !== "any") params.language = lang;
    }
    try {
      var res = await helixFetch("/streams", params);
      var items = (res.data || []).map(function (s) { return normalizeStream(s, false); });
      await storageSet("local", { gameStreams: items });
      return { error: "", items: items };
    } catch (err) {
      return { error: err.message === "auth" ? "auth" : "api", items: [] };
    }
  }

  async function fetchVideos(params) {
    try {
      var res = await helixFetch("/videos", params);
      var items = (res.data || []).map(normalizeVideo);
      return { error: "", items: items };
    } catch (err) {
      return { error: err.message === "auth" ? "auth" : "api", items: [] };
    }
  }

  // ---------------------------------------------------------------------------
  // Notifications (MV3-Compliant — no XHR / Blob URLs)
  // ---------------------------------------------------------------------------
  async function getChannelNotificationPref(userLogin, channelId, type) {
    var defaultVal = await getSettingValue("invertNotification");
    if (!userLogin) return !!defaultVal;
    var key = "notifications_" + userLogin;
    var stored = await storageGet("local", [key]);
    var list = Array.isArray(stored[key]) ? stored[key] : [];
    var match = list.find(function (c) { return String(c._id) === String(channelId); });
    if (match && match.notificationOpts && typeof match.notificationOpts[type] === "boolean") {
      return match.notificationOpts[type];
    }
    return !!defaultVal;
  }

  async function dispatchNotifications(streams, userLogin) {
    var showDesktop = await getSettingValue("showDesktopNotification");
    var playSound = await getSettingValue("playNotificationSound");
    var displayCount = parseInt(await getSettingValue("notifyCount"), 10);
    if (isNaN(displayCount)) displayCount = 3;

    var desktopStreams = [];
    var soundStreams = [];

    for (var i = 0; i < streams.length; i++) {
      var st = streams[i];
      if (await getChannelNotificationPref(userLogin, st.user_id, "desktop")) {
        desktopStreams.push(st);
      }
      if (await getChannelNotificationPref(userLogin, st.user_id, "sound")) {
        soundStreams.push(st);
      }
    }

    if (showDesktop && desktopStreams.length > 0 && api.notifications && api.notifications.create) {
      var defaultIcon = api.runtime.getURL("common/icons/64.png");
      var toShow = displayCount > 0 ? desktopStreams.slice(0, displayCount) : [];
      var rest = displayCount > 0 ? desktopStreams.slice(displayCount) : desktopStreams;
      var mapData = await storageGet("local", ["notificationMap"]);
      var notifMap = mapData.notificationMap || {};

      for (var j = 0; j < toShow.length; j++) {
        var s = toShow[j];
        var notifId = "tc_live_" + s.id + "_" + Date.now() + "_" + j;
        notifMap[notifId] = s.user_login;
        api.notifications.create(notifId, {
          type: "basic",
          title: s.user_name,
          message: (s.game_name ? s.game_name + "\n" : "") + (s.title || "Live now on Twitch"),
          iconUrl: defaultIcon
        });
      }

      if (rest.length > 0) {
        var summaryId = "tc_summary_" + Date.now();
        var names = rest.slice(0, 3).map(function (r) { return r.user_name; });
        var extra = rest.length > 3 ? "\n+" + (rest.length - 3) + " more" : "";
        api.notifications.create(summaryId, {
          type: "basic",
          title: "Twitch Companion",
          message: names.join("\n") + extra,
          iconUrl: defaultIcon
        });
      }

      await storageSet("local", { notificationMap: notifMap });
    }

    if (playSound && soundStreams.length > 0) {
      await playNotificationSound();
    }
  }

  // ---------------------------------------------------------------------------
  // OAuth2 Flow (MV3-Compliant via chrome.scripting.executeScript)
  // ---------------------------------------------------------------------------
  function buildOAuthUrl() {
    var cfg = getConstants().twitchApi;
    var qs = new URLSearchParams({
      client_id: cfg.client_id,
      redirect_uri: cfg.redirect_uri,
      response_type: cfg.response_type || "token",
      scope: cfg.scope || "user:read:follows user:read:email"
    });
    return cfg.api + "?" + qs.toString();
  }

  function extractOAuthUrlInTab() {
    var extApi = typeof browser !== "undefined" && browser.runtime ? browser : chrome;
    extApi.runtime.sendMessage({
      type: "OAUTH2_CALLBACK",
      href: window.location.href
    });
  }

  async function finalizeOAuth(href, tabId) {
    var cfg = getConstants().twitchApi;
    if (!href) return;
    var tokenMatch = href.match(/[&#]access_token=([\w/-]+)/);
    if (tokenMatch && tokenMatch[1]) {
      await setAccessToken(tokenMatch[1]);
      if (tabId && api.tabs && api.tabs.remove) {
        try { api.tabs.remove(tabId); } catch (e) {}
      }
      return;
    }

    var codeMatch = href.match(/[&?]code=([\w/-]+)/);
    if (codeMatch && codeMatch[1] && cfg.client_secret) {
      try {
        var body = new URLSearchParams({
          client_id: cfg.client_id,
          client_secret: cfg.client_secret,
          code: codeMatch[1],
          grant_type: "authorization_code",
          redirect_uri: cfg.redirect_uri
        });
        var res = await fetch("https://id.twitch.tv/oauth2/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: body.toString()
        });
        var data = await res.json();
        if (data && data.access_token) {
          await setAccessToken(data.access_token);
        }
      } catch (e) {
        // Token exchange failed
      }
      if (tabId && api.tabs && api.tabs.remove) {
        try { api.tabs.remove(tabId); } catch (e) {}
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Stream Navigation Helpers
  // ---------------------------------------------------------------------------
  async function getStreamUrl(userLogin, explicitType) {
    var type = explicitType || (await getSettingValue("openStreamIn")) || "newlayout";
    if (type === "html5") {
      return "https://player.twitch.tv/?channel=" + encodeURIComponent(userLogin) + "&parent=twitch-companion";
    }
    if (type === "theatrelayout") {
      return "https://www.twitch.tv/" + encodeURIComponent(userLogin) + "?mode=theatre";
    }
    if (type === "popout") {
      return "https://www.twitch.tv/" + encodeURIComponent(userLogin) + "/popout";
    }
    return "https://www.twitch.tv/" + encodeURIComponent(userLogin);
  }

  async function openStreamTab(userLogin, explicitType) {
    var url = await getStreamUrl(userLogin, explicitType);
    if (api.tabs && api.tabs.create) {
      api.tabs.create({ url: url });
    }
  }

  async function openChatTab(userLogin) {
    var openIn = (await getSettingValue("openChatIn")) || "newwindow";
    var url = "https://www.twitch.tv/popout/" + encodeURIComponent(userLogin) + "/chat?popout=";
    if (openIn === "newwindow" && api.windows && api.windows.create) {
      api.windows.create({ url: url, type: "popup", width: 400, height: 600 });
    } else if (api.tabs && api.tabs.create) {
      api.tabs.create({ url: url });
    }
  }

  async function openMultitwitch(userLogin) {
    if (!api.tabs || !api.tabs.query) return;
    api.tabs.query({}, function (tabs) {
      var mtTabs = (tabs || []).filter(function (t) {
        return t.url && /^https?:\/\/(www\.)?multitwitch\.tv/.test(t.url);
      });
      if (mtTabs.length > 0) {
        var last = mtTabs[mtTabs.length - 1];
        api.tabs.update(last.id, { url: last.url + "/" + userLogin });
      } else {
        api.tabs.create({ url: "https://multitwitch.tv/" + userLogin, active: false });
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Alarms Scheduling (MV3 Persistent Timers Replacement)
  // ---------------------------------------------------------------------------
  async function scheduleAlarms() {
    if (!api.alarms || !api.alarms.create) return;
    var refreshMinutes = parseInt(await getSettingValue("refreshInterval"), 10);
    if (isNaN(refreshMinutes) || refreshMinutes < 1) refreshMinutes = 5;

    api.alarms.create(ALARMS.FOLLOWING, { periodInMinutes: refreshMinutes });
    api.alarms.create(ALARMS.TOP_STREAMS, { periodInMinutes: 5 });
    api.alarms.create(ALARMS.GAMES, { periodInMinutes: 5 });
    api.alarms.create(ALARMS.CLEAR_NOTIFIED, { periodInMinutes: 10 });
  }

  // ---------------------------------------------------------------------------
  // Top-Level MV3 Event Listeners (Synchronously Registered)
  // ---------------------------------------------------------------------------
  if (api.runtime && api.runtime.onInstalled) {
    api.runtime.onInstalled.addListener(function () {
      scheduleAlarms();
      refreshTopStreams();
      refreshTopGames();
      refreshFollowingStreams();
    });
  }

  if (api.runtime && api.runtime.onStartup) {
    api.runtime.onStartup.addListener(function () {
      scheduleAlarms();
      refreshFollowingStreams();
    });
  }

  if (api.alarms && api.alarms.onAlarm) {
    api.alarms.onAlarm.addListener(function (alarm) {
      if (!alarm) return;
      if (alarm.name === ALARMS.FOLLOWING) {
        refreshFollowingStreams();
      } else if (alarm.name === ALARMS.TOP_STREAMS) {
        refreshTopStreams();
      } else if (alarm.name === ALARMS.GAMES) {
        refreshTopGames();
      } else if (alarm.name === ALARMS.CLEAR_NOTIFIED) {
        storageSet("local", { notifiedIds: [] });
      }
    });
  }

  if (api.notifications && api.notifications.onClicked) {
    api.notifications.onClicked.addListener(async function (notificationId) {
      var data = await storageGet("local", ["notificationMap"]);
      var map = data.notificationMap || {};
      var login = map[notificationId];
      if (login) {
        await openStreamTab(login);
        delete map[notificationId];
        await storageSet("local", { notificationMap: map });
      }
      if (api.notifications.clear) {
        api.notifications.clear(notificationId);
      }
    });
  }

  if (api.tabs && api.tabs.onUpdated) {
    api.tabs.onUpdated.addListener(function (tabId, changeInfo) {
      var redirectHost = getConstants().twitchApi.redirect_uri.replace(/^https?:\/\//i, "");
      if (changeInfo.url && changeInfo.url.indexOf(redirectHost) !== -1) {
        if (api.scripting && api.scripting.executeScript) {
          api.scripting.executeScript({
            target: { tabId: tabId },
            func: extractOAuthUrlInTab
          }).catch(function () {
            finalizeOAuth(changeInfo.url, tabId);
          });
        } else {
          finalizeOAuth(changeInfo.url, tabId);
        }
      }
    });
  }

  if (api.storage && api.storage.onChanged) {
    api.storage.onChanged.addListener(function (changes, area) {
      if (area === "sync" && changes.oauth2_twitch && changes.oauth2_twitch.newValue) {
        storageSet("local", { oauth2_twitch: changes.oauth2_twitch.newValue });
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Message Router (Popup <-> MV3 Background Service Worker)
  // ---------------------------------------------------------------------------
  async function handleMessage(msg, sender) {
    if (!msg || !msg.type || msg.target === "offscreen") return undefined;

    switch (msg.type) {
      case "OAUTH2_CALLBACK":
        await finalizeOAuth(msg.href, sender && sender.tab ? sender.tab.id : null);
        return { ok: true };

      case "GET_INITIAL_STATE": {
        var settings = await getSettings();
        var auth = await getAuthState();
        var cached = await storageGet("local", [
          "following",
          "followedChannels",
          "followedgames",
          "topstreams",
          "games",
          "search",
          "gameStreams"
        ]);
        var notifKey = auth.user && auth.user.login ? "notifications_" + auth.user.login : "";
        var notifStored = notifKey ? await storageGet("local", [notifKey]) : {};
        return {
          settings: settings,
          user: auth.user,
          isAuthorized: !!auth.token,
          following: cached.following || [],
          followedChannels: cached.followedChannels || [],
          followedgames: cached.followedgames || [],
          topstreams: cached.topstreams || [],
          games: cached.games || [],
          search: cached.search || [],
          gameStreams: cached.gameStreams || [],
          notifications: notifKey ? (notifStored[notifKey] || []) : [],
          contributors: getContributors(),
          browserTarget: getConstants().browserTarget || "chrome"
        };
      }

      case "SET_SETTINGS": {
        var updated = await saveSettings(msg.controls || []);
        return { ok: true, settings: updated };
      }

      case "AUTH_LOGIN": {
        if (api.tabs && api.tabs.create) {
          api.tabs.create({ url: buildOAuthUrl() });
        }
        return { ok: true };
      }

      case "AUTH_LOGOUT": {
        await setAccessToken("");
        return { ok: true };
      }

      case "UPDATE_COLLECTION": {
        if (msg.name === "following") return refreshFollowingStreams();
        if (msg.name === "topstreams") return refreshTopStreams(msg.opts);
        if (msg.name === "games") return refreshTopGames(msg.opts);
        if (msg.name === "followedChannels") return fetchFollowedChannels();
        if (msg.name === "search") return searchStreams(msg.query);
        if (msg.name === "gameStreams") return fetchGameStreams(msg.gameId, msg.disableLang);
        if (msg.name === "gameVideos") return fetchVideos({ game_id: msg.gameId, period: "week", first: 20 });
        if (msg.name === "channelVideos") return fetchVideos({ user_id: msg.channel, first: 20 });
        if (msg.name === "followedgames") return { error: "", items: [] };
        return { error: "", items: [] };
      }

      case "SAVE_NOTIFICATIONS": {
        var authState = await getAuthState();
        if (!authState.token || !authState.user || !authState.user.login) {
          return { error: "auth" };
        }
        var key = "notifications_" + authState.user.login;
        var payload = {};
        payload[key] = msg.items || [];
        await storageSet("local", payload);
        return { ok: true };
      }

      case "SET_CUSTOM_SOUND": {
        await storageSet("local", { customSound: msg.dataUrl || "" });
        return { ok: true };
      }

      case "PLAY_SOUND": {
        await playNotificationSound(msg.path, msg.volume);
        return { ok: true };
      }

      case "OPEN_STREAM": {
        await openStreamTab(msg.userLogin, msg.openType);
        return { ok: true };
      }

      case "OPEN_CHAT": {
        await openChatTab(msg.userLogin);
        return { ok: true };
      }

      case "OPEN_MULTITWITCH": {
        await openMultitwitch(msg.userLogin);
        return { ok: true };
      }

      case "TEST_NOTIFICATION": {
        await dispatchNotifications(msg.streams || [], msg.userLogin || "");
        return { ok: true };
      }

      default:
        return undefined;
    }
  }

  if (api.runtime && api.runtime.onMessage) {
    api.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
      if (!msg || msg.target === "offscreen") return false;
      handleMessage(msg, sender)
        .then(function (result) {
          if (typeof sendResponse === "function") sendResponse(result);
        })
        .catch(function (err) {
          if (typeof sendResponse === "function") sendResponse({ error: err.message || "error" });
        });
      return true;
    });
  }

  // Expose internal reference for web preview diagnostics if needed
  root.__twitchCompanionSW = {
    handleMessage: handleMessage,
    DEFAULT_SETTINGS: DEFAULT_SETTINGS
  };
})();
