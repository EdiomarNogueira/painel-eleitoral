# Manutenção do Painel Eleitoral 2026

## Caminho dos dados

1. `collect-tse.cjs` consulta o TSE e grava resultados em `dist/data/tse/`.
2. Os workflows em `.github/workflows/` coletam/publicam dados pendentes a cada cinco minutos. Execuções longas e filas podem aumentar esse prazo.
3. `dist/tse-client.js` lê os arquivos publicados (ou locais), compartilha o cache e entrega os dados às telas.
4. `dist/tse-store.js` valida e compartilha as leituras do Comparativo e da visão simples.
5. `dist/regional-model.js` calcula estimativas; `dist/result-policy.js` decide quando um resultado está completo e quando dados parciais precisam estar recentes.

## O que significa encerrado

Usamos `seções totalizadas === total de seções`, com total maior que zero. Não usamos o percentual arredondado do TSE. Um resultado completo validado é reutilizado independentemente de sua idade. Cada município, estado, agregado Exterior e Brasil é avaliado separadamente: Brasil completo não autoriza considerar um município ausente como completo.

Ao encerrar, a projeção é o próprio total de votos e o restante é zero. Diferenças entre horários de encerramento dos estados não bloqueiam o mostrador. Dados parciais continuam sujeitos à verificação de atualização.

## Atualizar os dados

```powershell
node collect-tse.cjs                 # todas as localidades; consulta apenas as pendentes
node collect-tse.cjs --core-only     # Brasil, estados, DF e agregado Exterior
node collect-tse.cjs --localities-only # municípios e localidades no exterior
node collect-tse.cjs --force         # revisão explícita, incluindo resultados completos
node serve.cjs                       # prévia local na porta 4173
```

O primeiro turno consolidado local é preservado. `--force` existe para revisar eventuais retificações oficiais; resultados com 100% não são consultados novamente de forma automática. Reinicie/recarregue a página após uma revisão forçada para limpar o cache final da sessão.

Na prévia local, os arquivos existentes na pasta têm prioridade sobre a publicação remota. `PAINEL_REMOTE=1` permite testar a versão de dados publicada. Alterações locais não publicam o site: os workflows só recebem o código após envio ao repositório.

## Onde editar a interface

- `dist/app.js`: resumo da visão completa.
- `dist/regional.js`: mapa, carregamento municipal e resultados por região.
- `dist/scenario.js`: cenário regional e mostrador da visão completa.
- `dist/simples.js`: abas da visão simples.
- `dist/comparativo.js`: comparação entre turnos.
- `dist/exterior.js`: painel de países.

Os modelos de cálculo ficam separados da interface. Os arquivos de dados gerados (mapas, bases eleitorais e JSON de resultados) permanecem compactos; não são código para edição manual.

## Verificação

Execute `node test-completion.cjs`, `node test-model.cjs`, `node test-regional.cjs`, `node test-simples.cjs`, `node test-comparativo.cjs`, `node test-first-turn.cjs` e `node test-exterior.cjs`.

Os arquivos de lógica e HTML foram formatados com Prettier 3.6.2. Evite executar scripts antigos de migração (`revise-*`, `unify-demo`, `connect-scenario`): suas alterações já estão aplicadas.
