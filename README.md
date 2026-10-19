# REATypeless

无需账号或订阅的本地语音输入工具。支持简体中文 / English 界面、语音转文字、可选 AI 润色、翻译和语音问答。

**1.2.0 源码预览版：支持 Windows x64 和 Apple Silicon Mac。** Windows 输入支持仍需在实际目标应用中验证。当前需要自行安装运行依赖；不是开箱即用、已公证的安装包。

## 功能

- 点击按钮或使用全局快捷键录音，尝试将文字插回开始录音前的输入框与光标位置。
- 快捷键通过直接按组合键设置，支持冲突提示。
- 默认快速听写；需要时开启本地 AI 润色。中文听写输出简体中文，翻译遵循指定目标语言。
- 录音计时、取消、历史记录、原文复制、词典和诊断信息复制。
- 本地 Whisper Small 语音识别与 Qwen3 4B 文本处理，无远程推理服务。

自动插入依赖目标应用提供的 macOS 辅助功能或 Windows UI Automation 信息，不能保证覆盖所有输入框。输入框关闭、内容变化或无法恢复光标时，请从历史记录复制结果。密码输入框不支持自动插入。

## Windows 从源码运行

需要 Windows 10/11 x64、Node.js 22.12+ 和系统自带 Windows PowerShell 5.1。

```powershell
npm ci
npm run build:native
npm run models:download
npm start
```

依赖与模型安装完成后，可以双击 `start-windows.cmd` 启动。

启动前安装 Windows 版 `whisper-cli.exe`、`ffmpeg.exe`；润色、翻译、问答还需要 `llama-server.exe`。工具来源为 whisper.cpp、FFmpeg 和 llama.cpp 各自的官方项目。工具及其配套 DLL 应保留在同一目录，可加入 PATH，或分别放入项目下 `runtime/whisper-cli/`、`runtime/ffmpeg/`、`runtime/llama-server/`。不要只复制 exe 而遗漏 DLL。

也可以在启动应用的 PowerShell 中指定路径：

```powershell
$env:REATYPELESS_WHISPER_CLI = 'C:\Tools\whisper\whisper-cli.exe'
$env:REATYPELESS_FFMPEG = 'C:\Tools\ffmpeg\bin\ffmpeg.exe'
$env:REATYPELESS_LLAMA_SERVER = 'C:\Tools\llama\llama-server.exe'
npm start
```

在 Windows 设置 → 隐私和安全性 → 麦克风中允许桌面应用访问。无需 macOS 辅助功能授权。外部应用请先点击目标输入框，再使用全局快捷键，或切回主窗口点击开始；Windows 版会记住最近的外部输入框与光标。使用 UI Automation 恢复支持的输入框及选区，内容变化、焦点恢复失败、密码框或不支持的控件不会自动插入。插入后会核对控件内容；无法确认时提示检查结果，不会自动重试。如未插入，从历史记录复制。以管理员身份运行的应用可能拒绝普通权限进程插入。

`npm test` 包含 Windows 助手通信和繁简转换测试。安装模型和工具后，`npm run test:integration` 使用 Windows 自带英文语音合成验证转写，不读取麦克风。`npm run dist:win` 输出 `dist/win-unpacked/REATypeless.exe`，包含模型和 `runtime/` 下的工具及 DLL；通过 PATH 或环境变量找到的外部工具不会自动打包。当前是未签名目录包，不是安装程序。Windows 数据保存在 `%APPDATA%/reatypeless/`。

## macOS 从源码运行

需要 Apple Silicon Mac、Node.js 22.12+、Xcode Command Line Tools 和安装于 `/opt/homebrew` 的 Homebrew。

```sh
xcode-select --install
brew install whisper-cpp llama.cpp ffmpeg
git clone https://github.com/gnuser/REATypeless.git
cd REATypeless
npm ci
npm run models:download
npm run build:native
npm start
```

模型下载约 2.5 GB，需要连接 Hugging Face；脚本校验 SHA-256，已验证的文件不会重复下载。模型不包含在 Git 仓库中，各自许可证见 [第三方说明](THIRD_PARTY_NOTICES.txt)。首次运行与模型加载可能较慢。

