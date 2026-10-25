/* Normalização do EA20 e soma das localidades do exterior; sem dependências externas. */
(function (root) {
  'use strict';
  const pair = ['13', '22'];
  const numeric = value => {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) throw Error('Valor numérico inválido no retorno do TSE');
    return n;
  };
  const integer = value => {
    const n = numeric(value);
    if (!Number.isSafeInteger(n)) throw Error('Contagem não inteira no retorno do TSE');
    return n;
  };
  function readResult(payload, election, code) {
    if (!payload || String(payload.ele) !== String(election) || String(payload.t) !== (String(election) === '6257' ? '1' : '2')) {
      throw Error('Arquivo de eleição/turno diferente do solicitado');
    }
    if (payload.f !== 'o' || payload.tpabr !== 'mu' || String(payload.cdabr).padStart(5, '0') !== code) {
      throw Error('Arquivo não corresponde à localidade oficial solicitada');
    }
    const c = payload.carg?.find(x => String(x.cd) === '1');
    if (!c || !Array.isArray(c.agr)) throw Error('Cargo presidencial não encontrado');
    const candidates = c.agr.flatMap(a => a.par || []).flatMap(p => p.cand || []);
    const votes = {};
    for (const candidate of candidates) {
      const id = String(candidate.n);
      if (votes[id] !== undefined) throw Error('Candidato duplicado na localidade');
      votes[id] = integer(candidate.vap ?? 0);
    }
    const valid = integer(payload.v?.vv ?? 0);
    const counted = integer(payload.s?.st ?? 0);
    const sections = integer(payload.s?.ts ?? 0);
    if (counted > sections) throw Error('Mais seções apuradas do que existentes');
    const sum = Object.values(votes).reduce((a, b) => a + b, 0);
    if (sum > valid) throw Error('Soma dos candidatos excede votos válidos');
    const pending = payload.dv === 'n' || (!counted && !valid);
    return {
      code, a: votes[pair[0]] || 0, b: votes[pair[1]] || 0,
      other: valid - (votes[pair[0]] || 0) - (votes[pair[1]] || 0),
      valid, counted, sections, pending,
      date: String(payload.dg || ''), time: String(payload.hg || ''),
      received: new Date().toISOString()
    };
  }
  function isSnapshot(s, code) {
    return s && s.code === code &&
      ['a', 'b', 'other', 'valid', 'counted', 'sections'].every(k => Number.isSafeInteger(s[k]) && s[k] >= 0) &&
      s.a + s.b + s.other === s.valid && s.counted <= s.sections && typeof s.pending === 'boolean';
  }
  function group(locations, snapshots) {
    if (!Array.isArray(locations) || !snapshots || typeof snapshots !== 'object') throw Error('Dados de localidades inválidos');
    const countries = new Map(), sum = {a:0,b:0,other:0,valid:0,counted:0,sections:0,loaded:0,pending:0};
    const seen = new Set();
    for (const loc of locations) {
      if (!/^\d{5}$/.test(loc.code) || seen.has(loc.code) || !loc.name || !loc.country) throw Error('Cadastro de localidades duplicado ou incompleto');
      seen.add(loc.code);
      if (!countries.has(loc.country)) countries.set(loc.country, {
        name:loc.country, places:[], loaded:0, pending:0, a:0,b:0,other:0,valid:0,counted:0,sections:0
      });
      const c = countries.get(loc.country), s = snapshots[loc.code];
      c.places.push({...loc, snapshot:isSnapshot(s,loc.code) ? s : null});
      if (s && !isSnapshot(s,loc.code)) throw Error('Dados da localidade ' + loc.code + ' estão inconsistentes');
      if (!s) continue;
      c.loaded++;sum.loaded++;
      if (s.pending) {c.pending++;sum.pending++;}
      for (const k of ['a','b','other','valid','counted','sections']) {c[k]+=s[k];sum[k]+=s[k];}
    }
    if (Object.keys(snapshots).some(code => !seen.has(code))) throw Error('Base contém localidade desconhecida');
    const rows = [...countries.values()];
    return {rows, total:sum, localities:locations.length, countries:rows.length};
  }
  function compare(sum, expected) {
    if (!expected || !['a','b','other','valid'].every(k => Number.isSafeInteger(expected[k]))) return null;
    const differences = Object.fromEntries(['a','b','other','valid'].map(k => [k, sum[k] - expected[k]]));
    return {matches:Object.values(differences).every(v => v === 0),differences};
  }
  const api = {readResult, isSnapshot, group, compare};
  root.ExteriorModel = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
