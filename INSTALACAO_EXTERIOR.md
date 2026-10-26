# Painel Eleitoral 2026 — painel de votos do exterior por país

## Instalação (aplicar ao projeto existente)

Extraia o pacote **na pasta que contém `dist/` e `serve.cjs`** (a pasta raiz do Painel Eleitoral 2026), preservando as subpastas. O workflow do GitHub Actions coleta os arquivos do TSE e publica os snapshots compartilhados em `dist/data/tse/`.

### Arquivo existente que será substituído

- `dist/index.html` — inicia a aplicação nos dados oficiais do segundo turno e carrega os módulos antes de iniciar o painel.
- `dist/tse-client.js` — lê os snapshots publicados pelo projeto e continua funcionando se `manifest.json` ainda não tiver sido publicado.
- `dist/regional.js` — carrega automaticamente os snapshots municipais do segundo turno no mapa.
- `collect-tse.cjs` — conserva snapshots e histórico quando os resultados não mudaram; ignora diferenças apenas de horário e identificador.
- `.github/workflows/pages.yml` — coleta os dados nacionais e estaduais e publica o Pages a cada cinco minutos.
- `.github/workflows/localities.yml` — coleta municípios e exterior separadamente, a cada vinte minutos, sem bloquear a atualização nacional.
- `dist/data/tse/localities-manifest.json` — versão independente dos snapshots municipais e do exterior.

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
3. A aplicação abre por padrão em **2º turno · dados oficiais**. O mapa e o painel do exterior leem os snapshots compartilhados do projeto; o navegador não consulta a API do TSE.
4. A visão completa e a visão simples verificam novas publicações uma vez por minuto. No GitHub, Brasil e estados são consultados a cada cinco minutos; municípios e exterior rodam em outro workflow a cada vinte minutos. O GitHub pode atrasar o início das execuções agendadas.
5. Os municípios são consultados em lotes rotativos. O mapa mostra os últimos snapshots disponíveis; cidades ainda não publicadas permanecem sem dados. Snapshots só mudam quando os totais eleitorais mudam. Os dados municipais e do exterior ficam versionados separadamente para não atrasar nem sobrescrever a coleta nacional.
6. Busque país ou localidade, altere a ordenação, expanda um país para inspecionar os números ou exporte o CSV do turno ativo.

### Regras importantes

- A apuração **nacional já inclui ZZ**. O painel exterior é **somente analítico**: **não soma votos adicionais ao resumo nacional**.
- Na demonstração os resultados por país são os **totais finais oficiais do 1º turno**; não mudam quando você avança artificialmente a apuração do projeto.
- No 1º turno, os percentuais exibidos comparam apenas Lula e Flávio; o painel conserva os votos válidos dos demais candidatos na contagem total.
- O 2º turno usa os arquivos da eleição **6258**, não transfere dados do 1º turno para projetar países. Países com localidades ainda sem snapshot têm **cobertura parcial**. A soma não é rotulada como reconciliada se diferir do agregado ZZ (leituras não são simultâneas).
- O TSE publica resultados por localidade eleitoral; o agrupamento por país é uma tabela manual auditável. Consulte as informações oficiais dos locais de votação quando atualizar essa correspondência em outro pleito.
- GitHub Actions permite agendar workflows no mínimo a cada cinco minutos; verificar a página a cada minuto não faz a coleta do TSE ocorrer a cada minuto. A documentação oficial do GitHub também informa que workflows agendados podem atrasar.

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
