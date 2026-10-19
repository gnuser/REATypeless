const { speechModel, recognitionArgs } = require("./speech");
const { polishWithCodex } = require("./codex-polish");
"use strict";
const {
  app,
  BrowserWindow,
  ipcMain,
  globalShortcut,
  Tray,
  Menu,
  nativeImage,
  clipboard,
  systemPreferences,
  shell,
  dialog,
  screen,
} = require("electron");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const run = promisify(execFile);
const { cleanText, stats } = require("./core");
const resources = app.isPackaged
  ? process.resourcesPath
  : path.join(__dirname, "..");
const isWindows = process.platform === "win32";
const { resolveTool, privacyURL } = require("./platform");
const tool = Object.fromEntries(
  ["whisper-cli", "ffmpeg", "llama-server"].map((name) => [
    name,
    resolveTool(name, resources),
  ]),
);
const helper = path.join(
  resources,
  app.isPackaged ? "native" : "build/native",
  isWindows ? "windows.ps1" : "output",
);
const { TargetClient } = require("./target-client");
const targets = new TargetClient(helper);
const { createLocalAI } = require("./local-ai");
const localAI = createLocalAI(
  tool["llama-server"],
  path.join(resources, "models", "Qwen3-4B-Q4_K_M.gguf"),
);
const { validate: validateShortcuts } = require("./shortcuts");
let shortcutCapturing = false,
  shortcutTimer,
  internalInput = null;

let main,
  overlay,
  tray,
  stateFile,
  data,
  session = null,
  serial = 0,
  timer,
  hideTimer,
  quitting = false;
