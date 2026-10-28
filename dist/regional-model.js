(function (root) {
  const policy =
    root.ResultPolicy ||
    (typeof require === "function" ? require("./result-policy.js") : null);
  root.ResultPolicy = policy;
  const groups = {
    Norte: ["ac", "am", "ap", "pa", "ro", "rr", "to"],
    Nordeste: ["al", "ba", "ce", "ma", "pb", "pe", "pi", "rn", "se"],
    "Centro-Oeste": ["df", "go", "ms", "mt"],
    Sudeste: ["es", "mg", "rj", "sp"],
    Sul: ["pr", "rs", "sc"],
    Exterior: ["zz"],
  };
  const FRESH_MS = 300000,
    simulationCache = new Map();
  const region = (uf) =>
    Object.keys(groups).find((k) => groups[k].includes(uf));
  function parse(d, uf, code = null) {
    if (
      String(d.ele) !== "6258" ||
      String(d.t) !== "2" ||
      d.f !== "o" ||
      d.tpabr !== (code ? "mu" : "uf") ||
      String(d.cdabr).toLowerCase() !== String(code || uf).toLowerCase()
    )
      throw Error("Abrangência ou eleição incorreta");
    const cs = (d.carg || [])
      .filter((c) => Number(c.cd) === 1)
      .flatMap((c) =>
        (c.agr || []).flatMap((g) =>
          (g.par || []).flatMap((p) => p.cand || []),
        ),
      );
    if (
      cs.length !== 2 ||
      !cs.some((c) => c.n === "13") ||
      !cs.some((c) => c.n === "22")
    )
      throw Error("Candidatos inesperados");
    const a = Number(cs.find((c) => c.n === "13").vap),
      b = Number(cs.find((c) => c.n === "22").vap),
      st = Number(d.s?.st),
      ts = Number(d.s?.ts),
      remaining = Number(d.e?.esnt);
    if (
      ![a, b, st, ts, remaining].every(
        (n) => Number.isSafeInteger(n) && n >= 0,
      ) ||
      ts === 0 ||
      st > ts
    )
      throw Error("Contagens inválidas");
    const [day, month, year] = (d.dg || "").split("/"),
      time = Date.parse(`${year}-${month}-${day}T${d.hg}-03:00`);
    if (!Number.isFinite(time)) throw Error("Data inválida");
    return {
      a,
      b,
      st,
      ts,
      p: (st / ts) * 100,
      remaining,
      time,
      label: d.dg + " " + d.hg,
      id: String(d.idg),
      turnout: root.ElectionModel?.turnout(d),
    };
  }
  function append(h, s) {
    const p = h.at(-1);
    if (p && s.time < p.time) return { h, old: true };
    if (p && (s.a < p.a || s.b < p.b || s.st < p.st || s.ts !== p.ts))
      return { h: [s], reset: true };
    if (
      p &&
      s.a === p.a &&
      s.b === p.b &&
      s.st === p.st &&
      s.remaining === p.remaining &&
      JSON.stringify(s.turnout || null) === JSON.stringify(p.turnout || null)
    )
      return { h, unchanged: true };
    return { h: [...h, s].slice(-120) };
  }
  function estimate(h, method = "recent") {
    const c = h?.at(-1);
    if (!c || !c.st) return null;
    if (c.st === c.ts)
      return { a: c.a, b: c.b, ra: 0, rb: 0, rateA: 0, rateB: 0, current: c };
    const old = h[Math.max(0, h.length - 5)];
    let rateA, rateB;
    if (method === "average") {
      rateA = c.a / c.st;
      rateB = c.b / c.st;
    } else {
      if (!old || old === c || c.st <= old.st || c.a < old.a || c.b < old.b)
        return null;
      rateA = (c.a - old.a) / (c.st - old.st);
      rateB = (c.b - old.b) / (c.st - old.st);
    }
    let ra = rateA * (c.ts - c.st),
      rb = rateB * (c.ts - c.st);
    const total = ra + rb;
    if (!total) return null;
    const cap = Math.min(1, c.remaining / total);
    ra *= cap;
    rb *= cap;
    return {
      a: c.a + ra,
      b: c.b + rb,
      ra,
      rb,
      rateA,
      rateB,
      current: c,
      capped: cap < 1,
    };
  }
  function rng(seed) {
    let x = seed >>> 0;
    return () => {
      x = (1664525 * x + 1013904223) >>> 0;
      return (x + 0.5) / 4294967296;
    };
  }
  function simulate(entries, sigma, iterations = 4000) {
    if (!entries.length || entries.some((e) => !e.est)) return null;
    const key = JSON.stringify([
      sigma,
      iterations,
      entries.map(({ uf, est: e }) => [
        uf,
        e.ra,
        e.rb,
        e.current.a,
        e.current.b,
        e.current.p,
      ]),
    ]);
    if (simulationCache.has(key)) return simulationCache.get(key);
    const rand = rng(20261025),
      normal = () =>
        Math.sqrt(-2 * Math.log(rand())) * Math.cos(2 * Math.PI * rand());
    let a = 0,
      b = 0,
      tie = 0;
    const shares = [];
    for (let i = 0; i < iterations; i++) {
      const common = normal(),
        regional = Object.fromEntries(
          Object.keys(groups).map((g) => [g, normal()]),
        );
      let va = 0,
        vb = 0;
      for (const { uf, est: e } of entries) {
        const rem = e.ra + e.rb;
        const shift =
          (sigma / 100) *
          Math.sqrt(1 - e.current.p / 100) *
          (0.5 * common + Math.sqrt(0.75) * regional[region(uf)]);
        const share = rem ? Math.max(0, Math.min(1, e.ra / rem + shift)) : 0;
        va += e.current.a + rem * share;
        vb += e.current.b + rem * (1 - share);
      }
      if (Math.abs(va - vb) < 1e-7) tie++;
      else if (va > vb) a++;
      else b++;
      shares.push((100 * va) / (va + vb));
    }
    shares.sort((x, y) => x - y);
    const result = {
      a: (100 * a) / iterations,
      b: (100 * b) / iterations,
      tie: (100 * tie) / iterations,
      low: shares[Math.floor(iterations * 0.05)],
      high: shares[Math.floor(iterations * 0.95)],
      iterations,
    };
    simulationCache.set(key, result);
    if (simulationCache.size > 12)
      simulationCache.delete(simulationCache.keys().next().value);
    return result;
  }
  root.RegionalModel = {
    groups,
    region,
    parse,
    append,
    estimate,
    simulate,
    FRESH_MS,
    isComplete: policy.complete,
    usableRegions: policy.usableRegions,
  };
  if (typeof module !== "undefined") module.exports = root.RegionalModel;
})(globalThis);
