(() => {
  "use strict";
  const $ = (id) => document.getElementById(id),
    M = ComparativoModel,
    store = TSEStore;
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
  const num = (n) =>
    n === null || n === undefined
      ? "—"
      : n.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
  const dec = (n) =>
    n === null || n === undefined
      ? "—"
      : n.toLocaleString("pt-BR", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  const percent = (n) => (n === null || n === undefined ? "—" : dec(n) + "%");
  const signed = (n, suffix = "", integer = false) =>
    n === null || n === undefined
      ? "—"
      : `${Math.abs(n) < (integer ? 0.5 : 0.005) ? "" : n > 0 ? "+" : "−"}${integer ? num(Math.abs(n)) : dec(Math.abs(n))}${suffix}`;
  const normalize = (s) =>
    s
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();
  let ctl = null,
    error = "",
    lastLabel = "";
  const countries = [...new Set(EXTERIOR_LOCATIONS.map((l) => l.country))].sort(
    (a, b) => a.localeCompare(b, "pt-BR"),
  );
  $("comparison").innerHTML =
    `<article class="card"><p class="eyebrow">RESULTADOS OFICIAIS · PRESIDENTE · 2026</p><h2>Comparativo entre Turnos</h2><p>Veja quanto mudou nos votos e na participação dos finalistas. Escolha a localidade e a base dos percentuais.</p>
    <div class="compareFilters"><label>Abrangência<select id="compareScope"><option value="br">Brasil inteiro</option><option value="uf">Estado / DF</option><option value="city">Município</option><option value="country">Exterior por país</option></select></label><label id="compareUFLabel" hidden>Estado<select id="compareUF"></select></label><label id="compareSearchLabel" hidden>Buscar município<input id="compareSearch" type="search" placeholder="Nome do município"></label><label id="compareCityLabel" hidden>Município<select id="compareCity"></select></label><label id="compareCountryLabel" hidden>País<select id="compareCountry"></select></label></div>
    <div class="compareActions"><button id="compareRefresh">Atualizar comparação</button><button id="compareCancel" class="quiet" disabled>Cancelar</button><span id="compareStatus" role="status" aria-live="polite"></span></div>
    <p id="compareNotice" class="notice"></p><div id="compareDates" class="compareDates"></div>
    <label class="compareBasis">Base dos percentuais<select id="compareBasis"><option value="normalized">Somente os finalistas · 1º turno normalizado</option><option value="official">Percentuais oficiais · todos os votos válidos</option></select></label><p id="compareBasisNote" class="small muted"></p>
    <div id="compareBars" class="chartGrid"></div><div class="tableWrap" tabindex="0" role="region" aria-label="Tabela comparativa dos candidatos"><table class="compareTable"><caption>Votos dos finalistas · diferenças = 2º turno menos 1º turno</caption><thead><tr><th scope="col">Candidato</th><th scope="col">1º turno<br>votos / participação</th><th scope="col">2º turno<br>votos / participação</th><th scope="col">Diferença<br>votos</th><th scope="col">Variação<br>do nº de votos</th><th scope="col">Participação<br>diferença em p.p.</th></tr></thead><tbody id="compareCandidates"></tbody></table></div><p class="small muted">Sinal + indica aumento; − indica redução; 0 indica igualdade. As variações usam apresentação neutra. “—” significa ausência de dados ou cálculo sem denominador. No celular, deslize as tabelas para os lados.</p>
  </article><article class="card participation"><p class="eyebrow">ELEITORADO E PARTICIPAÇÃO</p><h2>Comparecimento, abstenções e votos</h2><div class="tableWrap" tabindex="0" role="region" aria-label="Tabela comparativa da participação"><table class="compareTable"><caption>Totais e taxas de participação em cada turno</caption><thead><tr><th scope="col">Indicador</th><th scope="col">1º turno<br>total / taxa</th><th scope="col">2º turno<br>total / taxa</th><th scope="col">Diferença<br>absoluta</th><th scope="col">Variação<br>do total (%)</th><th scope="col">Taxa<br>diferença em p.p.</th></tr></thead><tbody id="compareParticipation"></tbody></table></div><p class="small muted">Comparecimento e abstenção: percentual sobre os eleitores das seções com dados (campo ESI do TSE). Brancos, nulos e válidos: percentual sobre os votos computados. Eleitorado apto usa o total oficial de cada turno, que pode mudar; não é usado como se todo ele já estivesse apurado.</p><p id="compareElectorate" class="takeaway"></p></article>
  <details class="card participation"><summary>Como conferir os cálculos e quais são os limites?</summary><ul><li>Diferença absoluta = votos no 2º turno − votos no 1º turno.</li><li>Variação relativa = (votos no 2º − votos no 1º) ÷ votos no 1º × 100. Se a base for zero, fica indisponível.</li><li>Percentual oficial = votos do candidato ÷ todos os votos válidos do respectivo turno × 100.</li><li>Normalização do 1º turno = votos do finalista ÷ soma dos votos de Lula e Flávio no 1º turno × 100. No 2º, usamos os votos válidos oficiais.</li><li>Variação em pontos percentuais = participação no 2º − participação no 1º, conforme a base selecionada. Não é variação percentual do número de votos.</li></ul><p><b>Seções equivalentes: indisponível nesta versão.</b> Os arquivos agregados utilizados não identificam individualmente as seções comuns já totalizadas nos dois turnos. Comparar a mesma porcentagem de seções não garante a mesma população. Não criamos uma equivalência artificial.</p><p>Países são agregações das localidades oficiais do TSE/ZZ usando o cadastro geográfico do site. O total de um país só aparece quando todas as localidades cadastradas desse país tiverem leitura no respectivo turno. Diferenças de cadastro entre turnos exigem revisão; uma localidade ausente interrompe a consulta e não é tratada como zero.</p><p>Resultados agregados não permitem identificar transferências individuais de votos, nem atribuir os votos de outros candidatos aos finalistas. Mudanças também podem refletir comparecimento, eleitorado e cobertura parcial.</p><p>A comparação é atualizada a cada 5 minutos enquanto esta aba está aberta. Resultados completos são reutilizados. Novas leituras válidas recebidas pelo site recalculam esta aba automaticamente. O cache preserva o 1º turno completo e compartilha leituras do 2º por 5 minutos; consultas simultâneas ao mesmo arquivo são unificadas.</p><div id="compareSources"></div><a href="https://www.tse.jus.br/eleicoes/informacoes-tecnicas-sobre-a-divulgacao-de-resultados" target="_blank" rel="noopener">Documentação técnica oficial do TSE ↗</a></details>`;
  $("compareUF").innerHTML = Object.keys(FIRST_TURN_DATA.ufs)
    .filter((uf) => uf !== "zz")
    .sort()
    .map((uf) => `<option value="${uf}">${uf.toUpperCase()}</option>`)
    .join("");
  $("compareCountry").innerHTML = countries
    .map((c) => `<option>${esc(c)}</option>`)
    .join("");
  function cities() {
    const old = $("compareCity").value,
      q = normalize($("compareSearch").value),
      list = COMPARE_CITIES.filter(
        (c) => c.uf === $("compareUF").value && normalize(c.name).includes(q),
      );
    $("compareCity").innerHTML =
      '<option value="">Selecione um município</option>' +
      list
        .map((c) => `<option value="${c.id}">${esc(c.name)}</option>`)
        .join("");
    if (list.some((c) => c.id === old)) $("compareCity").value = old;
  }
  function selection() {
    const scope = $("compareScope").value,
      uf = $("compareUF").value;
    if (scope === "br")
      return {
        label: "Brasil inteiro",
        units: [{ uf: "br", base: FIRST_TURN_DATA.national }],
      };
    if (scope === "uf")
      return {
        label: uf.toUpperCase(),
        units: [{ uf, base: FIRST_TURN_DATA.ufs[uf] }],
      };
    if (scope === "city") {
      const c = COMPARE_CITIES.find((c) => c.id === $("compareCity").value);
      return c
        ? {
            label: c.name + " / " + c.uf.toUpperCase(),
            units: [{ uf: c.uf, code: c.code, base: FIRST_TURN_CITIES[c.id] }],
          }
        : null;
    }
    return {
      label: $("compareCountry").value,
      units: EXTERIOR_LOCATIONS.filter(
        (c) => c.country === $("compareCountry").value,
      ).map((c) => ({ uf: "zz", code: c.code, name: c.name })),
    };
  }
  function read(sel, turn) {
    const rows = sel.units.map((u) =>
      turn === 1 && u.base
        ? M.base(u.base)
        : store.peek(store.url(turn, u.uf, u.code)),
    );
    return {
      value: rows.length === 1 ? rows[0] : M.aggregate(rows),
      loaded: rows.filter(Boolean).length,
    };
  }
  function dataCell(value, p) {
    return `${num(value)}${p !== null ? `<small>${percent(p)}</small>` : ""}`;
  }
  function row(r) {
    return `<tr><th scope="row">${esc(r.name)}</th><td>${dataCell(r.a, r.p1)}</td><td>${dataCell(r.b, r.p2)}</td><td class="delta">${signed(r.absolute, "", true)}</td><td class="delta">${signed(r.relative, "%")}</td><td class="delta">${signed(r.pp, " p.p.")}</td></tr>`;
  }
  function render() {
    const sel = selection();
    if (!sel) {
      $("compareNotice").textContent = "Selecione um município para comparar.";
      $("compareRefresh").disabled = true;
      for (const id of [
        "compareDates",
        "compareCandidates",
        "compareParticipation",
        "compareBars",
        "compareSources",
        "compareElectorate",
      ])
        $(id).innerHTML = "";
      return;
    }
    $("compareRefresh").disabled = !!ctl;
    const one = read(sel, 1),
      two = read(sel, 2),
      a = one.value,
      b = two.value,
      normalized = $("compareBasis").value === "normalized",
      result = M.compare(a, b, normalized);
    $("compareNotice").textContent =
      !a || !b
        ? `${sel.label} · Aguardando dados oficiais completos da localidade: 1º turno ${one.loaded}/${sel.units.length} arquivos; 2º turno ${two.loaded}/${sel.units.length}. Clique em Atualizar comparação.`
        : !result.begun
          ? `${sel.label} · SEGUNDO TURNO SEM SEÇÕES TOTALIZADAS. O 1º turno está disponível; as variações de votos aguardam o início da contagem.`
          : result.partial
            ? `${sel.label} · COMPARAÇÃO PROVISÓRIA: 1º turno com ${percent(a.p)} das seções; 2º turno com ${percent(b.p)}. Diferenças incluem a cobertura desigual da apuração e não representam ganho ou perda final.`
            : `${sel.label} · Ambos os turnos com 100% das seções totalizadas. Resultados ainda podem receber retificações oficiais.`;
    $("compareDates").innerHTML = [
      [a, 1],
      [b, 2],
    ]
      .map(
        ([d, t]) =>
          `<div><b>${t}º turno · ${d ? percent(d.p) : "—"} das seções</b><small>${d ? num(d.st) + " / " + num(d.ts) + " seções totalizadas" : "Sem leitura completa"}</small><small>${d ? "Arquivo oficial: " + esc(d.date + " " + d.time) + " · Brasília" : "Horário oficial indisponível"}${d?.earliest && d.earliest.timestamp !== d.timestamp ? "<br>Arquivos desde " + esc(d.earliest.date + " " + d.earliest.time) : ""}</small></div>`,
      )
      .join("");
    $("compareBasisNote").textContent = normalized
      ? "1º turno: somente os votos dos dois finalistas no denominador. 2º turno: votos válidos oficiais. A diferença mede a participação relativa entre eles, sem inferir transferência de votos."
      : "Cada percentual usa todos os votos válidos do próprio turno. No 1º turno há outros candidatos; por isso, os dois percentuais não somam 100%.";
    $("compareCandidates").innerHTML = result.candidates.map(row).join("");
    $("compareParticipation").innerHTML = result.participation
      .map(row)
      .join("");
    $("compareBars").innerHTML = result.candidates
      .map(
        (r, i) =>
          `<div><h3>${r.name}</h3>${[
            [r.p1, 1],
            [r.p2, 2],
          ]
            .map(
              ([p, t]) =>
                `<div class="barRow ${i ? "blue" : "red"}"><span>${t}º turno</span><div class="barTrack"><i class="${t === 1 ? "before" : ""}" style="width:${p ?? 0}%"></i></div><b>${percent(p)}</b></div>`,
            )
            .join(
              "",
            )}<p class="small">Mudança de participação: <b class="delta">${signed(r.pp, " p.p.")}</b></p></div>`,
      )
      .join("");
    const ed = M.delta(a?.t.electorate ?? null, b?.t.electorate ?? null);
    $("compareElectorate").textContent =
      ed.absolute === null
        ? "A diferença de eleitorado será calculada após receber os dois turnos."
        : `Eleitorado apto: ${signed(ed.absolute, "", true)} eleitores (${signed(ed.relative, "%")}). Cada turno mantém seu próprio total e sua própria cobertura.`;
    $("compareSources").innerHTML =
      "<p>Arquivos utilizados (clique para conferir):</p><ul>" +
      sel.units
        .map(
          (u) =>
            `<li>${esc(u.name || sel.label)}: <a href="${store.url(1, u.uf, u.code)}" target="_blank" rel="noopener">1º turno</a> · <a href="${store.url(2, u.uf, u.code)}" target="_blank" rel="noopener">2º turno</a></li>`,
        )
        .join("") +
      "</ul>";
  }
  async function refresh() {
    if (ctl) return;
    const sel = selection();
    if (!sel) return;
    const task = new AbortController();
    ctl = task;
    error = "";
    lastLabel = sel.label;
    $("compareCancel").disabled = false;
    render();
    let done = 0;
    const jobs = sel.units.flatMap((u) => [
      ...(u.base ? [] : [{ u, turn: 1 }]),
      { u, turn: 2 },
    ]);
    try {
      for (const { u, turn } of jobs) {
        task.signal.throwIfAborted();
        $("compareStatus").textContent =
          `${sel.label}: carregando ${++done}/${jobs.length} snapshots…`;
        await store.getURL(store.url(turn, u.uf, u.code), {
          signal: task.signal,
        });
        await new Promise((r) => setTimeout(r, 0));
      }
      task.signal.throwIfAborted();
      $("compareStatus").textContent =
        "Snapshots carregados para " +
        sel.label +
        ". Horários oficiais abaixo.";
    } catch (e) {
      error = task.signal.aborted
        ? "Consulta cancelada. Leituras já recebidas preservadas."
        : "Falha: " +
          e.message +
          ". Dados anteriores preservados; confira os horários.";
      $("compareStatus").textContent = error;
    } finally {
      ctl = null;
      $("compareCancel").disabled = true;
      render();
    }
  }
  function filters() {
    ctl?.abort();
    error = "";
    $("compareStatus").textContent = "";
    const s = $("compareScope").value;
    $("compareUFLabel").hidden = !["uf", "city"].includes(s);
    $("compareSearchLabel").hidden = s !== "city";
    $("compareCityLabel").hidden = s !== "city";
    $("compareCountryLabel").hidden = s !== "country";
    render();
  }
  $("compareScope").onchange = filters;
  $("compareUF").onchange = () => {
    cities();
    filters();
  };
  $("compareSearch").oninput = () => {
    cities();
    filters();
  };
  $("compareCity").onchange = filters;
  $("compareCountry").onchange = filters;
  $("compareBasis").onchange = render;
  $("compareRefresh").onclick = refresh;
  $("compareCancel").onclick = () => ctl?.abort();
  store.subscribe(() => render());
  cities();
  filters();
  refresh();
  setInterval(() => {
    if (!document.getElementById("comparison").hidden) refresh();
  }, 300000);
})();
