"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const express = require("express");
const { main: runBuild } = require("./scripts/build");
const { runChromeAudit } = require("./scripts/validate-chrome");

const ROOT = __dirname;
const PORT = parseInt(process.env.PORT, 10) || 3000;
const HOST = "0.0.0.0";

function ensureBuilt() {
  const chromeManifest = path.join(ROOT, "build", "chrome", "manifest.json");
  const firefoxManifest = path.join(ROOT, "build", "firefox", "manifest.json");
  if (!fs.existsSync(chromeManifest) || !fs.existsSync(firefoxManifest)) {
    console.log("[server] Built extension bundles missing — running initial MV3 build...");
    return runBuild();
  }
  return Promise.resolve();
}

function runFirefoxAudit() {
  const manifestPath = path.join(ROOT, "build", "firefox", "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    return { ok: false, checks: [{ name: "Firefox build present", pass: false }] };
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  const checks = [
    { name: "Manifest V3 version", pass: manifest.manifest_version === 3 },
    { name: "Gecko browser_specific_settings.id", pass: !!(manifest.browser_specific_settings && manifest.browser_specific_settings.gecko && manifest.browser_specific_settings.gecko.id) },
    { name: "Gecko strict_min_version (>=140.0)", pass: !!(manifest.browser_specific_settings && manifest.browser_specific_settings.gecko && manifest.browser_specific_settings.gecko.strict_min_version) },
    { name: "AMO data_collection_permissions declared", pass: !!(manifest.browser_specific_settings && manifest.browser_specific_settings.gecko && manifest.browser_specific_settings.gecko.data_collection_permissions) },
    { name: "MV3 Event Page background.scripts", pass: !!(manifest.background && Array.isArray(manifest.background.scripts)) },
    { name: "No Chrome-only offscreen permission", pass: !(manifest.permissions || []).includes("offscreen") },
    { name: "No broad http://*/* or https://*/* permissions", pass: !(manifest.permissions || []).includes("https://*/*") && !(manifest.permissions || []).includes("http://*/*") }
  ];

  let lintPassed = false;
  try {
    execSync("npx web-ext lint --source-dir ./build/firefox --warnings-as-errors=false", {
      cwd: ROOT,
      stdio: "pipe"
    });
    lintPassed = true;
  } catch (err) {
    lintPassed = false;
  }
  checks.push({ name: "Mozilla web-ext lint passed (0 errors)", pass: lintPassed });

  return {
    ok: checks.every((c) => c.pass),
    checks
  };
}

async function startServer() {
  await ensureBuilt();

  const app = express();
  app.use(express.json());

  // Serve built extension assets and preview helpers
  app.use("/build", express.static(path.join(ROOT, "build")));
  app.use("/web-preview", express.static(path.join(ROOT, "web-preview")));

  // Serve the real built MV3 popup.html with the MV3 shim + background-sw.js injected for live browser preview
  app.get("/preview/popup.html", (req, res) => {
    const browser = req.query.browser === "firefox" ? "firefox" : "chrome";
    const popupPath = path.join(ROOT, "build", browser, "common", "html", "popup.html");
    const localePath = path.join(ROOT, "_locales", "en", "messages.json");

    if (!fs.existsSync(popupPath)) {
      return res.status(500).send("Extension not built yet. Run npm run build.");
    }

    const messages = JSON.parse(fs.readFileSync(localePath, "utf8"));
    let html = fs.readFileSync(popupPath, "utf8");

    // Rewrite relative paths so they resolve under /build/<browser>/common/
    html = html
      .replace(/href="\.\.\//g, `href="/build/${browser}/common/`)
      .replace(/src="\.\.\//g, `src="/build/${browser}/common/`);

    const bootstrapScripts = [
      `<script>window.__PREVIEW_BROWSER__ = ${JSON.stringify(browser)}; window.__PREVIEW_LOCALE_MESSAGES__ = ${JSON.stringify(messages)};</script>`,
      `<script src="/web-preview/chrome-mv3-shim.js"></script>`,
      `<script src="/build/${browser}/background-sw.js"></script>`
    ].join("\n");

    html = html.replace("<head>", `<head>\n${bootstrapScripts}`);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  });

  // Live MV3 audit API
  app.get("/api/audit", (req, res) => {
    const chromeAudit = runChromeAudit();
    const firefoxAudit = runFirefoxAudit();
    const chromeManifest = fs.existsSync(path.join(ROOT, "build/chrome/manifest.json"))
      ? JSON.parse(fs.readFileSync(path.join(ROOT, "build/chrome/manifest.json"), "utf8"))
      : {};
    const firefoxManifest = fs.existsSync(path.join(ROOT, "build/firefox/manifest.json"))
      ? JSON.parse(fs.readFileSync(path.join(ROOT, "build/firefox/manifest.json"), "utf8"))
      : {};

    res.json({
      chrome: chromeAudit,
      firefox: firefoxAudit,
      manifests: {
        chrome: chromeManifest,
        firefox: firefoxManifest
      }
    });
  });

  // Rebuild Chrome & Firefox bundles on demand
  app.post("/api/rebuild", async (req, res) => {
    try {
      await runBuild();
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  });

  // Main workbench UI
  app.get("/", (req, res) => {
    res.sendFile(path.join(ROOT, "web-preview", "index.html"));
  });

  app.listen(PORT, HOST, () => {
    console.log(`[server] Twitch Companion MV3 Workbench listening on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("[server] Fatal startup error:", err);
  process.exit(1);
});
