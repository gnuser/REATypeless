"use strict";
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
process.chdir(path.join(__dirname, ".."));
const action = process.argv[2] || "native";
if (process.platform === "win32") {
  if (action === "native") {
    fs.mkdirSync("runtime", { recursive: true });
    fs.mkdirSync("build/native", { recursive: true });
    fs.copyFileSync("native/windows.ps1", "build/native/windows.ps1");
    fs.cpSync("native/windows", "build/native/windows", { recursive: true });
  } else if (action !== "icon")
    throw Error("Unsupported build action: " + action);
} else if (process.platform === "darwin")
  execFileSync("sh", ["scripts/build-" + action + ".sh"], { stdio: "inherit" });
else throw Error("Supported platforms: Windows and macOS");
