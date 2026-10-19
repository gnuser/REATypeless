// Synthetic smoke comparison, not an estimate of real-world transcription accuracy.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { resolveTool } = require('../src/platform');
const { recognitionArgs } = require('../src/speech');
if (process.platform !== 'darwin') throw Error('This synthetic fixture uses macOS say.');
const root = path.resolve(__dirname, '..');
const dir = path.join(root, 'build', 'speech-eval');
fs.mkdirSync(dir, {recursive:true});
const samples = [
  '请把会议改到明天下午四点半，预算是一千二百五十元，不要删除原来的记录。',
  '这个版本需要修复 inventory 的 bug，再检查 leaderboard 和 settings 页面，最后提交到 main 分支。',
  '嗯，我想说的是，下周三，不对，下周四再发布。先修复快捷键冲突，然后检查光标位置。',
];
const results = [];
for (const [i, expected] of samples.entries()) {
  const audio = path.join(dir, `${i}.aiff`), wav = path.join(dir, `${i}.wav`);
  execFileSync('/usr/bin/say', ['-v','Tingting','-r','180','-o',audio,expected]);
  execFileSync(resolveTool('ffmpeg',root), ['-v','error','-y','-i',audio,'-ar','16000','-ac','1',wav]);
  for (const name of ['ggml-small-q5_1.bin', 'ggml-large-v3-turbo-q5_0.bin']) {
    const out = path.join(dir, `${i}-${name}`), start = Date.now();
    execFileSync(resolveTool('whisper-cli',root), recognitionArgs(path.join(root,'models',name),wav,out,'zh'), {stdio:'ignore',timeout:150000});
    const result = {expected,model:name,seconds:(Date.now()-start)/1000,text:fs.readFileSync(out+'.txt','utf8').trim()};
    results.push(result); console.log(JSON.stringify(result));
  }
}
fs.mkdirSync(path.join(root,'evidence'), {recursive:true});
fs.writeFileSync(path.join(root,'evidence','speech-comparison.json'),JSON.stringify(results,null,2));
