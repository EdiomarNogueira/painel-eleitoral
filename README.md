# Painel Eleitoral 2026 — apuração e cenários eleitorais

Abra dist/index.html ou execute `node serve.cjs` e acesse http://127.0.0.1:4173/ . Não há instalação de dependências. O workflow `.github/workflows/pages.yml` prepara a publicação em GitHub Pages e a coleta compartilhada dos dados oficiais.

## Demonstração com 1º turno

A base contém resultados oficiais finais de 2026 (eleição 6257): Brasil, 26 estados, Distrito Federal, exterior e 5.571 municípios. O mapa tem 5.570 contornos do IBGE. Boa Esperança do Norte aparece na busca e nos dados, mas não tem contorno nessa malha. Votos municipais foram reconciliados com cada UF; UFs e exterior, com o Brasil.

O resultado final é distribuído proporcionalmente em etapas. Essas etapas NÃO são o histórico real da apuração. Avançar uma região atualiza o resumo nacional; o botão nacional avança todos os estados. A projeção simples e a projeção por estados usam a mesma contagem e métodos diferentes. O mapa mostra o resultado municipal final, separado das etapas simuladas.

As projeções comparam Lula e Flávio: os percentuais usam apenas os votos dos dois. Não há transferência de votos dos outros candidatos. A tabela de referência apresenta todos os candidatos e percentuais sobre todos os válidos. Abstenção, comparecimento, brancos, nulos e válidos também vêm da base real, com contagens proporcionais à etapa.

## Coleta compartilhada do TSE no GitHub

Os navegadores não consultam mais `resultados.tse.jus.br`. O workflow `.github/workflows/pages.yml` consulta a fonte oficial e salva os arquivos públicos e o histórico em `dist/data/tse/`; as páginas leem esses arquivos no GitHub Pages. Brasil, 28 unidades territoriais e as localidades do exterior são atualizados em cada execução. As 5.571 cidades são distribuídas por 24 lotes, com cobertura prevista em cerca de duas horas. O histórico comum de Brasil e estados conserva até 120 leituras; o histórico municipal também é compartilhado.

O agendamento do GitHub Actions está configurado para cinco minutos e pode atrasar. Nas execuções agendadas, o Pages só é republicado quando há dados novos; envios à branch principal e execuções manuais também publicam o site. Na primeira execução, o workflow faz a carga inicial das cidades, que pode levar dezenas de minutos. No repositório, deixe `.github/workflows/pages.yml`, `collect-tse.cjs` e `dist/` na raiz — não dentro de uma pasta `painel-eleitoral/`. Habilite Actions com permissão de escrita em `contents` e selecione **Settings → Pages → Build and deployment → GitHub Actions**. A execução manual está disponível na aba Actions.

## Medir acessos ao site

