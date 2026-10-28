/** Resultado nacional: valida o arquivo do TSE e calcula a projeção a partir do histórico. */
(function (root) {
  function projectFinalVotes(history, method = "recent") {
    const currentResult = history.at(-1);
    if (!currentResult || currentResult.p <= 0) {
      return null;
    }
    if (currentResult.p === 100) {
      return [currentResult.a, currentResult.b];
    }
    if (method === "average") {
      return [
        (currentResult.a * 100) / currentResult.p,
        (currentResult.b * 100) / currentResult.p,
      ];
    }
    const previousResult = history[Math.max(0, history.length - 5)];
    if (
      previousResult === currentResult ||
      currentResult.p <= previousResult.p ||
      currentResult.a < previousResult.a ||
      currentResult.b < previousResult.b
    ) {
      return null;
    }
    return [
      currentResult.a +
        ((currentResult.a - previousResult.a) /
          (currentResult.p - previousResult.p)) *
          (100 - currentResult.p),
      currentResult.b +
        ((currentResult.b - previousResult.b) /
          (currentResult.p - previousResult.p)) *
          (100 - currentResult.p),
    ];
  }
  function readParticipation(payload) {
    const readNonNegativeCount = (x) =>
      x !== undefined &&
      x !== null &&
      x !== "" &&
      Number.isSafeInteger(Number(x)) &&
      Number(x) >= 0
        ? Number(x)
        : null;
    const electorate = payload.e || {};
    const votes = payload.v || {};
    return {
      electorate: readNonNegativeCount(electorate.te),
      covered: readNonNegativeCount(electorate.esi),
      attended: readNonNegativeCount(electorate.c),
      abstained: readNonNegativeCount(electorate.a),
      totalVotes: readNonNegativeCount(votes.tv),
      valid: readNonNegativeCount(votes.vv),
      blank: readNonNegativeCount(votes.vb),
      nullVotes: readNonNegativeCount(votes.tvn),
      technicalNull: readNonNegativeCount(votes.vnt),
    };
  }
  function parseNationalResult(payload) {
    if (
      String(payload.ele) !== "6258" ||
      String(payload.t) !== "2" ||
      payload.f !== "o" ||
      payload.cdabr !== "br"
    ) {
      throw Error("Arquivo não corresponde à eleição oficial esperada.");
    }
    const cargo = payload.carg?.find((c) => Number(c.cd) === 1);
    const candidates = (cargo?.agr || [])
      .flatMap((g) =>
        (g.par || []).flatMap((p) =>
          (p.cand || []).map((c) => ({
            id: String(c.n),
            name: c.nmu || c.nm,
            party: p.sg,
            votes: Number(c.vap),
          })),
        ),
      )
      .sort((a, b) => Number(a.id) - Number(b.id));
    const total = Number(payload.s?.ts);
    const counted = Number(payload.s?.st);
    if (
      candidates.length !== 2 ||
      candidates.some(
        (c) => !Number.isSafeInteger(c.votes) || c.votes < 0 || !c.name,
      ) ||
      !Number.isSafeInteger(total) ||
      total <= 0 ||
      !Number.isSafeInteger(counted) ||
      counted < 0 ||
      counted > total ||
      !payload.dg ||
      !payload.hg
    ) {
      throw Error(
        "Formato inesperado. Projeção suspensa para evitar dados incorretos.",
      );
    }
    const [day, month, year] = payload.dg.split("/");
    const timestamp = Date.parse(`${year}-${month}-${day}T${payload.hg}-03:00`);
    if (!Number.isFinite(timestamp)) {
      throw Error("Data do arquivo inválida.");
    }
    return {
      candidates,
      total,
      counted,
      p: (counted / total) * 100,
      a: candidates[0].votes,
      b: candidates[1].votes,
      id: String(payload.idg),
      timestamp,
      label: payload.hg,
      date: payload.dg,
      turnout: readParticipation(payload),
    };
  }
  root.ElectionModel = {
    project: projectFinalVotes,
    parseTSE: parseNationalResult,
    turnout: readParticipation,
  };
  if (typeof module !== "undefined") {
    module.exports = root.ElectionModel;
  }
})(globalThis);
