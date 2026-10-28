/** Controlador do mapa: seleção de cidades, históricos territoriais e atualização das cores. */
(() => {
  const regionalModel = RegionalModel;
  const mapData = MAP_DATA;
  const byId = new Map(mapData.cities.map((c) => [c.id, c]));
  const cityNames = new Map(
    mapData.cities.map((c) => [
      c.id,
      c.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase(),
    ]),
  );
  const ufCodes = mapData.ufs.map((u) => u.uf);
  const elementById = (id) => document.getElementById(id);
  const formatVotes = (n) => Math.round(n).toLocaleString("pt-BR");
  const formatPercent = (n) =>
    n.toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }) + "%";
  const escapeHtml = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  let nationalDemoHistory = [];
  let demo = true;
  let stateHistories = {};
  let municipalHistories = {};
  let officialStateHistories = {};
  let officialMunicipalHistories = {};
  let selected = null;
  let job = 0;
  let loading = false;
  let view = [0, 0, 700, 690];
  let pathsById = null;
  let dirtyCities = new Set();
  let allColorsDirty = true;
  let paintedSelection = null;
  let simulationTimer = null;
  let cityCoverageNote = "";
  const host = document.createElement("section");
  host.id = "territory";
  host.className = "panel territory";
  host.innerHTML = `<div class="sectionhead"><div><div class="eyebrow">O PESO DOS VOTOS QUE FALTAM</div><h2>De onde podem vir os próximos votos?</h2></div><span class="tag">CIDADES, ESTADOS E REGIÕES</span></div><p id="regionalNotice" class="notice" role="status"></p><div class="geoToolbar"><label>Estado <select id="mapUF"><option value="">Brasil inteiro</option>${mapData.ufs
    .filter((u) => u.uf !== "zz")
    .map((u) => `<option value="${u.uf}">${escapeHtml(u.name)}</option>`)
    .join(
      "",
    )}</select></label><label>Buscar cidade <input id="citySearch" placeholder="Ex.: Salvador" type="search"></label><label>Cidade <select id="citySelect"><option value="">Selecione uma cidade</option></select></label></div><div class="geoLayout"><div><div class="mapShell"><svg id="brazilMap" viewBox="0 0 700 690" role="img" aria-label="Mapa municipal do Brasil: vermelho Lula, azul Flávio, cinza sem liderança observada"><g id="cityPaths">${mapData.cities.map((c) => `<path d="${c.path}" data-id="${c.id}" fill="#d5d8db"><title>${escapeHtml(c.name)} / ${c.uf.toUpperCase()}</title></path>`).join("")}</g></svg><div class="mapButtons"><button id="mapReset" title="Ver Brasil inteiro">Brasil ↗</button></div></div><div class="mapLegend"><span><i style="background:#c84d4d"></i>Lula</span><span><i style="background:#387cc1"></i>Flávio Bolsonaro</span><span><i style="background:#d5d8db"></i>Sem dados / zero / empate</span></div><small>Cor = liderança entre Lula e Flávio, nunca probabilidade nem vencedor entre todos os candidatos do 1º turno. Malha simplificada do IBGE; exterior fora do mapa. Boa Esperança do Norte está disponível na busca, mas não tem contorno nesta malha.</small></div><aside class="cityPanel"><div class="eyebrow">DETALHE DO MUNICÍPIO</div><h3 id="cityTitle">Explore o mapa</h3><div id="cityInfo">Clique em uma cidade ou use a busca para ver votos, apuração e projeção local.</div><button id="loadCity" class="primary" hidden>Carregar dados desta cidade</button><div class="liveRegional" hidden><button id="loadUF" class="primary">Carregar dados dos estados e exterior</button><button id="loadCities" class="secondary">Carregar cidades da área escolhida</button><button id="stopRegions" class="secondary">Parar coleta</button></div><div id="regionalLoadStatus" role="status" class="miniNote"></div></aside></div><div class="regionalControls"><label>Como calcular por estado <select id="regionalMethod"><option value="recent">Ritmo dos últimos lotes por estado</option><option value="average">Proporção já contada em cada estado</option></select></label><div id="demoRegionControls"><label>Região da próxima leitura <select id="demoRegion">${Object.keys(
    regionalModel.groups,
  )
    .map((g) => `<option ${g === "Nordeste" ? "selected" : ""}>${g}</option>`)
    .join(
      "",
    )}</select></label><label hidden>Lula no próximo lote <input id="regionalShare" type="range" min="0" max="100" value="70"><output id="regionalShareLabel">70%</output></label><button id="advanceRegion" class="primary">Avançar 5 pontos nesta região</button><button id="resetRegions" class="secondary">Reiniciar cenário territorial</button></div></div><div class="regionalTotals" id="regionalTotals"></div><div class="tablewrap"><table><thead><tr><th>Região</th><th>Contagem concluída</th><th>Lula agora</th><th>Flávio agora</th><th>Votos por seção: Lula / Flávio</th><th>Em 100% entre os dois: Lula / Flávio</th><th>Quem ganha mais votos no restante?</th></tr></thead><tbody id="regionRows"></tbody></table></div><div id="turnaround" class="projection"></div><details class="scenarioBox"><summary>Avançado: explorar cenários possíveis</summary><div class="eyebrow">ANÁLISE EXPERIMENTAL DE CENÁRIOS</div><h2>Em quantos cenários cada um termina à frente?</h2><p>Frequência em 4.000 simulações, condicionada às hipóteses abaixo. <b>Não é uma chance de eleição calibrada.</b></p><label for="uncertainty">Incerteza sobre a participação nos votos restantes: <output id="sigmaLabel">8 pontos percentuais</output></label><input id="uncertainty" type="range" min="1" max="25" value="8"><div id="chances"></div><p id="chanceRange"></p><small>O controle define o desvio-padrão inicial. Erros são correlacionados dentro da mesma região e parcialmente entre regiões. Alterar esse valor pode mudar muito os percentuais.</small></details><details class="regionalMethodology"><summary>Hipóteses, cobertura e limitações</summary><p>O mapa usa votos municipais observados. A projeção nacional usa os 26 estados, o Distrito Federal e o exterior, sem somar municípios novamente. Cada estado projeta votos atuais + votos por seção na janela × seções restantes. A janela inclui até cinco leituras distintas. O eleitorado das seções restantes limita o volume previsto; não estimamos comparecimento separadamente. A média acumulada é uma alternativa explícita, sem substituir silenciosamente o ritmo recente.</p><p>A projeção nacional exige dados suficientes de todos os 26 estados, do Distrito Federal e do exterior. Com dados oficiais, a coleta completa deve ter sido recebida nos últimos 5 minutos e as datas dos arquivos devem ter diferença de até 15 minutos. Cobertura parcial é mostrada como parcial. As leituras são coletadas pelo workflow central e compartilhadas. Brasil, estados e exterior são consultados a cada cinco minutos; municípios são atualizados em lotes ao longo de cerca de duas horas. Locais sem arquivo disponível continuam cinza.</p><p>Nas simulações, o volume restante projetado de cada estado é fixo. A participação de Lula nesses votos recebe um erro normal com desvio σ × √(1 − fração apurada), com componente nacional 0,5 e componente regional √0,75; a participação é limitada entre 0 e 100%. Flávio recebe o restante. A faixa exibida contém 90% dos cenários, não é um intervalo de confiança validado. Não há ajuste histórico, backtest, modelo de comparecimento ou estimativa empírica de σ nesta versão. Não use a frequência como probabilidade real ou anúncio de eleito.</p><p>O avanço regional e o resumo nacional usam uma única demonstração. Alterar uma região atualiza também a contagem nacional. A base é o resultado real do primeiro turno de 2026. Cada estado avança proporcionalmente sobre seu total final; não há histórico real de lotes nem transferência dos votos dos demais candidatos. O mapa mostra o resultado municipal completo entre Lula e Flávio, separado das etapas simuladas dos estados. O histórico desta seção fica na memória até fechar a página.</p><a href="https://servicodados.ibge.gov.br/api/docs/malhas?versao=3" target="_blank" rel="noopener">Malhas do IBGE ↗</a> · <a href="https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados" target="_blank" rel="noopener">Documentação do TSE ↗</a></details><button id="exportRegions" class="secondary">Exportar leituras territoriais ↓</button>`;
  document.querySelector(".history").before(host);
  function showStatus(s) {
    elementById("regionalLoadStatus").textContent = s;
  }
  function sumSnapshots(list) {
    const s = {
      a: 0,
      b: 0,
      st: 0,
      ts: 0,
      remaining: 0,
      time: 0,
    };
    for (const x of list)
      for (const k of ["a", "b", "st", "ts", "remaining"]) s[k] += x[k];
    s.p = (100 * s.st) / s.ts;
    s.label = "Etapa proporcional do primeiro turno";
    return s;
  }
  function nationalSnapshot(index) {
    const ss = ufCodes.map((uf) =>
      index === undefined
        ? stateHistories[uf].at(-1)
        : stateHistories[uf][index],
    );
    const s = sumSnapshots(ss);
    const keys = Object.keys(ss[0].turnout);
    s.turnout = Object.fromEntries(
      keys.map((k) => [
        k,
        ss.some((x) => x.turnout[k] === null)
          ? null
          : ss.reduce((n, x) => n + x.turnout[k], 0),
      ]),
    );
    s.total = s.ts;
    s.counted = s.st;
    s.date = FIRST_TURN_DATA.national.date;
    s.label = "Etapa simulada · " + formatPercent(s.p);
    s.otherVotes = ss.reduce((n, x) => n + x.otherVotes, 0);
    return s;
  }
  function emitNational() {
    window.dispatchEvent(
      new CustomEvent("horizonte-demo-snapshot", {
        detail: nationalDemoHistory,
      }),
    );
  }
  function advanceDemo(ufs, step = 5) {
    for (const uf of ufs) {
      const h = stateHistories[uf];
      const next = Math.min(100, h.at(-1).p + step);
      if (next !== h.at(-1).p) {
        h.push(FirstTurn.snapshot(FIRST_TURN_DATA.ufs[uf], next));
      }
    }
    const s = nationalSnapshot();
    if (s.st !== nationalDemoHistory.at(-1)?.st) {
      nationalDemoHistory.push(s);
    }
    emitNational();
    render();
  }
  function reset() {
    municipalHistories = {};
    for (const [id, base] of Object.entries(FIRST_TURN_CITIES)) {
      const snap = FirstTurn.snapshot(base, 100);
      snap.label = base.date + " " + base.time;
      municipalHistories[id] = [snap];
    }
    allColorsDirty = true;
    stateHistories = {};
    for (const uf of ufCodes)
      stateHistories[uf] = [
        FirstTurn.snapshot(FIRST_TURN_DATA.ufs[uf], 5),
        FirstTurn.snapshot(FIRST_TURN_DATA.ufs[uf], 10),
      ];
    nationalDemoHistory = [nationalSnapshot(0), nationalSnapshot(1)];
    emitNational();
    render();
  }
  function paintMap() {
    if (!pathsById) {
      pathsById = new Map(
        [...document.querySelectorAll("#cityPaths path")].map((path) => [
          path.dataset.id,
          path,
        ]),
      );
    }
    const paintCity = (id) => {
      const path = pathsById.get(id);
      if (!path) {
        return;
      }
      const c = municipalHistories[id]?.at(-1);
      const valid =
        c && Number.isFinite(c.a) && Number.isFinite(c.b) && c.a + c.b > 0;
      const fill =
        !valid || c.a === c.b ? "#d5d8db" : c.a > c.b ? "#c84d4d" : "#387cc1";
      if (path.getAttribute("fill") !== fill) {
        path.setAttribute("fill", fill);
      }
    };
    if (allColorsDirty) {
      for (const id of pathsById.keys()) paintCity(id);
      allColorsDirty = false;
      dirtyCities.clear();
    } else if (dirtyCities.size) {
      for (const id of dirtyCities) paintCity(id);
      dirtyCities.clear();
    }
    if (paintedSelection !== selected) {
      if (paintedSelection) {
        pathsById.get(paintedSelection)?.classList.remove("selectedCity");
      }
      if (selected) {
        pathsById.get(selected)?.classList.add("selectedCity");
      }
      paintedSelection = selected;
    }
  }
  function updateCityOptions() {
    const uf = elementById("mapUF").value;
    const q = elementById("citySearch")
      .value.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
    const cities = mapData.cities.filter(
      (c) => (!uf || c.uf === uf) && cityNames.get(c.id).includes(q),
    );
    elementById("citySelect").innerHTML =
      '<option value="">Selecione (' +
      cities.length +
      " cidades)</option>" +
      cities
        .slice(0, 600)
        .map(
          (c) =>
            `<option value="${c.id}">${escapeHtml(c.name)} / ${c.uf.toUpperCase()}</option>`,
        )
        .join("");
    if (cities.length > 600) {
      elementById("citySelect").insertAdjacentHTML(
        "beforeend",
        "<option disabled>Refine a busca para ver as demais cidades</option>",
      );
    }
  }
  function renderSelectedCity() {
    const c = byId.get(selected);
    elementById("loadCity").hidden = demo || !c;
    if (!c) {
      return;
    }
    elementById("cityTitle").textContent = c.name + " / " + c.uf.toUpperCase();
    const h = municipalHistories[c.id];
    const s = h?.at(-1);
    const e = regionalModel.estimate(h, elementById("regionalMethod").value);
    elementById("cityInfo").innerHTML = s
      ? `<p>${demo ? "1º TURNO · RESULTADO OFICIAL DE " + escapeHtml(s.label) : escapeHtml(s.label) + " · Brasília"}</p><strong>${formatPercent(s.p)} apurado</strong><p><b class="redText">Lula: ${formatVotes(s.a)} (${s.a + s.b ? formatPercent((100 * s.a) / (s.a + s.b)) : "—"})</b><br><b class="blueText">Flávio: ${formatVotes(s.b)} (${s.a + s.b ? formatPercent((100 * s.b) / (s.a + s.b)) : "—"})</b></p><p>Projeção local: ${e ? formatPercent((100 * e.a) / (e.a + e.b)) + " Lula / " + formatPercent((100 * e.b) / (e.a + e.b)) + " Flávio" : "sem base suficiente para o método selecionado"}</p><small>${demo ? "Comparação entre Lula e Flávio; os demais candidatos não entram neste percentual." : s.received ? "Recebido " + new Date(s.received).toLocaleTimeString("pt-BR") : ""}</small>`
      : "Sem leitura municipal. Consulte a cidade para obter votos e apuração.";
  }
  function getRegionalEstimates() {
    return ufCodes.map((uf) => ({
      uf,
      est: regionalModel.estimate(
        stateHistories[uf],
        elementById("regionalMethod").value,
      ),
    }));
  }
  function render() {
    paintMap();
    renderSelectedCity();
    elementById("regionalNotice").textContent = demo
      ? "DEMONSTRAÇÃO COM 1º TURNO · O mapa mostra o resultado municipal final entre Lula e Flávio. A simulação abaixo avança os estados separadamente, preservando as proporções reais de cada um. Não é o histórico da apuração nem uma previsão do segundo turno."
      : "DADOS DO TSE · O mapa carrega automaticamente os snapshots municipais do segundo turno; a projeção por estado usa o histórico compartilhado." +
        (cityCoverageNote ? " · " + cityCoverageNote : "");
    const entries = getRegionalEstimates();
    const ready = entries.filter((e) => e.est);
    const current = ufCodes
      .map((uf) => stateHistories[uf]?.at(-1))
      .filter(Boolean);
    let pa = 0;
    let pb = 0;
    for (const { est: e } of ready) {
      pa += e.a;
      pb += e.b;
    }
    const a = current.reduce((n, s) => n + s.a, 0);
    const b = current.reduce((n, s) => n + s.b, 0);
    const fresh =
      demo ||
      regionalModel.usableRegions(current, Date.now(), regionalModel.FRESH_MS);
    const complete = ready.length === 28 && fresh;
    elementById("regionalTotals").innerHTML =
      `<div><span class="label">LULA AGORA ${current.length < 28 ? "· PARCIAL" : ""}</span><strong class="redText">${a + b ? formatPercent((a / (a + b)) * 100) : "—"}</strong><small>${formatVotes(a)} votos</small></div><div><span class="label">FLÁVIO AGORA ${current.length < 28 ? "· PARCIAL" : ""}</span><strong class="blueText">${a + b ? formatPercent((b / (a + b)) * 100) : "—"}</strong><small>${formatVotes(b)} votos</small></div><div><span class="label">PROJEÇÃO TERRITORIAL · LULA / FLÁVIO</span><strong>${complete ? formatPercent((pa / (pa + pb)) * 100) + " / " + formatPercent((pb / (pa + pb)) * 100) : "Aguardando base"}</strong><small>${ready.length}/28 unidades com dados para projetar${!fresh ? " · coleta ausente ou defasada" : ""}</small></div>`;
    elementById("regionRows").innerHTML = Object.entries(regionalModel.groups)
      .map(([group, ufs]) => {
        const ss = ufs.map((u) => stateHistories[u]?.at(-1)).filter(Boolean);
        const ee = entries
          .filter((e) => ufs.includes(e.uf) && e.est)
          .map((e) => e.est);
        const c = sumSnapshots(ss);
        const valid = ss.length === ufs.length && ee.length === ufs.length;
        const x = ee.reduce((v, e) => v + e.a, 0);
        const y = ee.reduce((v, e) => v + e.b, 0);
        const rateA =
          ee.reduce((v, e) => v + e.rateA * e.current.ts, 0) /
          (ee.reduce((v, e) => v + e.current.ts, 0) || 1);
        const rateB =
          ee.reduce((v, e) => v + e.rateB * e.current.ts, 0) /
          (ee.reduce((v, e) => v + e.current.ts, 0) || 1);
        return `<tr><td>${group}${valid ? "" : " · parcial"}</td><td>${ss.length === ufs.length ? formatPercent(c.p) : "—"}</td><td>${formatVotes(c.a)}</td><td>${formatVotes(c.b)}</td><td>${valid ? formatVotes(rateA) + " · " + formatVotes(rateB) : "—"}</td><td>${valid ? formatPercent((x / (x + y)) * 100) + " · " + formatPercent((y / (x + y)) * 100) : "—"}</td><td>${valid ? formatVotes(Math.abs(x - c.a - (y - c.b))) + " para " + (x - c.a >= y - c.b ? "Lula" : "Flávio") : "—"}</td></tr>`;
      })
      .join("");
    const upside = ready
      .map(({ uf, est: e }) => ({
        uf,
        saldo: e.ra - e.rb,
      }))
      .sort((x, y) => Math.abs(y.saldo) - Math.abs(x.saldo));
    elementById("turnaround").textContent = complete
      ? `${pa > pb !== a > b ? "Virada no cenário: " : "Mantido o cenário: "}${pa === pb ? "empate" : pa > pb ? "Lula termina à frente" : "Flávio termina à frente"}. Diferença atual: ${formatVotes(Math.abs(a - b))} votos; projetada: ${formatVotes(Math.abs(pa - pb))}. Maior diferença nos votos restantes por estado: ${upside[0].uf.toUpperCase()}, ${formatVotes(Math.abs(upside[0].saldo))} a favor de ${upside[0].saldo >= 0 ? "Lula" : "Flávio"}.`
      : "Ainda não podemos calcular o total: consulte todos os estados e o exterior. Para medir o ritmo, precisamos de duas leituras com avanço na apuração.";
    elementById("advanceRegion").disabled =
      demo &&
      regionalModel.groups[elementById("demoRegion").value].every(
        (uf) => stateHistories[uf].at(-1).p >= 100,
      );
    const sigma = Number(elementById("uncertainty").value);
    elementById("sigmaLabel").textContent = sigma + " pontos percentuais";
    const sim = complete ? regionalModel.simulate(entries, sigma) : null;
    elementById("chances").innerHTML = sim
      ? `<div class="chance redText"><b>${formatPercent(sim.a)}</b><span>Lula à frente nos cenários</span></div><div class="chance blueText"><b>${formatPercent(sim.b)}</b><span>Flávio à frente nos cenários</span></div><div class="chance"><b>${formatPercent(sim.tie)}</b><span>Empate nos cenários</span></div>`
      : "Sem cobertura suficiente para simular o resultado nacional.";
    elementById("chanceRange").textContent = sim
      ? `Faixa com 90% dos cenários para Lula: ${formatPercent(sim.low)} a ${formatPercent(sim.high)} dos votos. ${demo ? "Base: primeiro turno real, com avanço proporcional simulado. " : ""}Frequências dependem do modelo e do controle de incerteza; mesmo 100% não significa certeza real.`
      : "";
    window.dispatchEvent(
      new CustomEvent("horizonte-territory-estimates", {
        detail: {
          entries,
          complete,
          demo,
          sigma,
        },
      }),
    );
  }
  window.addEventListener("horizonte-territory-request", () => render());
  function setBusy(v) {
    loading = v;
    for (const id of ["loadUF", "loadCities", "loadCity"])
      elementById(id).disabled = v;
  }
  async function fetchTerritorialResult(uf, code) {
    const file = uf + (code || "") + "-c0001-e006258-u.json";
    const r = await fetch(
      `https://resultados.tse.jus.br/oficial/ele2026/6258/dados/${uf}/${file}`,
      {
        cache: "no-cache",
        signal: AbortSignal.timeout(15000),
      },
    );
    if (!r.ok) {
      throw Error(`HTTP ${r.status} em ${uf}${code || ""}`);
    }
    const s = regionalModel.parse(await r.json(), uf, code);
    s.received = Date.now();
    return s;
  }
  async function collectTerritorialResults(tasks, type) {
    if (loading || demo) {
      return;
    }
    setBusy(true);
    const ticket = ++job;
    let done = 0;
    let corrections = 0;
    try {
      for (const t of tasks) {
        if (ticket !== job || demo) {
          break;
        }
        let s;
        try {
          s = await fetchTerritorialResult(t.uf, t.code);
        } catch (e) {
          if (type === "city" && /HTTP 404/.test(e.message)) {
            done++;
            showStatus(
              `${done}/${tasks.length} localidades carregadas; algumas ainda não têm snapshot central.`,
            );
            continue;
          }
          throw e;
        }
        if (ticket !== job || demo) {
          break;
        }
        const target =
          type === "uf" ? officialStateHistories : officialMunicipalHistories;
        if (type === "city") {
          const shared = await TSEClient.cityHistory(t.uf, t.code);
          if (shared.length) {
            target[t.id] = shared;
          }
        }
        const result = regionalModel.append(target[t.id] || [], s);
        if (result.old) {
          throw Error("Arquivo antigo recebido: coleta interrompida");
        }
        if (result.reset) {
          corrections++;
        }
        target[t.id] = result.h;
        if (type === "city") {
          dirtyCities.add(t.id);
        }
        done++;
        showStatus(
          `${done}/${tasks.length} leituras recebidas${corrections ? " · " + corrections + " janelas reiniciadas por correção" : ""}. Os municípios são fornecidos pelo lote central agendado do projeto.`,
        );
        if (done % 10 === 0 || type === "uf") {
          render();
        }
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      if (ticket === job) {
        showStatus(
          `Coleta concluída: ${done}/${tasks.length}. ${corrections} janelas reiniciadas. ${type === "uf" ? "Consulte novamente após avanço para medir o ritmo." : ""}`,
        );
      }
    } catch (e) {
      if (ticket === job) {
        showStatus(
          `Coleta interrompida após ${done}/${tasks.length}: ${e.message}. Dados anteriores preservados com data. O snapshot central do projeto pode estar ausente ou desatualizado.`,
        );
      }
    } finally {
      setBusy(false);
      render();
    }
  }
  function selectCity(id) {
    selected = id;
    renderSelectedCity();
    paintMap();
    elementById("citySelect").value = id;
  }
  function zoomToSelectedState() {
    const uf = elementById("mapUF").value;
    view = [0, 0, 700, 690];
    if (uf) {
      const bounds = mapData.cities
        .filter((c) => c.uf === uf && c.path)
        .map((c) =>
          document
            .querySelector(`#cityPaths path[data-id="${c.id}"]`)
            .getBBox(),
        );
      const x = Math.min(...bounds.map((b) => b.x));
      const y = Math.min(...bounds.map((b) => b.y));
      const r = Math.max(...bounds.map((b) => b.x + b.width));
      const b = Math.max(...bounds.map((b) => b.y + b.height));
      view = [x - 8, y - 8, r - x + 16, b - y + 16];
    }
    elementById("brazilMap").setAttribute("viewBox", view.join(" "));
  }
  let territoryLoading = false;
  let sharedTerritoryVersion = null;
  async function loadSharedTerritory(force = true) {
    if (demo || territoryLoading) {
      return;
    }
    territoryLoading = true;
    try {
      const [manifest, localitiesManifest] = await Promise.all([
        TSEClient.manifest(force),
        TSEClient.localitiesManifest(force),
      ]);
      const version = `${manifest?.checkedAt || "unversioned"}|${localitiesManifest?.checkedAt || "no-localities"}`;
      if (version === sharedTerritoryVersion) {
        return;
      }
      const shared = await TSEClient.history();
      const ufs = [
        ...new Set(mapData.cities.filter((c) => c.code).map((c) => c.uf)),
      ];
      const packs = await Promise.all(
        ufs.map(async (uf) => {
          const [results, histories] = await Promise.all([
            TSEClient.cityResults(uf, 6258).catch(() => ({})),
            TSEClient.cityHistories(uf).catch(() => ({})),
          ]);
          return {
            uf,
            results,
            histories,
          };
        }),
      );
      if (demo) {
        return;
      }
      const dataByUf = new Map(packs.map((p) => [p.uf, p]));
      const nextCity = {
        ...officialMunicipalHistories,
      };
      const received =
        Date.parse(
          localitiesManifest?.checkedAt ||
            manifest?.checkedAt ||
            shared.updatedAt ||
            "",
        ) || Date.now();
      let loaded = 0;
      let withVotes = 0;
      let invalid = 0;
      for (const city of mapData.cities) {
        if (!city.code) {
          continue;
        }
        const pack = dataByUf.get(city.uf);
        const raw = pack?.results?.[city.code];
        let history = Array.isArray(pack?.histories?.[city.code])
          ? [...pack.histories[city.code]]
          : [...(officialMunicipalHistories[city.id] || [])];
        if (raw) {
          try {
            const snapshot = regionalModel.parse(raw, city.uf, city.code);
            snapshot.received = received;
            const result = regionalModel.append(history, snapshot);
            if (!result.old) {
              history = result.h;
            }
          } catch {
            invalid++;
          }
        }
        if (history.length) {
          nextCity[city.id] = history;
          loaded++;
          if ((history.at(-1)?.st || 0) > 0) {
            withVotes++;
          }
        }
      }
      officialStateHistories = shared.ufs || {};
      stateHistories = officialStateHistories;
      officialMunicipalHistories = nextCity;
      municipalHistories = nextCity;
      allColorsDirty = true;
      sharedTerritoryVersion = version;
      cityCoverageNote = `${withVotes}/${mapData.cities.filter((c) => c.code).length} municípios com votos apurados; ${loaded - withVotes} ainda zerados · lote ${new Date(received).toLocaleString("pt-BR")}`;
      render();
      showStatus(
        `Snapshots municipais: ${loaded}/${mapData.cities.filter((c) => c.code).length} carregados, ${withVotes} com votos apurados${invalid ? ` · ${invalid} arquivos inválidos ignorados` : ""}.`,
      );
    } catch (e) {
      showStatus(
        "Não foi possível carregar os snapshots territoriais compartilhados: " +
          e.message,
      );
    } finally {
      territoryLoading = false;
    }
  }
  function switchMode(next) {
    job++;
    demo = next === "demo";
    document
      .querySelectorAll(".liveRegional")
      .forEach((e) => (e.hidden = demo));
    elementById("demoRegionControls").hidden = !demo;
    if (demo) {
      reset();
    } else {
      stateHistories = officialStateHistories;
      municipalHistories = officialMunicipalHistories;
      allColorsDirty = true;
      render();
      showStatus("Carregando os dados oficiais do segundo turno para o mapa…");
      loadSharedTerritory(true);
    }
  }
  window.addEventListener("horizonte-mode", (e) => switchMode(e.detail));
  elementById("mapUF").onchange = () => {
    updateCityOptions();
    zoomToSelectedState();
  };
  elementById("citySearch").oninput = updateCityOptions;
  elementById("citySelect").onchange = () =>
    selectCity(elementById("citySelect").value);
  elementById("cityPaths").onclick = (e) => {
    const id = e.target.dataset.id;
    if (id) {
      selectCity(id);
    }
  };
  elementById("mapReset").onclick = () => {
    elementById("mapUF").value = "";
    zoomToSelectedState();
    updateCityOptions();
  };
  elementById("regionalMethod").onchange = render;
  elementById("uncertainty").oninput = () => {
    elementById("sigmaLabel").textContent =
      elementById("uncertainty").value + " pontos percentuais";
    clearTimeout(simulationTimer);
    simulationTimer = setTimeout(render, 120);
  };
  elementById("loadUF").onclick = () =>
    collectTerritorialResults(
      ufCodes.map((uf) => ({
        id: uf,
        uf,
      })),
      "uf",
    );
  elementById("loadCity").onclick = () => {
    const c = byId.get(selected);
    if (c) {
      collectTerritorialResults([c], "city");
    }
  };
  elementById("loadCities").onclick = () =>
    collectTerritorialResults(
      mapData.cities.filter(
        (c) =>
          c.code &&
          (!elementById("mapUF").value || c.uf === elementById("mapUF").value),
      ),
      "city",
    );
  elementById("stopRegions").onclick = () => {
    job++;
    showStatus("Parada solicitada. A requisição em andamento será descartada.");
  };
  elementById("resetRegions").onclick = reset;
  elementById("demoRegion").onchange = render;
  elementById("regionalShare").oninput = () =>
    (elementById("regionalShareLabel").textContent =
      elementById("regionalShare").value + "%");
  elementById("advanceRegion").onclick = () =>
    advanceDemo(regionalModel.groups[elementById("demoRegion").value], 5);
  window.addEventListener("horizonte-demo-advance", (e) => {
    if (demo) {
      advanceDemo(ufCodes, e.detail);
    }
  });
  window.addEventListener("horizonte-demo-reset", () => {
    if (demo) {
      reset();
    }
  });
  elementById("exportRegions").onclick = () => {
    const a = document.createElement("a");
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              mode: demo ? "demonstracao-primeiro-turno" : "oficial",
              method: elementById("regionalMethod").value,
              sigma: Number(elementById("uncertainty").value),
              ufHistory: stateHistories,
              cityHistory: municipalHistories,
            },
            null,
            2,
          ),
        ],
        {
          type: "application/json",
        },
      ),
    );
    a.href = url;
    a.download = "painel-eleitoral-2026-territorios.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  updateCityOptions();
  reset();
  setInterval(() => {
    if (!demo && !loading) {
      loadSharedTerritory(true);
    }
  }, 300000);
})();
