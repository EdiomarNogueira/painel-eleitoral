(() => {
  const $ = (id) => document.getElementById(id),
    pct = (n) =>
      n.toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }) + "%",
    num = (n) => Math.round(n).toLocaleString("pt-BR");
  let baseline = null,
    scenario = null,
    lastKey = "",
    scenarioInputDirty = false;
  const box = document.createElement("section");
  box.id = "whatIf";
  box.className = "whatIf";
  box.innerHTML = `<div class="sectionhead"><div><div class="eyebrow">MUDE UMA REGIÃO. COMPARE O BRASIL.</div><h2>E se o resultado nessa região fosse diferente?</h2></div></div><p>Escolha a participação <b>final</b> de cada candidato em uma região. O total de votos previsto da região é mantido. As demais regiões mantêm suas projeções atuais.</p><p class="plainHint">Lula + Flávio = 100% nesta comparação. Os demais candidatos do primeiro turno não são redistribuídos.</p><div class="whatIfControls"><label>Região que você quer alterar<select id="whatRegion">${Object.keys(
    RegionalModel.groups,
  )
    .map((g) => `<option ${g === "Nordeste" ? "selected" : ""}>${g}</option>`)
    .join(
      "",
    )}</select></label><label>Lula: % final na região<input id="whatLula" type="number" min="0" max="100" step="any" value="60" inputmode="decimal"></label><label>Flávio: % final na região<input id="whatFlavio" type="number" min="0" max="100" step="any" value="40" inputmode="decimal"></label><button id="applyWhatIf" class="primary">Calcular este cenário</button><button id="clearWhatIf" class="secondary">Voltar à projeção atual</button></div><p id="whatLimits"></p><p id="whatStatus" role="status"></p><div id="whatComparison" class="whatComparison"></div><div class="gaugeSection"><div><div class="eyebrow">MOSTRADOR DO CENÁRIO NACIONAL</div><h2 id="gaugeTitle">Quem fica à frente?</h2><label for="gaugeMetric">O que o ponteiro representa</label><select id="gaugeMetric"><option value="votes">Participação nos votos projetados</option><option value="scenarios">Vitórias nos cenários simulados · experimental</option></select><p id="gaugeExplanation"></p></div><div class="gaugeCard"><svg id="victoryGauge" viewBox="0 0 440 275" role="img" aria-label="Mostrador da comparação entre Lula e Flávio"><path d="M 40 210 A 180 180 0 0 1 220 30" fill="none" stroke="#c84d4d" stroke-width="25"/><path d="M 220 30 A 180 180 0 0 1 400 210" fill="none" stroke="#387cc1" stroke-width="25"/><line x1="220" y1="15" x2="220" y2="50" stroke="#fff" stroke-width="4"/><text x="220" y="265" text-anchor="middle" font-size="12" fill="#52685a">50% / 50%</text><line id="gaugeNeedle" x1="220" y1="210" x2="220" y2="65" stroke="#18352c" stroke-width="6" stroke-linecap="round"/><circle cx="220" cy="210" r="12" fill="#18352c"/><text x="24" y="244" font-size="14" fill="#ab3038">100% Lula</text><text x="416" y="244" text-anchor="end" font-size="14" fill="#2469b2">100% Flávio</text></svg><div class="gaugePeople"><div><img src="photos/13.jpeg" alt="Lula" width="52" height="52"><span>Lula <b id="gaugeLula">—</b></span></div><div><span>Flávio Bolsonaro <b id="gaugeFlavio">—</b></span><img src="photos/22.jpeg" alt="Flávio Bolsonaro" width="52" height="52"></div></div><p id="gaugeLead" role="status"></p><small id="gaugeSource"></small></div></div></section>`;
  document.querySelector(".scenarioBox").before(box);
  function limits() {
    if (!baseline?.complete) {
      $("whatLimits").textContent =
        "Aguardando dados suficientes dos 26 estados, do Distrito Federal e do exterior.";
      $("applyWhatIf").disabled = true;
      return;
    }
    $("applyWhatIf").disabled = false;
    const region = $("whatRegion").value,
      bounds = ScenarioModel.limits(baseline.entries, region);
    if (bounds.error) {
      $("whatLimits").textContent = bounds.error;
      $("applyWhatIf").disabled = true;
      return;
    }
    if (!scenarioInputDirty) {
      const share = Math.max(bounds.min, Math.min(bounds.max, 60));
      $("whatLula").value = String(share);
      $("whatFlavio").value = String(100 - share);
    }
    $("whatLimits").textContent =
      `Projeção atual de ${region}: Lula ${pct(bounds.share)}. Pelos votos já contados, Lula pode terminar entre ${pct(bounds.min)} e ${pct(bounds.max)} sem retirar votos existentes.`;
  }
  function draw() {
    const finalized =
      baseline?.complete &&
      !baseline.demo &&
      baseline.entries.every((e) => RegionalModel.isComplete(e.est.current));
    $("gaugeMetric").disabled = Boolean(finalized);
    if (finalized) $("gaugeMetric").value = "votes";
    const entries = scenario?.entries || baseline?.entries,
      ready = baseline?.complete && entries,
      metric = $("gaugeMetric").value;
    let a = null,
      b = null,
      tie = 0;
    if (ready) {
      if (metric === "votes") {
        const totals = ScenarioModel.totals(entries);
        a = (100 * totals.a) / (totals.a + totals.b);
        b = 100 - a;
      } else {
        const sim = RegionalModel.simulate(entries, baseline.sigma);
        a = sim.a;
        b = sim.b;
        tie = sim.tie;
      }
    }
    const right = b === null ? 50 : b + tie / 2,
      angle = Math.PI * (1 - right / 100);
    $("gaugeNeedle").setAttribute("x2", String(220 + 145 * Math.cos(angle)));
    $("gaugeNeedle").setAttribute("y2", String(210 - 145 * Math.sin(angle)));
    $("gaugeNeedle").style.opacity = ready ? "1" : ".2";
    $("gaugeLula").textContent = a === null ? "—" : pct(a);
    $("gaugeFlavio").textContent = b === null ? "—" : pct(b);
    $("gaugeLead").textContent =
      a === null
        ? "Aguardando base para calcular"
        : Math.abs(a - b) < 0.000001
          ? "Empate na comparação"
          : `${a > b ? "Lula" : "Flávio Bolsonaro"} à frente: ${pct(Math.max(a, b))}${metric === "votes" ? " dos votos entre os dois" : " dos cenários simulados"}`;
    $("gaugeExplanation").textContent =
      metric === "votes"
        ? "O ponteiro mostra a divisão dos votos projetados entre os dois candidatos. Porcentagem de votos não é chance de vencer."
        : "O ponteiro usa a frequência em 4.000 cenários com as hipóteses de incerteza da seção Avançado. Isso não é uma probabilidade real validada. Empates dividem a posição do ponteiro igualmente.";
    $("gaugeSource").textContent =
      (scenario
        ? "Cenário personalizado · " + scenario.region
        : "Projeção atual por estados") +
      (baseline?.demo ? " · base: 1º turno" : " · base: 2º turno oficial") +
      (tie ? " · empates nos cenários: " + pct(tie) : "");
    if (
      ready &&
      !baseline.demo &&
      entries.every((e) => RegionalModel.isComplete(e.est.current))
    ) {
      $("gaugeSource").textContent =
        "Resultado totalizado · 100% das seções · 2º turno oficial";
      $("gaugeExplanation").textContent =
        "Apuração encerrada. Os votos totais são preservados, sem estimar crescimento adicional.";
      $("applyWhatIf").disabled = true;
      $("whatLimits").textContent =
        "Apuração encerrada: não há votos restantes para alterar o cenário.";
    }
    $("victoryGauge").setAttribute(
      "aria-label",
      $("gaugeLead").textContent + ". " + $("gaugeExplanation").textContent,
    );
    if (scenario) {
      const { before, after } = scenario,
        percent = (v) => (100 * v.a) / (v.a + v.b);
      $("whatComparison").innerHTML =
        `<div><span>Antes · projeção nacional</span><strong><span class="redText">Lula ${pct(percent(before))}</span><br><span class="blueText">Flávio ${pct(100 - percent(before))}</span></strong></div><div><span>Depois · somente ${scenario.region} alterado</span><strong><span class="redText">Lula ${pct(percent(after))}</span><br><span class="blueText">Flávio ${pct(100 - percent(after))}</span></strong></div><p>Diferença para Lula: ${num(after.a - before.a)} votos na projeção nacional. Votos atuais e dados do TSE permanecem intactos.</p>`;
    } else $("whatComparison").innerHTML = "";
  }
  function apply() {
    if (!baseline?.complete) return;
    const v = $("whatLula").value.trim(),
      share = v === "" ? NaN : Number(v);
    const result = ScenarioModel.changeRegion(
      baseline.entries,
      $("whatRegion").value,
      share,
    );
    if (result.error) {
      $("whatStatus").textContent = result.error;
      $("whatStatus").className = "notice error";
      return;
    }
    scenario = result;
    $("whatStatus").textContent =
      `Cenário aplicado: ${result.region}, Lula ${pct(share)} / Flávio ${pct(100 - share)}. As outras regiões mantêm as projeções anteriores.`;
    $("whatStatus").className = "notice";
    draw();
  }
  $("applyWhatIf").onclick = apply;
  $("clearWhatIf").onclick = () => {
    scenario = null;
    scenarioInputDirty = false;
    $("whatStatus").textContent =
      "Mostrando novamente a projeção atual, sem alteração regional.";
    limits();
    draw();
  };
  $("whatRegion").onchange = () => {
    scenario = null;
    scenarioInputDirty = false;
    $("whatStatus").textContent = "";
    limits();
    draw();
  };
  for (const [from, to] of [
    ["whatLula", "whatFlavio"],
    ["whatFlavio", "whatLula"],
  ])
    $(from).oninput = () => {
      scenarioInputDirty = true;
      const raw = $(from).value,
        n = Number(raw);
      $(to).value =
        raw.trim() !== "" && n >= 0 && n <= 100
          ? String(Number((100 - n).toFixed(6)))
          : "";
    };
  $("gaugeMetric").onchange = draw;
  window.addEventListener("horizonte-territory-estimates", (e) => {
    const next = e.detail,
      key = JSON.stringify([
        next.demo,
        next.entries.map((x) => [
          x.uf,
          x.est?.a,
          x.est?.b,
          x.est?.current.a,
          x.est?.current.b,
        ]),
      ]);
    if (key !== lastKey) {
      if (scenario)
        $("whatStatus").textContent =
          "A base foi atualizada. O cenário personalizado foi removido; calcule novamente para usá-lo na nova base.";
      scenario = null;
      scenarioInputDirty = false;
    }
    lastKey = key;
    baseline = next;
    limits();
    draw();
  });
  window.dispatchEvent(new Event("horizonte-territory-request"));
})();
