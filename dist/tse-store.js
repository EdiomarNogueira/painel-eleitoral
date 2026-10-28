/** Cache compartilhado pelo comparativo e pela visão simples. Uma consulta em andamento por URL. */
(function (root) {
  "use strict";
  const PARTIAL_RESULT_TTL_MS = 5 * 60 * 1000;
  const REQUEST_TIMEOUT_MS = 15 * 1000;
  const cachedResults = new Map();
  const pendingRequests = new Map();
  const updateListeners = new Set();

  function buildResultUrl(turn, state = "br", municipalityCode = "") {
    const electionCode = turn === 1 ? "6257" : "6258";
    const filename = `${state}${municipalityCode}-c0001-e00${electionCode}-u.json`;
    return `https://resultados.tse.jus.br/oficial/ele2026/${electionCode}/dados/${state}/${filename}`;
  }

  function readExpectedLocation(address) {
    const match = address.match(
      /\/625([78])\/dados\/([a-z]{2})\/([a-z]{2})(\d{5})?-c0001-e00625[78]-u\.json$/,
    );
    if (!match || match[2] !== match[3]) {
      throw Error("Endereço de resultado inesperado");
    }
    const [, electionSuffix, state, , municipalityCode] = match;
    return {
      turn: electionSuffix === "7" ? 1 : 2,
      scope: municipalityCode ? "mu" : state === "br" ? "br" : "uf",
      area: municipalityCode || state,
    };
  }

  // O objeto chega a várias telas. Nenhuma delas deve alterar o cache das outras.
  function freezeRecursively(value) {
    if (value && typeof value === "object") {
      Object.freeze(value);
      Object.values(value).forEach(freezeRecursively);
    }
    return value;
  }

  function canReuseCachedResult(entry) {
    if (!entry) return false;
    const { st: countedSections, ts: totalSections } = entry.result;
    const isComplete = totalSections > 0 && countedSections === totalSections;
    const isRecent = Date.now() - entry.received < PARTIAL_RESULT_TTL_MS;
    return isComplete || isRecent;
  }

  async function fetchAndCacheResult(address, expectedLocation, previousEntry) {
    const response = await fetch(address, {
      cache: "no-cache",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw Error("Projeto retornou HTTP " + response.status);
    }
    const rawResult = await response.json();
    const validatedResult = root.ComparativoModel.raw(
      rawResult,
      expectedLocation,
    );
    if (
      previousEntry &&
      validatedResult.timestamp < previousEntry.result.timestamp
    ) {
      throw Error(
        "Projeto retornou uma versão anterior; leitura anterior preservada",
      );
    }
    const entry = {
      raw: freezeRecursively(rawResult),
      result: freezeRecursively(validatedResult),
      received: Date.now(),
    };
    cachedResults.set(address, entry);
    updateListeners.forEach((listener) => listener(address, entry));
    return entry.raw;
  }

  async function loadSharedResult(address) {
    const expectedLocation = readExpectedLocation(address);
    const cachedEntry = cachedResults.get(address);
    if (canReuseCachedResult(cachedEntry)) return cachedEntry.raw;
    if (pendingRequests.has(address)) return pendingRequests.get(address);
    const request = fetchAndCacheResult(address, expectedLocation, cachedEntry);
    pendingRequests.set(address, request);
    try {
      return await request;
    } finally {
      pendingRequests.delete(address);
    }
  }

  // Cancelar uma tela não cancela a consulta compartilhada por outra tela.
  function waitForResult(request, signal) {
    if (!signal) return request;
    return new Promise((resolve, reject) => {
      const cancel = () => reject(signal.reason || Error("Consulta cancelada"));
      signal.addEventListener("abort", cancel, { once: true });
      request.then(
        (result) => {
          signal.removeEventListener("abort", cancel);
          resolve(result);
        },
        (error) => {
          signal.removeEventListener("abort", cancel);
          reject(error);
        },
      );
    });
  }

  async function getResult(address, { signal } = {}) {
    signal?.throwIfAborted();
    return waitForResult(loadSharedResult(address), signal);
  }

  function subscribeToUpdates(listener) {
    updateListeners.add(listener);
    return () => updateListeners.delete(listener);
  }

  // API pública preservada para as telas que já usam este módulo.
  root.TSEStore = {
    url: buildResultUrl,
    getURL: getResult,
    peek: (address) => cachedResults.get(address)?.result || null,
    subscribe: subscribeToUpdates,
  };
})(globalThis);
