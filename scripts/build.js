#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const Handlebars = require("handlebars");
const esbuild = require("esbuild");
const archiverMod = require("archiver");

const ROOT = path.resolve(__dirname, "..");
const BUILD_DIR = path.join(ROOT, "build");
const DIST_DIR = path.join(ROOT, "dist");
const COMMON_DIST_DIR = path.join(ROOT, "common", "dist");

const POPUP_CSS_FILES = [
  "common/css/reset.css",
  "common/css/bootstrap.min.css",
  "common/css/basic.css",
  "common/css/stream-view.css",
  "common/css/channel-view.css",
  "common/css/game-view.css",
  "common/css/settings-view.css",
  "common/css/menu-view.css",
  "common/css/info-view.css",
  "common/css/fontello.css",
  "common/css/white-view.css",
  "common/css/simple-view.css",
  "common/css/rtl.css",
  "common/css/baron.css"
];

const POPUP_JS_FILES = [
  "common/lib/onerror.js",
  "common/lib/utils.js",
  "node_modules/jquery/dist/jquery.min.js",
  "common/lib/3rd/jquery.visible.js",
  "common/lib/3rd/baron.js",
  "common/lib/3rd/bootstrap.js",
  "node_modules/underscore/underscore-umd-min.js",
  "node_modules/backbone/backbone-min.js",
  "node_modules/handlebars/dist/handlebars.runtime.min.js",
  "common/lib/3rd/prettydate.js",
  "common/lib/3rd/i18n.js",
  "common/dist/templates.js",
  "common/lib/handlebars-helpers.js",
  "common/lib/bg-bridge.js",
  "common/lib/popup.js",
  "common/lib/routes.js",
  "common/lib/init.js"
];

function parseArgs(argv) {
  const opts = { target: "all", zip: false, sourceZip: false };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith("--target=")) opts.target = arg.split("=")[1];
    if (arg === "--zip") opts.zip = true;
    if (arg === "--source-zip") opts.sourceZip = true;
  }
  return opts;
}

function readEnvFile() {
  const env = Object.assign({}, process.env);
  const envPath = path.join(ROOT, ".env");
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx > 0) {
        const key = trimmed.slice(0, idx).trim();
        const val = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, "");
        if (!env[key]) env[key] = val;
      }
    }
  }
  return env;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function copyDirSync(src, dest, filterFn) {
  if (!fs.existsSync(src)) return;
  ensureDir(dest);
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (filterFn && !filterFn(srcPath, entry)) continue;
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath, filterFn);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function precompileTemplates() {
  ensureDir(COMMON_DIST_DIR);
  const templatesDir = path.join(ROOT, "templates");
  const files = fs.readdirSync(templatesDir).filter((f) => f.endsWith(".html")).sort();
  const chunks = [
    "(function() {",
    "  var template = Handlebars.template, templates = Handlebars.templates = Handlebars.templates || {};"
  ];

  for (const file of files) {
    const name = path.basename(file, ".html");
    const source = fs.readFileSync(path.join(templatesDir, file), "utf8");
    const precompiled = Handlebars.precompile(source);
    chunks.push(`  templates[${JSON.stringify(name)}] = template(${precompiled});`);
  }

  chunks.push("})();");
  const outputPath = path.join(COMMON_DIST_DIR, "templates.js");
  fs.writeFileSync(outputPath, chunks.join("\n"), "utf8");
  console.log(`[build] Precompiled ${files.length} Handlebars templates -> common/dist/templates.js`);
}

async function fetchContributors() {
  ensureDir(COMMON_DIST_DIR);
  const outPath = path.join(COMMON_DIST_DIR, "contributors.js");
  const fallback = [
    {
      login: "LPauzies",
      html_url: "https://github.com/LPauzies",
      avatar_url: "https://avatars.githubusercontent.com/u/17008519?v=4&"
    },
    {
      login: "Ndragomirov",
      html_url: "https://github.com/Ndragomirov",
      avatar_url: "https://avatars.githubusercontent.com/u/2105675?v=4&"
    }
  ];

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch("https://api.github.com/repos/LPauzies/twitch-companion/contributors", {
      headers: { "User-Agent": "twitch-companion-build" },
      signal: controller.signal
    });
    clearTimeout(timer);
    if (res.ok) {
      const json = await res.json();
      if (Array.isArray(json) && json.length > 0) {
        const sanitized = json.map((c) => ({
          login: c.login,
          html_url: c.html_url,
          avatar_url: c.avatar_url
        }));
        fs.writeFileSync(outPath, `globalThis.contributorList = ${JSON.stringify(sanitized)};\n`, "utf8");
        console.log(`[build] Fetched ${sanitized.length} contributors from GitHub`);
        return;
      }
    }
  } catch (err) {
    // Offline or rate-limited — use fallback cleanly
  }

  fs.writeFileSync(outPath, `globalThis.contributorList = ${JSON.stringify(fallback)};\n`, "utf8");
  console.log("[build] Using cached fallback contributor list");
}