const defaults = {
  uiLanguage: "zh",
  simplified: true,
  language: "auto",
  translation: "English",
  polish: false,
  polishProvider: "local",
  speechModel: "auto",
  tone: "Natural",
  autoPaste: true,
  launchAtLogin: false,
  appearance: "dark",
  shortcut: "Control+Alt+D",
  translateShortcut: "Alt+Shift+Space",
  askShortcut: "Alt+Control+Space",
  microphone: "default",
};
function save() {
  const tmp = stateFile + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, stateFile);
}
function snapshot() {
  return {
    ...data,
    platform: process.platform,
    version: "1.3.0",
    started: session?.started || 0,
    stats: stats(data.history),
    phase: session?.phase || "idle",
    runtime: {
      speechModel: path.basename(speechModel(resources, data.settings, fs.existsSync)),
      speech:
        fs.existsSync(speechModel(resources, data.settings, fs.existsSync)) &&
        fs.existsSync(tool["whisper-cli"]) &&
        fs.existsSync(tool["ffmpeg"]),
      ai:
        fs.existsSync(path.join(resources, "models", "Qwen3-4B-Q4_K_M.gguf")) &&
        fs.existsSync(tool["llama-server"]),
    },
    microphonePermission: systemPreferences.getMediaAccessStatus("microphone"),
  };
}
function broadcast() {
  main?.webContents.send("state", snapshot());
}
function status(phase, message) {
  clearTimeout(hideTimer);
  overlay?.webContents.send("status", {
    phase,
    message,
    uiLanguage: data.settings.uiLanguage,
  });
  if (phase !== "idle") {
    overlay?.showInactive();
  } else {
    main?.webContents.send("notice", message);
    hideTimer = setTimeout(() => overlay?.hide(), 4000);
  }
  broadcast();
}
function finish(message) {
  if (session?.target)
    void targets.request("release", { token: session.target }).catch(() => {});
  clearTimeout(timer);
  globalShortcut.unregister("Escape");
  session = null;
  status("idle", message);
}
async function native(command, ...args) {
  return (
    await run(helper, [command, ...args], { timeout: 4000 })
  ).stdout.trim();
}
function checkSender(e) {
  if (![main?.webContents.id, overlay?.webContents.id].includes(e.sender.id))
    throw Error("Unknown window");
}
function secureWindow(options) {
  const w = new BrowserWindow({
    ...options,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  w.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  w.webContents.on("will-navigate", (e) => e.preventDefault());
  return w;
}
function updateTrayMenu() {
  if (!tray) return;
  const t = (en, zh) => (data.settings.uiLanguage === "zh" ? zh : en);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: t("Open REATypeless", "打开 REATypeless"), click: show },
      { label: t("Dictate", "听写"), click: () => toggle() },
      { label: t("Translate", "翻译"), click: () => toggle("translate") },
      { label: t("Ask anything", "问答"), click: () => toggle("ask") },
      { type: "separator" },
      { label: t("Quit", "退出"), click: () => app.quit() },
    ]),
  );
}
function show() {
  main.show();
  main.focus();
}
async function toggle(mode = "dictate", fromUI = false) {
  if (session?.phase === "recording") {
    session.phase = "processing";
    clearTimeout(timer);
    status("processing", "Transcribing locally…");
    overlay.webContents.send("capture", { action: "stop", id: session.id });
    timer = setTimeout(
      () => cancel("Processing timed out. Please try a shorter recording."),
      240000,
    );
    return;
  }
  if (session || shortcutCapturing) return;
  const current = {
    id: ++serial,
    phase: "starting",
    mode,
    options: { ...data.settings },
    target: "",
    selection: "",
    started: Date.now(),
    controller: new AbortController(),
  };
  session = current;
  try {
    current.model = speechModel(resources, current.options, fs.existsSync);
    if (!fs.existsSync(current.model))
      throw Error("Speech model is missing. Reinstall REATypeless.");
    if (!fs.existsSync(tool["whisper-cli"]) || !fs.existsSync(tool["ffmpeg"]))
      throw Error(
        "Speech tools are missing. Install whisper-cli and ffmpeg; see README.",
      );
    current.internal =
      main?.isFocused?.() && internalInput ? { ...internalInput } : null;
    const captured = current.internal
      ? {
          status: "ok",
          selection:
            mode === "ask"
              ? current.internal.value.slice(
                  current.internal.start,
                  current.internal.end,
                )
              : "",
        }
      : await targets
          .request("capture", { ask: mode === "ask" })
          .catch(() => ({ status: "unavailable" }));
    if (session !== current) {
      if (captured.token)
        void targets.request("release", { token: captured.token });
      return;
    }
    current.target = captured.token || "";
    current.selection = captured.selection || "";
    current.targetStatus = captured.status;
    if (!current.target && !current.internal && current.options.autoPaste)
      main?.webContents.send(
        "notice",
        captured.status === "permission"
          ? "Enable Accessibility to insert into your original input. Recording will still be saved."
          : `Click the destination input before opening REATypeless. ${captured.reason || ""} This recording will be saved in History.`,
      );
    if (
      isWindows &&
      systemPreferences.getMediaAccessStatus("microphone") === "denied"
    )
      throw Error(
        "Allow microphone access for desktop apps in Windows Settings.",
      );
    if (
      !isWindows &&
      systemPreferences.getMediaAccessStatus("microphone") !== "granted"
    ) {
      const allowed = await systemPreferences.askForMediaAccess("microphone");
      if (!allowed)
        throw Error(
          "Allow Microphone access in System Settings → Privacy & Security, then try again.",
        );
    }
    if (session !== current) return;
    status("starting", "Preparing microphone…");
    globalShortcut.register("Escape", () => cancel());
    overlay.webContents.send("capture", {
      action: "start",
      id: current.id,
      microphone: current.options.microphone,
    });
    timer = setTimeout(
      () => cancel("Microphone did not start. Check Settings."),
      15000,
    );
  } catch (e) {
    if (session === current) finish(e.message);
  }
}
function cancel(message = "Recording cancelled") {
  if (session) {
    session.controller.abort();
    overlay.webContents.send("capture", { action: "cancel", id: session.id });
  }
  serial++;
  finish(message);
}
async function receiveAudio(id, bytes, duration) {
  const current = session;
  if (
    !current ||
    current.id !== id ||
    current.phase !== "processing" ||
    current.receiving
  )
    return;
  current.receiving = true;
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "reatypeless-"));
  try {
    if (
      !(bytes instanceof Uint8Array) ||
      bytes.byteLength < 100 ||
      bytes.byteLength > 40_000_000
    )
      throw Error("No usable audio was recorded.");
    const input = path.join(dir, "audio.webm"),
      wav = path.join(dir, "audio.wav"),
      out = path.join(dir, "transcript");
    fs.writeFileSync(input, bytes, { mode: 0o600 });
    await run(
      tool["ffmpeg"],
      ["-v", "error", "-i", input, "-ar", "16000", "-ac", "1", wav],
      { windowsHide: true, timeout: 30000, signal: current.controller.signal },
    );
    const args = recognitionArgs(current.model, wav, out, current.options.language, data.dictionary);
    await run(tool["whisper-cli"], args, {
      windowsHide: true,
      timeout: 150000,
      maxBuffer: 4 * 1024 * 1024,
      signal: current.controller.signal,
    });
    let raw = cleanText(fs.readFileSync(out + ".txt", "utf8"), data.dictionary);
    if (!raw) throw Error("No speech detected.");
    if (session !== current) return;
    let text = raw,
      warning = "";
    if (current.mode !== "dictate" || current.options.polish) {
      status(
        "processing",
        current.mode === "translate"
          ? "Translating locally…"
          : current.mode === "ask"
            ? "Thinking locally…"
            : "Polishing your words…",
      );
      try {
        text = current.mode === "dictate" && current.options.polishProvider === "codex"
          ? await polishWithCodex(raw, current.controller.signal, { dictionary: data.dictionary })
          : await localAI.transform(
          raw,
          current.mode,
          current.options,
          current.selection,
          current.controller.signal,
        );
      } catch (e) {
        if (current.controller.signal.aborted) return;
        warning = `AI unavailable: ${e.message} Original transcript saved.`;
      }
    }
    if (session !== current) return;
    if (
      current.options.simplified &&
      (current.mode !== "translate" ||
        current.options.translation === "Simplified Chinese")
    ) {
      try {
        const converted = await targets.request("simplify", { text });
        if (typeof converted.text !== "string")
          throw Error("Conversion unavailable");
        text = converted.text;
      } catch {
        warning =
          "Simplified conversion unavailable. Original transcript saved.";
      }
    }
    if (session !== current) return;
    text = cleanText(text, data.dictionary);
    const entry = {
      id: crypto.randomUUID(),
      date: new Date().toISOString(),
      text,
      raw,
      duration: Math.max(0, Math.min(300, Number(duration) || 0)),
      mode: current.mode,
      warning,
    };
    data.history.unshift(entry);
    save();
    let message =
      current.options.autoPaste && !current.target && !current.internal
        ? `Saved to History. ${current.targetStatus === "permission" ? "Accessibility permission is required." : "No original input was captured."}`
        : "Saved to History.";
    if (current.internal && current.options.autoPaste && !warning) {
      show();
      main.webContents.send("insert-input", { ...current.internal, text });
      message = "Saved to History.";
    }
    if (current.target && current.options.autoPaste && !warning) {
      const old = clipboard.readText();
      clipboard.writeText(text);
      try {
        const result = await targets.request("paste", {
          token: current.target,
        });
        entry.deliveryDetails = result;
        const reasons = {
          unverified:
            "Insertion could not be confirmed. Check the original input before copying from History.",
          permission: "Enable Accessibility in Settings.",
          closed: "The original input was closed.",
          edited: "The original input changed during recording.",
          unsupported: "This input does not support restoring its cursor.",
          changed: "Could not restore the original input focus.",
        };
        message =
          result.status === "ok"
            ? "Inserted at your original cursor."
            : `Saved to History. ${reasons[result.status] || "Could not insert into the original input."}`;
      } finally {
        setTimeout(() => {
          if (clipboard.readText() === text) clipboard.writeText(old);
        }, 900);
      }
    }
    if (session !== current) return;
    entry.delivery = message;
    save();
    finish(warning || message);
  } catch (e) {
    if (session === current)
      finish(e.name === "AbortError" ? "Cancelled" : e.message);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
function endShortcutCapture() {
  clearTimeout(shortcutTimer);
  if (!shortcutCapturing) return;
  shortcutCapturing = false;
  main?.webContents.setIgnoreMenuShortcuts(false);
  registerShortcuts(data.settings);
  main?.webContents.send("shortcut-capture-ended");
}
function registerShortcuts(settings) {
  globalShortcut.unregisterAll();
  const failed = [];
  for (const [key, mode] of [
    ["shortcut", "dictate"],
    ["translateShortcut", "translate"],
    ["askShortcut", "ask"],
  ]) {
    try {
      if (!globalShortcut.register(settings[key], () => toggle(mode)))
        failed.push(settings[key]);
    } catch {
      failed.push(settings[key]);
    }
  }
  return failed;
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on("second-instance", () => main && show());
  app.whenReady().then(() => {
    stateFile = path.join(app.getPath("userData"), "data.json");
    try {
      data = JSON.parse(fs.readFileSync(stateFile, "utf8"));
    } catch (e) {
      if (e.code !== "ENOENT") {
        fs.copyFileSync(stateFile, stateFile + ".recovery-" + Date.now());
      }
      data = { history: [], dictionary: [], settings: {} };
    }
    if (data.settings.experienceVersion !== 2) {
      data.settings.polish = false;
      data.settings.experienceVersion = 2;
    }
    data.settings = { ...defaults, ...data.settings };
    save();
    targets.start();
    main = secureWindow({
      width: 1160,
      height: 810,
      minWidth: 900,
      minHeight: 620,
      title: "REATypeless",
      backgroundColor: "#242222",
      titleBarStyle: isWindows ? "default" : "hiddenInset",
    });
    main.loadFile(path.join(__dirname, "index.html"));
    main.on("blur", () => {
      internalInput = null;
      endShortcutCapture();
    });
    main.on("close", (e) => {
      endShortcutCapture();
      if (!quitting) {
        e.preventDefault();
        main.hide();
      }
    });
    const area = screen.getPrimaryDisplay().workArea;
    overlay = secureWindow({
      width: 430,
      height: 82,
      x: Math.round(area.x + (area.width - 430) / 2),
      y: area.y + area.height - 110,
      show: false,
      frame: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
      focusable: false,
      hasShadow: false,
    });
    overlay.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    overlay.loadFile(path.join(__dirname, "recorder.html"));
    overlay.webContents.session.setPermissionRequestHandler(
      (webContents, permission, callback) =>
        callback(
          webContents.id === overlay.webContents.id && permission === "media",
        ),
    );
    const icon = nativeImage.createFromDataURL(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAIElEQVQ4T2NkoBAwUqifYdQABgYGhv8DDAwM/4fRAAAAT+4DAdp8Ug0AAAAASUVORK5CYII=",
    );
    if (!isWindows) icon.setTemplateImage(true);
    tray = new Tray(icon);
    tray.setTitle("R");
    tray.setToolTip("REATypeless");
    tray.on("double-click", show);
    updateTrayMenu();
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: "REATypeless",
          submenu: [
            { role: "about" },
            { type: "separator" },
            { role: "hide" },
            { role: "quit" },
          ],
        },
        {
          label: "Edit",
          submenu: [
            { role: "undo" },
            { role: "redo" },
            { type: "separator" },
            { role: "cut" },
            { role: "copy" },
            { role: "paste" },
            { role: "selectAll" },
          ],
        },
        { label: "Window", submenu: [{ role: "minimize" }, { role: "zoom" }] },
      ]),
    );
    const failed = registerShortcuts(data.settings);
    if (failed.length)
      main.webContents.once("did-finish-load", () =>
        main.webContents.send(
          "notice",
          "Shortcut in use: " +
            failed.join(", ") +
            ". Choose another in Settings.",
        ),
      );
  });
}
app.on("activate", () => main && show());
app.on("window-all-closed", () => {});
app.on("before-quit", () => {
  quitting = true;
  if (session) cancel();
  localAI.close();
  targets.close();
  clearTimeout(shortcutTimer);
  globalShortcut.unregisterAll();
});
ipcMain.handle("get-state", (e) => {
  checkSender(e);
  return snapshot();
});
ipcMain.handle("toggle", (e, mode) => {
  checkSender(e);
  return toggle(
    ["dictate", "translate", "ask"].includes(mode) ? mode : "dictate",
    e.sender === main.webContents,
  );
});
ipcMain.on("started", (e, id) => {
  checkSender(e);
  if (session?.id !== id || session.phase !== "starting") return;
  clearTimeout(timer);
  session.phase = "recording";
  session.started = Date.now();
  status(
    "recording",
    "Listening · press shortcut again to finish · Esc to cancel",
  );
  timer = setTimeout(() => toggle(), 180000);
});
ipcMain.on("audio", (e, id, bytes, duration) => {
  checkSender(e);
  void receiveAudio(id, bytes, duration);
});
ipcMain.on("capture-error", (e, id, message) => {
  checkSender(e);
  if (session?.id === id) cancel(String(message));
});
ipcMain.handle("cancel", (e) => {
  checkSender(e);
  cancel();
});
ipcMain.handle("save-settings", (e, values) => {
  checkSender(e);
  if (session) throw Error("Finish the recording before changing settings.");
  const next = { ...data.settings };
  for (const key of Object.keys(defaults)) {
    if (typeof values[key] === typeof defaults[key])
      next[key] =
        typeof values[key] === "string"
          ? values[key].slice(0, 100)
          : values[key];
  }
  if (!["zh", "en"].includes(next.uiLanguage))
    throw Error("Unsupported interface language.");
  if (!["local", "codex"].includes(next.polishProvider)) throw Error("Unsupported polishing provider.");
  if (!["auto", "small"].includes(next.speechModel)) throw Error("Unsupported speech model.");
  validateShortcuts(next);
  endShortcutCapture();
  const failed = registerShortcuts(next);
  if (failed.length) {
    registerShortcuts(data.settings);
    throw Error("Shortcut unavailable: " + failed.join(", "));
  }
  data.settings = next;
  updateTrayMenu();
  app.setLoginItemSettings({ openAtLogin: next.launchAtLogin });
  save();
  broadcast();
  return snapshot();
});
ipcMain.handle("dictionary", (e, operation, value) => {
  checkSender(e);
  if (operation === "developer-terms") {
    for (const to of ["API", "bug", "Codex", "GitHub", "inventory", "leaderboard", "main", "Roblox", "settings", "UI"]) {
      if (!data.dictionary.some(w => w.to.toLowerCase() === to.toLowerCase()))
        data.dictionary.push({ id: crypto.randomUUID(), to, from: "" });
    }
  } else if (operation === "add") {
    const to = String(value.to || "")
        .trim()
        .slice(0, 150),
      from = String(value.from || "")
        .trim()
        .slice(0, 150);
    if (!to) throw Error("Enter a word.");
    data.dictionary.push({ id: crypto.randomUUID(), to, from });
  } else if (operation === "delete")
    data.dictionary = data.dictionary.filter((w) => w.id !== value);
  save();
  broadcast();
  return snapshot();
});
ipcMain.handle("copy", (e, id, raw = false) => {
  checkSender(e);
  const item = data.history.find((h) => h.id === id);
  if (item) clipboard.writeText(raw ? item.raw : item.text);
});
ipcMain.handle("delete-history", (e, id) => {
  checkSender(e);
  data.history = data.history.filter((h) => h.id !== id);
  save();
  broadcast();
});
ipcMain.handle("export", async (e) => {
  checkSender(e);
  const result = await dialog.showSaveDialog(main, {
    defaultPath: "REATypeless-history.txt",
  });
  if (result.canceled) return;
  fs.writeFileSync(
    result.filePath,
    data.history.map((h) => `${h.date}\n${h.text}`).join("\n\n"),
  );
});
ipcMain.handle("permission", async (e, type) => {
  checkSender(e);
  if (type === "accessibility")
    return isWindows
      ? (await targets.request("status")).status
      : native("permission");
  if (type === "microphone")
    return isWindows
      ? shell.openExternal(privacyURL(type))
      : systemPreferences.askForMediaAccess("microphone");
});
ipcMain.handle("permissions", async (e) => {
  checkSender(e);
  return {
    accessibility: (await targets.request("status")).status,
    microphone: systemPreferences.getMediaAccessStatus("microphone"),
  };
});
ipcMain.handle("open-privacy", (e, type) => {
  checkSender(e);
  return shell.openExternal(privacyURL(type));
});

