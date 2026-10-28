const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const policy = require("./dist/result-policy");
const model = require("./dist/model");
const regional = require("./dist/regional-model");
const raw = JSON.parse(fs.readFileSync("test-uf.json", "utf8"));
raw.s.st = raw.s.ts;
raw.e.esnt = "0";
const uf = String(raw.cdabr).toLowerCase();
let calls = [];
const context = {
  ResultPolicy: policy,
  ElectionModel: model,
  RegionalModel: regional,
  URL,
  Response,
  Date,
  window: {
    location: { href: "http://localhost/simples.html", protocol: "http:" },
    fetch: async (address) => {
      calls.push(String(address));
      return new Response(
        JSON.stringify(
          String(address).includes("manifest.json")
            ? { checkedAt: "2026-10-27T00:00:00Z" }
            : raw,
        ),
      );
    },
  },
};
vm.runInNewContext(fs.readFileSync("dist/tse-client.js", "utf8"), context);
(async () => {
  const url = `https://resultados.tse.jus.br/oficial/ele2026/6258/dados/${uf}/${uf}-c0001-e006258-u.json`;
  await (await context.window.fetch(url)).json();
  const count = calls.length;
  await (await context.window.fetch(url)).json();
  assert.equal(
    calls.length,
    count,
    "Completed individual requests use memory before reading the manifest or data file",
  );
  assert.equal(calls.filter((u) => u.includes("-u.json")).length, 1);
  console.log(
    "Cliente: resultado individual completo reutilizado antes de qualquer consulta de rede.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
