const fs=require('node:fs');const read=p=>fs.readFileSync('dist/'+p,'utf8'),write=(p,s)=>fs.writeFileSync('dist/'+p,s);
let app=read('app.js');
app=app.replace(/function resetDemo\(\)\{.*?\}\nfunction notice/s,`function resetDemo(){history=[FirstTurn.snapshot(FIRST_TURN_DATA.national,5),FirstTurn.snapshot(FIRST_TURN_DATA.national,10)];names=FirstTurn.pairNames(FIRST_TURN_DATA.national);render();}\nfunction notice`);
app=app.replace("'Valores fictícios para explorar a tendência'","'Etapa simulada com a base do 1º turno'");
app=app.replace("cur?.total?", "mode==='official'&&cur?.total?");
app=app.replace("'Ambiente de simulação'","'1º turno real · avanço proporcional simulado'");
app=app.replace("'DEMONSTRAÇÃO · Números e candidatos fictícios. Os controles não alteram dados oficiais.'","'DEMONSTRAÇÃO COM 1º TURNO · Votos reais de 2026, distribuídos proporcionalmente em etapas simuladas. Os percentuais dos candidatos comparam apenas Lula e Flávio; não são o resultado completo do 1º turno nem uma previsão do 2º.'");
app=app.replace("<span>Participação atual</span>","<span>Entre os dois candidatos</span>");
app=app.replace("${i?'B':'A'}","${esc(names[i]?.id||'—')}");
app=app.replace("${names[winner]?.name||'Candidato'}: ${pct(proj[winner]/projectedTotal*100)}","${names[winner]?.name||'Candidato'}: ${pct(proj[winner]/projectedTotal*100)} entre os dois");
app=app.replace("'Contagem observada com 100% das seções, sem extrapolação.'","mode==='demo'?'Etapa completa da reprodução proporcional. Não é uma simulação de transferência de votos para o 2º turno.':'Contagem observada com 100% das seções, sem extrapolação.'");
app=app.replace(/\$\('advance'\)\.onclick=\(\)=>\{.*?\};\$\('refresh'\)/s,`$('advance').onclick=()=>{const cur=history.at(-1),step=Math.min(Number($('step').value),100-cur.p);if(step<=0)return;history.push(FirstTurn.snapshot(FIRST_TURN_DATA.national,cur.p+step));render();};$('refresh')`);
app=app.replace("source:mode==='official'?URL_TSE:'Demonstração fictícia'","source:mode==='official'?URL_TSE:FIRST_TURN_DATA.source,demonstration:mode==='demo'?'Avanço proporcional simulado do primeiro turno; comparação restrita a Lula e Flávio':null");
write('app.js',app);
let html=read('index.html');
html=html.replace('2º turno · Presidente','Presidente · Brasil').replace('O agora.<br>Os próximos votos.','Entenda a apuração.<br>Explore os próximos votos.').replace('Acompanhe a contagem e explore como o ritmo de entrada<br class="desktop"> dos votos pode desenhar o resultado final.','Veja o que já foi contado e o que pode acontecer se o ritmo continuar. Comece escolhendo a origem dos dados.');
html=html.replace('>Dados do TSE</button>','>2º turno · dados oficiais</button>').replace('>Demonstração ↗</button>','>Demonstração com 1º turno</button>');
html=html.replace('SEÇÕES TOTALIZADAS','APURAÇÃO: SEÇÕES CONTADAS').replace('VOTOS NOS DOIS CANDIDATOS','VOTOS DE LULA + FLÁVIO').replace('ÚLTIMO DADO RECEBIDO','DATA OU ETAPA DA LEITURA');
html=html.replace('Do retrato à projeção','Se o ritmo continuar, como termina?').replace('Ritmo recente · últimas 5 leituras','Ritmo dos últimos lotes').replace('Média acumulada</option>','Proporção dos votos já contados</option>').replace('Projetar a partir de','Como calcular');
html=html.replace('E se o próximo<br>lote fosse diferente?','Avance a demonstração').replace('Os controles abaixo usam apenas números fictícios.','As etapas usam as proporções reais do 1º turno. São uma reprodução proporcional, não o histórico real da apuração.');
html=html.replace('<label for="share">','<div hidden><label for="share">').replace('<label for="step">','</div><label for="step">');
html=html.replace('Avanço da apuração','Quanto avançar').replaceAll('pontos percentuais','pontos na apuração').replace('Adicionar próximo lote','Avançar a apuração').replace('Cada nova leitura atualiza o ritmo e a projeção. Experimente inverter a tendência.','Exemplo: avançar 5 pontos leva a apuração de 10% para 15%. As preferências dos eleitores permanecem as registradas no 1º turno.');
html=html.replace('Como a tendência evolui','Histórico: compare as leituras').replaceAll('Participação projetada de A','Participação projetada de Lula, entre os dois').replace('Votos A</th><th>Votos B</th><th>A no lote</th><th>Projeção A','Votos de Lula</th><th>Votos de Flávio</th><th>Lula no lote</th><th>Projeção de Lula');
html=html.replace('A e B correspondem à ordem fixa de candidatos mostrada nos cartões.','Na demonstração, Lula e Flávio são comparados entre si. Os votos dos demais candidatos permanecem no resumo do primeiro turno e não são transferidos para os dois.');
html=html.replace('<script src="app.js">','<script src="first-turn-data.js"></script><script src="first-turn.js"></script><script src="app.js">');
html=html.replace('<link rel="stylesheet" href="help.css">','<link rel="stylesheet" href="help.css"><link rel="stylesheet" href="ux.css">');
write('index.html',html);
let help=read('help.js');
help=help.replace(/let t=cur\?\.turnout;if\(mode==='demo'&&cur\)\{.*?\}\n \$\('participationSource'\)/s,"let t=cur?.turnout;\n $('participationSource')");
help=help.replace("'DEMONSTRAÇÃO · Dados fictícios do simulador nacional: 80% de comparecimento e aproximadamente 2% de brancos / 3% de nulos.'","'BASE REAL DO 1º TURNO · Contagens distribuídas proporcionalmente na etapa simulada. Válidos incluem TODOS os candidatos; os cartões de projeção comparam apenas Lula e Flávio.'");
help=help.replaceAll('do eleitorado coberto','dos eleitores das seções contadas').replace('Participação e tipos de voto','Quem votou e como votou').replace('Eleitorado coberto neste resumo','Eleitores das seções contadas');
help=help.replace(' (campo e.esi)','').replace(' (v.tv)','').replace(' (v.tvn = v.vn + v.vnt)','');
const start=help.indexOf(' const steps=['),end=help.indexOf(' let index=',start);
help=help.slice(0,start)+` const steps=[
 ['.mode','1. Escolha os dados','Demonstração com 1º turno usa resultados reais de 2026 em etapas proporcionais simuladas. Não reproduz a ordem histórica da apuração. O outro modo consulta o segundo turno oficial.'],
 ['.summary','2. Veja quanto já foi contado','Seções são os grupos eleitorais cujos resultados são recebidos. 10% das seções não significa exatamente 10% dos eleitores. Na demonstração, o avanço é uma etapa proporcional simulada.'],
 ['#participation','3. Entenda a participação','Abstenção significa que a pessoa não compareceu. Brancos e nulos são votos sem escolha válida de candidato. Os percentuais usam bases diferentes, explicadas neste bloco. Os válidos do 1º turno incluem todos os candidatos.'],
 ['.results','4. Compare votos atuais e projetados','Os cartões comparam somente Lula e Flávio. Por isso seus percentuais somam 100% mesmo no primeiro turno, em que houve outros candidatos. A projeção responde: e se o ritmo continuar? Ela não transfere os votos dos demais candidatos.'],
 ['#brazilMap','5. Explore uma cidade','Vermelho: Lula está à frente de Flávio. Azul: Flávio está à frente de Lula. Cinza: sem dados, zero ou empate entre eles. Use a busca e o seletor de cidade como alternativa ao mapa. No primeiro turno, os dados municipais são carregados da fonte oficial.'],
 ['.regionalControls','6. Avance uma região','Na demonstração, escolha uma região e avance a contagem. As proporções vêm dos resultados do primeiro turno de cada estado. Isso mostra como diferentes velocidades de apuração podem mudar a liderança nacional.'],
 ['#regionRows','7. Veja o peso de cada região','A tabela mostra quanto foi contado e quantos votos cada região ainda pode acrescentar. O saldo identifica o candidato favorecido. No celular, deslize a tabela para os lados.'],
 ['.scenarioBox','8. Explore cenários com cuidado','Esta área é opcional. Ela compara 4.000 resultados possíveis sob hipóteses de variação nos votos restantes. Frequência nos cenários não é chance real de eleição. Na demonstração, a base é o primeiro turno e não prevê migração de votos.'],
 ['.regionalMethodology','9. Confira como calculamos','Aqui estão as fórmulas e os limites do modelo regional. Para os dados oficiais, uma projeção nacional exige todos os estados, Distrito Federal e exterior com leituras suficientes.'],
 ['.history','10. Compare as leituras','O gráfico e a tabela mostram a evolução do cálculo nacional acima. Exportar histórico salva as leituras antes de fechar a página. As etapas da demonstração são simuladas, não registros históricos.'],
 ['.methodology','11. Consulte as regras quando precisar','Estas são as fórmulas do cálculo nacional. Você chegou ao fim: Concluir fecha o tutorial. O botão Como usar permite começar novamente a qualquer momento.']
 ];
`+help.slice(end);
help=help.replaceAll('Próximo ↑','Próximo ↓').replaceAll('DE BAIXO PARA CIMA','DE CIMA PARA BAIXO');
write('help.js',help);