在系统设置中允许麦克风和辅助功能权限，然后回到目标输入框。开发模式的权限归属可能显示为 Electron；打包后为 REATypeless。界面语言和快捷键均在设置中修改并保存。

macOS 运行依赖优先支持 runtime 目录和环境变量，也从 `/opt/homebrew/bin/whisper-cli`、`/opt/homebrew/bin/llama-server` 和 `/opt/homebrew/bin/ffmpeg` 加载，并支持 PATH。仅复制应用到另一台电脑仍需安装这些依赖。

## 打包和验证

```sh
npm test
npm run test:native
npm run test:integration
npm run dist
```

`npm test` 检查核心逻辑、快捷键和录音流程，不需要模型。原生测试需要 macOS 和 Swift。集成测试使用系统合成语音，不打开麦克风，需要完整模型和运行依赖。

打包命令自动构建原生辅助程序和图标，输出在 `dist/`，并包含本地模型。当前构建未进行 Apple Developer ID 签名与公证。本仓库不提供经过跨机器验证的二进制发行版。面向普通用户的便携安装包、Windows 安装程序和 Intel Mac 验证仍待开发。

## 使用与隐私

在设置中查看或修改当前快捷键；按一次开始录音，再按一次停止。Escape 可取消。关闭主窗口后应用仍留在菜单栏，使用“退出”完全关闭。

音频在本地临时处理，正常处理结束后删除。识别文本、历史记录和设置保存在 Electron 用户数据目录（通常为 `~/Library/Application Support/reatypeless/`），没有额外加密。Ask 模式可以读取选中的文字。自动插入可能使用系统剪贴板。模型下载和依赖安装需要联网，推理在本机执行。

提交问题时请先检查诊断内容，不要附上私人录音、完整历史记录、密码或密钥。简短测试步骤见 [TESTING.txt](TESTING.txt)。

## 依赖检查

Electron 已固定为 43.8.0。当前 npm audit 仍可能报告打包工具经 `global-agent → roarr → sprintf-js` 引入的中等级别拒绝服务问题；它们属于开发/打包依赖，没有打入应用源码的运行依赖中。不要将不可信格式字符串交给这些工具；后续将随上游修复更新锁文件。

## 参与贡献

欢迎提交 issue 和 pull request。请提供系统版本、芯片类型、目标应用、复现步骤与预期结果；涉及光标插入的改动请同时验证按钮和全局快捷键。提交前运行适用测试，不要提交模型、录音、用户数据、生成文件或第三方应用文件。

本项目采用 [MIT License](LICENSE)。这是独立实现，与 Typeless 无隶属或赞助关系；不包含其源码、商标素材或服务凭据。第三方模型及工具不受本项目 MIT 许可证覆盖。

## English

REATypeless is a local voice dictation app with English / Simplified Chinese UI, configurable recorded shortcuts, optional AI polishing, translation, and spoken questions. No account or subscription is required. Whisper Small handles speech recognition; Qwen3 4B handles text generation on your computer.

**Source preview for Windows x64 and Apple Silicon macOS.** Windows requires Windows builds of whisper-cli, FFmpeg, and optionally llama-server in PATH or the runtime directory. Use `npm run build:native` and `npm start`; package with `npm run dist:win`. On Windows, focus the destination first, then start with a shortcut or return to the main window to record. Unsupported inputs fall back to History. Intel Mac has not been validated. Install Node.js 22.12+, Xcode Command Line Tools, and Homebrew in `/opt/homebrew`, then follow the commands above. Downloading models requires approximately 2.5 GB. Grant microphone and accessibility permissions before use.

Automatic insertion depends on the target app's accessibility support. If insertion cannot be confirmed, retrieve the result from History. Recordings are processed locally; saved transcripts are not encrypted. Dependency and model downloads require internet access. Packaged apps still require the external Homebrew runtimes and are not notarized. This repository is an independent MIT-licensed implementation, not affiliated with Typeless; third-party components retain their own licenses.
