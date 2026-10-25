const fs=require('node:fs');
const geo=JSON.parse(fs.readFileSync('dist/municipios.geojson'));
const config=JSON.parse(fs.readFileSync('municipios-tse.json'));
const lookup=new Map(config.abr.flatMap(u=>u.mu.map(m=>[String(m.cdi),{id:String(m.cdi),code:m.cd,uf:u.cd,name:m.nm}])));
const xy=([lon,lat])=>[(lon+74)*17,(6-lat)*17];
const path=rings=>rings.map(r=>r.map((p,i)=>(i?'L':'M')+xy(p).map(x=>x.toFixed(1)).join(',')).join('')+'Z').join('');
const cities=geo.features.map(f=>{const id=String(f.properties.codarea),meta=lookup.get(id);const polygons=f.geometry.type==='Polygon'?[f.geometry.coordinates]:f.geometry.coordinates;return {...(meta||{id,name:'Município IBGE '+id,uf:'',code:null}),path:polygons.map(path).join('')};});
const geometries=new Set(cities.map(c=>c.id));for(const [id,c] of lookup){if(c.uf!=='zz'&&!geometries.has(id))cities.push({...c,path:''});}
fs.writeFileSync('dist/map-data.js','window.MAP_DATA='+JSON.stringify({source:'IBGE API malhas v3, qualidade mínima; download 24/10/2026',cities,ufs:config.abr.map(u=>({uf:u.cd,name:u.ds}))})+';');
console.log(`${cities.filter(c=>c.path).length} polígonos e ${cities.filter(c=>!c.path).length} município sem contorno; ${cities.filter(c=>c.code).length} correspondências exatas IBGE/TSE; ${cities.filter(c=>!c.code).length} sem correspondência.`);

