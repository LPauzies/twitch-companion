(function () {
  "use strict";

  var uploadButton = document.querySelector("#uploadSound");
  var toggleButton = document.querySelector("#toggleSound");
  var playIcon = document.querySelector(".icon-play2");
  var pauseIcon = document.querySelector(".icon-pause2");
  var output = document.querySelector("#output");
  var audio = new Audio();
  var api = typeof browser !== "undefined" && browser.runtime ? browser : (typeof chrome !== "undefined" ? chrome : null);

  var readFile = function (opts, cb) {
    var file = opts.file;
    var maxSize = opts.maxSize;
    var fileReader = new FileReader();

    if (maxSize && file.size / 1024 > maxSize) {
      return cb("Max file size is " + maxSize + " kb");
    }

    fileReader.onloadend = function () {
      return cb(null, this.result);
    };

    fileReader.onabort = fileReader.onerror = function () {
      cb("An error occurred while reading the file!");
    };

    fileReader.readAsDataURL(file);
  };

  function showPauseButton() {
    pauseIcon.style.display = "block";
    playIcon.style.display = "none";
  }

  function showPlayButton() {
    pauseIcon.style.display = "none";
    playIcon.style.display = "block";
  }

  function persistCustomSound(dataUrl) {
    if (api && api.runtime && api.runtime.sendMessage) {
      api.runtime.sendMessage({ type: "SET_CUSTOM_SOUND", dataUrl: dataUrl });
    }
    try {
      localStorage["customSound"] = dataUrl;
    } catch (e) {
      // Ignore storage error
    }
  }

  toggleButton.addEventListener("click", function () {
    if (audio.src) {
      if (audio.paused) {
        audio.play().catch(function () {});
      } else {
        audio.pause();
      }
    }
  });

  audio.addEventListener("play", showPauseButton);
  audio.addEventListener("pause", showPlayButton);
  audio.addEventListener("ended", showPlayButton);

  uploadButton.addEventListener("change", function () {
    var file = this.files[0];
    if (file) {
      readFile({ file: file, maxSize: 200 }, function (err, res) {
        output.textContent = err ? err : "Sound uploaded and saved";
        if (!err) {
          audio.src = res;
          audio.play().catch(function () {});
          persistCustomSound(res);
        }
      });
    }
  });

  showPlayButton();
})();