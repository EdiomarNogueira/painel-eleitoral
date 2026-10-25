(function(root){
  'use strict';
  const cache=new Map(),pending=new Map(),listeners=new Set();
  const url=(turn,uf='br',code='')=>`https://resultados.tse.jus.br/oficial/ele2026/${turn===1?'6257':'6258'}/dados/${uf}/${uf}${code}-c0001-e00${turn===1?'6257':'6258'}-u.json`;
  function expected(address){const m=address.match(/\/625([78])\/dados\/([a-z]{2})\/([a-z]{2})(\d{5})?-c0001-e00625[78]-u\.json$/);if(!m||m[2]!==m[3])throw Error('Endereço de resultado inesperado');return {turn:m[1]==='7'?1:2,scope:m[4]?'mu':m[2]==='br'?'br':'uf',area:m[4]||m[2]};}
  function freeze(value){if(value&&typeof value==='object'){ bject.freeze(value); bject.values(value).forEach(freeze);}return value;}
  async function load(address){
    const exp=expected(address),old=cache.get(address);
    if(old&&(exp.turn===1&&old.result.st===old.result.ts||Date.now()-old.received<15000))return old.raw;
    if(pending.has(address))return pending.get(address);
    const job=(async()=>{const response=await fetch(address,{cache:'no-cache',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('Projeto retornou HTTP '+response.status);const data=await response.json(),result=root.ComparativoModel.raw(data,exp);
      if(old&&result.timestamp<old.result.timestamp)throw Error('  Projeto retornou uma versão anterior; leitura anterior preservada');
      const entry={raw:freeze(data),result:freeze(result),received:Date.now()};cache.set(address,entry);listeners.forEach(fn=>fn(address,entry));return entry.raw;
    })();pending.set(address,job);try{return await job;}finally{pending.delete(address);}
  }
  async function getURL(address,{signal}={}){
    signal?.throwIfAborted();const promise=load(address);if(!signal)return promise;
    return new Promise((resolve,reject)=>{const cancel=()=>reject(signal.reason||Error('Consulta cancelada'));signal.addEventListener('abort',cancel,{once:true});promise.then(v=>{signal.removeEventListener('abort',cancel);resolve(v);},e=>{signal.removeEventListener('abort',cancel);reject(e);});});
  }
  root.TSEStore={url,getURL,peek:address=>cache.get(address)?.result||null,subscribe:fn=>{listeners.add(fn);return()=>listeners.delete(fn);}};
})(globalThis);
