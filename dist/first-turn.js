/** Demonstração: cria etapas simuladas a partir do primeiro turno consolidado. */
(function (root) {
  function createDemoSnapshot(base, progress) {
    if (!base || !Number.isFinite(progress) || progress < 0 || progress > 100) {
      throw Error("Base ou avanço inválido");
    }
    const totalSections = Number(base.s.ts);
    const counted = Number(base.s.st);
    if (totalSections !== counted) {
      throw Error(
        "A demonstração exige a totalização completa do primeiro turno",
      );
    }
    const countedFraction = progress / 100;
    const candidateA = base.candidates.find((c) => c.id === "13");
    const candidateB = base.candidates.find((c) => c.id === "22");
    if (!candidateA || !candidateB) {
      throw Error("Candidatos ausentes");
    }
    const participation = ElectionModel.turnout(base);
    const turnout = Object.fromEntries(
      Object.entries(participation).map(([k, v]) => [
        k,
        v === null
          ? null
          : k === "electorate"
            ? v
            : Math.round(v * countedFraction),
      ]),
    );
    return {
      a: candidateA.votes * countedFraction,
      b: candidateB.votes * countedFraction,
      p: progress,
      st: totalSections * countedFraction,
      ts: totalSections,
      total: totalSections,
      counted: totalSections * countedFraction,
      remaining: Math.round(Number(base.e.te) * (1 - countedFraction)),
      turnout,
      otherVotes: Math.round(
        base.candidates
          .filter((c) => !["13", "22"].includes(c.id))
          .reduce((s, c) => s + c.votes, 0) * countedFraction,
      ),
      time: 0,
      label: "Etapa simulada · " + progress.toLocaleString("pt-BR") + "%",
      date: base.date,
      sourceDate: base.date,
      sourceTime: base.time,
    };
  }
  function getFinalistNames(base) {
    return ["13", "22"].map((id) => {
      const c = base.candidates.find((c) => c.id === id);
      return {
        id,
        name: c.name,
        party: c.party,
      };
    });
  }
  root.FirstTurn = {
    snapshot: createDemoSnapshot,
    pairNames: getFinalistNames,
  };
  if (typeof module !== "undefined") {
    module.exports = root.FirstTurn;
  }
})(globalThis);
