var gulp = require("gulp");
var handlebars = require("gulp-handlebars");
var del = require("del");
var wrap = require("gulp-wrap");
var declare = require("gulp-declare");
var merge = require("merge-stream");
var concat = require("gulp-concat");
var zip = require("gulp-zip");
var fs = require("fs");
var request = require("request");

// Function to replace secret inside constants
let replaceSecret = (osname) => {
  // Write secret from .env to build/chrome/common/
  try {
    var secret = fs
      .readFileSync(".env")
      .toString()
      .split("\n")
      .find((keyValue) => keyValue.includes("TWITCH_SECRET"))
      .split("=")[1];
    let constants = fs
      .readFileSync("build/" + osname + "/common/lib/constants.js")
      .toString();
    constants = constants.replace(
      'client_secret: ""',
      'client_secret: "' + secret + '"'
    );
    fs.writeFileSync("build/" + osname + "/common/lib/constants.js", constants);
  } catch (err) {
    throw new Error(
      ".env is not present with good format. Please read Readme.md file."
    );
  }
};

let upgradeVersion = (kindOfUpgrade, previousVersion) => {
  let index = 0;
  switch (kindOfUpgrade) {
    case "minor":
      index = 2;
      break;
    case "medium":
      index = 1;
      break;
    case "major":
      break;
    default:
      throw new Error("kindOfUpgrade argument not correct");
  }
  let splitted = previousVersion.split(".");
  splitted[index] = `${parseInt(splitted[index]) + 1}`;
  for (let i = index + 1; i < splitted.length; i++) splitted[i] = "0";
  return splitted.join(".");
};

let upgradePackageVersion = (kindOfUpgrade) => {
  var packageContent = JSON.parse(fs.readFileSync("package.json"));
  packageContent.version = upgradeVersion(
    kindOfUpgrade,
    packageContent.version
  );
  fs.writeFileSync("package.json", JSON.stringify(packageContent, null, 4));
};

let upgradeManifestVersion = (osname, kindOfUpgrade) => {
  var manifestContent = JSON.parse(fs.readFileSync(osname + "/manifest.json"));
  manifestContent.version = upgradeVersion(
    kindOfUpgrade,
    manifestContent.version
  );
  fs.writeFileSync(
    osname + "/manifest.json",
    JSON.stringify(manifestContent, null, 4)
  );
};

// Upgrade tasks for package
gulp.task("upgrade:package:minor", function (done) {
  upgradePackageVersion("minor");
  done();
});
gulp.task("upgrade:package:medium", function (done) {
  upgradePackageVersion("medium");
  done();
});
gulp.task("upgrade:package:major", function (done) {
  upgradePackageVersion("major");
  done();
});

// Upgrade tasks for Chrome
gulp.task("upgrade:chrome:minor", function (done) {
  upgradeManifestVersion("chrome", "minor");
  done();
});
gulp.task("upgrade:chrome:medium", function (done) {
  upgradeManifestVersion("chrome", "medium");
  done();
});
gulp.task("upgrade:chrome:major", function (done) {
  upgradeManifestVersion("chrome", "major");
  done();
});

// Upgrade tasks for Firefox
gulp.task("upgrade:firefox:minor", function (done) {
  upgradeManifestVersion("firefox", "minor");
  done();
});
gulp.task("upgrade:firefox:medium", function (done) {
  upgradeManifestVersion("firefox", "medium");
  done();
});
gulp.task("upgrade:firefox:major", function (done) {
  upgradeManifestVersion("firefox", "major");
  done();
});

// Upgrade tasks for Opera
gulp.task("upgrade:opera:minor", function (done) {
  upgradeManifestVersion("opera", "minor");
  done();
});
gulp.task("upgrade:opera:medium", function (done) {
  upgradeManifestVersion("opera", "medium");
  done();
});
gulp.task("upgrade:opera:major", function (done) {
  upgradeManifestVersion("opera", "major");
  done();
});

// Upgrade tasks for all OS
gulp.task(
  "upgrade:minor",
  gulp.series(
    "upgrade:package:minor",
    "upgrade:chrome:minor",
    "upgrade:firefox:minor",
    "upgrade:opera:minor",
    function (done) {
      done();
    }
  )
);

gulp.task(
  "upgrade:medium",
  gulp.series(
    "upgrade:package:medium",
    "upgrade:chrome:medium",
    "upgrade:firefox:medium",
    "upgrade:opera:medium",
    function (done) {
      done();
    }
  )
);

gulp.task(
  "upgrade:major",
  gulp.series(
    "upgrade:package:major",
    "upgrade:chrome:major",
    "upgrade:firefox:major",
    "upgrade:opera:major",
    function (done) {
      done();
    }
  )
);

// Copy operations
gulp.task("copy:opera", function () {
  return gulp
    .src(["build/chrome/**", "opera/**"])
    .pipe(gulp.dest("build/opera/"));
});

gulp.task("copy:firefox", function () {
  return gulp
    .src(["build/chrome/**", "firefox/**"])
    .pipe(gulp.dest("build/firefox/"));
});

