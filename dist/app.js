/** Controlador do resumo nacional: alterna demonstração e resultados oficiais e atualiza os indicadores. */
const URL_TSE =
  "https://resultados.tse.jus.br/oficial/ele2026/6258/dados/br/br-c0001-e006258-u.json";
const elementById = (id) => document.getElementById(id);
const formatVotes = (n) => Math.round(n).toLocaleString("pt-BR");
const formatPercent = (n) =>
  n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
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
let mode = "demo";
let history = [];
let liveHistory = [];
let liveNames = null;
let names = [];
let timer = null;
let busy = false;
let epoch = 0;
function resetDemo() {
  history = [
    FirstTurn.snapshot(FIRST_TURN_DATA.national, 5),
    FirstTurn.snapshot(FIRST_TURN_DATA.national, 10),
  ];
  names = FirstTurn.pairNames(FIRST_TURN_DATA.national);
  window.dispatchEvent(new Event("horizonte-demo-reset"));
  render();
}
function notice(msg, error = false) {
  elementById("notice").textContent = msg;
  elementById("notice").classList.toggle("error", error);
}
function render() {
  const currentResult = history.at(-1);
  const method = elementById("method").value;
  const proj = ElectionModel.project(history, method);
  const sum = currentResult ? currentResult.a + currentResult.b : 0;
  const projectedTotal = proj ? proj[0] + proj[1] : 0;
  elementById("progress").textContent = formatPercent(currentResult?.p || 0);
  elementById("progressbar").style.width = (currentResult?.p || 0) + "%";
  elementById("votes").textContent = formatVotes(sum);
  elementById("sections").textContent =
    mode === "official" && currentResult?.total
      ? `${formatVotes(currentResult.counted)} de ${formatVotes(currentResult.total)} seções`
      : mode === "demo"
        ? "Etapa simulada com a base do 1º turno"
        : "Aguardando seções do TSE";
  elementById("updated").textContent = currentResult
    ? mode === "demo"
      ? currentResult.label
      : currentResult.label + " · " + currentResult.date
    : "Aguardando consulta";
  elementById("status").textContent =
    mode === "demo"
      ? "1º turno real · avanço proporcional simulado"
      : currentResult?.p === 0
        ? "Apuração ainda não iniciada"
        : currentResult?.p === 100
          ? "100% das seções totalizadas"
          : "Última leitura oficial recebida";
  elementById("cards").innerHTML = [0, 1]
    .map((i) => {
      const votes = currentResult
        ? i === 0
          ? currentResult.a
          : currentResult.b
        : 0;
      const share = sum ? (votes / sum) * 100 : 0;
      return `<div class="candidate ${i ? "b" : ""}"><div class="candidateTop"><div class="identity"><img class="candidatePhoto" src="photos/${escapeHtml(names[i]?.id || "unknown")}.jpeg" alt="Foto de ${escapeHtml(names[i]?.name || "candidato")}" width="48" height="48"><div><div class="name">${escapeHtml(names[i]?.name || "Aguardando TSE")}</div><div class="sub">${escapeHtml(names[i]?.party || "")} · ${formatVotes(votes)} votos</div></div></div><div class="pct">${sum ? formatPercent(share) : "—"}</div></div><div class="bar"><i style="width:${share}%"></i></div><div class="metrics"><span>Entre os dois candidatos</span><span>Em 100%: <b>${projectedTotal ? formatPercent((proj[i] / projectedTotal) * 100) + " · " + formatVotes(proj[i]) + " votos" : "aguardando dados"}</b></span></div></div>`;
    })
    .join("");
  if (projectedTotal) {
    const winner = proj[0] === proj[1] ? -1 : proj[0] > proj[1] ? 0 : 1;
    elementById("headline").textContent =
      winner < 0
        ? "Empate no cenário projetado"
        : `${names[winner]?.name || "Candidato"}: ${formatPercent((proj[winner] / projectedTotal) * 100)} entre os dois`;
    elementById("explanation").textContent =
      currentResult.p === 100
        ? mode === "demo"
          ? "Etapa completa da reprodução proporcional. Não é uma simulação de transferência de votos para o 2º turno."
          : "Contagem observada com 100% das seções, sem extrapolação."
        : `${method === "recent" ? "Mantido o ritmo da janela recente" : "Mantida a média acumulada"} · diferença projetada de ${formatVotes(Math.abs(proj[0] - proj[1]))} votos.`;
  } else {
    elementById("headline").textContent = "Aguardando base para projetar";
    elementById("explanation").textContent =
      currentResult?.p > 0
        ? "O ritmo recente precisa de duas leituras com avanço na apuração."
        : "A projeção começa após a entrada dos primeiros votos.";
  }
  elementById("history").innerHTML = history
    .map((h, i) => {
      const previousResult = history[i - 1];
      const delta = previousResult
        ? h.a + h.b - previousResult.a - previousResult.b
        : 0;
      const pr = ElectionModel.project(history.slice(0, i + 1), method);
      return `<tr><td>${escapeHtml(h.label)}</td><td>${formatPercent(h.p)}</td><td>${formatVotes(h.a)}</td><td>${formatVotes(h.b)}</td><td>${delta > 0 ? formatPercent(((h.a - previousResult.a) / delta) * 100) : "—"}</td><td>${pr && pr[0] + pr[1] > 0 ? formatPercent((pr[0] / (pr[0] + pr[1])) * 100) : "—"}</td></tr>`;
    })
    .reverse()
    .slice(0, 30)
    .join("");
  window.dispatchEvent(
    new CustomEvent("horizonte-reading", {
      detail: {
        mode,
        cur: currentResult,
      },
    }),
  );
  drawChart(method);
  elementById("advance").disabled = currentResult?.p >= 100;
  if (mode === "demo") {
    notice(
      "DEMONSTRAÇÃO COM 1º TURNO · Votos reais de 2026, distribuídos proporcionalmente em etapas simuladas. Os percentuais dos candidatos comparam apenas Lula e Flávio; não são o resultado completo do 1º turno nem uma previsão do 2º.",
    );
  }
}
function drawChart(method) {
  const points = history
    .map((h, i) => {
      const pr = ElectionModel.project(history.slice(0, i + 1), method);
      return pr && pr[0] + pr[1] > 0
        ? {
            x: 48 + h.p * 8.9,
            y: 140 - (pr[0] / (pr[0] + pr[1])) * 120,
          }
        : null;
    })
    .filter(Boolean);
  const current = history.at(-1);
  const fallback =
    !points.length && current && current.a + current.b > 0
      ? {
          x: 48 + current.p * 8.9,
          y: 140 - (current.a / (current.a + current.b)) * 120,
        }
      : null;
  if (fallback) {
    points.push(fallback);
  }
  elementById("chart").innerHTML =
    `<svg viewBox="0 0 960 175" role="img" aria-label="Participação de Lula e Flávio: projeção quando disponível, contagem atual quando ainda não há leituras suficientes"><line x1="48" y1="80" x2="938" y2="80" stroke="#acb8aa" stroke-dasharray="5 6"/><line x1="48" y1="140" x2="938" y2="140" stroke="#e5e9e0"/><text x="5" y="24" font-size="11" fill="#66776c">100%</text><text x="12" y="84" font-size="11" fill="#66776c">50%</text><text x="20" y="144" font-size="11" fill="#66776c">0%</text><text x="48" y="167" font-size="11" fill="#66776c">0% apurado</text><text x="850" y="167" font-size="11" fill="#66776c">100% apurado</text><polyline points="${points.map((p) => p.x + "," + p.y).join(" ")}" fill="none" stroke="#1e654e" stroke-width="3"/>${points.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="4" fill="#1e654e"/>`).join("")}${fallback ? '<text x="110" y="28" font-size="12" fill="#66776c">Contagem atual · aguardando leituras para traçar a tendência</text>' : ""}${points.length ? "" : '<text x="330" y="56" font-size="13" fill="#66776c">Aguardando a primeira contagem</text>'}</svg>`;
}
function stopAuto() {
  clearInterval(timer);
  timer = null;
  elementById("auto").checked = false;
}
function startAuto() {
  if (ResultPolicy.complete(liveHistory.at(-1))) {
    stopAuto();
    return;
  }
  if (timer) {
    return;
  }
  elementById("auto").checked = true;
  timer = setInterval(fetchOfficial, 300000);
}
async function fetchOfficial() {
  if (busy || mode !== "official") {
    return;
  }
  if (ResultPolicy.complete(liveHistory.at(-1))) {
    stopAuto();
    render();
    return;
  }
  busy = true;
  elementById("refresh").disabled = true;
  const requestEpoch = epoch;
  try {
    notice("Carregando a leitura compartilhada do projeto…");
    const response = await fetch(URL_TSE, {
      cache: "no-cache",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      throw Error(
        `Snapshot do projeto respondeu HTTP ${response.status}. Nova tentativa automática em até cinco minutos.`,
      );
    }
    const snap = ElectionModel.parseTSE(await response.json());
    if (mode !== "official" || requestEpoch !== epoch) {
      return;
    }
    const previousResult = liveHistory.at(-1);
    let correction = false;
    if (previousResult && snap.timestamp < previousResult.timestamp) {
      throw Error(
        "O projeto retornou uma versão anterior. Última leitura preservada.",
      );
    }
    if (!previousResult || snap.id !== previousResult.id) {
      if (
        previousResult &&
        (snap.a < previousResult.a ||
          snap.b < previousResult.b ||
          snap.counted < previousResult.counted ||
          snap.total !== previousResult.total ||
          snap.candidates.some(
            (c, i) => c.id !== previousResult.candidates[i].id,
          ))
      ) {
        liveHistory = [];
        correction = true;
      }
      if (
        !previousResult ||
        snap.a !== previousResult.a ||
        snap.b !== previousResult.b ||
        snap.counted !== previousResult.counted ||
        correction
      ) {
        liveHistory.push(snap);
      } else {
        liveHistory[liveHistory.length - 1] = snap;
      }
    }
    liveNames = snap.candidates;
    names = liveNames;
    history = liveHistory;
    render();
    notice(
      `DADOS OFICIAIS · Arquivo do TSE gerado em ${snap.date} às ${snap.label} (Brasília). ${correction ? "Correção detectada: janela de projeção reiniciada." : snap.p === 0 ? "Aguardando o início da apuração." : "Projeções calculadas por este painel, não pelo TSE."}`,
    );
    if (snap.p === 100) {
      stopAuto();
    }
  } catch (err) {
    if (mode === "official" && requestEpoch === epoch) {
      const unavailable =
        location.protocol === "file:"
          ? ""
          : " O arquivo compartilhado do projeto está indisponível.";
      notice(
        `Não foi possível atualizar: ${err.message}. ${liveHistory.length ? "Os dados anteriores foram mantidos." : "Nenhum dado oficial carregado."}${unavailable}`,
        true,
      );
    }
  } finally {
    busy = false;
    elementById("refresh").disabled = false;
  }
}
function setMode(next) {
  epoch++;
  stopAuto();
  mode = next;
  window.dispatchEvent(
    new CustomEvent("horizonte-mode", {
      detail: next,
    }),
  );
  for (const id of ["demo", "official"]) {
    elementById(id).classList.toggle("active", id === next);
    elementById(id).setAttribute("aria-pressed", String(id === next));
  }
  elementById("simulator").hidden = next !== "demo";
  elementById("liveControls").hidden = next !== "official";
  if (next === "demo") {
    resetDemo();
  } else {
    const generation = epoch;
    window.TSEClient.history()
      .then((shared) => {
        if (mode !== "official" || generation !== epoch) {
          return;
        }
        liveHistory = shared.national || [];
        history = liveHistory;
        liveNames = liveHistory.at(-1)?.candidates || null;
        names = liveNames || [];
        render();
        fetchOfficial();
        startAuto();
      })
      .catch(() => {
        history = liveHistory;
        names = liveNames || [];
        render();
        fetchOfficial();
        startAuto();
      });
  }
}
elementById("demo").onclick = () => setMode("demo");
elementById("official").onclick = () => setMode("official");
elementById("reset").onclick = resetDemo;
elementById("method").onchange = render;
elementById("share").oninput = () =>
  (elementById("shareLabel").textContent = elementById("share").value + "%");
elementById("advance").onclick = () => {
  const currentResult = history.at(-1);
  const step = Math.min(
    Number(elementById("step").value),
    100 - currentResult.p,
  );
  if (step <= 0) {
    return;
  }
  window.dispatchEvent(
    new CustomEvent("horizonte-demo-advance", {
      detail: step,
    }),
  );
};
elementById("refresh").onclick = fetchOfficial;
elementById("auto").onchange = () => {
  if (elementById("auto").checked) {
    fetchOfficial();
    startAuto();
  } else {
    stopAuto();
  }
};
elementById("source").href = URL_TSE;
elementById("export").onclick = () => {
  const data = {
    mode,
    election: "2026-presidente-segundo-turno",
    source: mode === "official" ? URL_TSE : FIRST_TURN_DATA.source,
    demonstration:
      mode === "demo"
        ? "Avanço proporcional simulado do primeiro turno; comparação restrita a Lula e Flávio"
        : null,
    method: elementById("method").value,
    candidates: names,
    exportedAt: new Date().toISOString(),
    history,
  };
  const link = document.createElement("a");
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    }),
  );
  link.href = url;
  link.download = `painel-eleitoral-2026-${mode}.json`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
window.addEventListener("horizonte-demo-snapshot", (e) => {
  if (mode === "demo") {
    history = e.detail;
    render();
  }
});
setMode("official");
