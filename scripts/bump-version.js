#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const semver = require("semver");

const ROOT = path.resolve(__dirname, "..");
const bumpType = process.argv[2];

if (!["patch", "minor", "major"].includes(bumpType)) {
  console.error("Usage: node scripts/bump-version.js <patch|minor|major>");
  process.exit(1);
}

const pkgPath = path.join(ROOT, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
const nextVersion = semver.inc(pkg.version, bumpType);

if (!nextVersion) {
  console.error(`Invalid current version: ${pkg.version}`);
  process.exit(1);
}

const filesToUpdate = [
  pkgPath,
  path.join(ROOT, "chrome", "manifest.json"),
  path.join(ROOT, "firefox", "manifest.json")
];

for (const file of filesToUpdate) {
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  json.version = nextVersion;
  const indent = file.endsWith("package.json") ? 4 : 2;
  fs.writeFileSync(file, JSON.stringify(json, null, indent) + "\n", "utf8");
  console.log(`[bump] Updated ${path.relative(ROOT, file)} -> ${nextVersion}`);
}
