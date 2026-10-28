/* Regras compartilhadas pelo coletor e pelas telas. Não use percentuais arredondados. */
(function (root) {
  "use strict";
  const POLL_MS = 5 * 60 * 1000;
  function complete(result) {
    if (!result) return false;
    const counted = Number(result.s?.st ?? result.st ?? result.counted);
    const total = Number(
      result.s?.ts ?? result.ts ?? result.total ?? result.sections,
    );
    return (
      Number.isSafeInteger(counted) &&
      Number.isSafeInteger(total) &&
      total > 0 &&
      counted === total
    );
  }
  function usableRegions(snapshots, now = Date.now(), freshMs = POLL_MS) {
    if (snapshots.length !== 28 || snapshots.some((s) => !s)) return false;
    // Um resultado encerrado não expira. Horários de encerramento podem diferir entre UFs.
    const partial = snapshots.filter((s) => !complete(s));
    return (
      partial.every(
        (s) => Number.isFinite(s.received) && now - s.received < freshMs,
      ) &&
      (partial.length < 2 ||
        Math.max(...partial.map((s) => s.time)) -
          Math.min(...partial.map((s) => s.time)) <=
          900000)
    );
  }
  const api = { POLL_MS, complete, usableRegions };
  root.ResultPolicy = api;
  if (typeof module !== "undefined") module.exports = api;
})(globalThis);
