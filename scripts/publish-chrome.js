#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

async function main() {
  const extensionId = process.env.CHROME_EXTENSION_ID;
  const clientId = process.env.CHROME_CLIENT_ID;
  const clientSecret = process.env.CHROME_CLIENT_SECRET;
  const refreshToken = process.env.CHROME_REFRESH_TOKEN;
  const publishTarget = process.env.CHROME_PUBLISH_TARGET || "default";

  if (!extensionId || !clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing required Chrome Web Store environment variables: CHROME_EXTENSION_ID, CHROME_CLIENT_ID, CHROME_CLIENT_SECRET, CHROME_REFRESH_TOKEN"
    );
  }

  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
  const version = process.env.EXTENSION_VERSION || pkg.version;
  const zipPath = path.join(ROOT, "dist", `twitch-companion-chrome-${version}.zip`);
  if (!fs.existsSync(zipPath)) {
    throw new Error(`Chrome package not found at ${zipPath}. Run \`npm run package:chrome\` first.`);
  }

  console.log("[chrome-cd] Requesting Google OAuth2 access token...");
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  });
  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(`Failed to acquire Google access token: ${JSON.stringify(tokenData)}`);
  }

  const accessToken = tokenData.access_token;
  const zipBuffer = fs.readFileSync(zipPath);

  console.log(`[chrome-cd] Uploading ${path.basename(zipPath)} (${zipBuffer.length} bytes) to Chrome Web Store...`);
  const uploadRes = await fetch(
    `https://www.googleapis.com/upload/chromewebstore/v1.1/items/${encodeURIComponent(extensionId)}`,
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-goog-api-version": "2"
      },
      body: zipBuffer
    }
  );
  const uploadData = await uploadRes.json();
  if (!uploadRes.ok || uploadData.uploadState === "FAILURE") {
    throw new Error(`Chrome Web Store upload failed: ${JSON.stringify(uploadData)}`);
  }
  console.log("[chrome-cd] Upload succeeded:", uploadData.uploadState);

  console.log(`[chrome-cd] Publishing item ${extensionId} to target "${publishTarget}"...`);
  const publishRes = await fetch(
    `https://www.googleapis.com/chromewebstore/v1.1/items/${encodeURIComponent(extensionId)}/publish?publishTarget=${encodeURIComponent(publishTarget)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "x-goog-api-version": "2",
        "Content-Length": "0"
      }
    }
  );
  const publishData = await publishRes.json();
  if (!publishRes.ok) {
    throw new Error(`Chrome Web Store publish failed: ${JSON.stringify(publishData)}`);
  }

  console.log("[chrome-cd] Published successfully:", JSON.stringify(publishData));
}

main().catch((err) => {
  console.error("[chrome-cd] Error:", err.message);
  process.exit(1);
});
