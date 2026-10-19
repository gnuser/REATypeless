const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { speechModel, recognitionArgs } = require('../src/speech');
test('accuracy chooses installed Turbo, supports old installs and explicit Small', () => {
  assert.match(speechModel('/app', {}, () => true), /large-v3-turbo/);
  assert.match(speechModel('/app', {}, () => false), /small/);
  assert.match(speechModel('/app', {speechModel:'small'}, () => true), /small/);
});
test('recognition preserves chosen language and bounded dictionary hints without translation', () => {
  const args = recognitionArgs('model', 'audio', 'out', 'zh', [{to:'API'}, {to:'项目'.repeat(1000)}]);
  assert.equal(args[args.indexOf('-l')+1], 'zh');
  assert.equal(args[args.indexOf('--prompt')+1].length, 800);
  assert.ok(!args.includes('--translate'));
  assert.ok(!recognitionArgs('m','w','o','auto').includes('--prompt'));
});
