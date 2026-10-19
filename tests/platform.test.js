const test = require("node:test"),
  assert = require("node:assert/strict"),
  path = require("node:path");
const { resolveTool, privacyURL } = require("../src/platform");
test("Windows resolves bundled executables, PATH with spaces, and explicit overrides", () => {
  const root = path.resolve("fixture");
  const bundled = path.join(root, "runtime", "whisper-cli.exe");
  assert.equal(
    resolveTool(
      "whisper-cli",
      root,
      "win32",
      { PATH: "C:\\Tools" },
      (p) => p === bundled,
    ),
    bundled,
  );
  const external = path.join("C:\\Tools With Spaces", "ffmpeg.exe");
  assert.equal(
    resolveTool(
      "ffmpeg",
      root,
      "win32",
      { Path: '"C:\\Tools With Spaces";D:\\Other' },
      (p) => p === external,
    ),
    external,
  );
  assert.equal(
    resolveTool(
      "llama-server",
      root,
      "win32",
      { REATYPELESS_LLAMA_SERVER: "D:\\AI\\llama-server.exe" },
      () => false,
    ),
    "D:\\AI\\llama-server.exe",
  );
});
test("macOS retains Homebrew resolution and platform-specific privacy settings", () => {
  assert.equal(
    resolveTool(
      "ffmpeg",
      "/app",
      "darwin",
      {},
      (p) => p === "/opt/homebrew/bin/ffmpeg",
    ),
    "/opt/homebrew/bin/ffmpeg",
  );
  assert.equal(
    privacyURL("microphone", "win32"),
    "ms-settings:privacy-microphone",
  );
  assert.match(privacyURL("accessibility", "darwin"), /Privacy_Accessibility$/);
});
test(
  "Windows helper speaks UTF-8 JSON and simplifies Chinese without capturing input",
  { skip: process.platform !== "win32" },
  async () => {
    const { TargetClient } = require("../src/target-client");
    const client = new TargetClient(path.resolve("native/windows.ps1"));
    try {
      assert.equal((await client.request("status")).status, "ok");
      assert.equal(
        (await client.request("simplify", { text: "繁體中文與語音輸入 😀" }))
          .text,
        "繁体中文与语音输入 😀",
      );
      assert.equal(
        (await client.request("paste", { token: "missing" })).status,
        "closed",
      );
    } finally {
      client.close();
    }
  },
);
