/* Aba "Previsão 1º e 2º turno".
   Presidente: projeta o resultado final distribuindo, em cada estado, os votos que faltam na
   proporção já apurada naquele estado (corrige estados que apuram mais rápido).
   Governador: em cada estado, diz se a tendência é de vitória no 1º turno, 2º turno ou indefinido.
   Usa toNum/fmtInt/fmtPct/BASE_TSE/NOMES_UF/cargoDe/selecionarUF de painel.js e ABAS/abrirAba de grafico.js. */
const PV_INTERVALO_SEG = 60;
let pvTimer = null;

function urlPv(id, uf){
  const c = cargoDe(id, uf);
  return `${BASE_TSE}/oficial/ele2026/${c.eleicao}/dados/${uf}/${uf}-c${c.cargo}-e${c.eleicao.padStart(6, "0")}-u.json`;
}

/* Arquivo do TSE -> eleitorado, eleitores das seções já apuradas e candidatos. */
function lerPv(d){
  const cands = [];
  (d.carg || []).forEach(cg => (cg.agr || []).forEach(ag => (ag.par || []).forEach(pa => (pa.cand || []).forEach(c => cands.push({
    n: c.n, nome: c.nmu || c.nm || "Sem nome", partido: pa.sg || "", votos: toNum(c.vap), pct: toNum(c.pvap),
    eleito: c.e === "s" || /^eleit/i.test(c.st || ""), segundo: /2º turno/i.test(c.st || "")
  })))));
  const e = d.e || {}, s = d.s || {};
  return {te: toNum(e.te), est: toNum(e.est), pst: toNum(s.pst), cands, validos: cands.reduce((t, c) => t + c.votos, 0)};
}
async function buscarPv(id, uf){
  const res = await fetch(urlPv(id, uf) + "?t=" + Date.now(), {cache:"no-store"});
  if (!res.ok) throw new Error(res.status);
  return lerPv(await res.json());
}

/* Margem sobre 50% que ainda pode virar: grande no começo, some perto do fim da apuração. */
const margemIncerta = pst => Math.max(0.3, 6 * (1 - pst / 100));

/* ---------- Presidente ---------- */
function projetarPresidente(br, estados){
  // Proporção nacional atual, para estados que ainda não têm nenhum voto apurado.
  const partNac = {};
  br.cands.forEach(c => { partNac[c.n] = br.validos ? c.votos / br.validos : 0; });
  const validosPorEleitor = estados.reduce((t, r) => t + (r ? r.validos : 0), 0) /
                            Math.max(1, estados.reduce((t, r) => t + (r ? r.est : 0), 0));
  const proj = {};
  br.cands.forEach(c => { proj[c.n] = 0; });
  estados.forEach(r => {
    if (!r) return;
    const faltamEleitores = Math.max(0, r.te - r.est);
    const ritmo = r.est ? r.validos / r.est : validosPorEleitor; // votos válidos por eleitor
    const faltamValidos = faltamEleitores * ritmo;
    r.cands.forEach(c => {
      const parte = r.validos ? c.votos / r.validos : (partNac[c.n] || 0);
      proj[c.n] = (proj[c.n] || 0) + c.votos + faltamValidos * parte;
    });
  });
  const total = Object.values(proj).reduce((t, v) => t + v, 0) || 1;
  return br.cands.map(c => ({...c, projPct: proj[c.n] / total * 100})).sort((a, b) => b.projPct - a.projPct);
}

function desenharPresidente(br, estados){
  const lista = projetarPresidente(br, estados);
  const [a, b] = lista;
  const faltam = estados.filter(r => !r).length;
  $("pvPresResumo").textContent = `${fmtPct(br.pst)}% das seções apuradas no país` +
    (faltam ? ` · ${faltam} ${faltam === 1 ? "estado" : "estados"} sem leitura agora` : "");

  const v = $("pvPresVeredito");
  const oficial = br.cands.find(c => c.eleito);
  const segundoOficial = br.cands.filter(c => c.segundo);
  let tipo, texto;
  if (oficial){ tipo = "ok"; texto = `<b></b> está eleito no 1º turno (TSE).`; }
  else if (segundoOficial.length === 2){ tipo = "dois"; texto = `2º turno confirmado pelo TSE: <b></b> × <b></b>, em 25 de outubro.`; }
  else if (Math.abs(a.projPct - 50) < margemIncerta(br.pst)){ tipo = "indef"; texto = `<b></b> projetado com ${fmtPct(a.projPct)}%, perto dos 50% necessários para vencer no 1º turno.`; }
  else if (a.projPct > 50){ tipo = "ok"; texto = `Tendência de vitória de <b></b> no 1º turno, com ${fmtPct(a.projPct)}% projetados.`; }
  else { tipo = "dois"; texto = `Tendência de 2º turno entre <b></b> e <b></b>, em 25 de outubro.`; }
  v.className = "pv-veredito " + tipo;
  v.innerHTML = `<span class="pv-chip">${tipo === "ok" ? "1º turno" : tipo === "dois" ? "2º turno" : "Indefinido"}</span><span>${texto}</span>`;
  const nomes = segundoOficial.length === 2 ? segundoOficial : oficial ? [oficial] : [a, b];
  [...v.querySelectorAll("b")].filter(x => !x.textContent).forEach((x, i) => { x.textContent = `${nomes[i].nome} (${nomes[i].partido})`; });

  // Barras: atual x projetado, com a linha dos 50%.
  const box = $("pvPresBarras");
  box.innerHTML = `<div class="pv-legenda"><span><i class="pv-atual"></i>Apurado agora</span><span><i class="pv-proj"></i>Projeção final</span></div>`;
  lista.slice(0, 5).forEach(c => {
    const el = document.createElement("div");
    el.className = "pv-linha";
    el.innerHTML = `<span class="pv-nome"><b></b><small></small></span>
      <div class="pv-trilho">
        <div class="pv-barra pv-atual" style="width:${c.pct}%"></div>
        <div class="pv-barra pv-proj" style="width:${c.projPct}%"></div>
        <div class="pv-50" title="50% dos votos válidos"></div>
      </div>
      <span class="pv-num"><b>${fmtPct(c.projPct)}%</b><small>agora ${fmtPct(c.pct)}%</small></span>`;
    el.querySelector(".pv-nome b").textContent = c.nome;
    el.querySelector(".pv-nome small").textContent = c.partido;
    box.appendChild(el);
  });
}