ipcMain.handle("shortcut-capture", (e, active) => {
  checkSender(e);
  if (e.sender !== main.webContents) throw Error("Unknown window");
  if (active) {
    if (session) throw Error("Finish recording before changing shortcuts.");
    shortcutCapturing = true;
    globalShortcut.unregisterAll();
    main.webContents.setIgnoreMenuShortcuts(true);
    clearTimeout(shortcutTimer);
    shortcutTimer = setTimeout(endShortcutCapture, 60000);
  } else endShortcutCapture();
  return true;
});

ipcMain.on("remember-input", (e, value) => {
  checkSender(e);
  if (e.sender !== main.webContents) return;
  internalInput =
    value &&
    typeof value.value === "string" &&
    Number.isInteger(value.start) &&
    Number.isInteger(value.end) &&
    value.start >= 0 &&
    value.end >= value.start &&
    value.end <= value.value.length
      ? { value: value.value, start: value.start, end: value.end }
      : null;
});

ipcMain.handle("diagnostics", async (e) => {
  checkSender(e);
  const permissions = await targets
    .request("status")
    .catch(() => ({ status: "unavailable" }));
  clipboard.writeText(
    JSON.stringify(
      {
        app: "REATypeless",
        version: "1.3.0",
        platform: process.platform,
        arch: process.arch,
        os: os.release(),
        microphone: systemPreferences.getMediaAccessStatus("microphone"),
        accessibility: permissions.status,
        runtime: snapshot().runtime,
        uiLanguage: data.settings.uiLanguage,
        polish: data.settings.polish,
        simplified: data.settings.simplified,
      },
      null,
      2,
    ),
  );
});
