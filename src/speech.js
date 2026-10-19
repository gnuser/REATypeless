"use strict";
const fs = require("node:fs");
const path = require("node:path");
function speechModel(resources, settings = {}, exists = fs.existsSync) {
  const turbo = path.join(resources, "models", "ggml-large-v3-turbo-q5_0.bin");
  const small = path.join(resources, "models", "ggml-small-q5_1.bin");
  return settings.speechModel !== "small" && exists(turbo) ? turbo : small;
}
function recognitionArgs(model, wav, out, language, dictionary = []) {
  const terms = dictionary.map(w => w.to).filter(Boolean).join(", ").slice(0, 800);
  const args = ["-m", model, "-f", wav, "-l", language || "auto", "-otxt", "-of", out, "-nt", "-t", "6", "-bs", "5", "-bo", "5"];
  if (terms) args.push("--prompt", terms);
  return args;
}
module.exports = { speechModel, recognitionArgs };
