(()=>{
 const $=id=>document.getElementById(id);
 const button=document.createElement('button');
 button.id='startSimpleTour';
 button.className='quiet';
 button.textContent='Como usar?';
 button.setAttribute('aria-haspopup','dialog');
 document.querySelector('header').append(button);

 const dialog=document.createElement('dialog');
 dialog.id='simpleTourDialog';
 dialog.setAttribute('aria-labelledby','simpleTourTitle');
 dialog.setAttribute('aria-describedby','simpleTourText');
 dialog.innerHTML='<div class="simpleTourTop"><span id="simpleTourStep"></span><button id="cancelSimpleTour" class="quiet" aria-label="Cancelar tutorial">Cancelar ×</button></div><h2 id="simpleTourTitle"></h2><p id="simpleTourText"></p><div class="simpleTourNav"><button id="simpleTourPrev" class="quiet">← Anterior</button><button id="simpleTourNext">Próximo ↓</button></div>';
 document.body.append(dialog);

 const steps=[
  {tab:'summary',selector:'.intro',title:'Escolha a origem dos dados',text:'A demonstração usa resultados reais do primeiro turno em etapas simuladas. A opção oficial mostra os arquivos do segundo turno coletados e compartilhados pelo projeto.'},
  {tab:'summary',selector:'.actionbar',title:'Avance ou atualize a contagem',text:'Na demonstração, avance o total ou uma região. Nos dados oficiais, carregue as leituras já publicadas pelo projeto; a coleta do TSE acontece no GitHub em horários agendados. As etapas simuladas não são o histórico real da apuração.'},
  {tab:'summary',selector:'.tabs',title:'Navegue pelas áreas',text:'Resumo mostra os números principais. Regiões, Simular, Exterior e Comparativo abrem análises diferentes. Você pode voltar a qualquer área pelos mesmos botões.'},
  {tab:'summary',selector:'#summary .overview',title:'Leia o resumo',text:'Veja os votos já contados, a estimativa final e o andamento das seções. Os percentuais do cartão comparam somente Lula e Flávio; a participação mostra outras categorias e explica seus denominadores.'},
  {tab:'regions',selector:'#regions',title:'Explore as regiões',text:'As barras separam votos contados e votos restantes estimados. Na demonstração, escolha uma região para avançar só aquele grupo; o resumo nacional acompanha a mudança.'},
  {tab:'simulate',selector:'#simulate',title:'Teste um cenário',text:'Altere a participação final em uma região para ver o efeito na projeção do Brasil. O cálculo preserva o total previsto. A frequência de liderança em cenários experimentais é uma hipótese do modelo, não uma chance real de vitória.'},
  {tab:'abroad',selector:'#abroad',title:'Veja os votos no exterior',text:'Carregue as últimas leituras compartilhadas por país e procure por país ou localidade. No segundo turno, os dados vêm dos arquivos coletados pelo projeto; países incompletos são identificados.'},
  {tab:'comparison',selector:'#comparison',title:'Compare os dois turnos',text:'Esta área usa resultados oficiais para comparar primeiro e segundo turnos por Brasil, estado, município ou país. Ela é independente da demonstração e dos cenários.'}
 ];

 let index=0,highlight=null;
 function show(){
  if(highlight)highlight.classList.remove('simpleTourHighlight');
  const step=steps[index],tab=$('tab-'+step.tab);
  if(tab&&tab.getAttribute('aria-selected')!=='true')tab.click();
  highlight=document.querySelector(step.selector);
  highlight?.classList.add('simpleTourHighlight');
  highlight?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'center'});
  $('simpleTourStep').textContent=`ETAPA ${index+1} DE ${steps.length}`;
  $('simpleTourTitle').textContent=step.title;
  $('simpleTourText').textContent=step.text;
  $('simpleTourPrev').disabled=index===0;
  $('simpleTourNext').textContent=index===steps.length-1?'Concluir ✓':'Próximo ↓';
 }
 function close(){
  highlight?.classList.remove('simpleTourHighlight');
  highlight=null;
  dialog.close();
  button.disabled=false;
  button.focus({preventScroll:true});
 }
 button.onclick=()=>{index=0;button.disabled=true;dialog.showModal();show();$('simpleTourNext').focus({preventScroll:true});};
 $('simpleTourNext').onclick=()=>{if(index===steps.length-1)close();else{index++;show();}};
 $('simpleTourPrev').onclick=()=>{if(index>0){index--;show();}};
 $('cancelSimpleTour').onclick=close;
 dialog.oncancel=e=>{e.preventDefault();close();};
})();
