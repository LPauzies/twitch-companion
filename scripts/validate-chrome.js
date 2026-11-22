#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const CHROME_BUILD = path.join(ROOT, "build", "chrome");

function runChromeAudit() {
  const errors = [];
  const warnings = [];
  const checks = [];

  function check(name, pass, detail, isWarning) {
    checks.push({ name, pass, detail, severity: isWarning ? "warning" : "error" });
    if (!pass) {
      if (isWarning) warnings.push(`${name}: ${detail}`);
      else errors.push(`${name}: ${detail}`);
    }
  }

  const manifestPath = path.join(CHROME_BUILD, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    return {
      ok: false,
      errors: ["build/chrome/manifest.json not found. Run `npm run build:chrome` first."],
      warnings: [],
      checks: []
    };
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

  check("Manifest V3 version", manifest.manifest_version === 3, `manifest_version is ${manifest.manifest_version}`);
  check("Service worker configured", !!(manifest.background && manifest.background.service_worker), "background.service_worker must be set");
  check("No MV2 background.scripts", !(manifest.background && manifest.background.scripts), "background.scripts is not allowed in Chrome MV3");
  check("Action API (no browser_action)", !!manifest.action && !manifest.browser_action, "Must use action instead of browser_action");
  check("No deprecated background permission", !(manifest.permissions || []).includes("background"), "background permission removed in MV3");
  check("No wildcard <all_urls> host permissions", !(manifest.host_permissions || []).some((h) => h === "<all_urls>" || h === "*://*/*" || h === "http://*/*" || h === "https://*/*"), "Keep host_permissions scoped to Twitch domains");
  check("Strict MV3 CSP", !!(manifest.content_security_policy && manifest.content_security_policy.extension_pages && !manifest.content_security_policy.extension_pages.includes("unsafe-eval")), "CSP must not allow unsafe-eval");

  // Verify service worker file exists and has no banned MV2 APIs
  const swPath = path.join(CHROME_BUILD, manifest.background.service_worker || "");
  const swExists = fs.existsSync(swPath);
  check("Service worker file exists", swExists, manifest.background.service_worker);
  if (swExists) {
    const swCode = fs.readFileSync(swPath, "utf8");
    check("No XMLHttpRequest in Service Worker", !/\bXMLHttpRequest\b/.test(swCode), "Service workers must use fetch()");
    check("No tabs.executeScript in Service Worker", !/tabs\.executeScript/.test(swCode), "Use chrome.scripting.executeScript in MV3");
    check("No localStorage in Service Worker", !/\blocalStorage\b/.test(swCode), "Use chrome.storage API in MV3");
    check("No eval / new Function in Service Worker", !/\beval\s*\(|new Function\s*\(/.test(swCode), "Dynamic code execution forbidden in MV3");
  }

  // Verify popup HTML has no remote scripts or stylesheets
  const popupPath = path.join(CHROME_BUILD, manifest.action.default_popup || "");
  const popupExists = fs.existsSync(popupPath);
  check("Popup HTML exists", popupExists, manifest.action.default_popup);
  if (popupExists) {
    const popupHtml = fs.readFileSync(popupPath, "utf8");
    check("No remote CDN scripts/styles in popup", !/<(script|link)[^>]+https?:\/\//i.test(popupHtml), "Remote scripts/CSS violate Chrome Web Store MV3 policy");
    check("No inline script tags in popup", !/<script(?![^>]*\bsrc=)[^>]*>/i.test(popupHtml), "Inline scripts violate MV3 CSP");
  }

  // Verify icons exist
  const icons = manifest.icons || {};
  const missingIcons = Object.values(icons).filter((iconRel) => !fs.existsSync(path.join(CHROME_BUILD, iconRel)));
  check("All manifest icons present", missingIcons.length === 0, missingIcons.join(", ") || "OK");

  // Verify offscreen audio document exists
  check("Offscreen audio document present", fs.existsSync(path.join(CHROME_BUILD, "common/html/offscreen.html")), "common/html/offscreen.html");

  return { ok: errors.length === 0, errors, warnings, checks };
}

if (require.main === module) {
  const result = runChromeAudit();
  for (const c of result.checks) {
    console.log(`${c.pass ? "[PASS]" : "[FAIL]"} ${c.name}${c.pass ? "" : " — " + c.detail}`);
  }
  if (!result.ok) {
    console.error(`\nChrome MV3 validation failed with ${result.errors.length} error(s).`);
    process.exit(1);
  }
  console.log(`\nChrome MV3 validation passed (${result.checks.length}/${result.checks.length} checks).`);
}

module.exports = { runChromeAudit };
