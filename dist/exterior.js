/* Painel independente: localidade eleitoral (TSE) -> país (curadoria), sem alterar a apuração nacional. */
(() => {
  "use strict";
  const M = window.ExteriorModel;
  const locations = window.EXTERIOR_LOCATIONS;
  if (!M || !Array.isArray(locations))
    throw Error("Dependências do painel exterior não carregadas");
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => n.toLocaleString("pt-BR");
  const percent = (n) =>
    n.toLocaleString("pt-BR", {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    }) + "%";
  const esc = (s) =>
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
  const clean = (s) =>
    String(s)
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  const source = "https://resultados.tse.jus.br/oficial/ele2026";
  let mode = "demo",
    inFlight = false,
    job = 0,
    sharedVersion = null;
  let lastStatus = "";
  const snapshots = { demo: {}, official: {} };
  const latest = { demo: null, official: null };
  const cached = window.EXTERIOR_FIRST_TURN;
  if (
    cached &&
    cached.election === "6257" &&
    cached.localities &&
    typeof cached.localities === "object"
  ) {
    try {
      M.group(locations, cached.localities);
      Object.assign(snapshots.demo, cached.localities);
      latest.demo = cached.generatedAt;
    } catch (e) {
      console.warn("Cache exterior ignorado:", e.message);
    }
  }

  const host = document.createElement("section");
  host.id = "exterior";
  host.className = "panel exteriorPanel";
  host.innerHTML = `
    <div class="sectionhead"><div><div class="eyebrow">BRASILEIROS QUE VOTAM FORA DO PAÍS</div>
    <h2>Votos no exterior, país por país</h2></div><span class="tag">186 LOCALIDADES CONSULARES</span></div>
    <p id="extDescription">Resultados por país somados a partir das localidades eleitorais do TSE, sem dupla contagem no resultado nacional.</p>
    <div class="extActions">
      <button class="primary" id="extLoad" type="button">Carregar leituras compartilhadas ↻</button>
      <button class="secondary" id="extStop" type="button" disabled>Interromper carregamento</button>
      <button class="secondary" id="extExport" type="button">Exportar CSV ↓</button>
    </div>
    <p id="extStatus" role="status" aria-live="polite" class="extStatus"></p>
    <div class="extMetrics" id="extMetrics"></div>
    <div class="extReconciliation" id="extReconciliation"></div>
    <div class="extToolbar"><label for="extSearch">Buscar país ou localidade <input type="search" id="extSearch" placeholder="Ex.: Japão, Lisboa, Nova York"></label>
      <label for="extSort">Ordenar por <select id="extSort"><option value="valid">Mais votos válidos</option><option value="alpha">Nome do país</option><option value="a">Maior percentual de Lula</option><option value="b">Maior percentual de Flávio</option></select></label></div>
    <div id="extCountries" class="extCountries"></div>
    <p class="extFootnote">Fonte: TSE, resultado unificado EA20. Cada localidade eleitoral do exterior pertence a exatamente um país nesta tabela de correspondência do Painel Eleitoral 2026, que não é uma classificação por país fornecida pelo TSE. A demonstração mostra o <b>resultado final real do primeiro turno</b>, não as etapas proporcionais da simulação. Os percentuais de Lula e Flávio comparam somente os dois; os demais candidatos entram no total de votos válidos do primeiro turno. No segundo turno, cada país mostra apenas os snapshots já publicados pelo projeto; resultados parciais e leituras feitas em momentos diferentes não devem ser interpretados como totalização final.</p>`;
  const territory = $("territory");
  if (territory) territory.after(host);
  else document.querySelector(".history").before(host);

  function expectedDemo() {
    const d = window.FIRST_TURN_DATA?.ufs?.zz;
    if (!d) return null;
    const a = Number(d.candidates.find((c) => c.id === "13")?.votes || 0);
    const b = Number(d.candidates.find((c) => c.id === "22")?.votes || 0);
    const valid = Number(d.v.vv);
    return { a, b, valid, other: valid - a - b };
  }
  function expectedOfficial() {
    const d = latest.official;
    return d && d.reference ? d.reference : null;
  }
  function note(s) {
    lastStatus = s;
    $("extStatus").textContent = s;
  }
  function render() {
    const bundle = M.group(locations, snapshots[mode]);
    const { rows, total, localities } = bundle;
    const allLoaded = total.loaded === localities;
    const isDemo = mode === "demo";
    $("extStatus").textContent = lastStatus;
    const electionLabel = isDemo
      ? "1º turno · resultado final oficial"
      : "2º turno · leituras oficiais";
    $("extDescription").textContent = isDemo
      ? "Primeiro turno: votos reais por localidade, sem simular uma apuração por país. Os arquivos estão incluídos na distribuição do projeto."
      : "Segundo turno: snapshots compartilhados das 186 localidades salvas pelo projeto. Horários diferentes podem produzir diferenças em relação ao agregado ZZ.";
    $("extLoad").textContent = isDemo
      ? "Carregar/atualizar 1º turno ↻"
      : "Carregar leituras do projeto ↻";
    $("extLoad").disabled = inFlight;
    $("extStop").disabled = !inFlight;
    $("extMetrics").innerHTML = `
      <div><span class="label">LOCALIDADES CONSULTADAS</span><strong>${total.loaded} / ${localities}</strong><small>${rows.filter((r) => r.loaded === r.places.length).length} / ${rows.length} países com cobertura completa</small></div>
      <div><span class="label">VOTOS VÁLIDOS ${!allLoaded ? "· PARCIAL" : ""}</span><strong>${fmt(total.valid)}</strong><small>${electionLabel}</small></div>
      <div><span class="label">LULA / FLÁVIO · ENTRE OS DOIS</span><strong>${total.a + total.b ? percent((100 * total.a) / (total.a + total.b)) + " / " + percent((100 * total.b) / (total.a + total.b)) : "—"}</strong><small>${fmt(total.a)} / ${fmt(total.b)} votos</small></div>`;
    const reference = isDemo ? expectedDemo() : expectedOfficial();
    const result = allLoaded ? M.compare(total, reference) : null;
    if (!allLoaded) {
      $("extReconciliation").textContent =
        `Cobertura incompleta: ${localities - total.loaded} localidades ainda sem leitura. Totais exibidos apenas para as localidades consultadas.`;
    } else if (isDemo && result) {
      $("extReconciliation").textContent = result.matches
        ? "✓ Conferência concluída: a soma das localidades corresponde aos votos válidos e aos votos dos candidatos publicados pelo TSE para o exterior (ZZ)."
        : "⚠ Atenção: a soma das localidades não coincide com o agregado oficial ZZ. Não considere este recorte reconciliado.";
    } else if (!isDemo && result) {
      $("extReconciliation").textContent = result.matches
        ? "✓ A soma das últimas leituras coincide com o agregado ZZ consultado."
        : "⚠ As leituras por localidade diferem do agregado ZZ consultado. Os arquivos podem pertencer a momentos distintos da apuração.";
    } else {
      $("extReconciliation").textContent =
        "186 localidades consultadas. Não há uma referência ZZ do mesmo turno disponível para conferir os totais.";
    }
    $("extReconciliation").classList.toggle(
      "extWarning",
      Boolean(result && !result.matches),
    );

    const query = clean($("extSearch").value.trim());
    const sort = $("extSort").value;
    const filtered = rows
      .filter(
        (r) =>
          !query ||
          clean(r.name).includes(query) ||
          r.places.some((p) => clean(p.name).includes(query)),
      )
      .sort((a, b) =>
        sort === "alpha"
          ? a.name.localeCompare(b.name, "pt-BR")
          : sort === "a" || sort === "b"
            ? (b.a + b.b ? b[sort] / (b.a + b.b) : -1) -
                (a.a + a.b ? a[sort] / (a.a + a.b) : -1) || b.valid - a.valid
            : b.valid - a.valid || a.name.localeCompare(b.name, "pt-BR"),
      );
    const opened = new Set(
      [...document.querySelectorAll(".extCountry[open]")].map(
        (e) => e.dataset.country,
      ),
    );
    $("extCountries").innerHTML = filtered.length
      ? filtered
          .map((r, i) => {
            const hasVotes = r.a + r.b > 0;
            const share = hasVotes ? (100 * r.a) / (r.a + r.b) : 0;
            const status = `${r.loaded}/${r.places.length} locais${r.pending ? " · " + r.pending + " sem apuração" : ""}`;
            const details = r.places
              .map((p) => {
                const s = p.snapshot;
                return `<tr><td>${esc(p.name)} <small>(${esc(p.code)})</small></td><td>${s ? (s.pending ? "Aguardando" : fmt(s.valid)) : "Não consultada"}</td><td>${s ? fmt(s.a) : "—"}</td><td>${s ? fmt(s.b) : "—"}</td><td>${s ? fmt(s.other) : "—"}</td></tr>`;
              })
              .join("");
            const open = opened.has(r.name) ? " open" : "";
            return `<details class="extCountry" data-country="${esc(r.name)}"${open}><summary>
        <div class="extCountryName"><b>${esc(r.name)}</b><small>${status}</small></div>
        <div class="extCountryNumbers"><span>${fmt(r.valid)} válidos</span><span class="redText">Lula ${fmt(r.a)}${r.a + r.b ? " · " + percent(share) : ""}</span><span class="blueText">Flávio ${fmt(r.b)}${r.a + r.b ? " · " + percent(100 - share) : ""}</span></div>
        <span class="extChevron" aria-hidden="true">⌄</span></summary>
        <div class="extShare${hasVotes ? "" : " noVotes"}" aria-label="${hasVotes ? "Lula " + percent(share) + " e Flávio " + percent(100 - share) + " entre os dois, nas localidades consultadas" : "Sem votos comparáveis disponíveis"}"><i style="width:${share}%"></i></div>
        <div class="tablewrap"><table><thead><tr><th>Localidade eleitoral</th><th>Votos válidos</th><th>Lula</th><th>Flávio</th><th>Demais</th></tr></thead><tbody>${details}</tbody></table></div></details>`;
          })
          .join("")
      : "<p>Nenhum país ou localidade encontrado.</p>";
  }

  function endpoint(turn, code) {
    return `${source}/${turn === "demo" ? "6257" : "6258"}/dados/zz/zz${code}-c0001-e00${turn === "demo" ? "6257" : "6258"}-u.json`;
  }
  async function readLoc(turn, loc, signal) {
    const response = await fetch(endpoint(turn, loc.code), {
      cache: "no-cache",
      signal,
    });
    if (!response.ok)
      throw Error(`HTTP ${response.status} em ${loc.name} (${loc.code})`);
    return M.readResult(
      await response.json(),
      turn === "demo" ? "6257" : "6258",
      loc.code,
    );
  }
  async function getOfficialZZ(signal) {
    const url = `${source}/6258/dados/zz/zz-c0001-e006258-u.json`;
    const response = await fetch(url, { cache: "no-cache", signal });
    if (!response.ok)
      throw Error("Resposta " + response.status + " ao consultar ZZ");
    const d = await response.json();
    if (
      d.ele !== "6258" ||
      String(d.t) !== "2" ||
      d.tpabr !== "uf" ||
      d.cdabr !== "zz" ||
      d.f !== "o"
    )
      throw Error("Agregado ZZ não corresponde ao segundo turno");
    const cs = d.carg
      .flatMap((c) => (String(c.cd) === "1" ? c.agr || [] : []))
      .flatMap((g) => g.par || [])
      .flatMap((p) => p.cand || []);
    const a = Number(cs.find((c) => String(c.n) === "13")?.vap || 0),
      b = Number(cs.find((c) => String(c.n) === "22")?.vap || 0),
      valid = Number(d.v?.vv || 0);
    if (![a, b, valid].every(Number.isSafeInteger) || a + b > valid)
      throw Error("Agregado ZZ inválido");
    return { a, b, other: valid - a - b, valid };
  }
  const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  async function load() {
    if (inFlight) return;
    const active = mode,
      turn = active === "demo" ? 6257 : 6258;
    const ticket = ++job;
    inFlight = true;
    render();
    let completed = 0;
    const controller = new AbortController();
    activeController = controller;
    try {
      const manifest =
        active === "official" ? await TSEClient.manifest(true) : null;
      const version = manifest?.checkedAt || "unversioned";
      if (
        active === "official" &&
        version === sharedVersion &&
        M.group(locations, snapshots.official).total.loaded === locations.length
      ) {
        note(
          "A publicação compartilhada não mudou desde a última verificação.",
        );
        return;
      }
      note(
        `Carregando o lote compartilhado do ${active === "demo" ? "primeiro" : "segundo"} turno…`,
      );
      const results = await TSEClient.cityResults("zz", turn);
      if (ticket !== job) return;
      for (let i = 0; i < locations.length; i++) {
        if (ticket !== job || controller.signal.aborted) break;
        const loc = locations[i],
          raw = results[loc.code];
        if (raw) {
          snapshots[active][loc.code] = M.readResult(
            raw,
            String(turn),
            loc.code,
          );
          completed++;
        }
        note(
          `${i + 1}/${locations.length} localidades verificadas · ${completed} snapshots disponíveis.`,
        );
        if ((i + 1) % 20 === 0 || i + 1 === locations.length) render();
        await pause(0);
      }
      if (ticket === job) {
        if (active === "official") sharedVersion = version;
        latest[active] =
          active === "demo"
            ? new Date().toISOString()
            : { received: new Date().toISOString(), reference: null };
        if (active === "official") {
          try {
            latest.official.reference = await getOfficialZZ(controller.signal);
          } catch (e) {
            note(
              "Localidades carregadas, mas a conferência ZZ falhou: " +
                e.message,
            );
          }
        }
        note(
          `Lote do projeto carregado: ${completed}/${locations.length} localidades. ${completed === locations.length ? "Cobertura completa." : "Cobertura parcial."}`,
        );
      }
    } catch (e) {
      if (ticket === job)
        note(
          `Não foi possível carregar o snapshot compartilhado: ${e.message}. Os dados já exibidos foram preservados.`,
        );
    } finally {
      if (ticket === job) {
        inFlight = false;
        activeController = null;
        render();
      }
    }
  }
  let activeController = null;
  function stop() {
    if (!inFlight) return;
    job++;
    activeController?.abort();
    activeController = null;
    inFlight = false;
    note(
      "Consulta interrompida. Os resultados já recebidos foram preservados como parciais.",
    );
    render();
  }
  function switchMode(next) {
    stop();
    mode = next;
    render();
    load();
  }
  function exportCSV() {
    const data = M.group(locations, snapshots[mode]);
    const header = [
      "Turno",
      "País",
      "Localidade",
      "Código TSE",
      "Status",
      "Votos válidos",
      "Lula",
      "Flávio",
      "Demais candidatos",
      "Seções totalizadas",
      "Seções existentes",
      "Gerado TSE",
    ];
    const quote = (v) => '"' + String(v ?? "").replace(/"/g, '""') + '"';
    const rows = data.rows.flatMap((c) =>
      c.places.map((p) => {
        const s = p.snapshot;
        return [
          mode === "demo" ? "1" : "2",
          c.name,
          p.name,
          p.code,
          s ? (s.pending ? "Aguardando" : "Consultado") : "Não consultado",
          s?.valid ?? "",
          s?.a ?? "",
          s?.b ?? "",
          s?.other ?? "",
          s?.counted ?? "",
          s?.sections ?? "",
          s ? s.date + " " + s.time : "",
        ];
      }),
    );
    const csv =
      "\uFEFF" +
      [header, ...rows].map((row) => row.map(quote).join(";")).join("\r\n");
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download =
      "painel-eleitoral-2026-exterior-" +
      (mode === "demo" ? "1t" : "2t") +
      ".csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  $("extLoad").onclick = load;
  $("extStop").onclick = stop;
  $("extExport").onclick = exportCSV;
  $("extSearch").oninput = render;
  $("extSort").onchange = render;
  window.addEventListener("horizonte-mode", (e) => switchMode(e.detail));
  render();
  if (latest.demo)
    note(
      `Cache oficial do 1º turno carregado: ${M.group(locations, snapshots.demo).total.loaded}/${locations.length} localidades.`,
    );
  else
    note("Carregando automaticamente os snapshots compartilhados deste turno.");
  setInterval(() => {
    if (mode === "official" && !inFlight) load();
  }, 300000);
})();
