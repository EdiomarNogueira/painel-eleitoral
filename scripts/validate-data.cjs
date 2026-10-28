"use strict";
const fs = require("node:fs");
const path = require("node:path");
const projectRoot = path.resolve(__dirname, "..");
let validatedFiles = 0;

function validateDirectory(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      validateDirectory(filename);
    } else if (filename.endsWith(".json")) {
      const source = fs.readFileSync(filename, "utf8");
      const relativePath = path.relative(projectRoot, filename);
      if (/^(<<<<<<< |=======\s*$|>>>>>>> )/m.test(source)) {
        throw Error(`Conflito Git não resolvido: ${relativePath}`);
      }
      try {
        JSON.parse(source);
      } catch (error) {
        throw Error(`JSON inválido em ${relativePath}: ${error.message}`);
      }
      validatedFiles++;
    }
  }
}

validateDirectory(path.join(projectRoot, "dist"));
validateDirectory(path.join(projectRoot, "data-first-turn"));
console.log(`${validatedFiles} arquivos JSON válidos, sem conflitos Git.`);