function buildPopupAssets() {
  ensureDir(COMMON_DIST_DIR);

  const cssCombined = POPUP_CSS_FILES
    .map((rel) => fs.readFileSync(path.join(ROOT, rel), "utf8"))
    .join("\n");
  const cssResult = esbuild.transformSync(cssCombined, { loader: "css", minify: true });
  fs.writeFileSync(path.join(COMMON_DIST_DIR, "popup.comb.css"), cssResult.code, "utf8");

  const jsCombined = POPUP_JS_FILES
    .map((rel) => {
      const content = fs.readFileSync(path.join(ROOT, rel), "utf8");
      return `/* === ${rel} === */\n${content}\n;`;
    })
    .join("\n");
  fs.writeFileSync(path.join(COMMON_DIST_DIR, "popup.comb.js"), jsCombined, "utf8");

  console.log("[build] Built common/dist/popup.comb.css and common/dist/popup.comb.js");
}

function buildTarget(target, env) {
  const targetDir = path.join(BUILD_DIR, target);
  fs.rmSync(targetDir, { recursive: true, force: true });
  ensureDir(targetDir);

  // Copy common assets (skip unused dev-only or background sources already bundled into background-sw.js)
  copyDirSync(path.join(ROOT, "common"), path.join(targetDir, "common"));
  copyDirSync(path.join(ROOT, "_locales"), path.join(targetDir, "_locales"));

  // Copy target manifest.json
  const manifestSrc = path.join(ROOT, target, "manifest.json");
  fs.copyFileSync(manifestSrc, path.join(targetDir, "manifest.json"));

  // Copy target constants.js & inject TWITCH_SECRET / TWITCH_CLIENT_ID if provided
  let constantsContent = fs.readFileSync(
    path.join(ROOT, target, "common", "lib", "constants.js"),
    "utf8"
  );
  if (env.TWITCH_SECRET) {
    constantsContent = constantsContent.replace(
      'client_secret: ""',
      `client_secret: ${JSON.stringify(env.TWITCH_SECRET)}`
    );
  }
  if (env.TWITCH_CLIENT_ID) {
    constantsContent = constantsContent.replace(
      /client_id:\s*"[^"]*"/,
      `client_id: ${JSON.stringify(env.TWITCH_CLIENT_ID)}`
    );
  }
  ensureDir(path.join(targetDir, "common", "lib"));
  fs.writeFileSync(path.join(targetDir, "common", "lib", "constants.js"), constantsContent, "utf8");

  // Bundle self-contained MV3 background-sw.js (constants + contributors + background-sw.js)
  const contributorsCode = fs.readFileSync(path.join(COMMON_DIST_DIR, "contributors.js"), "utf8");
  const swCoreCode = fs.readFileSync(path.join(ROOT, "common", "lib", "background-sw.js"), "utf8");
  const swCombined = [
    "/* Twitch Companion MV3 Background Worker (" + target + ") */",
    constantsContent,
    contributorsCode,
    swCoreCode
  ].join("\n;\n");

  const swMinified = esbuild.transformSync(swCombined, {
    loader: "js",
    target: target === "firefox" ? "firefox109" : "chrome114",
    minify: false
  });
  fs.writeFileSync(path.join(targetDir, "background-sw.js"), swMinified.code, "utf8");

  console.log(`[build] Built MV3 extension -> build/${target}/`);
}

function createZip(sourceDir, outZipPath, ignorePatterns) {
  return new Promise((resolve, reject) => {
    ensureDir(path.dirname(outZipPath));
    const output = fs.createWriteStream(outZipPath);
    const archive = typeof archiverMod.ZipArchive === "function"
      ? new archiverMod.ZipArchive({ zlib: { level: 9 } })
      : archiverMod("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      console.log(`[package] Created ${path.relative(ROOT, outZipPath)} (${archive.pointer()} bytes)`);
      resolve();
    });
    archive.on("error", reject);

    archive.pipe(output);

    if (ignorePatterns) {
      archive.glob("**/*", {
        cwd: sourceDir,
        dot: false,
        ignore: ignorePatterns
      });
    } else {
      archive.directory(sourceDir, false);
    }

    archive.finalize();
  });
}

async function main() {
  const opts = parseArgs(process.argv);
  const env = readEnvFile();
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const version = pkg.version;

  if (opts.sourceZip) {
    const srcZip = path.join(DIST_DIR, `twitch-companion-source-${version}.zip`);
    await createZip(ROOT, srcZip, [
      "node_modules/**",
      "build/**",
      "dist/**",
      ".git/**",
      ".env",
      "*.zip"
    ]);
    return;
  }

  precompileTemplates();
  await fetchContributors();
  buildPopupAssets();

  const targets = opts.target === "all" ? ["chrome", "firefox"] : [opts.target];
  for (const target of targets) {
    if (target !== "chrome" && target !== "firefox") {
      throw new Error(`Unsupported target "${target}". Supported targets: chrome, firefox, all.`);
    }
    buildTarget(target, env);
    if (opts.zip) {
      const zipPath = path.join(DIST_DIR, `twitch-companion-${target}-${version}.zip`);
      await createZip(path.join(BUILD_DIR, target), zipPath);
    }
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error("[build] Failed:", err);
    process.exit(1);
  });
}

module.exports = { main };
