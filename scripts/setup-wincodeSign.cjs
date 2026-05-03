// Pre-populates the winCodeSign cache without symlink creation.
//
// electron-builder downloads winCodeSign-2.6.0.7z to get rcedit.exe (used to
// embed the ASAR integrity hash into Electron.exe). The archive contains macOS
// symlinks (libcrypto.dylib, libssl.dylib). When 7-Zip tries to restore those
// as real symlinks it needs SeCreateSymbolicLinkPrivilege, which Windows only
// grants in Developer Mode or to Administrators.
//
// This script downloads the same archive and extracts it WITHOUT the symlink-
// preservation flag (-snl), so macOS entries become plain files instead of
// symlinks. The Windows tools (win/) are regular files and extract fine.
// Once the cache directory is present, app-builder reuses it on every run.

"use strict";

const { spawnSync } = require("child_process");
const https = require("https");
const fs = require("fs");
const os = require("os");
const path = require("path");

if (process.platform !== "win32") process.exit(0);

const VERSION = "winCodeSign-2.6.0";
const CACHE_DIR = path.join(
  process.env.LOCALAPPDATA || os.homedir(),
  "electron-builder",
  "Cache",
  "winCodeSign",
  VERSION
);

if (fs.existsSync(path.join(CACHE_DIR, "rcedit-x64.exe"))) {
  console.log("winCodeSign cache OK — skipping setup");
  process.exit(0);
}

const SEVEN_ZIP = path.resolve(
  __dirname,
  "..",
  "node_modules",
  "7zip-bin",
  "win",
  "x64",
  "7za.exe"
);
const DOWNLOAD_URL = `https://github.com/electron-userland/electron-builder-binaries/releases/download/${VERSION}/${VERSION}.7z`;
const TMP_FILE = path.join(os.tmpdir(), `${VERSION}-${Date.now()}.7z`);

function download(url, dest, depth) {
  if (depth === undefined) depth = 0;
  if (depth > 10) return Promise.reject(new Error("Too many redirects"));
  return new Promise(function (resolve, reject) {
    const file = fs.createWriteStream(dest);
    https
      .get(url, function (res) {
        if (res.statusCode === 301 || res.statusCode === 302) {
          file.close();
          try { fs.unlinkSync(dest); } catch (_) {}
          download(res.headers.location, dest, depth + 1).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          reject(new Error("HTTP " + res.statusCode + " from " + url));
          return;
        }
        res.pipe(file);
        file.on("finish", function () { file.close(resolve); });
        file.on("error", reject);
      })
      .on("error", reject);
  });
}

(async function main() {
  try {
    console.log("Downloading " + VERSION + ".7z (first-time setup)...");
    await download(DOWNLOAD_URL, TMP_FILE);

    fs.mkdirSync(CACHE_DIR, { recursive: true });

    console.log("Extracting (macOS symlinks will be skipped — this is fine)...");
    // Extract WITHOUT -snl so 7-Zip does not attempt to create macOS symlinks as
    // real Windows symlinks, which requires SeCreateSymbolicLinkPrivilege.
    spawnSync(SEVEN_ZIP, ["x", "-bd", "-y", TMP_FILE, "-o" + CACHE_DIR], {
      stdio: "inherit",
    });

    if (!fs.existsSync(path.join(CACHE_DIR, "rcedit-x64.exe"))) {
      throw new Error("Extraction failed: rcedit-x64.exe not found in " + CACHE_DIR);
    }

    console.log("winCodeSign cache ready at: " + CACHE_DIR);
  } finally {
    try { fs.unlinkSync(TMP_FILE); } catch (_) {}
  }
})().catch(function (err) {
  console.error("setup-wincodeSign error:", err.message);
  process.exit(1);
});
