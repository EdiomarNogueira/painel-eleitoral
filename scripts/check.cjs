"use strict";

// Sem dependências de teste: este comando usa somente o Node.js.
const { spawnSync } = require("node:child_process");
const { readdirSync } = require("node:fs");
const path = require("node:path");
const projectRoot = path.resolve(__dirname, "..");

function runNode(commandArguments) {
  const result = spawnSync(process.execPath, commandArguments, {
    cwd: projectRoot,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

runNode(["scripts/validate-data.cjs"]);

const browserScripts = readdirSync(path.join(projectRoot, "dist")).filter(
  (filename) => filename.endsWith(".js"),
);
for (const filename of browserScripts) {
  runNode(["--check", path.join("dist", filename)]);
}

const testFiles = readdirSync(projectRoot)
  .filter((filename) => /^test-.*\.cjs$/.test(filename))
  .sort();
for (const filename of testFiles) {
  console.log(`\nVerificando ${filename}`);
  runNode([filename]);
}
console.log(
  `\nConcluído: ${browserScripts.length} scripts com sintaxe válida e ${testFiles.length} arquivos de teste aprovados.`,
);
