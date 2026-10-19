// Page templates share the renderer state and escaping helpers from ui.js.
function home() {
  return `<h1 class="hero">${t("Speak, don't type", "说出来，不用打字")}</h1><p>${t("Click into any input, press your shortcut, speak, then press it again.", "先点击要输入的位置，按快捷键开始说话，再按一次结束。")}</p><div class="home-grid"><section><div class="workspace"><div class="row"><h3>${t("Try it here", "试着说一句")}</h3><span class="record-status" role="status">${phaseLabel()}</span></div><textarea id="scratch" placeholder="${t("Click here, then use your dictation shortcut.", "点击这里，再按快捷键开始听写。")}"></textarea><div class="actions">${recordControls()}</div></div><div class="card test-note"><b>${state.settings.polish ? t("Polished dictation", "润色听写") : t("Fast dictation", "快速听写")}</b><p>${state.settings.polish ? t("Uses your selected polishing engine. May take longer.", "使用设置中的润色引擎整理表达，等待时间会稍长。") : t("Transcribes directly, without waiting for the writing model.", "直接转录，无需等待润色模型。")}</p><p>${t("Chinese dictation is converted to Simplified Chinese. Originals stay in History.", "中文听写默认转换为简体，原始转录保留在历史记录。")}</p></div><div class="row test-note"><span>${state.stats.words} ${t("words dictated", "字已听写")}</span><span>${state.history.length} ${t("recordings", "条记录")}</span></div></section><section class="rail"><div class="card">${Object.entries(
    modes,
  )
    .map(
      ([mode, labels]) =>
        `<p>${t(...labels)}</p><kbd>${esc(shortcut(state.settings[{ dictate: "shortcut", translate: "translateShortcut", ask: "askShortcut" }[mode]]))}</kbd>`,
    )
    .join(
      "",
    )}${button(t("Edit shortcuts", "修改快捷键"), 'data-page="settings"')}</div><div class="card privacy"><h3>${t("Audio stays on your computer", "录音留在本机")}</h3><p>${t("Local mode needs no account. Optional Codex polishing sends text to OpenAI.", "本地模式无需账号。可选 Codex 润色会将文本发送到 OpenAI。")}</p></div>${button(t("Setup & feedback", "开始使用与反馈"), 'data-page="about"')}</section></div>`;
}
function history() {
  const items = state.history.filter((h) =>
    (h.text + " " + h.raw).toLowerCase().includes(search.toLowerCase()),
  );
  return `<div class="row"><h1>${t("History", "历史记录")}</h1>${button(t("Export", "导出"), 'data-action="export"')}</div><div class="toolbar"><span class="subtle">${state.history.length} ${t("recordings · on this computer", "条记录 · 保存在本机")}</span><input id="search" placeholder="${t("Search history", "搜索记录")}" value="${esc(search)}"></div>${items.map((h) => `<article class="entry"><div class="row"><time>${esc(new Date(h.date).toLocaleString(state.settings.uiLanguage === "zh" ? "zh-CN" : "en-US"))} · ${t(...(modes[h.mode] || modes.dictate))} · ${Math.round(h.duration)}s</time><div class="actions">${button(t("Copy", "复制"), `data-copy="${h.id}"`)}${button(t("Delete", "删除"), `data-delete="${h.id}"`)}</div></div><p>${esc(h.text)}</p>${h.delivery ? `<p class="subtle">${esc(messages.translate(h.delivery, state.settings.uiLanguage))}</p>` : ""}${h.warning ? `<p class="notice">${esc(messages.translate(h.warning, state.settings.uiLanguage))}</p>` : ""}<details><summary>${t("Original transcript", "原始转录")}</summary><p>${esc(h.raw)}</p>${button(t("Copy original", "复制原文"), `data-copy-raw="${h.id}"`)}</details></article>`).join("") || `<div class="empty"><h2>${t("No recordings found", "暂无记录")}</h2><p>${t("Your next dictation will appear here.", "下一次听写会保存在这里。")}</p></div>`}`;
}
function dictionary() {
  return `<div class="row"><h1>${t("Dictionary", "词典")}</h1>${button(t("New word", "添加词语"), 'data-action="new-word"')}</div><p>${t("Add names and terms you often use. Optional replacements correct recurring mistakes.", "添加常用姓名和术语；可填写经常被误识别的写法，自动替换。")}</p>${button(t("Add developer vocabulary", "添加开发常用词"), 'data-action="developer-terms"')}<div class="word-list">${state.dictionary.map((w) => `<div class="word"><div><b>${esc(w.to)}</b><p>${w.from ? esc(w.from) + " → " + esc(w.to) : t("Recognition hint", "识别提示")}</p></div>${button("×", `data-remove-word="${w.id}" aria-label="${t("Remove word", "删除词语")}"`)}</div>`).join("")}</div>`;
}
function select(key, options) {
  return `<select name="${key}">${options.map(([v, label]) => `<option value="${v}" ${state.settings[key] === v ? "selected" : ""}>${label}</option>`).join("")}</select>`;
}
function setting(title, description, input) {
  return `<div class="setting"><div>${title}<p>${description}</p></div>${input}</div>`;
}
function checkbox(key, label) {
  return `<input type="checkbox" name="${key}" aria-label="${label}" ${state.settings[key] ? "checked" : ""}>`;
}
function settings() {
  return `<h1>${t("Settings", "设置")}</h1><form id="settings-form"><section class="settings-section"><h3>${t("Language & writing", "语言与听写")}</h3>${setting(
    t("Interface language", "界面语言"),
    t("Changes the interface only.", "仅改变界面语言。"),
    select("uiLanguage", [
      ["zh", "简体中文"],
      ["en", "English"],
    ]),
  )}${setting(
    t("Speech language", "识别语言"),
    t("Auto-detect supports mixed languages.", "自动检测支持多语言。"),
    select("language", [
      ["auto", t("Auto-detect", "自动检测")],
      ["zh", "中文"],
      ["en", "English"],
      ["ja", "日本語"],
      ["ko", "한국어"],
      ["es", "Español"],
      ["fr", "Français"],
      ["de", "Deutsch"],
      ["ru", "Русский"],
    ]),
  )}${setting(t("Recognition quality", "识别质量"), t("Accuracy uses Large v3 Turbo when installed; otherwise Small. For mostly Chinese speech, choose Chinese above to avoid short-clip language mistakes.", "优先准确使用已安装的 Large v3 Turbo，否则使用 Small。主要说中文时，建议上方选择中文，减少短句语言误判。"), select("speechModel", [["auto", t("Prefer accuracy", "优先准确")], ["small", t("Small · lower memory", "Small · 节省内存")]]))}${setting(t("Polish dictation", "润色听写"), t("Off is faster. Turn on to remove fillers with AI.", "关闭更快；开启后使用 AI 整理表达和口头语。"), checkbox("polish", t("Polish dictation", "润色听写")))}${setting(t("Polishing engine", "润色引擎"), t("Codex sends transcript text to OpenAI using your CLI login and quota. Audio stays local. Requires a recent Codex CLI. Translation and Ask still use local AI.", "Codex 使用 CLI 登录和额度，将转录文本发送到 OpenAI；音频仍在本地。需要新版 Codex CLI。翻译与问答仍使用本地 AI。"), select("polishProvider", [["local", t("Local Qwen · offline", "本地 Qwen · 离线")], ["codex", t("Codex · online", "Codex · 联网")]]))}${setting(t("Simplified Chinese output", "中文输出简体"), t("For dictation and Chinese answers; does not change your translation target.", "用于听写和中文回答，不改变指定的翻译目标。"), checkbox("simplified", t("Simplified Chinese output", "中文输出简体")))}${setting(
    t("Translate to", "翻译目标"),
    "",
    select("translation", [
      ["English", "English"],
      ["Simplified Chinese", "简体中文"],
      ["Traditional Chinese", "繁體中文"],
      ["Japanese", "日本語"],
      ["Korean", "한국어"],
      ["French", "Français"],
      ["Spanish", "Español"],
    ]),
  )}</section><section class="settings-section"><h3>${t("Shortcuts", "快捷键")}</h3>${[
    ["shortcut", "dictate"],
    ["translateShortcut", "translate"],
    ["askShortcut", "ask"],
  ]
    .map(([k, mode]) =>
      setting(
        t(...modes[mode]),
        t(
          "Click, then press a combination. Esc cancels.",
          "点击后直接按组合键，Esc 取消。",
        ),
        `<input type="hidden" name="${k}" value="${esc(state.settings[k])}">${button(esc(shortcut(state.settings[k])), `type="button" data-shortcut="${k}" aria-label="${t("Record shortcut for ", "录入快捷键：") + t(...modes[mode])}"`, "shortcut-recorder")}`,
      ),
    )
    .join(
      "",
    )}</section><section class="settings-section"><h3>${t("Permissions & output", "权限与输入")}</h3>${setting(t("Microphone", "麦克风"), `<span id="microphone-status">${t("Checking…", "正在检查…")}</span>`, button(t("Enable", "开启"), 'type="button" data-permission="microphone"') + button(t("System Settings", "系统设置"), 'type="button" data-privacy="microphone"'))}${setting(state.platform === "win32" ? t("Windows input support", "Windows 输入支持") : t("Accessibility", "辅助功能"), '<span id="accessibility-status"></span>', state.platform === "win32" ? "" : button(t("Enable", "开启"), 'type="button" data-permission="accessibility"') + button(t("System Settings", "系统设置"), 'type="button" data-privacy="accessibility"'))}${setting(t("Automatic insertion", "自动插入"), t("Return text to the original input and caret.", "将文字插回原来的输入框和光标位置。"), checkbox("autoPaste", t("Automatic insertion", "自动插入")))}</section><section class="settings-section"><h3>${t("General", "通用")}</h3>${setting(
    t("Appearance", "外观"),
    "",
    select("appearance", [
      ["dark", t("Dark", "深色")],
      ["light", t("Light", "浅色")],
    ]),
  )}${setting(t("Launch at login", "登录时启动"), "", checkbox("launchAtLogin", t("Launch at login", "登录时启动")))}</section><div class="settings-footer actions">${button(t("Save settings", "保存设置"), 'type="submit"', "primary")}</div></form>`;
}
function about() {
  return `<h1>${t("Ready for a test drive", "开始试用")}</h1><div class="about"><div class="card"><h3>${t("Three steps", "只需三步")}</h3><p>${state.platform === "win32" ? t("1. Allow desktop microphone access in Windows Settings.<br>2. Focus your destination input.<br>3. Use the shortcut to start and stop recording.", "1. 在 Windows 设置中允许桌面应用访问麦克风。<br>2. 点击目标输入框。<br>3. 使用快捷键开始和结束录音。") : t("1. Enable Microphone and Accessibility in Settings.<br>2. Click an input in your app.<br>3. Press your shortcut to start, and again to finish.", "1. 在设置中开启麦克风和辅助功能权限。<br>2. 点击你要输入的输入框。<br>3. 按快捷键开始，再按一次结束。")}</p><p>${t("Esc cancels. If insertion fails, copy the text from History.", "Esc 可取消。如果没有插入，可以从历史记录复制文字。")}</p>${button(t("Open settings", "打开设置"), 'data-page="settings"')}</div><div class="card"><h3>${t("Send useful feedback", "反馈使用问题")}</h3><p>${t("Tell the developer which app you used, what you expected, and what happened. The button below copies version and setup information, without transcripts or recordings.", "请告诉开发者：使用哪个 App、预期结果、实际发生了什么。下面的按钮仅复制版本和环境信息，不包含转录或录音。")}</p>${button(t("Copy diagnostic info", "复制诊断信息"), 'data-action="diagnostics"')}</div><p>${t("Version", "版本")} ${esc(state.version || "1.3.0")} · ${t("Local mode needs no account. Codex polishing requires login, network and quota.", "本地模式无需账号；Codex 润色需要登录、联网和可用额度。")}</p></div>`;
}