gulp.task("copy:chrome", function () {
  var c1 = gulp.src(["common/**"]).pipe(gulp.dest("build/chrome/common/"));

  var c2 = gulp.src(["_locales/**"]).pipe(gulp.dest("build/chrome/_locales/"));

  var c3 = gulp.src(["chrome/**"]).pipe(gulp.dest("build/chrome/"));

  return merge(c1, c2, c3);
});

// Secret replacement operations
gulp.task("secret:opera", function (done) {
  replaceSecret("opera");
  done();
});

gulp.task("secret:firefox", function (done) {
  replaceSecret("firefox");
  done();
});

gulp.task("secret:chrome", function (done) {
  replaceSecret("chrome");
  done();
});

// Code concatenation operations
gulp.task("concat:popupjs", function () {
  return gulp
    .src([
      "common/lib/onerror.js",
      "common/lib/utils.js",
      "common/lib/3rd/jquery.js",
      "common/lib/3rd/jquery.visible.js",
      "common/lib/3rd/baron.js",
      "common/lib/3rd/bootstrap.js",
      "common/lib/3rd/underscore.js",
      "common/lib/3rd/backbone.js",
      "common/lib/3rd/handlebars.js",
      "common/lib/3rd/prettydate.js",
      "common/lib/3rd/i18n.js",
      "common/dist/templates.js",
      "common/lib/handlebars-helpers.js",
      "common/lib/popup.js",
      "common/lib/routes.js",
      "common/lib/init.js",
    ])
    .pipe(concat("popup.comb.js"))
    .pipe(gulp.dest("common/dist/"));
});

gulp.task("concat:popupcss", function () {
  return gulp
    .src([
      "common/css/reset.css",
      "common/css/bootstrap.min.css",
      "common/css/basic.css",
      "common/css/simple-view.css",
      "common/css/white-view.css",
      "common/css/stream-view.css",
      "common/css/channel-view.css",
      "common/css/game-view.css",
      "common/css/settings-view.css",
      "common/css/menu-view.css",
      "common/css/info-view.css",
      "common/css/fontello.css",
      "common/css/rtl.css",
      "common/css/baron.css",
    ])
    .pipe(concat("popup.comb.css"))
    .pipe(gulp.dest("common/dist/"));
});

// Clean operations
gulp.task("clean:dist", function (done) {
  del.sync(["dist/*"]);
  done();
});

gulp.task("clean:opera", function (done) {
  del.sync(["build/opera/*"]);
  done();
});

gulp.task("clean:chrome", function (done) {
  del.sync(["build/chrome/*"]);
  done();
});

gulp.task("clean:firefox", function (done) {
  del.sync(["build/firefox/*"]);
  done();
});

// Compression tasks for distribution
gulp.task("compress:chrome", function () {
  var v = JSON.parse(fs.readFileSync("package.json")).version;

  return gulp
    .src("build/chrome/**")
    .pipe(zip("twitch-companion-chrome-" + v + ".zip"))
    .pipe(gulp.dest("dist/"));
});

gulp.task("compress:opera", function () {
  var v = JSON.parse(fs.readFileSync("package.json")).version;

  return gulp
    .src("build/opera/**")
    .pipe(zip("twitch-companion-opera-" + v + ".zip"))
    .pipe(gulp.dest("dist/"));
});

gulp.task("compress:firefox", function () {
  var v = JSON.parse(fs.readFileSync("package.json")).version;

  return gulp
    .src("build/firefox/**")
    .pipe(zip("twitch-companion-firefox-" + v + ".zip"))
    .pipe(gulp.dest("dist/"));
});

// Task to manage handlebars templates
gulp.task("handlebars", function () {
  return gulp
    .src("templates/*.html")
    .pipe(handlebars())
    .pipe(wrap("Handlebars.template(<%= contents %>)"))
    .pipe(
      declare({
        namespace: "Handlebars.templates",
        noRedeclare: true, // Avoid duplicate declarations
      })
    )
    .pipe(concat("templates.js"))
    .pipe(gulp.dest("common/dist/"));
});

// Task to fetch contributors
gulp.task("contributors", function (cb) {
  request(
    {
      method: "GET",
      url: "https://api.github.com/repos/lpauzies/twitch-companion/contributors",
      headers: {
        "User-Agent": "whatever",
      },
    },
    function (err, res, body) {
      if (err || !body) {
        return cb(err || new Error("No body"));
      }
      fs.writeFile(
        "common/dist/contributors.js",
        "var contributorList = " + body + ";",
        cb
      );
    }
  );
});

// Gulp main task for build
gulp.task(
  "chrome",
  gulp.series(
    "clean:chrome",
    "handlebars",
    "contributors",
    "concat:popupcss",
    "concat:popupjs",
    "copy:chrome",
    "secret:chrome",
    function (done) {
      done();
    }
  )
);

gulp.task(
  "opera",
  gulp.series(
    "chrome",
    "clean:opera",
    "copy:opera",
    "secret:opera",
    function (done) {
      done();
    }
  )
);

gulp.task(
  "firefox",
  gulp.series(
    "chrome",
    "clean:firefox",
    "copy:firefox",
    "secret:firefox",
    function (done) {
      done();
    }
  )
);
