(function () {
  "use strict";

  var root = this;
  var CHROME = "chrome";
  var FIREFOX = "firefox";

  var isFirefox = typeof root.browser !== "undefined" && !!root.browser.runtime;
  var _browser = isFirefox ? root.browser : root.chrome;

  var that = {};

  var detectRealBrowser = function () {
    var ua = root.navigator && root.navigator.userAgent ? root.navigator.userAgent : "";
    if (/firefox|iceweasel/i.test(ua)) {
      return FIREFOX;
    }
    return CHROME;
  };

  that.rbrowser = detectRealBrowser();

  var _tabs = (that.tabs = {});

  _tabs.create = function (opts) {
    if (_browser && _browser.tabs && _browser.tabs.create) {
      _browser.tabs.create({ url: opts.url });
    }
  };

  _tabs.update = function (tabId, opts) {
    if (_browser && _browser.tabs && _browser.tabs.update) {
      _browser.tabs.update(tabId, opts);
    }
  };

  _tabs.query = function (opts, callback) {
    if (_browser && _browser.tabs && _browser.tabs.query) {
      _browser.tabs.query(opts, callback);
    } else if (callback) {
      callback([]);
    }
  };

  var _windows = (that.windows = {});

  _windows.create = function (opts) {
    var defaults = { url: opts.url, type: "popup" };
    if (!isFirefox) {
      defaults.focused = true;
    }
    if (_browser && _browser.windows && _browser.windows.create) {
      _browser.windows.create(defaults);
    }
  };

  var _action = (that.browserAction = that.action = {});

  _action.setBadgeText = function (opts) {
    var actionApi = _browser && (_browser.action || _browser.browserAction);
    if (actionApi && actionApi.setBadgeText) {
      actionApi.setBadgeText({ text: opts.text });
    }
  };

  _action.setBadgeBackgroundColor = function (color) {
    var actionApi = _browser && (_browser.action || _browser.browserAction);
    if (actionApi && actionApi.setBadgeBackgroundColor) {
      actionApi.setBadgeBackgroundColor(color);
    }
  };

  var _i18n = (that.i18n = {});

  _i18n.getMessage = function (id) {
    if (_browser && _browser.i18n && _browser.i18n.getMessage) {
      return _browser.i18n.getMessage(id) || "";
    }
    return id;
  };

  var _runtime = (that.runtime = {});

  _runtime.getURL = function (str) {
    if (_browser && _browser.runtime && _browser.runtime.getURL) {
      return _browser.runtime.getURL(str);
    }
    return str;
  };

  _runtime.getVersion = function () {
    if (_browser && _browser.runtime && _browser.runtime.getManifest) {
      return _browser.runtime.getManifest().version;
    }
    return "3.0.0";
  };

  _runtime.sendMessage = function (payload, callback) {
    if (_browser && _browser.runtime && _browser.runtime.sendMessage) {
      try {
        var res = _browser.runtime.sendMessage(payload, function (response) {
          if (typeof callback === "function") callback(response);
        });
        if (res && typeof res.then === "function") {
          res.then(function (response) {
            if (typeof callback === "function") callback(response);
          }).catch(function () {
            if (typeof callback === "function") callback(null);
          });
        }
      } catch (e) {
        if (typeof callback === "function") callback(null);
      }
    } else if (typeof callback === "function") {
      callback(null);
    }
  };

  _runtime.sendMessageAsync = function (payload) {
    return new Promise(function (resolve) {
      _runtime.sendMessage(payload, function (res) {
        resolve(res || {});
      });
    });
  };

  var notifications = (that.notifications = {});

  notifications.richNotificationsSupported = function () {
    return !!(_browser && _browser.notifications && _browser.notifications.create);
  };

  that._getBackgroundPage = function () {
    return root.bgBridge;
  };

  that.getConstants = function () {
    return root.constants;
  };

  root.utils = that;
}).call(this);