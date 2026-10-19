"use strict";
let allow;
// The foreground Electron process must delegate activation to its helper.
// Windows does not automatically grant this right to a background child.
function allowHelperForeground(pid) {
  if (process.platform !== "win32" || !Number.isInteger(pid) || pid <= 0)
    return false;
  if (!allow)
    allow = require("koffi")
      .load("user32.dll")
      .func("int __stdcall AllowSetForegroundWindow(uint32_t dwProcessId)");
  return Boolean(allow(pid));
}
module.exports = { allowHelperForeground };
