const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const fs = require('node:fs');
const path = require('node:path');
const { polishWithCodex } = require('../src/codex-polish');
function fakeProcess(action) {
  let folder, killed = false;
  return {
    spawn(exe, args, opts) {
      assert.equal(opts.shell, undefined);
      assert.ok(args.includes('--ignore-user-config'));
      assert.ok(args.includes('--ephemeral'));
      folder = args[args.indexOf('-C') + 1];
      const child = new EventEmitter();
      child.stdin = new PassThrough(); child.stderr = new PassThrough();
      child.kill = () => { killed = true; setImmediate(() => child.emit('close', 1)); };
      let prompt = '';
      child.stdin.on('data', data => { prompt += data; });
      child.stdin.on('finish', () => action(child, args, prompt));
      return child;
    },
    get folder() { return folder; },
    get killed() { return killed; },
  };
}
test('Codex returns only result file and removes temporary transcript artifacts', async () => {
  const fake = fakeProcess((child,args,prompt) => {
    assert.ok(prompt.includes(JSON.stringify('嗯，明天三点，不对四点开会。')));
    fs.writeFileSync(args[args.indexOf('--output-last-message')+1], '明天四点开会。');
    child.stderr.write('private debug text'); child.emit('close', 0);
  });
  assert.equal(await polishWithCodex('嗯，明天三点，不对四点开会。', null, fake), '明天四点开会。');
  assert.equal(fs.existsSync(fake.folder), false);
});
test('cancel kills Codex and does not return late output', async () => {
  const controller = new AbortController();
  const fake = fakeProcess(() => controller.abort());
  await assert.rejects(polishWithCodex('测试', controller.signal, fake), /Cancelled/);
  assert.ok(fake.killed); assert.equal(fs.existsSync(fake.folder), false);
});
test('timeout and empty response preserve failure rather than fabricated text', async () => {
  const hung = fakeProcess(() => {});
  await assert.rejects(polishWithCodex('测试', null, {...hung, timeout: 10}), /timed out/);
  const empty = fakeProcess((child,args) => {
    fs.writeFileSync(args[args.indexOf('--output-last-message')+1], ' '); child.emit('close', 0);
  });
  await assert.rejects(polishWithCodex('测试', null, empty), /invalid result/);
});
