const assert = require("node:assert/strict"),
  fs = require("node:fs"),
  vm = require("node:vm");
global.ElectionModel = require("./dist/model");
const M = require("./dist/comparativo-model");
const raw = require("./data-first-turn/br.json"),
  first = M.raw(raw, { turn: 1, scope: "br", area: "br" });
assert.equal(first.a, 53879538);
assert.equal(first.b, 56104503);
assert.equal(first.p, 100);
const simple = (a, b, valid, st = 100) =>
  M.base({
    candidates: [
      { id: "13", votes: a },
      { id: "22", votes: b },
    ],
    s: { st, ts: 100 },
    e: { te: 1200, esi: 1000, c: 900, a: 100 },
    v: { tv: 900, vv: valid, vb: 40, tvn: 60 },
    date: "25/10/2026",
    time: "18:00:00",
  });
const a = simple(300, 200, 800),
  b = simple(480, 320, 800);
let c = M.compare(a, b, true);
assert.equal(c.candidates[0].p1, 60);
assert.equal(c.candidates[0].p2, 60);
assert.equal(c.candidates[0].pp, 0);
assert.equal(c.candidates[0].absolute, 180);
assert.equal(c.candidates[0].relative, 60);
c = M.compare(a, b, false);
assert.equal(c.candidates[0].p1, 37.5);
assert.equal(c.candidates[0].pp, 22.5);
const p = simple(120, 80, 200, 25);
assert.equal(M.compare(a, p).partial, true);
assert.equal(M.compare(a, p).candidates[0].absolute, -180);
assert.equal(M.compare(a, simple(0, 0, 0, 0)).candidates[0].absolute, null);
assert.equal(M.delta(0, 20).relative, null);
assert.equal(M.delta(10, null).absolute, null);
assert.equal(M.compare(a, null).candidates[0].b, null);
assert.equal(
  M.compare(a, b).participation.find((x) => x.name === "Comparecimento").p1,
  90,
);
assert.equal(M.aggregate([a, null]), null);
assert.equal(M.aggregate([a, b]).a, 780);
const incomplete = structuredClone(a);
incomplete.t.abstained = null;
assert.equal(M.aggregate([incomplete, b]).t.abstained, null);
assert.throws(
  () => M.raw(raw, { turn: 2, scope: "br", area: "br" }),
  /não corresponde/,
);
assert.throws(
  () => M.raw(raw, { turn: 1, scope: "uf", area: "sp" }),
  /não corresponde/,
);
// Every cached municipal and state base must be usable without mutating it.
const ctx = { window: {} };
for (const name of ["first-turn-data", "first-turn-cities"])
  vm.runInNewContext(fs.readFileSync("dist/" + name + ".js", "utf8"), ctx);
for (const base of [
  ...Object.values(ctx.window.FIRST_TURN_CITIES),
  ...Object.values(ctx.window.FIRST_TURN_DATA.ufs),
]) {
  const before = JSON.stringify(base);
  assert.equal(M.base(base).p, 100);
  assert.equal(JSON.stringify(base), before);
}
(async () => {
  let calls = 0,
    clock = 100000,
    payload = structuredClone(raw);
  payload.ele = "6258";
  payload.t = "2";
  payload.carg[0].agr = payload.carg[0].agr.map((g) => ({
    ...g,
    par: g.par.map((p) => ({
      ...p,
      cand: p.cand.filter((c) => ["13", "22"].includes(c.n)),
    })),
  }));
  payload.v.vv = String(first.a + first.b);
  payload.s.st = "100";
  const sandbox = {
    ComparativoModel: M,
    AbortSignal,
    Date: { now: () => clock },
    fetch: async () => {
      calls++;
      return { ok: true, json: async () => structuredClone(payload) };
    },
  };
  vm.runInNewContext(fs.readFileSync("dist/tse-store.js", "utf8"), sandbox);
  const store = sandbox.TSEStore,
    url = store.url(2);
  let events = 0;
  store.subscribe(() => events++);
  await Promise.all([store.getURL(url), store.getURL(url)]);
  assert.equal(calls, 1);
  assert.equal(events, 1);
  await store.getURL(url);
  assert.equal(calls, 1);
  clock += 300001;
  payload.dg = "04/10/2026";
  await assert.rejects(store.getURL(url), /anterior/);
  assert.equal(events, 1);
  assert.equal(store.peek(url).date, "05/10/2026");
  clock += 300001;
  payload.dg = "06/10/2026";
  payload.carg[0].agr[0].par[0].cand[0].vap = "invalid";
  await assert.rejects(store.getURL(url));
  assert.equal(events, 1);
  console.log(
    "Comparativo: bases oficiais, fórmulas, pontos percentuais, parciais, ausências, países, deduplicação e rejeição de leituras inválidas verificados.",
  );
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
