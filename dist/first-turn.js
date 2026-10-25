(function(root){
 function snapshot(base,progress){
  if(!base||!Number.isFinite(progress)||progress<0||progress>100)throw Error('Base ou avanço inválido');
  const ts=Number(base.s.ts),counted=Number(base.s.st);if(ts!==counted)throw Error('A demonstração exige a totalização completa do primeiro turno');
  const f=progress/100,a=base.candidates.find(c=>c.id==='13'),b=base.candidates.find(c=>c.id==='22');if(!a||!b)throw Error('Candidatos ausentes');
  const t=ElectionModel.turnout(base),turnout=Object.fromEntries(Object.entries(t).map(([k,v])=>[k,v===null?null:k==='electorate'?v:Math.round(v*f)]));
  return {a:a.votes*f,b:b.votes*f,p:progress,st:ts*f,ts,total:ts,counted:ts*f,remaining:Math.round(Number(base.e.te)*(1-f)),turnout,otherVotes:Math.round(base.candidates.filter(c=>!['13','22'].includes(c.id)).reduce((s,c)=>s+c.votes,0)*f),time:0,label:'Etapa simulada · '+progress.toLocaleString('pt-BR')+'%',date:base.date,sourceDate:base.date,sourceTime:base.time};
 }
 function pairNames(base){return ['13','22'].map(id=>{const c=base.candidates.find(c=>c.id===id);return {id,name:c.name,party:c.party};});}
 root.FirstTurn={snapshot,pairNames};if(typeof module!=='undefined')module.exports=root.FirstTurn;
})(globalThis);

