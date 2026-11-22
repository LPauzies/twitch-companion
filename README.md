# Twitch Companion (v3.0.0 — Manifest V3)

<p align="center">
  <img src="common/icons/64.png" alt="Twitch Companion Logo" />
</p>

Twitch Companion is a browser extension for **Google Chrome** and **Mozilla Firefox** that lets you track followed Twitch streamers, browse top games and live channels, search streams, and receive customizable desktop & audio notifications when favorite channels go live.

---

## Software Audit & Migration Findings

During the audit of the original v2.2.2 codebase, the following compliance blockers, deprecated APIs, security vulnerabilities, and maintenance issues were identified and resolved:

### 1. Chrome & Firefox Manifest V3 Compliance Gaps (Fixed)
| Finding | Impact in Original Code | Resolution in v3.0.0 |
|---|---|---|
| **Manifest V2 deprecated** | Chrome Web Store no longer accepts MV2 extensions; Firefox recommends MV3 with explicit Gecko metadata. | Migrated both `chrome/manifest.json` and `firefox/manifest.json` to **`manifest_version: 3`**. |
| **Persistent Background Page (`persistent: true`)** | Chrome MV3 requires an ephemeral **Service Worker** (`background.service_worker`), which has no `window`, `document`, `localStorage`, `XMLHttpRequest`, or `Audio`. | Built a pure modern ES2022 `common/lib/background-sw.js` running as a Service Worker on Chrome and an MV3 Event Page (`background.scripts`) on Firefox. |
| **`chrome.extension.getBackgroundPage()` removed in MV3** | `common/lib/popup.js` directly accessed background Backbone collections via `getBackgroundPage()`, causing instant crashes in MV3. | Replaced with `common/lib/bg-bridge.js`, synchronizing popup Backbone models/collections with `background-sw.js` via `chrome.runtime.sendMessage` & `chrome.storage.onChanged`. |
| **`localStorage` in background** | Unavailable in MV3 Service Workers. | Migrated all settings, OAuth tokens, notification preferences, custom audio data, and cached streams to `chrome.storage.local` + `chrome.storage.sync`. |
| **`setInterval` / `setTimeout` polling** | Service Workers terminate after ~30s of idle time, killing background stream polling. | Replaced background timers with **`chrome.alarms`** (`tc_refresh_following`, `tc_refresh_topstreams`, `tc_refresh_games`, `tc_clear_notified`) registered synchronously at top-level. |
| **`chrome.tabs.executeScript({ code })` removed & banned** | MV3 strictly forbids string-based code injection (`code: ...`) and removed `tabs.executeScript`. | Replaced OAuth callback extraction with **`chrome.scripting.executeScript({ target: { tabId }, func })`**. |
| **`new Audio()` unavailable in Chrome Service Workers** | Notification sound playback failed in MV3 service workers. | Added Chrome MV3 **Offscreen Document** (`common/html/offscreen.html` + `common/lib/offscreen.js`, reason `AUDIO_PLAYBACK`) with native `Audio` fallback for Firefox Event Pages. |
| **Remote CDN & dead scripts in `popup.html`** | Loaded FontAwesome from `cdnjs.cloudflare.com`, a missing `../lib/paypal.js`, and a remote PayPal image — violating MV3 strict CSP and store policies. | Removed all remote scripts/styles/images; replaced social icons with inline SVGs and enforced `content_security_policy.extension_pages: "script-src 'self'; object-src 'self'"`. |
| **Overly broad permissions** | Firefox manifest requested `"http://*/*"` and `"https://*/*"`; Chrome requested deprecated `"background"`; Firefox also had an invalid `"minimum_chrome_version"` field. | Scoped `host_permissions` strictly to Twitch & OAuth redirect domains (`https://api.twitch.tv/*`, `https://id.twitch.tv/*`, `https://*.twitch.tv/*`, `https://static-cdn.jtvnw.net/*`, `https://ndragomirov.github.io/*`). |
| **Firefox AMO `browser_specific_settings.gecko` missing** | Required by Mozilla Add-ons for MV3 extensions, including new mandatory **`data_collection_permissions`**. | Added `browser_specific_settings.gecko` with explicit `id`, `strict_min_version: "140.0"` (and `gecko_android: "142.0"`), and `data_collection_permissions: { required: ["none"] }`. |
| **`browser_action` deprecated** | Replaced by `action` in MV3. | Migrated manifests to `action` and updated `utils.js` & `background-sw.js` to use `chrome.action`. |

