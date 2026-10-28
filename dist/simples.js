/** Controlador da visão simples: estado da página, atualização dos dados e renderização das abas. */
(() => {
  "use strict";

  const elementById = (id) => document.getElementById(id);
  const regionalModel = RegionalModel;
  const simpleModel = SimpleModel;
  const ufCodes = Object.keys(FIRST_TURN_DATA.ufs);
  const formatVotes = (n) => Math.round(n).toLocaleString("pt-BR");
  const formatPercent = (n) =>
    Number.isFinite(n)
      ? n.toLocaleString("pt-BR", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        }) + "%"
      : "—";
  const escapeHtml = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (character) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[character],
    );
  const normalizeSearch = (s) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  let mode = "official";
  let demoHistories = {};
  let officialHistories = {};
  let national = null;
  let records = {
    demo: [],
    official: [],
  };
  let scenario = null;
  let scenarioInputDirty = false;
  let controller = null;
  let abroadController = null;
  let sigmaTimer = null;
  let lastFetch = null;
  let sharedVersion = null;
  let sharedSync = false;
  const abroad = {
    demo: {
      ...(window.EXTERIOR_FIRST_TURN?.localities || {}),
    },
    official: {},
  };
  const histories = () => (mode === "demo" ? demoHistories : officialHistories);
  const entries = () =>
    ufCodes.map((uf) => ({
      uf,
      est: regionalModel.estimate(histories()[uf], elementById("method").value),
    }));
  const current = () =>
    mode === "demo" ? simpleModel.aggregate(demoHistories) : national;
  function renderVoteSplit(a, b) {
    const total = a + b;
    const p = total ? (100 * a) / total : 0;
    return `<div class="split" aria-label="Lula ${total ? formatPercent(p) : "sem votos"}; Flávio ${total ? formatPercent(100 - p) : "sem votos"}"><span style="width:${p}%"></span><span style="width:${total ? 100 - p : 0}%"></span></div>`;
  }
  function recordProjection() {
    const currentResult = current();
    if (!currentResult) {
      return;
    }
    const record = {
      p: currentResult.p,
      recent: null,
      average: null,
    };
    for (const method of ["recent", "average"]) {
      const regionalEstimates = ufCodes.map((uf) => ({
        uf,
        est: regionalModel.estimate(histories()[uf], method),
      }));
      if (
        simpleModel.eligible(histories(), regionalEstimates, mode === "demo")
      ) {
        record[method] = ScenarioModel.totals(regionalEstimates);
      }
    }
    const list = records[mode];
    if (
      !list.length ||
      JSON.stringify(list.at(-1)) !== JSON.stringify(record)
    ) {
      list.push(record);
    }
  }
  function resetDemo() {
    demoHistories = {};
    records.demo = [];
    for (const uf of ufCodes) {
      demoHistories[uf] = [FirstTurn.snapshot(FIRST_TURN_DATA.ufs[uf], 5)];
    }
    recordProjection();
    for (const uf of ufCodes) {
      demoHistories[uf].push(FirstTurn.snapshot(FIRST_TURN_DATA.ufs[uf], 10));
    }
    recordProjection();
    scenario = null;
    scenarioInputDirty = false;
    render();
  }
  function advanceDemoRegions(ufs) {
    let changed = false;
    for (const uf of ufs) {
      const h = demoHistories[uf];
      const p = Math.min(100, h.at(-1).p + 5);
      if (p !== h.at(-1).p) {
        h.push(FirstTurn.snapshot(FIRST_TURN_DATA.ufs[uf], p));
        changed = true;
      }
    }
    if (!changed) {
      return;
    }
    scenario = null;
    scenarioInputDirty = false;
    recordProjection();
    render();
    elementById("scenarioStatus").textContent =
      "A contagem mudou. Calcule novamente para testar um cenário nesta base.";
  }
  function comparison(
    container,
    before,
    after,
    firstLabel = "Agora",
    lastLabel = "Final",
  ) {
    elementById(container).innerHTML = ["Lula", "Flávio"]
      .map((name, i) => {
        const key = i ? "b" : "a";
        const a =
          before && before.a + before.b
            ? (100 * before[key]) / (before.a + before.b)
            : null;
        const b =
          after && after.a + after.b
            ? (100 * after[key]) / (after.a + after.b)
            : null;
        return `<div class="compareRow ${i ? "blue" : "red"}"><div class="compareName">${name}</div><div class="barRow"><span>${firstLabel}</span><div class="barTrack"><i class="before" style="width:${a ?? 0}%"></i></div><b>${formatPercent(a)}</b></div><div class="barRow"><span>${lastLabel}</span><div class="barTrack"><i style="width:${b ?? 0}%"></i></div><b>${formatPercent(b)}</b></div></div>`;
      })
      .join("");
  }
  function renderSummary(currentResult, projected) {
    renderCountedVotes(currentResult);
    renderProjectedVotes(currentResult, projected);
    renderProjectionTrend(currentResult);
    renderParticipation(currentResult);
  }
  function renderCountedVotes(currentResult) {
    const sum = currentResult ? currentResult.a + currentResult.b : 0;
    elementById("candidateCards").innerHTML = [
      ["Lula", "13", currentResult?.a],
      ["Flávio Bolsonaro", "22", currentResult?.b],
    ]
      .map(
        ([name, id, v], i) =>
          `<div class="${i ? "blue" : "red"}"><img src="photos/${id}.jpeg" alt="${name}" width="56" height="56"><h3>${name}</h3><strong>${sum ? formatPercent((100 * v) / sum) : "—"}</strong><small>${v != null ? formatVotes(v) + " votos" : "Aguardando leitura"}</small></div>`,
      )
      .join("");
    elementById("currentBar").innerHTML = renderVoteSplit(
      currentResult?.a || 0,
      currentResult?.b || 0,
    );
    elementById("currentLead").textContent = !sum
      ? "Ainda não há votos para comparar."
      : currentResult.a === currentResult.b
        ? "Os dois estão empatados na contagem."
        : `${currentResult.a > currentResult.b ? "Lula" : "Flávio"} tem ${formatVotes(Math.abs(currentResult.a - currentResult.b))} votos a mais na contagem atual.`;
    elementById("progressRing").style.setProperty("--p", currentResult?.p || 0);
    elementById("progressValue").textContent = currentResult
      ? formatPercent(currentResult.p)
      : "—";
    elementById("progressCaption").textContent =
      mode === "demo"
        ? "Etapa proporcional simulada com resultados reais do 1º turno."
        : national
          ? `${formatVotes(national.counted)} de ${formatVotes(national.total)} seções totalizadas.`
          : "Aguardando a primeira consulta.";
  }
  function renderProjectedVotes(currentResult, projected) {
    comparison("comparisonChart", currentResult, projected);
    elementById("projectedLead").textContent = projected
      ? `${projected.a === projected.b ? "Empate" : projected.a > projected.b ? "Lula ficaria à frente" : "Flávio ficaria à frente"} se o ritmo de cada estado continuar.`
      : "Projeção indisponível: precisamos de leituras suficientes em todos os estados e no exterior.";
    if (mode === "official" && regionalModel.isComplete(currentResult)) {
      elementById("projectedLead").textContent =
        "Contagem encerrada: estes são os votos totalizados, sem crescimento projetado.";
    }
  }
  function renderProjectionTrend(currentResult) {
    const method = elementById("method").value;
    const projectionHistory = records[mode].filter((r) => r[method]);
    const showCurrentCountOnly =
      !projectionHistory.length &&
      Boolean(currentResult && currentResult.a + currentResult.b);
    const points = projectionHistory.length
      ? projectionHistory
      : showCurrentCountOnly
        ? [
            {
              p: currentResult.p,
              [method]: {
                a: currentResult.a,
                b: currentResult.b,
              },
            },
          ]
        : [];
    const renderCandidateLine = ([key, color]) => {
      const ps = points.map((r) => [
        45 + r.p * 4.3,
        170 - (140 * r[method][key]) / (r[method].a + r[method].b),
      ]);
      return `<polyline points="${ps.map((p) => p.join(",")).join(" ")}" fill="none" stroke="${color}" stroke-width="3"/>${ps.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="4" fill="${color}"/>`).join("")}`;
    };
    elementById("trendChart").className = "trend";
    elementById("trendChart").innerHTML = points.length
      ? `<svg viewBox="0 0 500 215" role="img" aria-label="Projeção de Lula e Flávio, de zero a cem por cento, conforme avança a contagem"><line x1="45" y1="100" x2="475" y2="100" stroke="#adbfc9" stroke-dasharray="5 5"/><text x="3" y="33">100%</text><text x="10" y="104">50%</text><text x="17" y="174">0%</text><text x="45" y="200">0% das seções</text><text x="380" y="200">100% das seções</text>${[
          ["a", "#ba3d48"],
          ["b", "#266caf"],
        ]
          .map(renderCandidateLine)
          .join("")}</svg>`
      : '<p class="empty">O gráfico começa quando houver base para uma projeção. No ritmo recente, precisamos de duas leituras com avanço.</p>';
    if (showCurrentCountOnly) {
      elementById("trendChart")
        .querySelector("svg")
        .insertAdjacentHTML(
          "beforeend",
          '<text x="95" y="25">Contagem atual; aguardando leituras para projetar a tendência</text>',
        );
    }
    elementById("trendCaption").textContent =
      mode === "demo"
        ? "As etapas são simuladas, não registros históricos. Avance uma região para observar o efeito na contagem."
        : "O gráfico registra somente leituras desta sessão. Não representa o histórico anterior à abertura da página.";
  }
  function renderParticipation(currentResult) {
    const participation = currentResult?.turnout;
    const metrics = [
      [
        "Abstenção",
        participation?.abstained,
        participation?.covered,
        "eleitores",
      ],
      [
        "Comparecimento",
        participation?.attended,
        participation?.covered,
        "eleitores",
      ],
      ["Brancos", participation?.blank, participation?.totalVotes, "votos"],
      ["Nulos", participation?.nullVotes, participation?.totalVotes, "votos"],
      ["Válidos", participation?.valid, participation?.totalVotes, "votos"],
    ];
    elementById("participationMetrics").innerHTML = metrics
      .map(
        ([label, v, total, unit]) =>
          `<div class="metric"><span>${label}</span><strong>${v != null && total > 0 ? formatPercent((100 * v) / total) : "—"}</strong><small>${v != null ? formatVotes(v) + " " + unit : "Sem leitura"}</small><div class="miniTrack"><i style="width:${v != null && total > 0 ? (100 * v) / total : 0}%"></i></div></div>`,
      )
      .join("");
  }
  function renderRegions(regionalEstimates) {
    const rows = simpleModel.regionRows(histories(), regionalEstimates);
    const max = Math.max(
      1,
      ...rows.map((r) => (r.ready ? r.finalA + r.finalB : r.a + r.b)),
    );
    elementById("regionChart").innerHTML = rows
      .map(
        (r) =>
          `<div class="regionRow"><div><b>${r.name}</b><br><small>${formatPercent(r.p)} das seções${!r.all ? " · parcial" : ""}</small></div><div><div class="regionStack" aria-label="${r.name}: ${formatVotes(r.a + r.b)} votos contados e ${r.remaining == null ? "restante indisponível" : formatVotes(r.remaining) + " restantes estimados"}"><span style="width:${(100 * (r.a + r.b)) / max}%"></span><span style="width:${(100 * (r.remaining || 0)) / max}%"></span></div></div><div><b>${r.remaining == null ? "—" : formatVotes(r.remaining)}</b><br><small>restantes estimados</small></div></div>`,
      )
      .join("");
    elementById("regionCoverage").textContent =
      `${regionalEstimates.filter((e) => e.est).length} de 28 unidades com estimativa (26 estados, Distrito Federal e exterior). Larguras usam a mesma escala de votos entre os dois candidatos.`;
    elementById("regionCards").innerHTML = rows
      .map(
        (r) =>
          `<article class="card"><h3>${r.name}</h3><p>${r.ready ? "Projeção ao final, entre os dois:" : "Ainda sem base para uma projeção."}</p><div class="countryValues"><b class="red">Lula ${r.ready ? formatPercent((100 * r.finalA) / (r.finalA + r.finalB)) : "—"}</b><b class="blue">Flávio ${r.ready ? formatPercent((100 * r.finalB) / (r.finalA + r.finalB)) : "—"}</b></div>${renderVoteSplit(r.finalA || 0, r.finalB || 0)}<small>${r.ready ? `${formatVotes(Math.abs(r.finalA - r.a - (r.finalB - r.b)))} votos de vantagem para ${r.finalA - r.a >= r.finalB - r.b ? "Lula" : "Flávio"} no restante estimado.` : "Consulte novamente após a entrada de novos votos."}</small></article>`,
      )
      .join("");
    elementById("regionNext").disabled =
      mode === "demo" &&
      regionalModel.groups[elementById("advanceRegion").value].every(
        (uf) => demoHistories[uf].at(-1).p >= 100,
      );
  }
  function scenarioReadiness(regionalEstimates) {
    if (
      mode === "demo" ||
      regionalModel.usableRegions(
        Object.values(histories()).map((h) => h.at(-1)),
      )
    ) {
      return "";
    }
    const available = regionalEstimates.filter((e) => e.est).length;
    if (available < 28) {
      return `Simulação oficial aguardando projeção: ${available}/28 unidades prontas; faltam ${28 - available}.`;
    }
    const snapshots = Object.values(histories()).map((h) => h.at(-1));
    if (snapshots.length !== 28) {
      return `Simulação oficial aguardando 28 leituras estaduais; encontrei ${snapshots.length}.`;
    }
    const age = Math.max(
      ...snapshots.map((s) => Date.now() - (s.received || 0)),
    );
    if (age >= simpleModel.FRESH_MS) {
      return `Simulação oficial pausada: a publicação compartilhada tem ${Math.max(1, Math.floor(age / 60000))} min. Aguarde uma publicação recente do projeto ou selecione Demonstração com 1º turno.`;
    }
    const times = snapshots.map((s) => s.time);
    if (Math.max(...times) - Math.min(...times) > 900000) {
      return "Simulação oficial aguardando leituras com horários mais próximos entre os estados.";
    }
    return "";
  }
  function syncScenarioInputs(regionalEstimates, ready) {
    if (!ready || scenarioInputDirty) {
      return;
    }
    const bounds = ScenarioModel.limits(
      regionalEstimates,
      elementById("scenarioRegion").value,
    );
    if (bounds.error) {
      return;
    }
    const share = Math.max(bounds.min, Math.min(bounds.max, 60));
    elementById("scenarioA").value = String(share);
    elementById("scenarioB").value = String(100 - share);
  }
  function renderScenario(regionalEstimates, ready) {
    const before = ready ? ScenarioModel.totals(regionalEstimates) : null;
    const after = ready ? scenario?.after || before : null;
    comparison("scenarioComparison", before, after, "Antes", "Depois");
    const right = after ? (100 * after.b) / (after.a + after.b) : 50;
    const angle = Math.PI * (1 - right / 100);
    elementById("scenarioGauge").className = "scenarioGauge";
    elementById("scenarioGauge").innerHTML =
      `<svg viewBox="0 0 400 240" role="img" aria-label="${after ? "Projeção: Lula " + formatPercent(100 - right) + " e Flávio " + formatPercent(right) : "Aguardando projeção"}"><path d="M 35 190 A 165 165 0 0 1 200 25" fill="none" stroke="#ba3d48" stroke-width="20"/><path d="M 200 25 A 165 165 0 0 1 365 190" fill="none" stroke="#266caf" stroke-width="20"/>${after ? `<line x1="200" y1="190" x2="${200 + 130 * Math.cos(angle)}" y2="${190 - 130 * Math.sin(angle)}" stroke="#192b35" stroke-width="5"/><circle cx="200" cy="190" r="9" fill="#192b35"/>` : ""}<text x="25" y="225" font-size="13" fill="#ba3d48">100% Lula</text><text x="375" y="225" text-anchor="end" font-size="13" fill="#266caf">100% Flávio</text></svg>`;
    elementById("scenarioImpact").textContent = !ready
      ? "Aguardando uma projeção completa e atualizada."
      : scenario
        ? `A mudança em ${scenario.region} altera a projeção de Lula em ${formatVotes(scenario.after.a - scenario.before.a)} votos. Demais regiões preservadas.`
        : before
          ? "Sem alteração: o mostrador usa a projeção atual por estados."
          : "Aguardando dados para calcular o cenário.";
    elementById("calculate").disabled = !ready;
    const finalized =
      mode === "official" &&
      ready &&
      regionalEstimates.every((e) => regionalModel.isComplete(e.est.current));
    document.querySelector("#simulate .advanced").hidden = finalized;
    for (const id of ["scenarioA", "scenarioB"]) {
      elementById(id).disabled = finalized;
    }
    if (finalized) {
      elementById("calculate").disabled = true;
      for (const id of ["scenarioA", "scenarioB"]) {
        elementById(id).value = Number(elementById(id).value).toFixed(2);
      }
      elementById("scenarioImpact").textContent =
        "Apuração encerrada em todas as regiões. O mostrador apresenta o resultado totalizado; não há votos restantes para projetar.";
    }
    if (ready) {
      const group = elementById("scenarioRegion").value;
      const subset = regionalEstimates.filter(
        (e) => regionalModel.region(e.uf) === group,
      );
      const total = ScenarioModel.totals(subset);
      const sum = total.a + total.b;
      const min = (100 * subset.reduce((n, e) => n + e.est.current.a, 0)) / sum;
      const max =
        (100 * (sum - subset.reduce((n, e) => n + e.est.current.b, 0))) / sum;
      elementById("scenarioLimits").textContent =
        `Pelos votos já contados, Lula pode terminar entre ${formatPercent(min)} e ${formatPercent(max)} em ${group}.`;
    } else {
      elementById("scenarioLimits").textContent =
        scenarioReadiness(regionalEstimates) ||
        "Precisamos de uma projeção completa para alterar uma região.";
    }
    elementById("sigmaLabel").textContent =
      elementById("sigma").value + " pontos percentuais";
    if (finalized) {
      elementById("scenarioLimits").textContent =
        "Esta região já encerrou a contagem. Os percentuais acima são os resultados finais.";
    }
    const sim =
      ready && !finalized
        ? regionalModel.simulate(
            scenario?.entries || regionalEstimates,
            Number(elementById("sigma").value),
          )
        : null;
    elementById("chanceMetrics").className = "chanceMetrics";
    elementById("chanceMetrics").innerHTML = sim
      ? `<div class="metric red"><span>Lula nos cenários</span><strong>${formatPercent(sim.a)}</strong></div><div class="metric blue"><span>Flávio nos cenários</span><strong>${formatPercent(sim.b)}</strong></div><div class="metric"><span>Empate</span><strong>${formatPercent(sim.tie)}</strong></div>`
      : "Aguardando uma base completa.";
  }
  function render() {
    const regionalEstimates = entries();
    const ready = simpleModel.eligible(
      histories(),
      regionalEstimates,
      mode === "demo",
    );
    const currentResult = current();
    elementById("sourceNote").textContent =
      mode === "demo"
        ? "DEMONSTRAÇÃO COM 1º TURNO · Resultados reais de 2026 em etapas proporcionais simuladas. Não é o histórico da apuração nem uma previsão do 2º turno."
        : "DADOS OFICIAIS DO 2º TURNO · Verificação a cada 5 minutos. Resultados com 100% das seções são reutilizados; só localidades pendentes precisam de nova coleta.";
    elementById("demoActions").hidden = mode !== "demo";
    elementById("liveActions").hidden = mode !== "official";
    elementById("regionDemo").hidden = mode !== "demo";
    if (mode === "demo") {
      elementById("status").textContent =
        "Etapa simulada · " + formatPercent(currentResult?.p) + " das seções";
    } else if (!controller) {
      elementById("status").textContent = national
        ? `Arquivo Brasil: ${national.date} ${national.label} · Brasília${!ready ? " · projeção ainda sem base suficiente ou desatualizada" : ""}`
        : "Nenhuma leitura compartilhada carregada nesta tela.";
    }
    elementById("next").disabled =
      mode === "demo" && currentResult?.p >= 100 - 1e-8;
    syncScenarioInputs(regionalEstimates, ready);
    renderSummary(
      currentResult,
      ready ? ScenarioModel.totals(regionalEstimates) : null,
    );
    renderRegions(regionalEstimates);
    renderScenario(regionalEstimates, ready);
    renderAbroad();
    getComparisonContext();
  }
  async function fetchJson(url, signal) {
    return TSEStore.getURL(url, {
      signal,
    });
  }
  async function refresh() {
    if (controller) {
      return;
    }
    const ctl = new AbortController();
    controller = ctl;
    elementById("refresh").disabled = true;
    elementById("stop").disabled = false;
    let error = null;
    try {
      const staged = {};
      for (let i = 0; i < ufCodes.length; i++) {
        const uf = ufCodes[i];
        elementById("status").textContent =
          `Carregando estados compartilhados: ${i + 1}/28…`;
        const d = await fetchJson(
          `https://resultados.tse.jus.br/oficial/ele2026/6258/dados/${uf}/${uf}-c0001-e006258-u.json`,
          AbortSignal.any([ctl.signal, AbortSignal.timeout(15000)]),
        );
        const s = regionalModel.parse(d, uf);
        s.received = Date.now();
        const result = regionalModel.append(officialHistories[uf] || [], s);
        if (result.old) {
          throw Error(
            "Foi recebida uma versão anterior de " + uf.toUpperCase(),
          );
        }
        staged[uf] = result.h;
        await new Promise((r) => setTimeout(r, 0));
        ctl.signal.throwIfAborted();
      }
      const nationalData = ElectionModel.parseTSE(
        await fetchJson(
          "https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.json",
          AbortSignal.any([ctl.signal, AbortSignal.timeout(15000)]),
        ),
      );
      if (national && nationalData.timestamp < national.timestamp) {
        throw Error("Arquivo nacional anterior à última leitura");
      }
      if (mode === "official") {
        officialHistories = staged;
        national = nationalData;
        lastFetch = Date.now();
        scenario = null;
        scenarioInputDirty = false;
        recordProjection();
      }
    } catch (e) {
      error = ctl.signal.aborted
        ? "Consulta cancelada. Leituras anteriores preservadas."
        : "Falha ao carregar snapshot compartilhado: " +
          e.message +
          ". Leituras anteriores preservadas.";
    } finally {
      controller = null;
      elementById("refresh").disabled = false;
      elementById("stop").disabled = true;
      render();
      if (error && mode === "official") {
        elementById("status").textContent = error;
      }
    }
  }
  async function checkShared(force = true) {
    if (mode !== "official" || controller || sharedSync) {
      return;
    }
    sharedSync = true;
    const activeMode = mode;
    elementById("status").textContent =
      "Verificando a publicação compartilhada…";
    try {
      const meta = await TSEClient.manifest(force);
      const version = meta?.checkedAt || "unversioned";
      if (version === sharedVersion && national) {
        elementById("status").textContent =
          "Publicação compartilhada sem mudanças desde a última verificação.";
        await loadAbroad();
        return;
      }
      const shared = await TSEClient.history();
      if (mode !== activeMode) {
        return;
      }
      officialHistories = shared.ufs || {};
      national = shared.national?.at(-1) || null;
      records.official = shared.projections || [];
      sharedVersion = version;
      scenario = null;
      scenarioInputDirty = false;
      recordProjection();
      render();
      await loadAbroad();
    } catch (e) {
      if (mode === activeMode) {
        render();
        elementById("status").textContent =
          "Falha ao carregar dados compartilhados: " +
          e.message +
          ". A leitura anterior foi preservada.";
      }
    } finally {
      sharedSync = false;
    }
  }
  function renderAbroad() {
    const data = ExteriorModel.group(EXTERIOR_LOCATIONS, abroad[mode]);
    const q = normalizeSearch(elementById("countrySearch").value);
    const rows = data.rows
      .filter((r) =>
        normalizeSearch(
          r.name + " " + r.places.map((p) => p.name).join(" "),
        ).includes(q),
      )
      .sort(
        (a, b) => b.valid - a.valid || a.name.localeCompare(b.name, "pt-BR"),
      );
    elementById("abroadNote").textContent =
      mode === "demo"
        ? "Resultado final real do primeiro turno por país. Esses dados não acompanham as etapas simuladas do Resumo."
        : "Segundo turno: arquivos coletados pelo projeto. Países incompletos são identificados.";
    elementById("abroadSummary").innerHTML =
      `<p class="takeaway">${data.total.loaded}/${data.localities} localidades carregadas · ${data.total.loaded ? formatVotes(data.total.valid) : "—"} votos válidos${data.total.loaded < data.localities ? " · cobertura parcial" : ""}</p>`;
    elementById("countryChart").innerHTML = !data.total.loaded
      ? '<p class="empty">O cadastro de países está disponível, mas os resultados ainda não foram carregados. O lote do projeto é carregado automaticamente. Nenhum valor foi preenchido artificialmente.</p>'
      : !rows.length
        ? '<p class="empty">Nenhum país ou localidade encontrado.</p>'
        : rows
            .map((r) => {
              const sum = r.a + r.b;
              return `<div class="countryRow"><div class="countryTitle"><b>${escapeHtml(r.name)}</b><span>${formatVotes(r.valid)} votos válidos</span></div><small>${r.loaded}/${r.places.length} localidades${r.loaded < r.places.length ? " · PARCIAL" : ""}</small>${renderVoteSplit(r.a, r.b)}<div class="countryValues"><span class="red">Lula ${sum ? formatPercent((100 * r.a) / sum) : "—"}</span><span class="blue">Flávio ${sum ? formatPercent((100 * r.b) / sum) : "—"}</span></div><details><summary>Ver localidades e números</summary><p>${r.places.map((p) => `${escapeHtml(p.name)}: ${p.snapshot ? formatVotes(p.snapshot.a) + " Lula / " + formatVotes(p.snapshot.b) + " Flávio · " + escapeHtml(p.snapshot.date) + " " + escapeHtml(p.snapshot.time) : "sem leitura"}`).join("<br>")}</p></details></div>`;
            })
            .join("");
  }
  async function loadAbroad() {
    if (abroadController) {
      return;
    }
    const ctl = new AbortController();
    const target = mode;
    const turn = mode === "demo" ? 6257 : 6258;
    abroadController = ctl;
    elementById("loadAbroad").disabled = true;
    elementById("stopAbroad").disabled = false;
    let count = 0;
    try {
      const results = await TSEClient.cityResults("zz", turn);
      ctl.signal.throwIfAborted();
      for (const loc of EXTERIOR_LOCATIONS) {
        ctl.signal.throwIfAborted();
        const raw = results[loc.code];
        if (raw) {
          abroad[target][loc.code] = ExteriorModel.readResult(
            raw,
            String(turn),
            loc.code,
          );
          count++;
        }
        if (count % 10 === 0) {
          renderAbroad();
        }
        await new Promise((r) => setTimeout(r, 0));
      }
      elementById("abroadStatus").textContent =
        `Lote compartilhado carregado: ${count}/${EXTERIOR_LOCATIONS.length} localidades.`;
    } catch (e) {
      elementById("abroadStatus").textContent = ctl.signal.aborted
        ? "Carregamento cancelado. Dados recebidos foram preservados."
        : "Não foi possível carregar o snapshot compartilhado: " +
          e.message +
          ". Dados anteriores foram preservados.";
    } finally {
      abroadController = null;
      elementById("loadAbroad").disabled = false;
      elementById("stopAbroad").disabled = true;
      renderAbroad();
    }
  }
  function getComparisonContext() {
    const active =
      elementById("tab-comparison").getAttribute("aria-selected") === "true";
    document.querySelector(".sourceControl").hidden = active;
    document.querySelector(".actionbar").hidden = active;
    if (active) {
      elementById("sourceNote").textContent =
        "COMPARATIVO OFICIAL ENTRE TURNOS · Esta aba usa somente resultados oficiais. A demonstração e os cenários das outras abas não alteram estes números.";
    }
  }
  function activateTab(id, focus = false) {
    document.querySelectorAll("[role=tab]").forEach((b) => {
      const active = b.id === "tab-" + id;
      b.setAttribute("aria-selected", String(active));
      b.tabIndex = active ? 0 : -1;
      elementById(b.getAttribute("aria-controls")).hidden = !active;
      if (active && focus) {
        b.focus();
      }
    });
    history.replaceState(null, "", "#" + id);
    render();
  }
  document.querySelectorAll("[role=tab]").forEach((button, i, all) => {
    button.onclick = () => activateTab(button.getAttribute("aria-controls"));
    button.onkeydown = (e) => {
      let next;
      if (e.key === "ArrowRight") {
        next = (i + 1) % all.length;
      }
      if (e.key === "ArrowLeft") {
        next = (i + all.length - 1) % all.length;
      }
      if (e.key === "Home") {
        next = 0;
      }
      if (e.key === "End") {
        next = all.length - 1;
      }
      if (next !== undefined) {
        e.preventDefault();
        activateTab(all[next].getAttribute("aria-controls"), true);
      }
    };
  });
  for (const id of ["advanceRegion", "scenarioRegion"]) {
    elementById(id).innerHTML = Object.keys(regionalModel.groups)
      .map((g) => `<option ${g === "Nordeste" ? "selected" : ""}>${g}</option>`)
      .join("");
  }
  elementById("sourceMode").onchange = () => {
    controller?.abort();
    abroadController?.abort();
    mode = elementById("sourceMode").value;
    scenario = null;
    scenarioInputDirty = false;
    elementById("scenarioStatus").textContent = "";
    elementById("abroadStatus").textContent = "";
    render();
    if (mode === "official") {
      checkShared(true);
      loadAbroad();
    }
  };
  elementById("next").onclick = () => advanceDemoRegions(ufCodes);
  elementById("reset").onclick = resetDemo;
  elementById("regionNext").onclick = () =>
    advanceDemoRegions(
      regionalModel.groups[elementById("advanceRegion").value],
    );
  elementById("advanceRegion").onchange = render;
  elementById("refresh").onclick = refresh;
  elementById("stop").onclick = () => controller?.abort();
  elementById("method").onchange = () => {
    scenario = null;
    scenarioInputDirty = false;
    render();
  };
  elementById("scenarioRegion").onchange = () => {
    scenario = null;
    scenarioInputDirty = false;
    elementById("scenarioStatus").textContent = "";
    render();
  };
  elementById("sigma").oninput = () => {
    elementById("sigmaLabel").textContent =
      elementById("sigma").value + " pontos percentuais";
    clearTimeout(sigmaTimer);
    sigmaTimer = setTimeout(render, 120);
  };
  for (const [from, to] of [
    ["scenarioA", "scenarioB"],
    ["scenarioB", "scenarioA"],
  ]) {
    elementById(from).oninput = () => {
      scenarioInputDirty = true;
      const v = elementById(from).value;
      const n = Number(v);
      elementById(to).value =
        v !== "" && n >= 0 && n <= 100
          ? String(Number((100 - n).toFixed(6)))
          : "";
    };
  }
  elementById("calculate").onclick = () => {
    const regionalEstimates = entries();
    if (
      !simpleModel.eligible(histories(), regionalEstimates, mode === "demo")
    ) {
      return;
    }
    const v = elementById("scenarioA").value;
    const result = ScenarioModel.changeRegion(
      regionalEstimates,
      elementById("scenarioRegion").value,
      v === "" ? NaN : Number(v),
    );
    elementById("scenarioStatus").className = result.error ? "error" : "";
    if (result.error) {
      elementById("scenarioStatus").textContent = result.error;
      return;
    }
    scenario = result;
    elementById("scenarioStatus").textContent =
      `Cenário aplicado em ${scenario.region}: Lula ${formatPercent(scenario.share)} / Flávio ${formatPercent(100 - scenario.share)}.`;
    render();
  };
  elementById("clearScenario").onclick = () => {
    scenario = null;
    scenarioInputDirty = false;
    elementById("scenarioStatus").textContent =
      "Alteração removida. Mostrando a projeção atual.";
    render();
  };
  elementById("countrySearch").oninput = renderAbroad;
  elementById("loadAbroad").onclick = loadAbroad;
  elementById("stopAbroad").onclick = () => abroadController?.abort();
  const d = FIRST_TURN_DATA.national;
  elementById("fullFirstTurn").innerHTML =
    `<p>Arquivo oficial gerado em ${escapeHtml(d.date)} às ${escapeHtml(d.time)}. Percentuais sobre todos os votos válidos.</p><div class="tableWrap"><table><caption>Brasil · primeiro turno de 2026</caption><thead><tr><th scope="col">Candidato</th><th scope="col">Votos</th><th scope="col">% dos válidos</th></tr></thead><tbody>${[
      ...d.candidates,
    ]
      .sort((a, b) => b.votes - a.votes)
      .map(
        (candidate) =>
          `<tr><td>${escapeHtml(candidate.name)}</td><td>${formatVotes(candidate.votes)}</td><td>${formatPercent((100 * candidate.votes) / Number(d.v.vv))}</td></tr>`,
      )
      .join("")}</tbody></table></div>`;
  mode = "demo";
  resetDemo();
  mode = "official";
  elementById("sourceMode").value = "official";
  const initial = location.hash.slice(1);
  if (
    ["summary", "regions", "simulate", "abroad", "comparison"].includes(initial)
  ) {
    activateTab(initial);
  } else {
    render();
  }
  checkShared(true);
  loadAbroad();
  setInterval(() => {
    if (mode === "official") {
      checkShared(true);
    }
  }, 300000);
})();
