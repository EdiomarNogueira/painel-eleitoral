# Como ler e alterar o código

Comece pelo arquivo da tela ou da regra que deseja mudar. Não é necessário ler o projeto inteiro.

## Caminho de uma atualização

1. `collect-tse.cjs` consulta o TSE e salva os arquivos oficiais em `dist/data/tse/`.
2. `dist/tse-client.js` entrega esses arquivos às telas. Também mantém os resultados completos em cache.
3. `dist/tse-store.js` compartilha consultas entre consumidores: verifica cache, evita consultas simultâneas iguais, valida a resposta e avisa as telas.
4. Os arquivos terminados em `-model.js` calculam os indicadores. Não manipulam HTML.
5. Os controladores, como `simples.js`, recebem esses valores e atualizam a interface.

O site usa JavaScript sem etapa de compilação. Os arquivos em `dist/` são também os fontes da interface; uma alteração neles aparece ao recarregar a página. O nome dessa pasta foi preservado porque os workflows já a publicam.

## Onde procurar

| Alteração                              | Arquivo                               | Ponto de entrada                               |
| -------------------------------------- | ------------------------------------- | ---------------------------------------------- |
| Encerramento e validade dos resultados | `dist/result-policy.js`               | `isCompleteResult`, `hasUsableRegionalResults` |
| Cache e deduplicação                   | `dist/tse-store.js`                   | `loadSharedResult`, `fetchAndCacheResult`      |
| Projeção nacional                      | `dist/model.js`                       | `projectFinalVotes`                            |
| Projeção por estado e município        | `dist/regional-model.js`              | `estimateFinalVotes`                           |
| Simulação de mudança regional          | `dist/scenario-model.js`              | `applyRegionalShare`                           |
| Diferenças entre turnos                | `dist/comparativo-model.js`           | `compareRounds`                                |
| Cartões do resumo simples              | `dist/simples.js`                     | `renderCountedVotes`, `renderProjectedVotes`   |
| Gráfico de evolução                    | `dist/simples.js`                     | `renderProjectionTrend`                        |
| Abstenção, brancos e nulos             | `dist/simples.js`                     | `renderParticipation`                          |
| Mapa e seleção municipal               | `dist/regional.js`                    | `paintMap`, `renderSelectedCity`               |
| Tutorial                               | `dist/help.js`, `dist/simple-help.js` | `showTourStep`, `closeTutorial`                |

## Convenções de escrita

- Funções descrevem uma ação: `fetchAndCacheResult`, `renderParticipation`.
- Variáveis descrevem o dado: `currentResult`, `countedSections`, `remainingVotesA`.
- Comentários explicam motivos e restrições, principalmente eleitorado, encerramento e compartilhamento de consultas.
- Validação acontece antes do cálculo. Resultados ausentes não viram zero silenciosamente.
- Uma função de interface deve montar uma parte identificável da tela. O resumo simples, por exemplo, chama funções separadas para contagem, projeção, tendência e participação.
- Os nomes de implementação seguem inglês; as explicações de negócio e os textos da tela usam português.

## Campos compactos mantidos por compatibilidade

Os históricos já gravados, os modelos e as telas compartilham um formato. Alterar suas chaves exigiria uma migração de dados; por isso os campos abaixo foram preservados. Dentro das funções, prefira nomes descritivos ou desestruturação com aliases.

| Campo               | Significado                                                                 |
| ------------------- | --------------------------------------------------------------------------- |
| `a`, `b`            | Votos dos finalistas 13 e 22, respectivamente                               |
| `st`, `ts`          | Seções totalizadas e total de seções                                        |
| `p`                 | Percentual de seções totalizadas                                            |
| `ra`, `rb`          | Votos restantes estimados de cada finalista                                 |
| `est`               | Estimativa de uma unidade territorial                                       |
| `h`                 | Histórico retornado pela função de atualização                              |
| `remaining`         | Eleitores das seções ainda não totalizadas                                  |
| `time`, `timestamp` | Horário oficial convertido em milissegundos                                 |
| `received`          | Horário de recebimento; o formato varia entre modelos, confira o consumidor |

As APIs globais existentes, como `RegionalModel.estimate`, também permanecem. A exportação ao final do arquivo relaciona esses nomes à implementação descritiva, como `estimateFinalVotes`.

## Arquivos que não são código de manutenção diária

- `dist/data/tse/`: arquivos oficiais, históricos e manifestos produzidos pelo coletor.
- `map-data.js`, `municipios.geojson`, `first-turn-data.js`, `first-turn-cities.js`, `compare-cities.js` e bases do exterior: dados gerados. Permanecem compactos.
- `build-map.cjs`, `import-first-turn.cjs`, `import-exterior.cjs`: ferramentas de preparação das bases.
- `revise-*`, `connect-scenario.cjs`, `unify-demo.cjs`: scripts históricos de migração, não usados na execução do site. Não os execute para iniciar ou atualizar o painel.

## Rotina de manutenção

1. Execute `npm start` para abrir a prévia local.
2. Altere a regra no modelo ou a apresentação no controlador correspondente.
3. Execute `npm test`: verifica a sintaxe dos scripts e os oito arquivos de testes existentes.
4. Confira a tela completa e a simples no navegador; os testes de cálculo não substituem essa conferência.
5. Para usar o formatador, execute `npm install` uma vez e depois `npm run format`. Os dados gerados são ignorados.

Os passos de publicação e coleta estão em `MANUTENCAO.md`.
