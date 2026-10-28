/** Cenário regional: altera apenas votos ainda não contados e conserva o total projetado. */
(function (root) {
  function sumProjectedVotes(entries) {
    return entries.reduce(
      (s, { est: estimate }) => ({
        a: s.a + estimate.a,
        b: s.b + estimate.b,
      }),
      {
        a: 0,
        b: 0,
      },
    );
  }
  function calculateRegionLimits(entries, region) {
    if (!entries.length || entries.some((estimate) => !estimate.est)) {
      return {
        error: "Faltam dados para projetar todas as regiões.",
      };
    }
    const selectedStates = entries.filter(
      (estimate) => root.RegionalModel.region(estimate.uf) === region,
    );
    if (!selectedStates.length) {
      return {
        error: "Escolha uma região válida.",
      };
    }
    const projectedVotes = sumProjectedVotes(selectedStates);
    const total = projectedVotes.a + projectedVotes.b;
    const countedVotesA = selectedStates.reduce(
      (s, estimate) => s + estimate.est.current.a,
      0,
    );
    const countedVotesB = selectedStates.reduce(
      (s, estimate) => s + estimate.est.current.b,
      0,
    );
    if (total <= 0) {
      return {
        error: "A região ainda não tem votos suficientes para calcular.",
      };
    }
    return {
      min: (100 * countedVotesA) / total,
      max: (100 * (total - countedVotesB)) / total,
      share: (100 * projectedVotes.a) / total,
      total,
      projected: projectedVotes,
    };
  }
  function applyRegionalShare(entries, region, share) {
    if (!entries.length || entries.some((estimate) => !estimate.est)) {
      return {
        error: "Faltam dados para projetar todas as regiões.",
      };
    }
    if (!Number.isFinite(share) || share < 0 || share > 100) {
      return {
        error: "Informe uma porcentagem de 0 a 100.",
      };
    }
    const selectedStates = entries.filter(
      (estimate) => root.RegionalModel.region(estimate.uf) === region,
    );
    if (!selectedStates.length) {
      return {
        error: "Escolha uma região válida.",
      };
    }
    const regionLimits = calculateRegionLimits(entries, region);
    if (regionLimits.error) {
      return regionLimits;
    }
    const regionalProjection = sumProjectedVotes(selectedStates);
    const total = regionalProjection.a + regionalProjection.b;
    const countedVotesA = selectedStates.reduce(
      (s, estimate) => s + estimate.est.current.a,
      0,
    );
    const countedVotesB = selectedStates.reduce(
      (s, estimate) => s + estimate.est.current.b,
      0,
    );
    const remainingVotes = selectedStates.reduce(
      (s, estimate) => s + estimate.est.ra + estimate.est.rb,
      0,
    );
    const { min, max } = regionLimits;
    const targetVotesA = (total * share) / 100;
    if (
      targetVotesA < countedVotesA - 1e-6 ||
      targetVotesA > total - countedVotesB + 1e-6
    ) {
      return {
        error:
          "Esse percentual exigiria retirar votos já contados. Escolha um valor dentro dos limites indicados.",
        min,
        max,
      };
    }
    const remainingShareA = remainingVotes
      ? Math.max(
          0,
          Math.min(1, (targetVotesA - countedVotesA) / remainingVotes),
        )
      : 0;
    const updatedEntries = entries.map((item) => {
      if (root.RegionalModel.region(item.uf) !== region) {
        return item;
      }
      const estimate = item.est;
      const remainingVotesInState = estimate.ra + estimate.rb;
      const additionalVotesA = remainingVotesInState * remainingShareA;
      const additionalVotesB = remainingVotesInState - additionalVotesA;
      return {
        ...item,
        est: {
          ...estimate,
          ra: additionalVotesA,
          rb: additionalVotesB,
          a: estimate.current.a + additionalVotesA,
          b: estimate.current.b + additionalVotesB,
        },
      };
    });
    return {
      entries: updatedEntries,
      before: sumProjectedVotes(entries),
      after: sumProjectedVotes(updatedEntries),
      min,
      max,
      regionalTotal: total,
      region,
      share,
    };
  }
  root.ScenarioModel = {
    totals: sumProjectedVotes,
    limits: calculateRegionLimits,
    changeRegion: applyRegionalShare,
  };
  if (typeof module !== "undefined") {
    module.exports = root.ScenarioModel;
  }
})(globalThis);
