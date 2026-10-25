'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ElectionModel = require('./dist/model.js');
const RegionalModel = require('./dist/regional-model.js');
const ExteriorModel = require('./dist/exterior-model.js');

const root = __dirname;
const dataRoot = path.join(root, 'dist', 'data', 'tse');
const historyFile = path.join(dataRoot, 'history.json');
const bootstrapMarker = path.join(dataRoot, 'bootstrap-complete.json');
const shardCount = 24;
const historyLimit = 120;
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
let changed = false;
let requests = 0;
let failures = 0;
let missing = 0;

async function mapLimit(items, limit, action) {
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      await action(items[index], index);
    }
  });
  await Promise.all(workers);
}

function assignedArray(file, name) {
  const source = fs.readFileSync(path.join(root, 'dist', file), 'utf8');
  const match = source.match(new RegExp(`(?:window\\.)?${name}\\s*=\\s*([\\s\\S]*?);`));
  if (!match) throw new Error(`Não encontrei ${name} em dist/${file}`);
  return JSON.parse(match[1]);
}

function codesFromFirstTurn() {
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'dist', 'first-turn-data.js'), 'utf8'), context);
  const codes = Object.keys(context.window.FIRST_TURN_DATA?.ufs || {});
  if (codes.length !== 28) throw new Error(`Esperava 28 códigos territoriais, encontrei ${codes.length}`);
  return codes.sort();
}

function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return fallback; throw error; }
}

