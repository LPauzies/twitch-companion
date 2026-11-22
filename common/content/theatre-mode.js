(function () {
  "use strict";

  var theatreBtnSelector = '[data-a-target="player-theatre-mode-button"]';
  var MAX_TRIES = 400;

  function waitUntilVisible(selector, callback) {
    var tries = 0;
    var tm = setInterval(function () {
      var el = document.querySelector(selector);
      if (++tries > MAX_TRIES) {
        clearInterval(tm);
        callback("timeout error");
        return;
      }

      if (el && el.offsetHeight > 0) {
        clearInterval(tm);
        callback();
      }
    }, 50);
  }

  function turnOn() {
    var turnOnBtn = document.querySelector(theatreBtnSelector);
    if (turnOnBtn) {
      turnOnBtn.click();
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    var query = window.location.search || "";
    var ref = document.referrer || "";
    if (/mode=theatre/i.test(ref) || /mode=theatre/i.test(query)) {
      waitUntilVisible(theatreBtnSelector, function (err) {
        if (!err) {
          turnOn();
        }
      });
    }
  });
})();