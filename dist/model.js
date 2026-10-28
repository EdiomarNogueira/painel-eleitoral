(function (root) {
  function project(history, method = "recent") {
    const cur = history.at(-1);
    if (!cur || cur.p <= 0) return null;
    if (cur.p === 100) return [cur.a, cur.b];
    if (method === "average")
      return [(cur.a * 100) / cur.p, (cur.b * 100) / cur.p];
    const prev = history[Math.max(0, history.length - 5)];
    if (prev === cur || cur.p <= prev.p || cur.a < prev.a || cur.b < prev.b)
      return null;
    return [
      cur.a + ((cur.a - prev.a) / (cur.p - prev.p)) * (100 - cur.p),
      cur.b + ((cur.b - prev.b) / (cur.p - prev.p)) * (100 - cur.p),
    ];
  }
  function turnout(d) {
    const count = (x) =>
      x !== undefined &&
      x !== null &&
      x !== "" &&
      Number.isSafeInteger(Number(x)) &&
      Number(x) >= 0
        ? Number(x)
        : null;
    const e = d.e || {},
      v = d.v || {};
    return {
      electorate: count(e.te),
      covered: count(e.esi),
      attended: count(e.c),
      abstained: count(e.a),
      totalVotes: count(v.tv),
      valid: count(v.vv),
      blank: count(v.vb),
      nullVotes: count(v.tvn),
      technicalNull: count(v.vnt),
    };
  }
  function parseTSE(d) {
    if (
      String(d.ele) !== "6258" ||
      String(d.t) !== "2" ||
      d.f !== "o" ||
      d.cdabr !== "br"
    )
      throw Error("Arquivo não corresponde à eleição oficial esperada.");
    const cargo = d.carg?.find((c) => Number(c.cd) === 1);
    const candidates = (cargo?.agr || [])
      .flatMap((g) =>
        (g.par || []).flatMap((p) =>
          (p.cand || []).map((c) => ({
            id: String(c.n),
            name: c.nmu || c.nm,
            party: p.sg,
            votes: Number(c.vap),
          })),
        ),
      )
      .sort((a, b) => Number(a.id) - Number(b.id));
    const total = Number(d.s?.ts),
      counted = Number(d.s?.st);
    if (
      candidates.length !== 2 ||
      candidates.some(
        (c) => !Number.isSafeInteger(c.votes) || c.votes < 0 || !c.name,
      ) ||
      !Number.isSafeInteger(total) ||
      total <= 0 ||
      !Number.isSafeInteger(counted) ||
      counted < 0 ||
      counted > total ||
      !d.dg ||
      !d.hg
    )
      throw Error(
        "Formato inesperado. Projeção suspensa para evitar dados incorretos.",
      );
    const [day, month, year] = d.dg.split("/");
    const timestamp = Date.parse(`${year}-${month}-${day}T${d.hg}-03:00`);
    if (!Number.isFinite(timestamp)) throw Error("Data do arquivo inválida.");
    return {
      candidates,
      total,
      counted,
      p: (counted / total) * 100,
      a: candidates[0].votes,
      b: candidates[1].votes,
      id: String(d.idg),
      timestamp,
      label: d.hg,
      date: d.dg,
      turnout: turnout(d),
    };
  }
  root.ElectionModel = { project, parseTSE, turnout };
  if (typeof module !== "undefined") module.exports = root.ElectionModel;
})(globalThis);