### 2. Twitch API Issues Found & Fixed
- **Deprecated Kraken v5 header**: `common/lib/twitch-api.js` sent `Accept: application/vnd.twitchtv.v5+json` and had an extra leading space in `Authorization: " Bearer " + token`. Replaced with clean Helix headers (`Client-Id` + `Authorization: Bearer <token>`) using native `fetch()`.
- **Deprecated `/users/follows` endpoint**: Twitch decommissioned `/helix/users/follows` in 2023. Updated to **`/helix/channels/followed?user_id=:user_id`**.
- **Legacy `XMLHttpRequest` image blobbing for notifications**: Replaced with direct icon URLs (zero XHR or `URL.createObjectURL` inside Service Worker).

### 3. Technology Modernization & Security Patches
| Package / Tool | Before | After | Why |
|---|---|---|---|
| **Build System** | Gulp 4, `gulp-util` (deprecated), `run-sequence`, `del` v2, `request` (deprecated 2020) | **Node.js 22 + `esbuild` + `archiver`** (`scripts/build.js`) | Fast, zero-deprecated-dependency builds; graceful offline contributor fallback; `.env` no longer crashes local builds. |
| **jQuery** | Vendored `v3.4.1` (XSS CVEs) | **`jquery@^4.1.0`** (npm-managed) | Patches known XSS vulnerabilities flagged by CodeQL & store scanners. |
| **Handlebars** | Vendored `v4.5.3` full compiler (prototype pollution CVEs) | **`handlebars@^4.7.10` runtime-only** (`handlebars.runtime.min.js`) | Patches prototype pollution CVEs and eliminates `new Function` / `eval` for strict MV3 CSP. |
| **Underscore** | Vendored `v1.8.3` (CVE-2021-23358) | **`underscore@^1.13.8`** | Patches arbitrary code execution vulnerability. |
| **Backbone** | Vendored `v1.1.2` | **`backbone@^1.6.1`** | Modernized Backbone runtime. |
| **Linter & Validator** | `jshint` v2 + `web-ext` v6.7.0 | **`eslint` v10 + `web-ext` v10 + `scripts/validate-chrome.js`** | Full MV3 linting for both Chrome Web Store & Mozilla AMO. |
| **GitHub Actions** | `actions/checkout@v2`, `github/codeql-action/*@v1` (deprecated/broken) | **`actions/checkout@v4`**, **`github/codeql-action/*@v3`** | Restores working CI security analysis. |

### 4. Opera Support Removed
- Deleted `opera/` manifests, `opera/common/lib/constants.js`, `screenshots/opera/`, and all Opera build/package tasks, browser-detection branches, and store links.

---

## Development & Build Commands

### Requirements
- **Node.js 22+** (Node 24 LTS used in CI/CD)

### Install Dependencies
```bash
npm install
```

### Run Live MV3 Preview Workbench (Port 3000)
```bash
npm run dev
```
Opens an interactive local preview of the actual built Chrome & Firefox MV3 extension popup (`440×590`) alongside live Chrome MV3 & Firefox `web-ext lint` compliance checks.

### Build & Lint Extensions
```bash
# Build both Chrome and Firefox MV3 bundles into build/chrome and build/firefox
npm run build:all

# Build a single browser target
npm run build:chrome
npm run build:firefox

# Run ESLint + Chrome MV3 compliance checks + Firefox web-ext lint
npm run lint:all
```

### Package Store Archives
```bash
# Create Chrome & Firefox .zip archives in dist/
npm run package:all

# Create Mozilla AMO source code archive (required for AMO review)
npm run package:source
```

