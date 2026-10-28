/** Agregações da visão simples. Ausência de dados é diferente de zero votos. */
(function (root) {
  function aggregateLatestResults(histories) {
    const latestResults = Object.values(histories).map((x) => x.at(-1));
    if (!latestResults.length) {
      return null;
    }
    const sumField = (k) => latestResults.reduce((n, v) => n + (v[k] || 0), 0);
    const ts = sumField("ts");
    const st = sumField("st");
    const participationFields = [
      "electorate",
      "covered",
      "attended",
      "abstained",
      "totalVotes",
      "valid",
      "blank",
      "nullVotes",
      "technicalNull",
    ];
    return {
      a: sumField("a"),
      b: sumField("b"),
      p: ts ? (100 * st) / ts : 0,
      ts,
      st,
      turnout: Object.fromEntries(
        participationFields.map((k) => [
          k,
          latestResults.some((v) => v.turnout?.[k] == null)
            ? null
            : latestResults.reduce((n, v) => n + v.turnout[k], 0),
        ]),
      ),
    };
  }
  function buildRegionalRows(histories, entries) {
    return Object.entries(root.RegionalModel.groups).map(([name, ufs]) => {
      const loadedResults = ufs
        .map((uf) => histories[uf]?.at(-1))
        .filter(Boolean);
      const availableEstimates = entries.filter(
        (e) => ufs.includes(e.uf) && e.est,
      );
      const allStatesLoaded = loadedResults.length === ufs.length;
      const allEstimatesAvailable = availableEstimates.length === ufs.length;
      const countedTotals = loadedResults.reduce(
        (s, v) => ({
          a: s.a + v.a,
          b: s.b + v.b,
          st: s.st + v.st,
          ts: s.ts + v.ts,
        }),
        {
          a: 0,
          b: 0,
          st: 0,
          ts: 0,
        },
      );
      const projectedTotals = availableEstimates.reduce(
        (s, v) => ({
          a: s.a + v.est.a,
          b: s.b + v.est.b,
        }),
        {
          a: 0,
          b: 0,
        },
      );
      return {
        name,
        ...countedTotals,
        p:
          allStatesLoaded && countedTotals.ts
            ? (countedTotals.st / countedTotals.ts) * 100
            : null,
        ready: allEstimatesAvailable,
        all: allStatesLoaded,
        finalA: allEstimatesAvailable ? projectedTotals.a : null,
        finalB: allEstimatesAvailable ? projectedTotals.b : null,
        remaining: allEstimatesAvailable
          ? Math.max(
              0,
              projectedTotals.a +
                projectedTotals.b -
                countedTotals.a -
                countedTotals.b,
            )
          : null,
      };
    });
  }
  function canProjectNationalResult(
    histories,
    entries,
    demo,
    now = Date.now(),
  ) {
    if (entries.length !== 28 || entries.some((e) => !e.est)) {
      return false;
    }
    if (demo) {
      return true;
    }
    const latestResults = Object.values(histories).map((h) => h.at(-1));
    return root.RegionalModel.usableRegions(
      latestResults,
      now,
      root.RegionalModel.FRESH_MS,
    );
  }
  const api = {
    aggregate: aggregateLatestResults,
    regionRows: buildRegionalRows,
    eligible: canProjectNationalResult,
    FRESH_MS: root.RegionalModel.FRESH_MS,
  };
  root.SimpleModel = api;
  if (typeof module !== "undefined") {
    module.exports = api;
  }
})(globalThis);
