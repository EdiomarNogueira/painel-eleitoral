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
  const ratio = (n, d) => (n !== null && d > 0 ? (100 * n) / d : null);
  const timestamp = (date, time) => {
    const [d, m, y] = date.split("/");
    return Date.parse(`${y}-${m}-${d}T${time}-03:00`);
  };
  function base(d) {
    const candidates = d.candidates || [],
      a = count(candidates.find((c) => c.id === "13")?.votes),
      b = count(candidates.find((c) => c.id === "22")?.votes);
    const st = count(d.s?.st),
      ts = count(d.s?.ts),
      t = root.ElectionModel.turnout(d);
    if (
      [a, b, st, ts, t.valid].some((n) => n === null) ||
      st > ts ||
      a + b > t.valid
    )
      throw Error("Contagens inconsistentes");
    const time = timestamp(d.date, d.time);
    if (!Number.isFinite(time)) throw Error("Horário oficial inválido");
    return {
      a,
      b,
      st,
      ts,
      p: ratio(st, ts),
      t,
      date: d.date,
      time: d.time,
      timestamp: time,
      first: !!d.first,
    };
  }
  function raw(d, expected) {
    const turn = expected.turn,
      ele = turn === 1 ? "6257" : "6258";
    if (
      d.f !== "o" ||
      String(d.ele) !== ele ||
      String(d.t) !== String(turn) ||
      d.tpabr !== expected.scope ||
      String(d.cdabr).toLowerCase() !== expected.area
    )
      throw Error("Eleição, turno ou localidade não corresponde à consulta");
    const cs = (d.carg || [])
      .filter((c) => String(c.cd) === "1")
      .flatMap((c) =>
        (c.agr || []).flatMap((a) =>
          (a.par || []).flatMap((p) => p.cand || []),
        ),
      );
    if (new Set(cs.map((c) => String(c.n))).size !== cs.length)
      throw Error("Candidato duplicado");
    const r = base({
      ...d,
      date: d.dg,
      time: d.hg,
      candidates: cs.map((c) => ({ id: String(c.n), votes: c.vap })),
      first: turn === 1,
    });
    if (turn === 2 && (cs.length !== 2 || r.a + r.b !== r.t.valid))
      throw Error("Finalistas ou votos válidos inconsistentes");
    return r;
  }
  function aggregate(items) {
    if (!items.length || items.some((x) => !x)) return null;
    const sum = (k) => items.reduce((n, x) => n + x[k], 0),
      t = {};
    for (const k of Object.keys(items[0].t))
      t[k] = items.some((x) => x.t[k] === null)
        ? null
        : items.reduce((n, x) => n + x.t[k], 0);
    const sorted = [...items].sort((a, b) => a.timestamp - b.timestamp),
      latest = sorted.at(-1),
      st = sum("st"),
      ts = sum("ts");
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
  function delta(a, b) {
    return {
      absolute: a === null || b === null ? null : b - a,
      relative: a > 0 && b !== null ? (100 * (b - a)) / a : null,
    };
  }
  function compare(one, two, normalized = true) {
    const begun = !!two && two.st > 0;
    const candidates = ["a", "b"].map((key, i) => {
      const a = one?.[key] ?? null,
        b = two?.[key] ?? null,
        p1 = one ? ratio(a, normalized ? one.a + one.b : one.t.valid) : null,
        p2 = two ? ratio(b, two.t.valid) : null;
      return {
        name: i ? "Flávio Bolsonaro" : "Lula",
        a,
        b,
        p1,
        p2,
        pp: p1 !== null && p2 !== null ? p2 - p1 : null,
        ...delta(a, begun ? b : null),
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
      const a = one?.t[key] ?? null,
        b = two?.t[key] ?? null,
        p1 = den && one ? ratio(a, one.t[den]) : null,
        p2 = den && two ? ratio(b, two.t[den]) : null;
      return {
        name,
        a,
        b,
        p1,
        p2,
        pp: p1 !== null && p2 !== null ? p2 - p1 : null,
        ...delta(a, begun || key === "electorate" ? b : null),
      };
    });
    return {
      candidates,
      participation,
      partial: !one || !two || one.st !== one.ts || two.st !== two.ts,
      begun,
    };
  }
  root.ComparativoModel = { base, raw, aggregate, compare, delta, ratio };
  if (typeof module !== "undefined") module.exports = root.ComparativoModel;
})(globalThis);