### Version Bumping
Synchronizes `package.json`, `chrome/manifest.json`, and `firefox/manifest.json`:
```bash
npm run bump:patch   # e.g. 3.0.0 -> 3.0.1
npm run bump:minor   # e.g. 3.0.0 -> 3.1.0
npm run bump:major   # e.g. 3.0.0 -> 4.0.0
```

---

## Manual CD — Automated Store Deployment

A manual Continuous Deployment workflow is configured at **`.github/workflows/deploy.yml`** (`workflow_dispatch`).

### 1. Configure Repository Secrets
In your GitHub repository, navigate to **Settings → Secrets and variables → Actions** and add:

#### Chrome Web Store Secrets
- `CHROME_EXTENSION_ID` — Your 32-character Chrome extension ID from the Chrome Web Store Developer Dashboard.
- `CHROME_CLIENT_ID` — Google Cloud OAuth 2.0 Client ID (with Chrome Web Store API enabled).
- `CHROME_CLIENT_SECRET` — Google Cloud OAuth 2.0 Client Secret.
- `CHROME_REFRESH_TOKEN` — OAuth 2.0 Refresh Token authorized with `https://www.googleapis.com/auth/chromewebstore`.

#### Firefox Add-ons (AMO) Secrets
- `AMO_JWT_ISSUER` — Your Mozilla Add-ons API Key (`JWT issuer` from https://addons.mozilla.org/developers/addon/api/key/).
- `AMO_JWT_SECRET` — Your Mozilla Add-ons API Secret (`JWT secret`).

#### Optional Twitch Credentials
- `TWITCH_CLIENT_ID` — Override default Twitch Client ID if needed.
- `TWITCH_SECRET` — Only required if switching OAuth flow from implicit `token` to `code`.

### 2. Trigger a Manual Release
1. Open the **Actions** tab in GitHub.
2. Select **Manual CD — Deploy to Chrome & Firefox Stores**.
3. Click **Run workflow** and select:
   - **`target`**: `all`, `chrome`, or `firefox`
   - **`version_bump`**: `none`, `patch`, `minor`, or `major`
   - **`chrome_publish_target`**: `default` (public) or `trustedTesters`
   - **`dry_run`**: Keep `true` to build, run `npm run lint:all`, and download `.zip` artifacts without publishing; uncheck (`false`) to publish live to the stores and create a GitHub Release.

---

## Architecture Overview

```text
chrome/
  manifest.json                 # Chrome MV3 (service_worker, offscreen, action)
  common/lib/constants.js       # Chrome OAuth redirect config
firefox/
  manifest.json                 # Firefox MV3 (event page scripts, gecko settings, data_collection_permissions)
  common/lib/constants.js       # Firefox OAuth redirect config
common/
  lib/background-sw.js          # Shared MV3 background worker (Helix fetch, alarms, storage, scripting OAuth, audio)
  lib/bg-bridge.js              # Popup-to-worker Backbone message bridge (replaces getBackgroundPage)
  lib/offscreen.js              # Chrome MV3 offscreen audio player
  lib/popup.js                  # Popup UI views (Backbone + precompiled Handlebars)
  html/popup.html               # Strict CSP popup markup (zero remote assets)
  html/offscreen.html           # Chrome MV3 offscreen audio document
  content/theatre-mode.js       # Twitch theatre-mode content script
scripts/
  build.js                      # ESBuild + Handlebars + Archiver builder & packager
  validate-chrome.js            # Chrome Web Store MV3 validator
  bump-version.js               # Semver synchronizer
  publish-chrome.js             # Chrome Web Store API v1.1 uploader/publisher
.github/workflows/
  deploy.yml                    # Manual CD workflow (Chrome Web Store + Firefox AMO + GitHub Release)
  codeql.yml                    # CodeQL v3 security scanning
  tags.yml                      # Automated git tagging
server.js                       # Express v5 live MV3 preview & compliance workbench (port 3000)
```

---

## License
GPL-3.0-only — Forked originally from `twitch-now` by Ndragomirov, maintained by LPauzies and contributors.
