(() => {
  const nativeFetch = window.fetch.bind(window);
  const base = new URL(".", window.location.href);
  const localRoot = new URL("data/tse/", base);
  const historyCache = new Map();
  const finalFiles = new Map(),
    finalObjects = new Map();
  let finalHistory = null;
  function validatedFinal(raw, request) {
    if (!ResultPolicy.complete(raw)) return false;
    try {
      if (request.uf === "br") ElectionModel.parseTSE(raw);
      else if (request.uf === "zz" && request.code)
        ExteriorModel.readResult(raw, request.turn, request.code);
      else RegionalModel.parse(raw, request.uf, request.code || null);
      return true;
    } catch {
      return false;
    }
  }
  function finalPack(path, data) {
    const m = path.match(/\/(6257|6258)\/cities\/([a-z]{2})\.json$/);
    if (!m) return false;
    const places =
      m[2] === "zz"
        ? window.EXTERIOR_LOCATIONS || []
        : (window.COMPARE_CITIES || window.MAP_DATA?.cities || []).filter(
            (c) => c.uf === m[2],
          );
    return (
      places.length > 0 &&
      places.every((c) =>
        validatedFinal(data.results?.[c.code], {
          turn: m[1],
          uf: m[2],
          code: c.code,
        }),
      )
    );
  }
  let manifestPromise,
    manifestValue = null,
    manifestReadAt = 0;
  let localitiesManifestPromise,
    localitiesManifestValue = null,
    localitiesManifestReadAt = 0,
    localitiesManifestLoaded = false;
  function requireHttp() {
    if (window.location.protocol === "file:")
      throw Error(
        "O painel foi aberto como arquivo. Na pasta raiz do projeto, execute node serve.cjs e abra http://127.0.0.1:4173/.",
      );
  }
  function manifest(force = false) {
    if (manifestValue && !force && Date.now() - manifestReadAt < 30000)
      return Promise.resolve(manifestValue);
    if (manifestPromise) return manifestPromise;
    const url = new URL("manifest.json", localRoot);
    url.searchParams.set("v", String(Date.now()));
    manifestPromise = nativeFetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((value) => {
        if (
          manifestValue?.checkedAt &&
          value?.checkedAt !== manifestValue.checkedAt
        )
          historyCache.clear();
        manifestValue = value;
        manifestReadAt = Date.now();
        return value;
      })
      .catch(() => manifestValue)
      .finally(() => {
        manifestPromise = null;
      });
    return manifestPromise;
  }
  function localitiesManifest(force = false) {
    if (
      localitiesManifestLoaded &&
      !force &&
      Date.now() - localitiesManifestReadAt < 30000
    )
      return Promise.resolve(localitiesManifestValue);
    if (localitiesManifestPromise) return localitiesManifestPromise;
    const url = new URL("localities-manifest.json", localRoot);
    url.searchParams.set("v", String(Date.now()));
    localitiesManifestPromise = nativeFetch(url, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((value) => {
        if (
          localitiesManifestValue?.checkedAt &&
          value?.checkedAt !== localitiesManifestValue.checkedAt
        )
          historyCache.clear();
        localitiesManifestValue = value;
        localitiesManifestLoaded = true;
        localitiesManifestReadAt = Date.now();
        return value;
      })
      .catch(() => localitiesManifestValue)
      .finally(() => {
        localitiesManifestPromise = null;
      });
    return localitiesManifestPromise;
  }
  function cacheVersion(version) {
    return (
      version?.checkedAt || version?.updatedAt || Math.floor(Date.now() / 60000)
    );
  }
  function versioned(path, version) {
    const url = new URL(path, base);
    url.searchParams.set("v", String(cacheVersion(version)));
    return url;
  }
  async function loadObject(path, isLocality = false) {
    requireHttp();
    if (finalObjects.has(path)) return finalObjects.get(path);
    const [coreMeta, localMeta] = await Promise.all([
      manifest(),
      isLocality ? localitiesManifest() : Promise.resolve(null),
    ]);
    const meta = isLocality ? localMeta || coreMeta : coreMeta,
      key = path + "|" + cacheVersion(meta);
    if (!historyCache.has(key))
      historyCache.set(
        key,
        nativeFetch(versioned(path, meta), { cache: "no-store" })
          .then(async (r) => {
            if (!r.ok)
              throw Error(`Snapshot do projeto indisponível (${r.status}).`);
            return r.json();
          })
          .catch((error) => {
            historyCache.delete(key);
            throw error;
          }),
      );
    const value = await historyCache.get(key);
    if (finalPack(path, value)) finalObjects.set(path, value);
    return value;
  }
  function response(value, status = 200) {
    return new Response(value === null ? null : JSON.stringify(value), {
      status,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  }
  function parse(address) {
    let u;
    try {
      u = new URL(address);
    } catch {
      return null;
    }
    if (u.hostname !== "resultados.tse.jus.br") return null;
    const match = u.pathname.match(
      /^\/oficial\/ele2026\/(6257|6258)\/dados\/([a-z]{2})\/([a-z]{2})(\d{5})?-c0001-e00(6257|6258)-u\.json$/,
    );
    if (!match || match[2] !== match[3] || match[1] !== match[5]) return null;
    return {
      turn: match[1],
      uf: match[2],
      code: match[4] || "",
      filename: u.pathname.slice(u.pathname.lastIndexOf("/") + 1),
      pathname: u.pathname,
    };
  }
  async function projectFetch(input, init) {
    const address =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input?.url;
    const request = parse(address);
    if (!request) return nativeFetch(input, init);
    requireHttp();
    if (init?.signal?.aborted)
      throw init.signal.reason || Error("Consulta cancelada");
    if (finalFiles.has(address)) return response(finalFiles.get(address));
    const meta = await manifest();
    if (request.code) {
      const file = `${request.turn}/cities/${request.uf}.json`;
      try {
        const data = await loadObject(`data/tse/${file}`, true);
        const raw = data.results?.[request.code];
        if (validatedFinal(raw, request)) finalFiles.set(address, raw);
        return raw ? response(raw) : response(null, 404);
      } catch {
        return response(null, 503);
      }
    }
    const relative = `data/tse/${request.turn}/dados/${request.uf}/${request.filename}`;
    const fetched = await nativeFetch(versioned(relative, meta), {
      ...init,
      cache: "no-store",
    });
    if (fetched.ok) {
      const raw = await fetched.clone().json();
      if (validatedFinal(raw, request)) finalFiles.set(address, raw);
    }
    return fetched;
  }
  window.fetch = projectFetch;
  async function history() {
    if (finalHistory) return finalHistory;
    const [meta, data] = await Promise.all([
      manifest(),
      loadObject("data/tse/history.json"),
    ]);
    const received =
      Date.parse(meta?.checkedAt || data.updatedAt || "") || Date.now();
    for (const item of data.national || []) item.received = received;
    for (const list of Object.values(data.ufs || {}))
      if (list.length) list[list.length - 1].received = received;
    const result = {
      ...data,
      checkedAt: meta?.checkedAt || data.updatedAt || null,
    };
    if (
      ResultPolicy.complete(data.national?.at(-1)) &&
      Object.keys(data.ufs || {}).length === 28 &&
      Object.values(data.ufs).every((h) => ResultPolicy.complete(h.at(-1)))
    )
      finalHistory = result;
    return result;
  }
  async function cityHistory(uf, code) {
    try {
      const data = await loadObject(`data/tse/history-cities/${uf}.json`, true);
      return data[String(code)] || [];
    } catch {
      return [];
    }
  }
  async function cityResults(uf, turn = 6258) {
    const data = await loadObject(`data/tse/${turn}/cities/${uf}.json`, true);
    return data.results || {};
  }
  async function cityHistories(uf) {
    return loadObject(`data/tse/history-cities/${uf}.json`, true);
  }
  window.TSEClient = {
    history,
    cityHistory,
    cityResults,
    cityHistories,
    manifest,
    localitiesManifest,
  };
})();
