(function(root){
function totals(entries){return entries.reduce((s,{est:e})=>({a:s.a+e.a,b:s.b+e.b}),{a:0,b:0});}
function limits(entries,region){
 if(!entries.length||entries.some(e=>!e.est))return {error:'Faltam dados para projetar todas as regiões.'};
 const selected=entries.filter(e=>root.RegionalModel.region(e.uf)===region);
 if(!selected.length)return {error:'Escolha uma região válida.'};
 const projected=totals(selected),total=projected.a+projected.b;
 const observedA=selected.reduce((s,e)=>s+e.est.current.a,0),observedB=selected.reduce((s,e)=>s+e.est.current.b,0);
 if(total<=0)return {error:'A região ainda não tem votos suficientes para calcular.'};
 return {min:100*observedA/total,max:100*(total-observedB)/total,share:100*projected.a/total,total,projected};
}
function changeRegion(entries,region,share){
 if(!entries.length||entries.some(e=>!e.est))return {error:'Faltam dados para projetar todas as regiões.'};
 if(!Number.isFinite(share)||share<0||share>100)return {error:'Informe uma porcentagem de 0 a 100.'};
 const selected=entries.filter(e=>root.RegionalModel.region(e.uf)===region);if(!selected.length)return {error:'Escolha uma região válida.'};
 const bound=limits(entries,region);if(bound.error)return bound;
 const base=totals(selected),total=base.a+base.b,observedA=selected.reduce((s,e)=>s+e.est.current.a,0),observedB=selected.reduce((s,e)=>s+e.est.current.b,0),remaining=selected.reduce((s,e)=>s+e.est.ra+e.est.rb,0),{min,max}=bound,target=total*share/100;
 if(target<observedA-1e-6||target>total-observedB+1e-6)return {error:'Esse percentual exigiria retirar votos já contados. Escolha um valor dentro dos limites indicados.',min,max};
 const restShare=remaining?Math.max(0,Math.min(1,(target-observedA)/remaining)):0;
 const changed=entries.map(item=>{if(root.RegionalModel.region(item.uf)!==region)return item;const e=item.est,rest=e.ra+e.rb,ra=rest*restShare,rb=rest-ra;return {...item,est:{...e,ra,rb,a:e.current.a+ra,b:e.current.b+rb}};});
 return {entries:changed,before:totals(entries),after:totals(changed),min,max,regionalTotal:total,region,share};
}
root.ScenarioModel={totals,limits,changeRegion};if(typeof module!=='undefined')module.exports=root.ScenarioModel;
})(globalThis);
