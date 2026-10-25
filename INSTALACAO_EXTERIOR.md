# Painel Eleitoral 2026 — painel de votos do exterior por país

## Instalação (aplicar ao projeto existente)

Extraia o pacote de atualização **na pasta que contém `dist/` e `serve.cjs`** (a pasta raiz do seu Painel Eleitoral 2026), preservando as subpastas. Se o ZIP trouxer a pasta `horizonte/`, copie **o conteúdo** dela para a raiz do seu projeto.

### Arquivo existente que será substituído

- `dist/index.html` — acrescenta a folha de estilo e quatro novos scripts, carregados após `regional.js`.

### Arquivos novos

- `dist/exterior.css` — estilos responsivos para a seção de países.
- `dist/exterior.js` — painel, filtros, coleta oficial, estados parciais, botão interromper e exportação CSV.
- `dist/exterior-model.js` — validação do resultado TSE e soma sem duplicar localidades.
- `dist/exterior-locations.js` — cadastro de 186 localidades do TSE de 2026 e correspondência com países; essa **tabela país/localidade é curadoria do Painel Eleitoral 2026**, não é publicada pronta pelo TSE.
- `dist/exterior-first-turn-data.js` — inicialmente vazio: pode ser substituído pelo importador para carregar imediatamente os resultados completos do primeiro turno, mesmo sem conexão.
- `import-exterior.cjs` — baixa resultados oficiais completos do 1º turno (com cache e limitação de requisições), confere a soma contra o arquivo `data-first-turn/zz.json` e gera `dist/exterior-first-turn-data.js`.
- `test-exterior.cjs` — teste de agrupamento, leitura, cobertura e reconciliação.
- `INSTALACAO_EXTERIOR.md` — estas instruções.

### Como usar

1. Abra o terminal na pasta raiz do Painel Eleitoral 2026 e rode `node serve.cjs`. Acesse `http://127.0.0.1:4173/`.
2. Role até a seção **Votos no exterior, país por país**, logo abaixo do painel territorial.
3. Na demonstração do **1º turno**, clique em **Carregar/atualizar 1º turno**. O navegador buscará diretamente no TSE os arquivos de 186 localidades (consulta gradual, não automática). A consulta exige acesso à internet e permissão CORS do servidor do TSE.
4. Para exibir o **resultado do 1º turno imediatamente e offline** nas próximas aberturas, execute **uma vez** `node import-exterior.cjs` (no seu computador com acesso à internet). Ele pode ser reexecutado para retomar downloads interrompidos. Confere todas as localidades antes de salvar o arquivo final. Não há dependências NPM.
5. Ao mudar para **2º turno · dados oficiais**, clique em **Consultar 2º turno por localidade**. Este é um fluxo manual, independente da atualização nacional a cada 30 segundos. Coletar 186 arquivos leva tempo, respeitando um intervalo mínimo de 280ms entre requisições e interrompendo em erro de rede/HTTP.
6. Busque país ou localidade, altere a ordenação, expanda um país para inspecionar cidades, ou exporte o CSV do turno ativo.

### Regras importantes

- A apuração **nacional já inclui ZZ**. O painel exterior é **somente analítico**: **não soma votos adicionais ao resumo nacional**.
- Na demonstração os resultados por país são os **totais finais oficiais do 1º turno**; não mudam quando você avança artificialmente a apuração do projeto.
- No 1º turno, os percentuais exibidos comparam apenas Lula e Flávio; o painel conserva os votos válidos dos demais candidatos na contagem total.
- O 2º turno usa os arquivos do TSE referentes à eleição **6258**, não transfere dados do 1º turno para projetar países. Países com localidades ainda sem consulta têm **cobertura parcial**. A soma não é rotulada como reconciliada se diferir do agregado ZZ (leituras não são simultâneas).
- O TSE publica resultados por localidade eleitoral; o agrupamento por país é uma tabela manual auditável. Consulte as informações oficiais dos locais de votação quando atualizar essa correspondência em outro pleito.
- A integração foi testada estruturalmente e com dados oficiais que já estavam no ZIP; nesta execução não foi possível baixar os 186 arquivos do TSE nem testar a interface em navegador por restrições do ambiente de execução.

### Testes

Na raiz:

```bash
node test-exterior.cjs
node test-first-turn.cjs
node test-model.cjs
node test-regional.cjs
```

### Referências

- TSE (resultados 2026): https://resultados.tse.jus.br/oficial/ele2026/6257/dados/zz/zz-c0001-e006257-u.json
- Documentação técnica: https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados
- TSE (locais de votação no exterior): https://www.tse.jus.br/hotsites/locais-votacao-exterior/
