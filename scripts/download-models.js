'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const models = [
  ['ggml-large-v3-turbo-q5_0.bin', 'https://huggingface.co/ggerganov/whisper.cpp/resolve/98aa99a0a9db05ae2342309f5096248665f7cba3/ggml-large-v3-turbo-q5_0.bin', '394221709cd5ad1f40c46e6031ca61bce88931e6e088c188294c6d5a55ffa7e2'],
  ['ggml-small-q5_1.bin', 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small-q5_1.bin', 'ae85e4a935d7a567bd102fe55afc16bb595bdb618e11b2fc7591bc08120411bb'],
  ['Qwen3-4B-Q4_K_M.gguf', 'https://huggingface.co/Qwen/Qwen3-4B-GGUF/resolve/main/Qwen3-4B-Q4_K_M.gguf', '7485fe6f11af29433bc51cab58009521f205840f5b4ae3a32fa7f92e8534fdf5'],
];
async function digest(file) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
async function main() {
  const directory = path.resolve(__dirname, '../models');
  fs.mkdirSync(directory, { recursive: true });
  for (const [name, url, expected] of models) {
    const destination = path.join(directory, name);
    if (fs.existsSync(destination) && await digest(destination) === expected) {
      console.log(`Verified ${name}`);
      continue;
    }
    const temporary = `${destination}.${process.pid}.part`;
    try {
      console.log(`Downloading ${name} (this may take several minutes)…`);
      const response = await fetch(url);
      if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}: ${name}`);
      await pipeline(Readable.fromWeb(response.body), fs.createWriteStream(temporary, { flags: 'wx' }));
      if (await digest(temporary) !== expected) throw new Error(`Checksum mismatch: ${name}`);
      fs.renameSync(temporary, destination);
      console.log(`Verified ${name}`);
    } finally {
      fs.rmSync(temporary, { force: true });
    }
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
