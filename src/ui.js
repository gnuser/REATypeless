let state,
  page = "home",
  search = "",
  toastTimer,
  scratch = "",
  shortcutButton = null,
  shortcutReady = false,
  captureGeneration = 0;
const $ = (id) => document.getElementById(id),
  content = $("content");
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const t = (en, zh) => (state?.settings.uiLanguage === "zh" ? zh : en);
const shortcut = (s) =>
  state?.platform === "win32"
    ? s
        .replace(/Command/g, "Super")
        .replace(/Control/g, "Ctrl")
        .replace(/Return/g, "Enter")
    : shortcuts.label(s);
const button = (label, attrs = "", cls = "") =>
  `<button ${attrs} class="${cls}">${label}</button>`;
const modes = {
  dictate: ["Dictate", "听写"],
  translate: ["Translate", "翻译"],
  ask: ["Ask anything", "问答"],
};
function toast(text) {
  $("toast").textContent = messages.translate(text, state?.settings.uiLanguage);
  $("toast").style.display = "block";
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ($("toast").style.display = "none"), 7000);
}
function phaseLabel() {
  return (
    {
      idle: t("Ready when you are", "准备好了"),
      starting: t("Preparing microphone…", "正在准备麦克风…"),
      recording: t("Recording", "正在录音"),
      processing: t("Processing locally…", "正在本地处理…"),
    }[state.phase] || state.phase
  );
}
function recordControls() {
  return (
    button(
      state.phase === "recording"
        ? t("Stop recording", "结束录音")
        : t("Start dictating", "开始听写"),
      'data-action="record"',
      "primary",
    ) +
    button(
      t("Cancel", "取消"),
      'data-action="cancel"' + (state.phase === "idle" ? " hidden" : ""),
    )
  );
}
function sidebar() {
  document.querySelector("nav").innerHTML = [
    ["home", "⌂", t("Home", "首页")],
    ["history", "◷", t("History", "历史")],
    ["dictionary", "▤", t("Dictionary", "词典")],
  ]
    .map(([id, icon, label]) =>
      button(
        `<span>${icon}</span>${label}`,
        `data-page="${id}"`,
        page === id ? "active" : "",
      ),
    )
    .join("");
  document.querySelector(".badge").textContent = t("Local", "本地");
  document.querySelector(".private-card").innerHTML =
    `<span class="dot"></span>${t("Local speech recognition", "本地语音识别")}<p>${t("Audio stays local.<br>Codex polishing uses the cloud.", "录音留在本机。<br>Codex 润色需要联网。")}</p>${button(t("Start dictating", "开始听写"), 'id="start-side"', "primary")}`;
  document.querySelector(".sidebar-footer span").textContent =
    state.version || "1.3.0";
  document
    .querySelector('[data-page="settings"]')
    .setAttribute("aria-label", t("Settings", "设置"));
  document
    .querySelector('[data-page="about"]')
    .setAttribute("aria-label", t("Help and about", "帮助与反馈"));
}
function dialog() {
  $("word-form").innerHTML =
    `<h2>${t("New word", "添加词语")}</h2><label>${t("Word or phrase", "正确词语")}<input name="to" required maxlength="150" autofocus></label><label>${t("Replace when heard (optional)", "误识别写法（可选）")}<input name="from" maxlength="150"></label><div class="actions">${button(t("Cancel", "取消"), 'type="button" id="close-word"')}${button(t("Add word", "添加"), 'type="submit"', "primary")}</div>`;
}
async function permissions() {
  if (page !== "settings") return;
  try {
    const p = await window.rea.permissions();
    if ($("microphone-status"))
      $("microphone-status").textContent =
        p.microphone === "granted"
          ? t("Enabled", "已开启")
          : t("Required for recording", "录音需要此权限");
    if ($("accessibility-status"))
      $("accessibility-status").textContent =
        p.accessibility === "ok"
          ? state.platform === "win32"
            ? t(
                "Available · use a shortcut in the destination input",
                "可用 · 请在目标输入框使用快捷键",
              )
            : t(
                "Enabled · original cursor can be restored",
                "已开启 · 可恢复原光标",
              )
          : t(
              "Required for insertion into other apps",
              "插入其他 App 需要此权限",
            );
  } catch {
    if ($("accessibility-status"))
      $("accessibility-status").textContent = t(
        "Restart the app to check again.",
        "请重启应用后再检查。",
      );
  }
}
function updateStatus() {
  const busy = ["starting", "processing"].includes(state.phase);
  for (const b of document.querySelectorAll(
    '#start-side,[data-action="record"]',
  )) {
    b.textContent =
      state.phase === "recording"
        ? t("Stop recording", "结束录音")
        : busy
          ? phaseLabel()
          : t("Start dictating", "开始听写");
    b.disabled = busy;
  }
  for (const b of document.querySelectorAll('[data-action="cancel"]'))
    b.hidden = state.phase === "idle";
  const label = document.querySelector(".record-status");
  if (label) {
    const secs =
      state.phase === "recording"
        ? Math.max(0, Math.floor((Date.now() - state.started) / 1000))
        : 0;
    label.textContent =
      phaseLabel() +
      (state.phase === "recording"
        ? ` · ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`
        : "");
  }
}
function render() {
  if (!state) return;
  if ($("scratch")) scratch = $("scratch").value;
  document.documentElement.lang =
    state.settings.uiLanguage === "zh" ? "zh-CN" : "en";
  document.body.className =
    state.settings.appearance === "light" ? "light" : "";
  sidebar();
  content.innerHTML = (
    { home, history, dictionary, settings, about }[page] || home
  )();
  if ($("scratch")) $("scratch").value = scratch;
  dialog();
  updateStatus();
  void permissions();
}
document.addEventListener("click", async (e) => {
  const b = e.target.closest("button");
  if (!b) return;
  try {
    if (b.dataset.shortcut) {
      await beginShortcutCapture(b);
      return;
    }
    if (b.dataset.page) {
      await stopShortcutCapture();
      page = b.dataset.page;
      search = "";
      render();
    }
    if (b.id === "start-side" || b.dataset.action === "record")
      await window.rea.toggle("dictate");
    if (b.dataset.action === "cancel") await window.rea.cancel();
    if (b.dataset.action === "export") await window.rea.export();
    if (b.dataset.action === "diagnostics") {
      await window.rea.diagnostics();
      toast(
        t(
          "Diagnostic info copied. No transcripts included.",
          "诊断信息已复制，不包含转录内容。",
        ),
      );
    }
    if (b.dataset.action === "new-word") $("word-dialog").showModal();
    if (b.id === "close-word") $("word-dialog").close();
    if (b.dataset.copy || b.dataset.copyRaw) {
      await window.rea.copy(
        b.dataset.copy || b.dataset.copyRaw,
        !!b.dataset.copyRaw,
      );
      toast(t("Copied to clipboard", "已复制"));
    }
    if (
      b.dataset.delete &&
      confirm(t("Delete this saved transcript?", "删除这条记录？"))
    )
      await window.rea.deleteHistory(b.dataset.delete);
    if (b.dataset.removeWord)
      await window.rea.dictionary("delete", b.dataset.removeWord);
    if (b.dataset.permission) {
      await window.rea.permission(b.dataset.permission);
      await permissions();
    }
    if (b.dataset.privacy) await window.rea.openPrivacy(b.dataset.privacy);
  } catch (err) {
    toast(err.message);
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "search") {
    search = e.target.value;
    const pos = e.target.selectionStart;
    render();
    $("search").focus();
    $("search").setSelectionRange(pos, pos);
  }
});
document.addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    if (e.target.id === "word-form") {
      const f = new FormData(e.target);
      await window.rea.dictionary("add", {
        to: f.get("to"),
        from: f.get("from"),
      });
      $("word-dialog").close();
    }
    if (e.target.id === "settings-form") {
      await stopShortcutCapture();
      const f = new FormData(e.target),
        values = Object.fromEntries(f);
      for (const key of ["polish", "simplified", "autoPaste", "launchAtLogin"])
        values[key] = f.has(key);
      state = await window.rea.saveSettings(values);
      render();
      toast(t("Settings saved", "设置已保存"));
    }
  } catch (err) {
    toast(err.message);
  }
});
window.rea.onState((value) => {
  const languageChanged =
    state?.settings.uiLanguage !== value.settings.uiLanguage;
  state = value;
  if (languageChanged || !["settings", "home"].includes(page)) render();
  else {
    updateStatus();
    void permissions();
  }
});
window.rea.onNotice(toast);
window.rea.state().then((value) => {
  state = value;
  render();
});
setInterval(() => state && updateStatus(), 500);
function resetShortcutButton() {
  if (shortcutButton) {
    const field = document.querySelector(
      `[name="${shortcutButton.dataset.shortcut}"]`,
    );
    shortcutButton.textContent = shortcut(field?.value || "");
    shortcutButton.classList.remove("listening");
  }
  shortcutButton = null;
  shortcutReady = false;
}
async function stopShortcutCapture() {
  captureGeneration++;
  resetShortcutButton();
  await window.rea.shortcutCapture(false);
}
async function beginShortcutCapture(b) {
  const generation = ++captureGeneration;
  resetShortcutButton();
  shortcutButton = b;
  b.textContent = t("Preparing…", "准备中…");
  b.classList.add("listening");
  try {
    await window.rea.shortcutCapture(true);
    if (generation !== captureGeneration) return;
    shortcutReady = true;
    b.textContent = t("Press keys… (Esc cancels)", "请按组合键…（Esc 取消）");
  } catch (error) {
    resetShortcutButton();
    toast(error.message);
  }
}
document.addEventListener(
  "keydown",
  async (e) => {
    if (!shortcutButton) return;
    if (e.code === "Tab") {
      await stopShortcutCapture();
      return;
    }
    e.preventDefault();
    e.stopImmediatePropagation();
    if (e.code === "Escape") {
      await stopShortcutCapture();
      return;
    }
    if (!shortcutReady) return;
    const value = shortcuts.accelerator(e);
    if (!value) return;
    document.querySelector(
      `[name="${shortcutButton.dataset.shortcut}"]`,
    ).value = value;
    await stopShortcutCapture();
    toast(
      t(
        "Shortcut recorded. Save settings to apply.",
        "快捷键已录入，保存设置后生效。",
      ),
    );
  },
  true,
);
window.rea.onShortcutCaptureEnd(() => {
  captureGeneration++;
  resetShortcutButton();
});
function rememberInput() {
  const field = document.activeElement;
  if (field?.id === "scratch")
    window.rea.rememberInput({
      value: field.value,
      start: field.selectionStart,
      end: field.selectionEnd,
    });
}
for (const name of ["selectionchange", "input", "keyup", "mouseup", "focusin"])
  document.addEventListener(name, rememberInput);
window.rea.onInsertInput(({ value, start, end, text }) => {
  const field = $("scratch");
  if (!field || field.value !== value) {
    toast(
      t(
        "Original input changed or closed. Your text is in History.",
        "原输入框已更改或关闭，文字已保存在历史记录。",
      ),
    );
    return;
  }
  field.focus();
  field.setSelectionRange(start, end);
  field.setRangeText(text, start, end, "end");
  scratch = field.value;
  rememberInput();
  toast(t("Inserted at your original cursor.", "已插入原光标位置。"));
});
