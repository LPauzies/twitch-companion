(function () {
  "use strict";

  window.onerror = function (msg, url, line, column, err) {
    var msgError = msg + " in " + url + " (line: " + line + ")";
    console.error(msgError);
  };
})();