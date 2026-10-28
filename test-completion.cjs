const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const P = require("./dist/result-policy");
global.ElectionModel = require("./dist/model");
const R = require("./dist/regional-model");
global.RegionalModel = R;
const S = require("./dist/simples-model");
const C = require("./dist/comparativo-model");

assert.equal(P.complete({ s: { st: "0", ts: "0" } }), false);
assert.equal(P.complete({ st: 99999, ts: 100000, p: 100 }), false);
assert.equal(P.complete({ s: { st: "10", ts: "10" } }), true);
assert.equal(P.complete({ counted: 10, total: 10 }), true);
assert.equal(P.complete({ st: 11, ts: 10 }), false);

const now = Date.now();
const finished = Object.values(R.groups)
  .flat()
  .map((uf, index) => ({
    uf,
    st: 10,
    ts: 10,
    a: 60,
    b: 40,
    remaining: 0,
    time: now - index * 3600000,
    received: now - 86400000,
  }));
const histories = Object.fromEntries(finished.map((s) => [s.uf, [s]]));
const estimates = finished.map((s) => ({ uf: s.uf, est: R.estimate([s]) }));
assert.ok(
  S.eligible(histories, estimates, false, now),
  "Completed regions remain usable with different old closing times",
);
assert.ok(
  estimates.every(
    (e) => e.est.ra === 0 && e.est.rb === 0 && e.est.a === 60 && e.est.b === 40,
  ),
);
const mixed = structuredClone(finished);
mixed[0].st = 9;
mixed[0].received = now;
mixed[0].time = now;
assert.ok(P.usableRegions(mixed, now));
mixed[0].received = now - 300001;
assert.equal(P.usableRegions(mixed, now), false);
assert.equal(P.usableRegions(finished.slice(1), now), false);

(async () => {
  const raw = JSON.parse(fs.readFileSync("test-uf.json", "utf8"));
  // A synthetic finalized file only for cache tests, never displayed in the site.
  raw.s.st = raw.s.ts;
  raw.e.esnt = "0";
  let clock = Date.now(),
    requests = 0;
  const ctx = {
    ComparativoModel: C,
    AbortSignal,
    Date: { now: () => clock },
    fetch: async () => {
      requests++;
      return { ok: true, json: async () => structuredClone(raw) };
    },
  };
  vm.runInNewContext(fs.readFileSync("dist/tse-store.js", "utf8"), ctx);
  const address = ctx.TSEStore.url(2, String(raw.cdabr).toLowerCase());
  await ctx.TSEStore.getURL(address);
  clock += 86400000;
  await ctx.TSEStore.getURL(address);
  assert.equal(
    requests,
    1,
    "Second-turn complete snapshots must never be polled again",
  );
  console.log(
    "Encerramento: igualdade exata de seções, validade permanente, ausência de crescimento e cache final sem nova consulta verificados.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
