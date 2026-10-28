/** Regras de encerramento e atualização, compartilhadas entre o coletor e as telas. */
(function (root) {
  "use strict";

  const POLL_MS = 5 * 60 * 1000;
  const EXPECTED_TERRITORIES = 28; // 26 estados, Distrito Federal e exterior.
  const MAX_PARTIAL_TIME_DIFFERENCE_MS = 15 * 60 * 1000;
  function isCompleteResult(result) {
    if (!result) {
      return false;
    }
    const countedSections = Number(result.s?.st ?? result.st ?? result.counted);
    const totalSections = Number(
      result.s?.ts ?? result.ts ?? result.total ?? result.sections,
    );
    return (
      Number.isSafeInteger(countedSections) &&
      Number.isSafeInteger(totalSections) &&
      totalSections > 0 &&
      countedSections === totalSections
    );
  }
  function hasUsableRegionalResults(
    snapshots,
    now = Date.now(),
    freshMs = POLL_MS,
  ) {
    if (
      snapshots.length !== EXPECTED_TERRITORIES ||
      snapshots.some((snapshot) => !snapshot)
    ) {
      return false;
    }
    // Um resultado encerrado não expira. Horários de encerramento podem diferir entre UFs.
    const partialResults = snapshots.filter((s) => !isCompleteResult(s));
    return (
      partialResults.every(
        (s) => Number.isFinite(s.received) && now - s.received < freshMs,
      ) &&
      (partialResults.length < 2 ||
        Math.max(...partialResults.map((s) => s.time)) -
          Math.min(...partialResults.map((s) => s.time)) <=
          MAX_PARTIAL_TIME_DIFFERENCE_MS)
    );
  }
  const api = {
    POLL_MS,
    complete: isCompleteResult,
    usableRegions: hasUsableRegionalResults,
  };
  root.ResultPolicy = api;
  if (typeof module !== "undefined") {
    module.exports = api;
  }
})(globalThis);