function writeJson(file, value) {
  const content = JSON.stringify(value);
  let previous = null;
  try { previous = fs.readFileSync(file, 'utf8'); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (previous === content) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  if (!file.endsWith(`${path.sep}manifest.json`)) changed = true;
  return true;
}

function latestFile(turn, uf) {
  return path.join(dataRoot, String(turn), 'dados', uf, `${uf}-c0001-e00${turn}-u.json`);
}

function aggregateFile(turn, uf) {
  return path.join(dataRoot, String(turn), 'cities', `${uf}.json`);
}

function sortedObject(value) {
  return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
}

function signature(turn, uf, code, raw) {
  if (uf === 'br') {
    const s = ElectionModel.parseTSE(raw);
    return JSON.stringify([s.a, s.b, s.counted, s.total, s.candidates, s.turnout]);
  }
  if (uf === 'zz') {
    const s = ExteriorModel.readResult(raw, String(turn), String(code));
    return JSON.stringify([s.a, s.b, s.other, s.valid, s.counted, s.sections, s.pending]);
  }
  const s = RegionalModel.parse(raw, uf, code || null);
  return JSON.stringify([s.a, s.b, s.st, s.ts, s.remaining, s.turnout]);
}

function sameNational(previous, current) {
  return previous && JSON.stringify([previous.a, previous.b, previous.counted, previous.total, previous.candidates, previous.turnout]) ===
    JSON.stringify([current.a, current.b, current.counted, current.total, current.candidates, current.turnout]);
}

function sameRegional(previous, current) {
  return previous && JSON.stringify([previous.a, previous.b, previous.st, previous.ts, previous.remaining, previous.turnout]) ===
    JSON.stringify([current.a, current.b, current.st, current.ts, current.remaining, current.turnout]);
}

const aggregates = new Map();
function aggregate(turn, uf) {
  const key = `${turn}:${uf}`;
  if (!aggregates.has(key)) {
    const file = aggregateFile(turn, uf);
    const loaded = readJson(file, { schema: 1, results: {} });
    if (!loaded || loaded.schema !== 1 || !loaded.results || typeof loaded.results !== 'object') throw new Error(`Cache municipal inválido: ${file}`);
    aggregates.set(key, loaded);
  }
  return aggregates.get(key);
}

const cityHistories = new Map();
function cityHistory(uf) {
  if (!cityHistories.has(uf)) cityHistories.set(uf, readJson(path.join(dataRoot, 'history-cities', `${uf}.json`), {}));
  return cityHistories.get(uf);
}

function urlFor(turn, uf, code = '') {
  return `https://resultados.tse.jus.br/oficial/ele2026/${turn}/dados/${uf}/${uf}${code}-c0001-e00${turn}-u.json`;
}

async function fetchTSE(turn, uf, code = '') {
  await wait(260);
  requests++;
  const address = urlFor(turn, uf, code);
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(address, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
      if (response.status === 404) { missing++; return null; }
      if (!response.ok) throw new Error(`HTTP ${response.status} em ${uf}${code}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      if (attempt === 0) await wait(1000);
    }
  }
  failures++;
  console.warn(`Falha em ${uf}${code}: ${lastError?.message || 'erro desconhecido'}`);
  return null;
}

function appendNational(list, snapshot) {
  const previous = list.at(-1);
  if (previous && snapshot.timestamp < previous.timestamp) return false;
  if (sameNational(previous, snapshot)) return false;
  if (previous && (snapshot.a < previous.a || snapshot.b < previous.b || snapshot.counted < previous.counted || snapshot.total !== previous.total)) list.length = 0;
  list.push(snapshot);
  if (list.length > historyLimit) list.splice(0, list.length - historyLimit);
  return true;
}

function appendRegional(list, snapshot) {
  const previous = list.at(-1);
  if (previous && snapshot.time < previous.time) return false;
  if (sameRegional(previous, snapshot)) return false;
  if (previous && (snapshot.a < previous.a || snapshot.b < previous.b || snapshot.st < previous.st || snapshot.ts !== previous.ts)) list.length = 0;
  list.push(snapshot);
  if (list.length > historyLimit) list.splice(0, list.length - historyLimit);
  return true;
}

function captureProjection(histories, codes) {
  const current = codes.map(uf => ({ uf, snapshot: histories.ufs[uf]?.at(-1) }));
  if (current.some(item => !item.snapshot)) return;
  const counted = current.reduce((sum, item) => sum + item.snapshot.st, 0);
  const sections = current.reduce((sum, item) => sum + item.snapshot.ts, 0);
  if (!sections) return;
  const projection = { p: counted / sections * 100, recent: null, average: null };
  for (const method of ['recent', 'average']) {
    const estimates = current.map(item => RegionalModel.estimate(histories.ufs[item.uf], method));
    if (estimates.every(Boolean)) projection[method] = {
      a: estimates.reduce((sum, item) => sum + item.a, 0),
      b: estimates.reduce((sum, item) => sum + item.b, 0)
    };
  }
  histories.projections ||= [];
  if (JSON.stringify(histories.projections.at(-1)) === JSON.stringify(projection)) return;
  histories.projections.push(projection);
  if (histories.projections.length > historyLimit) histories.projections.splice(0, histories.projections.length - historyLimit);
  histories.updatedAt = new Date().toISOString();
  changed = true;
}

async function saveCore(turn, areas, histories) {
  await mapLimit(areas, 4, async uf => {
    const raw = await fetchTSE(turn, uf);
    if (!raw) return;
    try {
      if (uf === 'br') {
        const snapshot = ElectionModel.parseTSE(raw);
        const file = latestFile(turn, uf), previous = readJson(file, null);
        if (!previous || signature(turn, uf, '', previous) !== signature(turn, uf, '', raw)) writeJson(file, raw);
        if (appendNational(histories.national, snapshot)) histories.updatedAt = new Date().toISOString();
      } else {
        const snapshot = RegionalModel.parse(raw, uf);
        const file = latestFile(turn, uf), previous = readJson(file, null);
        if (!previous || signature(turn, uf, '', previous) !== signature(turn, uf, '', raw)) writeJson(file, raw);
        histories.ufs[uf] ||= [];
        if (appendRegional(histories.ufs[uf], snapshot)) histories.updatedAt = new Date().toISOString();
      }
    } catch (error) {
      failures++;
      console.warn(`Resposta inválida para ${uf}: ${error.message}`);
    }
  });
}

async function saveLocality(turn, locality, options = {}) {
  const { uf, code } = locality;
  const stored = aggregate(turn, uf);
  if (options.onlyMissing && stored.results[code]) return;
  const raw = await fetchTSE(turn, uf, code);
  if (!raw) return;
  try {
    let snapshot;
    if (uf === 'zz') snapshot = ExteriorModel.readResult(raw, String(turn), code);
    else snapshot = RegionalModel.parse(raw, uf, code);
    snapshot.received = Date.now();
    const previous = stored.results[code];
    if (previous && signature(turn, uf, code, previous) === signature(turn, uf, code, raw)) return;
    stored.results[code] = raw;
    if (turn === 6258 && uf !== 'zz') {
      const records = cityHistory(uf);
      const history = records[code] || (records[code] = []);
      appendRegional(history, snapshot);
    }
  } catch (error) {
    failures++;
    console.warn(`Resposta inválida para ${uf}${code}: ${error.message}`);
  }
}

function shardForRun() {
  const run = Number(process.env.GITHUB_RUN_NUMBER);
  return Number.isInteger(run) && run > 0 ? run % shardCount : Math.floor(Date.now() / 300000) % shardCount;
}

function setOutput(key, value) {
  if (!process.env.GITHUB_OUTPUT) return;
  fs.appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
}

async function main() {
  fs.mkdirSync(dataRoot, { recursive: true });
  const coreOnly = process.argv.includes('--core-only');
  const localitiesOnly = process.argv.includes('--localities-only');
  if (coreOnly && localitiesOnly) throw new Error('Use --core-only ou --localities-only, não ambos.');
  const isBootstrap = process.argv.includes('--bootstrap') || !fs.existsSync(bootstrapMarker);
  const shard = shardForRun();
  const histories = readJson(historyFile, { national: [], ufs: {}, updatedAt: null });
  histories.national ||= [];
  histories.ufs ||= {};
  histories.projections ||= [];
  const ufs = codesFromFirstTurn();
  const cities = assignedArray('compare-cities.js', 'COMPARE_CITIES');
  const exterior = assignedArray('exterior-locations.js', 'EXTERIOR_LOCATIONS');
  if (cities.length < 5500 || exterior.length !== 186) throw new Error('As listas de cidades ou localidades do exterior estão incompletas');

  if (!localitiesOnly) {
    await saveCore(6258, ['br', ...ufs], histories);
    captureProjection(histories, ufs);
    writeJson(historyFile, histories);
  }

  if (!coreOnly) {
    for (const turn of [6257, 6258]) {
      const storedExterior = aggregate(turn, 'zz');
      await mapLimit(exterior, 4, place => saveLocality(turn, { uf: 'zz', code: String(place.code) }, { onlyMissing: turn === 6257 }));
      storedExterior.results = sortedObject(storedExterior.results);
    }

    const cityBatch = isBootstrap ? cities : cities.filter((_, index) => index % shardCount === shard);
    await mapLimit(cityBatch, 4, city => saveLocality(6258, { uf: city.uf, code: String(city.code) }));

    for (const [key, value] of aggregates) {
      const [turn, uf] = key.split(':');
      value.results = sortedObject(value.results);
      writeJson(aggregateFile(turn, uf), value);
    }
    for (const [uf, value] of cityHistories) writeJson(path.join(dataRoot, 'history-cities', `${uf}.json`), sortedObject(value));
    if (isBootstrap) writeJson(bootstrapMarker, { completedAt: new Date().toISOString(), municipalities: cities.length });
  }

  const manifestPath = path.join(dataRoot, 'manifest.json');
  const previousManifest = readJson(manifestPath, null);
  if (!previousManifest?.checkedAt) changed = true;
  const checkedAt = changed ? new Date().toISOString() : previousManifest.checkedAt;
  writeJson(manifestPath, {
    schema: 1,
    checkedAt,
    updatedAt: histories.updatedAt
  });
  setOutput('changed', String(changed));
  setOutput('checked_at', checkedAt);
  const cityCount = coreOnly ? 0 : (isBootstrap ? cities.length : cities.filter((_, index) => index % shardCount === shard).length);
  const phase = coreOnly ? 'prioritária' : localitiesOnly ? 'municipal/exterior' : 'completa';
  console.log(`Coleta ${phase} concluída: ${requests} consultas, ${cityCount} municípios no lote, ${missing} sem arquivo e ${failures} falhas.`);
}

main().catch(error => { console.error(error); process.exitCode = 1; });
