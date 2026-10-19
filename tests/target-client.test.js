const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { PassThrough } = require("node:stream");
const { TargetClient } = require("../src/target-client");

function fixture() {
  const children = [];
  const client = new TargetClient("helper", {
    spawn() {
      const child = new EventEmitter();
      child.stdout = new PassThrough();
      child.stdin = new PassThrough();
      child.kill = () => {};
      children.push(child);
      return child;
    },
  });
  return { client, children };
}

test("late exit from an old helper does not reject a replacement request", async () => {
  const { client, children } = fixture();
  try {
    const first = client.request("status");
    children[0].emit("error", Error("stopped"));
    await assert.rejects(first, /stopped/);
    const second = client.request("status");
    children[0].emit("exit", 1);
    children[1].stdout.write('{"id":2,"status":"ok"}\n');
    assert.equal((await second).status, "ok");
  } finally {
    client.close();
  }
});

test("split UTF-8 responses survive chunk boundaries and close rejects pending work", async () => {
  const { client, children } = fixture();
  const pending = client.request("simplify");
  const bytes = Buffer.from('{"id":1,"text":"你好😀"}\n');
  for (const byte of bytes) children[0].stdout.write(Buffer.from([byte]));
  assert.equal((await pending).text, "你好😀");
  const unfinished = client.request("status");
  client.close();
  await assert.rejects(unfinished, /stopped/);
  assert.equal(client.pending.size, 0);
});
