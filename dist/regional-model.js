/** Cálculos territoriais: histórico, votos restantes e cenários experimentais. Não acessa a tela nem a rede. */
(function (root) {
  const policy =
    root.ResultPolicy ||
    (typeof require === "function" ? require("./result-policy.js") : null);
  root.ResultPolicy = policy;
  const statesByRegion = {
    Norte: ["ac", "am", "ap", "pa", "ro", "rr", "to"],
    Nordeste: ["al", "ba", "ce", "ma", "pb", "pe", "pi", "rn", "se"],
    "Centro-Oeste": ["df", "go", "ms", "mt"],
    Sudeste: ["es", "mg", "rj", "sp"],
    Sul: ["pr", "rs", "sc"],
    Exterior: ["zz"],
  };
  const FRESH_MS = 300000;
  const HISTORY_LIMIT = 120;
  const RECENT_HISTORY_WINDOW = 5;
  const simulationCache = new Map();
  const findRegion = (uf) =>
    Object.keys(statesByRegion).find((k) => statesByRegion[k].includes(uf));
  function parseTerritorialResult(payload, uf, code = null) {
    if (
      String(payload.ele) !== "6258" ||
      String(payload.t) !== "2" ||
      payload.f !== "o" ||
      payload.tpabr !== (code ? "mu" : "uf") ||
      String(payload.cdabr).toLowerCase() !== String(code || uf).toLowerCase()
    ) {
      throw Error("Abrangência ou eleição incorreta");
    }
    const candidates = (payload.carg || [])
      .filter((office) => Number(office.cd) === 1)
      .flatMap((office) =>
        (office.agr || []).flatMap((g) =>
          (g.par || []).flatMap((party) => party.cand || []),
        ),
      );
    if (
      candidates.length !== 2 ||
      !candidates.some((candidate) => candidate.n === "13") ||
      !candidates.some((candidate) => candidate.n === "22")
    ) {
      throw Error("Candidatos inesperados");
    }
    const a = Number(candidates.find((candidate) => candidate.n === "13").vap);
    const b = Number(candidates.find((candidate) => candidate.n === "22").vap);
    const st = Number(payload.s?.st);
    const ts = Number(payload.s?.ts);
    const remaining = Number(payload.e?.esnt);
    if (
      ![a, b, st, ts, remaining].every(
        (n) => Number.isSafeInteger(n) && n >= 0,
      ) ||
      ts === 0 ||
      st > ts
    ) {
      throw Error("Contagens inválidas");
    }
    const [day, month, year] = (payload.dg || "").split("/");
    const time = Date.parse(`${year}-${month}-${day}T${payload.hg}-03:00`);
    if (!Number.isFinite(time)) {
      throw Error("Data inválida");
    }
    return {
      a,
      b,
      st,
      ts,
      p: (st / ts) * 100,
      remaining,
      time,
      label: payload.dg + " " + payload.hg,
      id: String(payload.idg),
      turnout: root.ElectionModel?.turnout(payload),
    };
  }
  function appendSnapshot(history, snapshot) {
    const previousResult = history.at(-1);
    if (previousResult && snapshot.time < previousResult.time) {
      return {
        h: history,
        old: true,
      };
    }
    if (
      previousResult &&
      (snapshot.a < previousResult.a ||
        snapshot.b < previousResult.b ||
        snapshot.st < previousResult.st ||
        snapshot.ts !== previousResult.ts)
    ) {
      return {
        h: [snapshot],
        reset: true,
      };
    }
    if (
      previousResult &&
      snapshot.a === previousResult.a &&
      snapshot.b === previousResult.b &&
      snapshot.st === previousResult.st &&
      snapshot.remaining === previousResult.remaining &&
      JSON.stringify(snapshot.turnout || null) ===
        JSON.stringify(previousResult.turnout || null)
    ) {
      return {
        h: history,
        unchanged: true,
      };
    }
    return {
      h: [...history, snapshot].slice(-HISTORY_LIMIT),
    };
  }
  function estimateFinalVotes(history, method = "recent") {
    const currentResult = history?.at(-1);
    if (!currentResult || !currentResult.st) {
      return null;
    }
    if (currentResult.st === currentResult.ts) {
      return {
        a: currentResult.a,
        b: currentResult.b,
        ra: 0,
        rb: 0,
        rateA: 0,
        rateB: 0,
        current: currentResult,
      };
    }
    const previousResult =
      history[Math.max(0, history.length - RECENT_HISTORY_WINDOW)];
    let rateA;
    let rateB;
    if (method === "average") {
      rateA = currentResult.a / currentResult.st;
      rateB = currentResult.b / currentResult.st;
    } else {
      if (
        !previousResult ||
        previousResult === currentResult ||
        currentResult.st <= previousResult.st ||
        currentResult.a < previousResult.a ||
        currentResult.b < previousResult.b
      ) {
        return null;
      }
      rateA =
        (currentResult.a - previousResult.a) /
        (currentResult.st - previousResult.st);
      rateB =
        (currentResult.b - previousResult.b) /
        (currentResult.st - previousResult.st);
    }
    let remainingVotesA = rateA * (currentResult.ts - currentResult.st);
    let remainingVotesB = rateB * (currentResult.ts - currentResult.st);
    const total = remainingVotesA + remainingVotesB;
    if (!total) {
      return null;
    }
    // Não podemos acrescentar mais votos do que os eleitores ainda não totalizados.
    const electorateLimitFactor = Math.min(1, currentResult.remaining / total);
    remainingVotesA *= electorateLimitFactor;
    remainingVotesB *= electorateLimitFactor;
    return {
      a: currentResult.a + remainingVotesA,
      b: currentResult.b + remainingVotesB,
      ra: remainingVotesA,
      rb: remainingVotesB,
      rateA,
      rateB,
      current: currentResult,
      capped: electorateLimitFactor < 1,
    };
  }
  function createSeededRandom(seed) {
    let x = seed >>> 0;
    return () => {
      x = (1664525 * x + 1013904223) >>> 0;
      return (x + 0.5) / 4294967296;
    };
  }
  function simulateRegionalScenarios(entries, sigma, iterations = 4000) {
    if (!entries.length || entries.some((estimate) => !estimate.est)) {
      return null;
    }
    const key = JSON.stringify([
      sigma,
      iterations,
      entries.map(({ uf, est: estimate }) => [
        uf,
        estimate.ra,
        estimate.rb,
        estimate.current.a,
        estimate.current.b,
        estimate.current.p,
      ]),
    ]);
    if (simulationCache.has(key)) {
      return simulationCache.get(key);
    }
    const random = createSeededRandom(20261025);
    const sampleNormalDistribution = () =>
      Math.sqrt(-2 * Math.log(random())) * Math.cos(2 * Math.PI * random());
    let a = 0;
    let b = 0;
    let tie = 0;
    const shares = [];
    for (let i = 0; i < iterations; i++) {
      const nationalVariation = sampleNormalDistribution();
      const variationByRegion = Object.fromEntries(
        Object.keys(statesByRegion).map((g) => [g, sampleNormalDistribution()]),
      );
      let scenarioVotesA = 0;
      let scenarioVotesB = 0;
      for (const { uf, est: estimate } of entries) {
        const remainingVotes = estimate.ra + estimate.rb;
        const shift =
          (sigma / 100) *
          Math.sqrt(1 - estimate.current.p / 100) *
          (0.5 * nationalVariation +
            Math.sqrt(0.75) * variationByRegion[findRegion(uf)]);
        const share = remainingVotes
          ? Math.max(0, Math.min(1, estimate.ra / remainingVotes + shift))
          : 0;
        scenarioVotesA += estimate.current.a + remainingVotes * share;
        scenarioVotesB += estimate.current.b + remainingVotes * (1 - share);
      }
      if (Math.abs(scenarioVotesA - scenarioVotesB) < 1e-7) {
        tie++;
      } else if (scenarioVotesA > scenarioVotesB) {
        a++;
      } else {
        b++;
      }
      shares.push((100 * scenarioVotesA) / (scenarioVotesA + scenarioVotesB));
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
    if (simulationCache.size > 12) {
      simulationCache.delete(simulationCache.keys().next().value);
    }
    return result;
  }
  root.RegionalModel = {
    groups: statesByRegion,
    region: findRegion,
    parse: parseTerritorialResult,
    append: appendSnapshot,
    estimate: estimateFinalVotes,
    simulate: simulateRegionalScenarios,
    FRESH_MS,
    isComplete: policy.complete,
    usableRegions: policy.usableRegions,
  };
  if (typeof module !== "undefined") {
    module.exports = root.RegionalModel;
  }
})(globalThis);
