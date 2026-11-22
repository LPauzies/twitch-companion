(function () {
  "use strict";

  function boot() {
    if (window.bgBridge && typeof window.bgBridge.ready === "function") {
      window.bgBridge.ready().then(function () {
        app.init();
      });
    } else {
      app.init();
    }
  }

  if (document.readyState === "complete") {
    boot();
  } else {
    window.addEventListener("load", boot);
  }
})();
