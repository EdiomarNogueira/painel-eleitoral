const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
global.ElectionModel=require('./dist/model');global.RegionalModel=require('./dist/regional-model');const F=require('./dist/first-turn'),S=require('./dist/scenario-model');
const ctx={window:{}};for(const f of ['first-turn-data','first-turn-cities','map-data'])vm.runInNewContext(fs.readFileSync('dist/'+f+'.js','utf8'),ctx);
const d=ctx.window.FIRST_TURN_DATA,cities=ctx.window.FIRST_TURN_CITIES,geo=ctx.window.MAP_DATA;
assert.equal(Object.keys(d.ufs).length,28);assert.equal(Object.keys(cities).length,5571);assert.equal(geo.cities.length,5571);
const national=F.snapshot(d.national,100);const entries=Object.entries(d.ufs).map(([uf,base])=>({uf,est:RegionalModel.estimate([F.snapshot(base,5),F.snapshot(base,10)])}));
const totals=S.totals(entries);assert.ok(Math.abs(totals.a-national.a)<.001);assert.ok(Math.abs(totals.b-national.b)<.001);
for(const [uf,base] of Object.entries(d.ufs)){if(uf==='zz')continue;const refs=geo.cities.filter(c=>c.uf===uf),actual=refs.reduce((s,c)=>{const x=F.snapshot(cities[c.id],100);return {a:s.a+x.a,b:s.b+x.b};},{a:0,b:0}),expected=F.snapshot(base,100);assert.equal(actual.a,expected.a,uf+' votos Lula');assert.equal(actual.b,expected.b,uf+' votos Flávio');}
const x=S.changeRegion(entries,'Nordeste',60);assert.ok(!x.error);assert.ok(Math.abs(x.before.a+x.before.b-x.after.a-x.after.b)<.001);
for(let i=0;i<entries.length;i++)if(RegionalModel.region(entries[i].uf)!=='Nordeste')assert.equal(x.entries[i],entries[i]);
const changed=x.entries.filter(e=>RegionalModel.region(e.uf)==='Nordeste'),ne=S.totals(changed);assert.ok(Math.abs(ne.a/(ne.a+ne.b)-.6)<1e-9);
assert.ok(S.changeRegion(entries,'Nordeste',0).error);assert.ok(S.changeRegion(entries,'Nordeste',100).error);assert.ok(S.changeRegion(entries,'Nordeste',NaN).error);assert.ok(S.changeRegion(entries,'Nordeste',-1).error);
assert.equal(national.turnout.abstained,Number(d.national.e.a));assert.equal(national.turnout.blank,Number(d.national.v.vb));assert.equal(national.turnout.nullVotes,Number(d.national.v.tvn));
console.log('Primeiro turno: 5571 municípios reconciliados com 27 UFs; UFs + exterior reconciliados com Brasil. Cenário de 60% no Nordeste conserva outras regiões, total de votos e votos já contados.');

