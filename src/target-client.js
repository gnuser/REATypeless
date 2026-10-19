"use strict";
const { spawn } = require("node:child_process");
const { allowHelperForeground } = require("./windows-focus");

class TargetClient {
  constructor(executable, options = {}) {
    this.executable = executable;
    this.spawn = options.spawn || spawn;
    this.allowForeground = options.allowForeground || allowHelperForeground;
    this.timeout = options.timeout || 5000;
    this.startupTimeout = options.startupTimeout || 30000;
    this.ready = new WeakSet();
    this.pending = new Map();
    this.serial = 0;
    this.child = null;
  }

  get isWindowsHelper() {
    return this.executable.endsWith(".ps1");
  }

  start() {
    if (this.child) return this.child;
    const args = this.isWindowsHelper
      ? [
          "-NoLogo",
          "-NoProfile",
          "-NonInteractive",
          "-STA",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          this.executable,
          "-OwnerProcessId",
          String(process.pid),
        ]
      : ["serve", String(process.pid)];
    const child = this.spawn(
      this.isWindowsHelper ? "powershell.exe" : this.executable,
      args,
      { windowsHide: true, stdio: ["pipe", "pipe", "ignore"] },
    );
    this.child = child;
    child.stdout.setEncoding("utf8");
    let buffer = "";
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      let end;
      while ((end = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, end);
        buffer = buffer.slice(end + 1);
        let reply;
        try {
          reply = JSON.parse(line);
        } catch {
          continue;
        }
        const entry = this.pending.get(reply.id);
        if (entry?.child !== child) continue;
        this.ready.add(child);
        this.settle(reply.id, null, reply);
      }
    });
    const failed = () => this.disconnect(child);
    child.on("error", failed);
    child.on("exit", failed);
    child.stdin.on("error", failed);
    return child;
  }

  settle(id, error, reply) {
    const entry = this.pending.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    this.pending.delete(id);
    if (error) entry.reject(error);
    else entry.resolve(reply);
  }

  disconnect(child) {
    if (this.child === child) this.child = null;
    for (const [id, entry] of this.pending) {
      if (entry.child === child)
        this.settle(id, Error("Input helper stopped. Please retry."));
    }
  }

  async request(op, args = {}) {
    const child = this.start();
    if (op === "paste" && this.isWindowsHelper) this.allowForeground(child.pid);
    const id = ++this.serial;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => this.settle(id, Error("Input helper timed out.")),
        this.ready.has(child) ? this.timeout : this.startupTimeout,
      );
      this.pending.set(id, { resolve, reject, timer, child });
      try {
        child.stdin.write(JSON.stringify({ ...args, id, op }) + "\n");
      } catch (error) {
        this.settle(id, error);
      }
    });
  }

  close() {
    const child = this.child;
    if (!child) return;
    this.disconnect(child);
    child.stdin.end();
    child.kill();
  }
}
module.exports = { TargetClient };
