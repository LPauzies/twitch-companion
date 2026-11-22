(function () {
  "use strict";

  var api = typeof browser !== "undefined" && browser.runtime ? browser : chrome;
  var audio = new Audio();

  if (api && api.runtime && api.runtime.onMessage) {
    api.runtime.onMessage.addListener(function (msg) {
      if (!msg || msg.target !== "offscreen") return;

      if (msg.type === "PLAY_SOUND" && msg.path) {
        audio.pause();
        audio.src = msg.path;
        audio.volume = typeof msg.volume === "number" ? Math.max(0, Math.min(1, msg.volume)) : 1;
        audio.loop = !!msg.loop;
        audio.play().catch(function () {});
      } else if (msg.type === "STOP_SOUND") {
        audio.pause();
      }
    });
  }
})();
