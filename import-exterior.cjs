/**
 * Cache oficial das 186 localidades (1º turno, 2026) para uso offline.
 * Node 18+. Arquivos brutos ficam em data-first-turn/exterior/ para retomada.
 * Execute: node import-exterior.cjs
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { readResult, group, compare } = require('./dist/exterior-model.js');
const root = __dirname;
const ctx = {window:{}};
vm.runInNewContext(fs.readFileSync(path.join(root, 'dist/exterior-locations.js'), 'utf8'), ctx);
const locations = ctx.window.EXTERIOR_LOCATIONS;
const cachedDir = path.join(root, 'data-first-turn/exterior');
const filename = path.join(root, 'dist/exterior-first-turn-data.js');
const reference = JSON.parse(fs.readFileSync(path.join(root, 'data-first-turn/zz.json')));
const allowed = new Set(locations.map(l => l.code));
const wait = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  if (locations.length !== 186 || allowed.size !== locations.length) throw Error('Cadastro do exterior incompleto');
  fs.mkdirSync(cachedDir, {recursive:true});
  const result = {};
  let fresh = 0;
  for (const [i, loc] of locations.entries()) {
    const file = path.join(cachedDir, loc.code + '.json');
    let d;
    if (fs.existsSync(file)) {
      d = JSON.parse(fs.readFileSync(file, 'utf8'));
    } else {
      const url = `https://resultados.tse.jus.br/oficial/ele2026/6257/dados/zz/zz${loc.code}-c0001-e006257-u.json`;
      const response = await fetch(url, {signal:AbortSignal.timeout(20000)});
      if (!response.ok) throw Error(`TSE respondeu HTTP ${response.status} para ${loc.name}; interrompido para evitar pedidos inválidos`);
      d = await response.json();
      readResult(d, '6257', loc.code); // Nunca armazenar um retorno de outro turno ou localidade.
      fs.writeFileSync(file, JSON.stringify(d));
      fresh++;
      await wait(280);
    }
    const snapshot = readResult(d, '6257', loc.code);
    if (snapshot.pending || snapshot.counted !== snapshot.sections) {
      throw Error(`Resultado de ${loc.name} ainda não é final; cache não foi publicado`);
    }
    result[loc.code] = snapshot;
    if ((i + 1) % 20 === 0) console.log(`${i + 1}/${locations.length} localidades verificadas`);
  }
  const merged = group(locations, result);
  const candidates = reference.carg.flatMap(c => c.agr || []).flatMap(a => a.par || []).flatMap(p => p.cand || []);
  const a = Number(candidates.find(c => String(c.n) === '13')?.vap || 0);
  const b = Number(candidates.find(c => String(c.n) === '22')?.vap || 0);
  const valid = Number(reference.v.vv);
  const check = compare(merged.total, {a,b,other:valid-a-b,valid});
  if (!check?.matches) throw Error('Divergência entre a soma das localidades e ZZ do TSE: ' + JSON.stringify(check?.differences));
  const bundle = {election:'6257',generatedAt:new Date().toISOString(),localities:result};
  fs.writeFileSync(filename, '/* Cache: totais oficiais do 1º turno, reconciliados com ZZ. */\nwindow.EXTERIOR_FIRST_TURN=' + JSON.stringify(bundle) + ';\n');
  console.log(`OK: ${merged.countries} agrupamentos de país, ${merged.localities} localidades, ${valid} votos válidos. ${fresh} arquivos baixados neste comando.`);
}
main().catch(e => { console.error(e.message); process.exitCode = 1; });
