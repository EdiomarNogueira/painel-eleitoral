/** Comparação entre turnos: totais, percentuais oficiais e normalização dos finalistas. */
(function (root) {
  "use strict";

  const count = (v) =>
    v !== null &&
    v !== undefined &&
    v !== "" &&
    Number.isSafeInteger(Number(v)) &&
    Number(v) >= 0
      ? Number(v)
      : null;
  const ratio = (n, denominator) =>
    n !== null && denominator > 0 ? (100 * n) / denominator : null;
  const timestamp = (date, time) => {
    const [day, m, y] = date.split("/");
    return Date.parse(`${y}-${m}-${day}T${time}-03:00`);
  };
  function readResultTotals(payload) {
    const candidates = payload.candidates || [];
    const a = count(candidates.find((c) => c.id === "13")?.votes);
    const b = count(candidates.find((c) => c.id === "22")?.votes);
    const st = count(payload.s?.st);
    const ts = count(payload.s?.ts);
    const t = root.ElectionModel.turnout(payload);
    if (
      [a, b, st, ts, t.valid].some((n) => n === null) ||
      st > ts ||
      a + b > t.valid
    ) {
      throw Error("Contagens inconsistentes");
    }
    const time = timestamp(payload.date, payload.time);
    if (!Number.isFinite(time)) {
      throw Error("Horário oficial inválido");
    }
    return {
      a,
      b,
      st,
      ts,
      p: ratio(st, ts),
      t,
      date: payload.date,
      time: payload.time,
      timestamp: time,
      first: !!payload.first,
    };
  }
  function parseOfficialResult(payload, expected) {
    const turn = expected.turn;
    const ele = turn === 1 ? "6257" : "6258";
    if (
      payload.f !== "o" ||
      String(payload.ele) !== ele ||
      String(payload.t) !== String(turn) ||
      payload.tpabr !== expected.scope ||
      String(payload.cdabr).toLowerCase() !== expected.area
    ) {
      throw Error("Eleição, turno ou localidade não corresponde à consulta");
    }
    const cs = (payload.carg || [])
      .filter((c) => String(c.cd) === "1")
      .flatMap((c) =>
        (c.agr || []).flatMap((a) =>
          (a.par || []).flatMap((p) => p.cand || []),
        ),
      );
    if (new Set(cs.map((c) => String(c.n))).size !== cs.length) {
      throw Error("Candidato duplicado");
    }
    const r = readResultTotals({
      ...payload,
      date: payload.dg,
      time: payload.hg,
      candidates: cs.map((c) => ({
        id: String(c.n),
        votes: c.vap,
      })),
      first: turn === 1,
    });
    if (turn === 2 && (cs.length !== 2 || r.a + r.b !== r.t.valid)) {
      throw Error("Finalistas ou votos válidos inconsistentes");
    }
    return r;
  }
  function aggregateResults(items) {
    if (!items.length || items.some((x) => !x)) {
      return null;
    }
    const sum = (k) => items.reduce((n, x) => n + x[k], 0);
    const t = {};
    for (const k of Object.keys(items[0].t))
      t[k] = items.some((x) => x.t[k] === null)
        ? null
        : items.reduce((n, x) => n + x.t[k], 0);
    const sorted = [...items].sort((a, b) => a.timestamp - b.timestamp);
    const latest = sorted.at(-1);
    const st = sum("st");
    const ts = sum("ts");
    return {
      a: sum("a"),
      b: sum("b"),
      st,
      ts,
      p: ratio(st, ts),
      t,
      date: latest.date,
      time: latest.time,
      timestamp: latest.timestamp,
      earliest: sorted[0],
      files: items.length,
    };
  }
  function calculateChange(a, b) {
    return {
      absolute: a === null || b === null ? null : b - a,
      relative: a > 0 && b !== null ? (100 * (b - a)) / a : null,
    };
  }
  function compareRounds(firstRound, secondRound, normalized = true) {
    const begun = !!secondRound && secondRound.st > 0;
    const candidates = ["a", "b"].map((key, i) => {
      const a = firstRound?.[key] ?? null;
      const b = secondRound?.[key] ?? null;
      const p1 = firstRound
        ? ratio(
            a,
            normalized ? firstRound.a + firstRound.b : firstRound.t.valid,
          )
        : null;
      const p2 = secondRound ? ratio(b, secondRound.t.valid) : null;
      return {
        name: i ? "Flávio Bolsonaro" : "Lula",
        a,
        b,
        p1,
        p2,
        pp: p1 !== null && p2 !== null ? p2 - p1 : null,
        ...calculateChange(a, begun ? b : null),
      };
    });
    const definitions = [
      ["electorate", "Eleitorado apto", null],
      ["covered", "Eleitores das seções com dados", "electorate"],
      ["attended", "Comparecimento", "covered"],
      ["abstained", "Abstenções", "covered"],
      ["blank", "Brancos", "totalVotes"],
      ["nullVotes", "Nulos (inclui técnicos)", "totalVotes"],
      ["valid", "Votos válidos", "totalVotes"],
    ];
    const participation = definitions.map(([key, name, den]) => {
      const a = firstRound?.t[key] ?? null;
      const b = secondRound?.t[key] ?? null;
      const p1 = den && firstRound ? ratio(a, firstRound.t[den]) : null;
      const p2 = den && secondRound ? ratio(b, secondRound.t[den]) : null;
      return {
        name,
        a,
        b,
        p1,
        p2,
        pp: p1 !== null && p2 !== null ? p2 - p1 : null,
        ...calculateChange(a, begun || key === "electorate" ? b : null),
      };
    });
    return {
      candidates,
      participation,
      partial:
        !firstRound ||
        !secondRound ||
        firstRound.st !== firstRound.ts ||
        secondRound.st !== secondRound.ts,
      begun,
    };
  }
  root.ComparativoModel = {
    base: readResultTotals,
    raw: parseOfficialResult,
    aggregate: aggregateResults,
    compare: compareRounds,
    delta: calculateChange,
    ratio,
  };
  if (typeof module !== "undefined") {
    module.exports = root.ComparativoModel;
  }
})(globalThis);
