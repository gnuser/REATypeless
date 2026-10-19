"use strict";
const { execFileSync } = require("node:child_process");
const fs = require("node:fs"),
  path = require("node:path");
process.chdir(path.join(__dirname, ".."));
fs.mkdirSync("build", { recursive: true });
if (process.platform === "win32") {
  execFileSync(
    "powershell.exe",
    [
      "-NoLogo",
      "-NoProfile",
      "-NonInteractive",
      "-File",
      path.join(__dirname, "make-test-audio.ps1"),
    ],
    { stdio: "inherit", windowsHide: true },
  );
} else execFileSync("sh", ["scripts/make-test-audio.sh"], { stdio: "inherit" });