O GitHub Pages não mostra, no painel do projeto, uma contagem de visitas às páginas publicadas. **Insights → Traffic** mostra visitas ao repositório de código nos últimos 14 dias, que não são necessariamente visitas ao painel. Para contar as visitas ao site, conecte um serviço de analytics, como [GoatCounter](https://www.goatcounter.com/), depois de criar uma conta e definir o identificador do site; o código de medição precisa desse identificador. Nenhum rastreador está ativo neste pacote.

## Segundo turno oficial

O segundo turno usa os snapshots centralizados da eleição 6258. O botão atualiza a leitura publicada pelo projeto; a coleta agendada é única e compartilhada. Os históricos ficam no repositório e também podem ser exportados na visão completa. A disponibilidade dos dados depende das execuções agendadas e da publicação do GitHub Pages.

## Cenário regional e mostrador

Escolha uma região e a porcentagem FINAL de Lula ou Flávio; o outro valor é preenchido para somar 100%. O cenário preserva o total projetado da região e as projeções de todas as demais. Não altera votos já observados. Percentuais que exigiriam retirar votos contados são recusados. Atualização da base descarta o cenário anterior e pede novo cálculo.

O mostrador vai de 100% Lula à esquerda a 100% Flávio à direita. Oferece votos projetados ou frequência de liderança em 4.000 cenários experimentais. A frequência NÃO é uma probabilidade real validada. O modelo usa erros normais correlacionados por região e parcialmente nacionais, desvio ajustável e redução de incerteza conforme a apuração. O volume restante é fixo; não há calibração histórica ou transferência de votos entre turnos.

## UX e tutorial

Navegação por partes, controles e textos maiores, fotos oficiais, cores consistentes, busca de cidade como alternativa ao mapa, informação textual além das cores, área avançada recolhível e bases de cálculo explicadas. Tutorial com 13 etapas de cima para baixo, Anterior, Próximo, Cancelar, Escape e Concluir. Respeita movimento reduzido e restaura os detalhes que abriu.

## Fontes

- TSE: https://resultados.tse.jus.br/oficial/ele2026/6257/dados/
- Documentação: https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados
- IBGE: https://servicodados.ibge.gov.br/api/docs/malhas?versao=3
- Fotos oficiais: arquivos e atribuição em dist/photos/sources.json.

## Verificação e manutenção

Execute `node test-model.cjs`, `node test-regional.cjs` e `node test-first-turn.cjs`. Os testes verificam extrapolação, correções, contagens ausentes, participação, cenários, conservação de votos e reconciliação dos municípios, estados e Brasil.

No navegador foram exercitados consulta oficial, mapa, busca, avanço regional integrado, fotos, cenário Nordeste 60%/40%, limites dos votos contados, métricas do mostrador e tutorial. Validação funcional não equivale a validação estatística.

O importador `import-first-turn.cjs` conserva os arquivos em data-first-turn/ e gera bases estáticas. Opções: --cities para municípios e --photos para fotos. Usa cache e cadência limitada. `build-map.cjs` transforma a malha em SVG. Scripts revise-*.cjs, unify-demo.cjs e connect-scenario.cjs são migrações já aplicadas: não execute novamente.

## Painel de votos no exterior por país

A seção abaixo do mapa territorial agrupa as **186 localidades eleitorais do exterior** (TSE/ZZ) por país, mostra cobertura das leituras compartilhadas, votos válidos, votos de Lula e Flávio, localidades de cada país, busca, ordenação e exportação CSV. No 1º turno, os votos por país são os finais reais e independentes da etapa simulada. No 2º, os snapshots são coletados pelo workflow; os totais regionais e nacionais **não** recebem somas extras. Para preparar cache local do 1º turno execute `node import-exterior.cjs` (usa os arquivos oficiais por localidade e confere ZZ). Veja `INSTALACAO_EXTERIOR.md` para limites e uso.


## Visão simples alternativa

Abra `/simples.html` ou o link “Visão simples” no cabeçalho original. A interface organiza os dados em Resumo, Regiões, Simular e Exterior, com comparação entre contagem e projeção, evolução por leitura e volume restante por região. O botão “Como usar?” oferece um tutorial de oito etapas que percorre as áreas e muda de aba conforme explica cada uma. A visão completa continua disponível.

Usa os mesmos modelos e bases. A visão oficial carrega o histórico comum publicado pelo projeto; a demonstração e a simulação continuam locais à sessão. A frequência experimental fica recolhida; o ponteiro principal indica votos projetados. Use o botão de carregar para buscar as leituras compartilhadas mais recentes.

Execute também `node test-simples.cjs`: cobertura, agregação, conservação regional e validade temporal das leituras.


## Comparativo entre Turnos

A aba Comparativo em `/simples.html#comparison` usa exclusivamente resultados oficiais, independentemente da demonstração. Brasil, 27 UFs e 5.571 municípios reutilizam o 1º turno consolidado. Países usam a soma das localidades TSE/ZZ do cadastro existente, exigindo todas as leituras do país por turno.

Apresenta totais, variação absoluta, variação relativa do número de votos, percentuais oficiais ou normalizados entre finalistas e diferença em pontos percentuais. Também compara eleitorado, cobertura, comparecimento, abstenções, brancos, nulos e válidos. Cada turno conserva seu denominador e horário; percentuais sem base ficam indisponíveis. Sem seções totalizadas no 2º turno, variações de votos aguardam o início da contagem.

TSEStore compartilha cache e leituras recebidas entre as áreas da visão simples e valida eleição/localidade/contagens/data. O comparativo lê os snapshots do projeto; não dispara consultas do navegador ao TSE. A cobertura municipal do 2º turno depende dos lotes agendados.

Limite explícito: não há comparação de seções equivalentes, porque os arquivos agregados consumidos não identificam as seções comuns. Não há inferência de transferência de votos. O total por país depende do cadastro de localidades e não é tratado como uma abrangência oficial própria do TSE.

Verificação: `node test-comparativo.cjs` cobre normalização, p.p., variação relativa, parciais, base zero, dados ausentes, agregação por país, bases locais, cache, deduplicação e rejeição de leituras inválidas. Consultas reais validadas no navegador para Brasil, SP, São Paulo e Portugal; layout verificado em celular de 390 px.

#   p a i n e l - e l e i t o r a l  
 