/* ---------- Governador ---------- */
function desenharGovernador(govs){
  const ufs = Object.keys(NOMES_UF);
  const linhas = ufs.map((uf, i) => {
    const r = govs[i];
    if (!r) return {uf, tipo: "erro"};
    const cs = [...r.cands].sort((x, y) => y.votos - x.votos);
    const [a, b] = cs;
    if (!a || !r.validos) return {uf, tipo: "vazio", r};
    const eleito = cs.find(c => c.eleito), segundo = cs.filter(c => c.segundo);
    const tipo = eleito ? "ok-oficial" : segundo.length === 2 ? "dois-oficial"
      : Math.abs(a.pct - 50) < margemIncerta(r.pst) ? "indef" : a.pct > 50 ? "ok" : "dois";
    return {uf, tipo, r, a: eleito || a, b: segundo.length === 2 ? segundo[1] : b, a2: segundo.length === 2 ? segundo[0] : null};
  });
  const conta = t => linhas.filter(l => l.tipo.startsWith(t)).length;
  $("pvGovResumo").textContent = `${conta("ok")} com tendência de decisão no 1º turno · ${conta("dois")} de 2º turno · ${conta("indef")} indefinidos` +
    (conta("vazio") + conta("erro") ? ` · ${conta("vazio") + conta("erro")} sem dados` : "");

  const ordem = {"ok-oficial": 0, ok: 1, indef: 2, dois: 3, "dois-oficial": 4, vazio: 5, erro: 6};
  linhas.sort((x, y) => ordem[x.tipo] - ordem[y.tipo] || NOMES_UF[x.uf].localeCompare(NOMES_UF[y.uf], "pt-BR"));
  const box = $("pvGovLista");
  box.innerHTML = "";
  linhas.forEach(l => {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "pv-uf " + l.tipo.replace("-oficial", "");
    el.title = `Abrir o painel de ${NOMES_UF[l.uf]}`;
    const chip = {"ok-oficial": "Eleito", ok: "1º turno", indef: "Indefinido", dois: "2º turno", "dois-oficial": "2º turno (TSE)", vazio: "Sem votos", erro: "Sem leitura"}[l.tipo];
    el.innerHTML = `<span class="pv-uf-topo"><b></b><span class="pv-chip">${chip}</span></span><span class="pv-uf-txt"></span>`;
    el.querySelector("b").textContent = NOMES_UF[l.uf];
    const txt = el.querySelector(".pv-uf-txt");
    if (l.a){
      const quem = c => `${c.nome} (${c.partido}) ${fmtPct(c.pct)}%`;
      txt.textContent = (l.tipo.startsWith("dois") ? `${quem(l.a2 || l.a)} × ${quem(l.b)}`
        : quem(l.a) + (l.b ? ` · 2º: ${quem(l.b)}` : "")) + ` · ${fmtPct(l.r.pst)}% apurado`;
    } else txt.textContent = l.tipo === "erro" ? "Não foi possível ler o TSE agora." : "Nenhuma seção apurada ainda.";
    el.addEventListener("click", () => { selecionarUF(l.uf, true); abrirAba("painel"); scrollTo({top: 0}); });
    box.appendChild(el);
  });
}

async function carregarPrevisao(){
  const ufs = Object.keys(NOMES_UF);
  const ok = p => p.then(v => v, () => null);
  const [br, estados, govs] = await Promise.all([
    ok(buscarPv("pres", "br")),
    Promise.all(ufs.map(uf => ok(buscarPv("pres", uf)))),
    Promise.all(ufs.map(uf => ok(buscarPv("gov", uf)))),
  ]);
  if (br) desenharPresidente(br, estados);
  else $("pvPresResumo").textContent = "Não foi possível ler o resultado nacional do TSE.";
  desenharGovernador(govs);
}

ABAS.previsao = {
  hash: "#previsao",
  abrir(){ if (!pvTimer){ carregarPrevisao(); pvTimer = setInterval(carregarPrevisao, PV_INTERVALO_SEG * 1000); } },
  fechar(){ clearInterval(pvTimer); pvTimer = null; },
};
