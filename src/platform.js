"use strict";
const fs = require("node:fs");
const path = require("node:path");
function resolveTool(
  name,
  resources,
  platform = process.platform,
  env = process.env,
  exists = fs.existsSync,
) {
  const override = env["REATYPELESS_" + name.toUpperCase().replace(/-/g, "_")];
  if (override) return override;
  const filename = name + (platform === "win32" ? ".exe" : "");
  const candidates = [
    path.join(resources, "runtime", filename),
    path.join(resources, "runtime", name, filename),
  ];
  if (platform === "darwin")
    candidates.push("/opt/homebrew/bin/" + name, "/usr/local/bin/" + name);
  for (const dir of (env.PATH || env.Path || "")
    .split(platform === "win32" ? ";" : ":")
    .filter(Boolean))
    candidates.push(path.join(dir.replace(/^"|"$/g, ""), filename));
  return candidates.find(exists) || candidates[0];
}
function privacyURL(type, platform = process.platform) {
  return platform === "win32"
    ? "ms-settings:privacy-microphone"
    : "x-apple.systempreferences:com.apple.preference.security?" +
        (type === "microphone"
          ? "Privacy_Microphone"
          : "Privacy_Accessibility");
}
module.exports = { resolveTool, privacyURL };
