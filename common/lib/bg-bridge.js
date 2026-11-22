/*
 * Twitch Companion — MV3 Popup-to-Background Bridge
 * Replaces MV2 chrome.extension.getBackgroundPage() with message passing
 * + chrome.storage synchronization while preserving the Backbone view contract.
 */
(function (w) {
  "use strict";

  var bridge = (w.bgBridge = {});
  var _isAuthorized = false;

  var send = function (payload) {
    return utils.runtime.sendMessageAsync(payload);
  };

  // Dispatcher & helper facade expected by popup.js
  bridge.bgApp = {
    dispatcher: _.clone(Backbone.Events),
    playSound: function (path, volume) {
      send({ type: "PLAY_SOUND", path: path, volume: volume });
    }
  };

  // Auth facade expected by popup.js
  bridge.twitchApi = _.extend(
    {
      isAuthorized: function () {
        return _isAuthorized;
      },
      setAuthorized: function (val) {
        var prev = _isAuthorized;
        _isAuthorized = !!val;
        if (_isAuthorized && !prev) {
          this.trigger("authorize");
        } else if (!_isAuthorized && prev) {
          this.trigger("revoke");
        }
      }
    },
    Backbone.Events
  );

  // User Model
  var UserModel = Backbone.Model.extend({
    defaults: {
      authenticated: false,
      name: "",
      logo: utils.runtime.getURL("common/icons/user_default.png")
    },
    login: function () {
      send({ type: "AUTH_LOGIN" });
    },
    logout: function () {
      var self = this;
      send({ type: "AUTH_LOGOUT" }).then(function () {
        self.set({ authenticated: false, name: "" });
        bridge.twitchApi.setAuthorized(false);
        bridge.following.reset();
        bridge.followedChannels.reset();
      });
    }
  });

  // Settings Collection
  var SettingsCollection = Backbone.Collection.extend({
    model: Backbone.Model,
    initialize: function () {
      this.on("change", this.persist.bind(this));
    },
    getNotificationSoundSource: function () {
      var ctrl = this.get("notificationSound");
      var val = ctrl ? ctrl.get("value") : "common/audio/ding.ogg";
      return val === "customsound" ? undefined : val;
    },
    persist: function () {
      var controls = this.map(function (m) {
        return { id: m.get("id"), value: m.get("value") };
      });
      send({ type: "SET_SETTINGS", controls: controls });
    }
  });

  // Stream Model
  var StreamModel = Backbone.Model.extend({
    idAttribute: "_id",
    openStream: function (type) {
      send({ type: "OPEN_STREAM", userLogin: this.get("user_login"), openType: type });
    },
    openChat: function () {
      send({ type: "OPEN_CHAT", userLogin: this.get("user_login") });
    },
    openMultitwitch: function () {
      send({ type: "OPEN_MULTITWITCH", userLogin: this.get("user_login") });
    },
    follow: function (cb) {
      if (cb) cb();
    },
    unfollow: function (cb) {
      if (cb) cb();
    }
  });

  // Stream Collection (backed by SW message calls)
  var StreamCollection = Backbone.Collection.extend({
    model: StreamModel,
    collectionName: "topstreams",
    pagination: false,
    cursor: "",
    updating: false,
    initialize: function () {
      this.listenTo(bridge.settings, "change:value", function (m) {
        if (m.get("id") === "viewSort") {
          this.setComparator();
        }
      });
    },
    setComparator: function () {
      var sortModel = bridge.settings.get("viewSort");
      var curSort = (sortModel ? sortModel.get("value") : "viewer_count|-1").split("|");
      var prop = curSort[0];
      var reverse = parseInt(curSort[1], 10) || -1;
      this.comparator = function (a, b) {
        var va = a.get(prop);
        var vb = b.get(prop);
        return va > vb ? 1 * reverse : va < vb ? -1 * reverse : 0;
      };
      this.sort();
    },
    update: function (opts) {
      var self = this;
      if (self.updating) return;
      self.updating = true;
      self.trigger("update-status", true, { reset: !(opts && opts.append) });

      var payload = {
        type: "UPDATE_COLLECTION",
        name: self.collectionName,
        opts: opts || {}
      };
      if (self.query !== undefined) payload.query = self.query;
      if (self.gameid !== undefined) payload.gameId = self.gameid;
      if (self.langFilter === false) payload.disableLang = true;

      send(payload).then(function (res) {
        self.updating = false;
        self.trigger("update-status", false, { reset: !(opts && opts.append) });
        if (res && res.error) {
          self.trigger("_error", res.error);
          return;
        }
        self.cursor = (res && res.cursor) || "";
        var items = (res && res.items) || [];
        if (opts && opts.append) {
          var added = self.add(items, { silent: true });
          self.trigger("addarray", added);
        } else {
          self.reset(items, { silent: true });
          self.setComparator();
          self.trigger("update");
        }
      });
    },
    loadNext: function () {
      if (this.pagination && this.cursor && !this.updating) {
        this.update({ append: true, after: this.cursor });
      }
    }
  });

  var FollowingCollection = StreamCollection.extend({
    collectionName: "following",
    pagination: false
  });

  var TopStreamsCollection = StreamCollection.extend({
    collectionName: "topstreams",
    pagination: true
  });

  var SearchCollection = StreamCollection.extend({
    collectionName: "search",
    query: "",
    pagination: false
  });

  var GameStreamsCollection = StreamCollection.extend({
    collectionName: "gameStreams",
    gameid: null,
    langFilter: true,
    pagination: false,
    disableLanguageFilter: function () {
      this.langFilter = false;
    },
    enableLanguageFilter: function () {
      this.langFilter = true;
    }
  });

  // Games Collection
  var GameModel = Backbone.Model.extend({
    idAttribute: "_id",
    follow: function (cb) { if (cb) cb(); },
    unfollow: function (cb) { if (cb) cb(); }
  });

  var GamesCollection = Backbone.Collection.extend({
    model: GameModel,
    collectionName: "games",
    pagination: true,
    cursor: "",
    updating: false,
    findByName: function (name) {
      return this.find(function (g) { return g.get("name") === name; });
    },
    update: function (opts) {
      var self = this;
      if (self.updating) return;
      self.updating = true;
      self.trigger("update-status", true, { reset: !(opts && opts.append) });

      send({ type: "UPDATE_COLLECTION", name: self.collectionName, opts: opts || {} }).then(function (res) {
        self.updating = false;
        self.trigger("update-status", false, { reset: !(opts && opts.append) });
        if (res && res.error) {
          self.trigger("_error", res.error);
          return;
        }
        self.cursor = (res && res.cursor) || "";
        var items = (res && res.items) || [];
        if (opts && opts.append) {
          var added = self.add(items, { silent: true });
          self.trigger("addarray", added);
        } else {
          self.reset(items, { silent: true });
          self.trigger("update");
        }
      });
    },
    loadNext: function () {
      if (this.pagination && this.cursor && !this.updating) {
        this.update({ append: true, after: this.cursor });
      }
    }
  });

  // Game Lobby Model
  var GameLobbyModel = GameModel.extend({
    change: function (gameName) {
      var decoded = decodeURIComponent(gameName || "");
      var found = bridge.games.findByName(decoded) || bridge.followedgames.findByName(decoded);
      if (found) {
        this.set(found.toJSON());
        bridge.gameStreams.gameid = found.get("id");
        bridge.gameStreams.update();
        bridge.gameVideos.gameid = found.get("id");
        bridge.gameVideos.update();
      }
    }
  });

  // Videos Collection
  var VideosCollection = Backbone.Collection.extend({
    model: Backbone.Model.extend({ idAttribute: "_id" }),
    collectionName: "channelVideos",
    channel: null,
    gameid: null,
    update: function () {
      var self = this;
      self.trigger("update-status", true, { reset: true });
      send({
        type: "UPDATE_COLLECTION",
        name: self.collectionName,
        channel: self.channel,
        gameId: self.gameid
      }).then(function (res) {
        self.trigger("update-status", false, { reset: true });
        if (res && res.error) {
          self.trigger("_error", res.error);
          return;
        }
        self.reset((res && res.items) || [], { silent: true });
        self.trigger("update");
      });
    }
  });

  // Followed Channels Collection
  var FollowedChannelModel = Backbone.Model.extend({
    idAttribute: "_id",
    openChannelPage: function () {
      utils.tabs.create({ url: "https://www.twitch.tv/" + this.get("to_login") });
    }
  });

  var FollowedChannelsCollection = Backbone.Collection.extend({
    model: FollowedChannelModel,
    comparator: function (a) { return a.get("to_login") || ""; },
    update: function () {
      var self = this;
      send({ type: "UPDATE_COLLECTION", name: "followedChannels" }).then(function (res) {
        if (res && res.error) {
          self.trigger("_error", res.error);
          return;
        }
        self.reset((res && res.items) || [], { silent: true });
        self.trigger("update");
      });
    }
  });

  // Per-channel Notifications Collection
  var ChannelNotificationModel = Backbone.Model.extend({
    idAttribute: "_id",
    defaults: {
      notificationOpts: { desktop: true, sound: true }
    },
    openProfilePage: function () {
      utils.tabs.create({ url: "https://www.twitch.tv/" + this.get("to_login") + "/about" });
    }
  });

  var NotificationSettingsCollection = Backbone.Collection.extend({
    model: ChannelNotificationModel,
    _snapshot: null,
    comparator: function (a) { return a.get("to_login") || ""; },
    store: function () {
      this._snapshot = this.toJSON();
    },
    restore: function () {
      if (this._snapshot) {
        this.reset(this._snapshot);
        this.saveToStorage();
      }
    },
    saveToStorage: function () {
      var val = this.map(function (v) {
        return {
          _id: v.get("_id"),
          notificationOpts: v.get("notificationOpts")
        };
      });
      send({ type: "SAVE_NOTIFICATIONS", items: val });
    },
    update: function () {
      var self = this;
      send({ type: "UPDATE_COLLECTION", name: "followedChannels" }).then(function (res) {
        if (res && res.error) {
          self.trigger("_error", res.error);
          return;
        }
        var invert = bridge.settings.get("invertNotification");
        var defVal = invert ? !!invert.get("value") : true;
        var items = ((res && res.items) || []).map(function (c) {
          return _.extend({}, c, {
            notificationOpts: { desktop: defVal, sound: defVal }
          });
        });
        self.reset(items, { silent: true });
        self.trigger("update");
      });
    }
  });

  // Instantiate collections on bridge
  bridge.settings = new SettingsCollection();
  bridge.user = new UserModel();
  bridge.following = new FollowingCollection();
  bridge.followedgames = new GamesCollection();
  bridge.followedgames.collectionName = "followedgames";
  bridge.followedgames.pagination = false;
  bridge.topstreams = new TopStreamsCollection();
  bridge.games = new GamesCollection();
  bridge.search = new SearchCollection();
  bridge.gameLobby = new GameLobbyModel();
  bridge.gameStreams = new GameStreamsCollection();
  bridge.gameVideos = new VideosCollection();
  bridge.gameVideos.collectionName = "gameVideos";
  bridge.videos = new VideosCollection();
  bridge.followedChannels = new FollowedChannelsCollection();
  bridge.notifications = new NotificationSettingsCollection();
  bridge.contributors = new Backbone.Collection();

  // Hydrate initial state from MV3 background worker
  bridge.ready = function () {
    return send({ type: "GET_INITIAL_STATE" }).then(function (state) {
      state = state || {};
      if (Array.isArray(state.settings) && state.settings.length) {
        bridge.settings.reset(state.settings, { silent: true });
      }
      if (state.user) {
        bridge.user.set(state.user, { silent: true });
      }
      _isAuthorized = !!state.isAuthorized;
      if (Array.isArray(state.following)) {
        bridge.following.reset(state.following, { silent: true });
        bridge.following.setComparator();
      }
      if (Array.isArray(state.followedChannels)) {
        bridge.followedChannels.reset(state.followedChannels, { silent: true });
      }
      if (Array.isArray(state.followedgames)) {
        bridge.followedgames.reset(state.followedgames, { silent: true });
      }
      if (Array.isArray(state.topstreams)) {
        bridge.topstreams.reset(state.topstreams, { silent: true });
        bridge.topstreams.setComparator();
      }
      if (Array.isArray(state.games)) {
        bridge.games.reset(state.games, { silent: true });
      }
      if (Array.isArray(state.contributors)) {
        bridge.contributors.reset(state.contributors, { silent: true });
      }
      return state;
    });
  };

  // Listen for live storage updates while popup is open
  var extApi = typeof browser !== "undefined" && browser.storage ? browser : (typeof chrome !== "undefined" ? chrome : null);
  if (extApi && extApi.storage && extApi.storage.onChanged) {
    extApi.storage.onChanged.addListener(function (changes, area) {
      if (area !== "local") return;
      if (changes.user && changes.user.newValue) {
        bridge.user.set(changes.user.newValue);
        bridge.twitchApi.setAuthorized(!!changes.user.newValue.authenticated);
      }
      if (changes.following && Array.isArray(changes.following.newValue)) {
        bridge.following.reset(changes.following.newValue, { silent: true });
        bridge.following.setComparator();
        bridge.following.trigger("update");
      }
      if (changes.topstreams && Array.isArray(changes.topstreams.newValue)) {
        bridge.topstreams.reset(changes.topstreams.newValue, { silent: true });
        bridge.topstreams.setComparator();
        bridge.topstreams.trigger("update");
      }
      if (changes.games && Array.isArray(changes.games.newValue)) {
        bridge.games.reset(changes.games.newValue, { silent: true });
        bridge.games.trigger("update");
      }
    });
  }
})(window);
