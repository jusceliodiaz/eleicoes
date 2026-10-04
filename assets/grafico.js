/* Aba "Por estado": barras 100% empilhadas para as 27 UFs, com seletor de cargo.
   Presidente: cores fixas nos dois primeiros do Brasil. Demais cargos: 1º e 2º de cada estado.
   Só busca os dados enquanto a aba está aberta. Usa toNum/fmtInt/fmtPct/BASE_TSE/NOMES_UF/cargoDe/
   selecionarUF de painel.js. */
const G_INTERVALO_SEG = 60;
const fmtPct1 = n => n.toLocaleString("pt-BR", {minimumFractionDigits:1, maximumFractionDigits:1});
const urlCargo = (id, uf) => {
  const c = cargoDe(id, uf);
  return `${BASE_TSE}/oficial/ele2026/${c.eleicao}/dados/${uf}/${uf}-c${c.cargo}-e${c.eleicao.padStart(6, "0")}-u.json`;
};

let gTimer = null, gDados = null, gLideres = null, gCargo = "pres", gGeracao = 0;

/* Lê um arquivo do TSE: % apurado e votos/percentual de cada candidato, pelo número. */
function lerArquivo(d){
  const cands = {};
  (d.carg || []).forEach(cg => (cg.agr || []).forEach(ag => (ag.par || []).forEach(pa => (pa.cand || []).forEach(c => {
    cands[c.n] = {nome: c.nmu || c.nm || "Sem nome", partido: pa.sg || "", votos: toNum(c.vap), pct: toNum(c.pvap)};
  }))));
  return {pst: toNum((d.s || {}).pst), cands};
}

async function buscar(uf){
  const res = await buscarTSE(urlCargo(gCargo, uf));
  if (!res.ok) throw new Error(res.status);
  return lerArquivo(await res.json());
}

async function carregarGrafico(){
  const g = ++gGeracao, pres = gCargo === "pres";
  const ufs = Object.keys(NOMES_UF);
  const [br, ...estados] = await Promise.allSettled([pres ? buscar("br") : null, ...ufs.map(buscar)]);
  if (g !== gGeracao) return; // trocou de cargo no meio
  // Presidente: as cores seguem os dois primeiros no Brasil, não a posição em cada estado.
  gLideres = null;
  if (pres && br.status === "fulfilled" && br.value){
    gLideres = Object.entries(br.value.cands).sort((a,b) => b[1].votos - a[1].votos).slice(0, 2)
      .map(([n, c]) => ({n, nome: c.nome, partido: c.partido}));
  }
  if (pres && !gLideres){ $("gResumo").textContent = "Não foi possível ler o resultado nacional do TSE."; return; }
  gDados = ufs.map((uf, i) => {
    const r = estados[i];
    if (r.status !== "fulfilled") return {uf, nome: NOMES_UF[uf], erro: true};
    const todos = Object.values(r.value.cands);
    const [a, b] = pres
      ? gLideres.map(l => ({nome: l.nome, partido: l.partido, ...(r.value.cands[l.n] || {votos:0, pct:0})}))
      : [...todos].sort((x, y) => y.votos - x.votos).slice(0, 2).concat([{nome:"—", partido:"", votos:0, pct:0}]).slice(0, 2);
    const totalVal = todos.reduce((s, c) => s + c.votos, 0);
    return {uf, nome: NOMES_UF[uf], pst: r.value.pst, a, b,
            outros: {votos: totalVal - a.votos - b.votos, pct: Math.max(0, 100 - a.pct - b.pct)}, totalVal};
  });
  desenhar();
}

function desenhar(){
  if (!gDados) return;
  const pres = gCargo === "pres", titulo = cargoDe(gCargo, "").titulo;
  $("gTitulo").textContent = `${gCargo === "depe" ? "Deputado estadual / distrital" : titulo} por estado`;

  const legenda = pres
    ? [[`${gLideres[0].nome} (${gLideres[0].partido})`, "1"], [`${gLideres[1].nome} (${gLideres[1].partido})`, "2"], ["Outros candidatos", "outros"]]
    : [["1º colocado no estado", "1"], ["2º colocado no estado", "2"], ["Demais candidatos", "outros"]];
  $("gLegenda").innerHTML = "";
  legenda.forEach(([n, k]) => {
    const li = document.createElement("li");
    li.innerHTML = `<i style="background:var(--serie-${k})"></i><span></span>`;
    li.querySelector("span").textContent = n;
    $("gLegenda").appendChild(li);
  });
  $("gOrdem").options[0].textContent = pres ? "Vantagem de " + gLideres[0].nome : "Vantagem do 1º colocado";

  const ok = gDados.filter(d => !d.erro && d.totalVal);
  const semVotos = ok.length < 27 ? ` · ${27 - ok.length} ainda sem votos` : "";
  if (!ok.length) $("gResumo").textContent = "Nenhum estado com votos apurados ainda.";
  else if (pres){
    const ganhaA = ok.filter(d => d.a.votos > d.b.votos).length, ganhaB = ok.filter(d => d.b.votos > d.a.votos).length;
    $("gResumo").textContent = `${gLideres[0].nome} à frente em ${ganhaA} ${ganhaA === 1 ? "estado" : "estados"}, ${gLideres[1].nome} em ${ganhaB}` + semVotos;
  } else {
    // Quantos estados cada partido lidera.
    const conta = {};
    ok.forEach(d => { conta[d.a.partido] = (conta[d.a.partido] || 0) + 1; });
    const top = Object.entries(conta).sort((x, y) => y[1] - x[1]).slice(0, 5).map(([p, n]) => `${p} ${n}`).join(", ");
    $("gResumo").textContent = `Estados liderados por partido: ${top}` + semVotos;
  }

  const ordem = $("gOrdem").value;
  const lista = [...gDados].sort((x, y) =>
    ordem === "nome" ? x.nome.localeCompare(y.nome, "pt-BR")
    : ordem === "apurado" ? (y.pst || -1) - (x.pst || -1)
    : ((y.a && y.totalVal ? y.a.pct - y.b.pct : -999) - (x.a && x.totalVal ? x.a.pct - x.b.pct : -999)));

  const box = $("gBarras");
  box.innerHTML = "";
  lista.forEach(d => {
    const linha = document.createElement("div");
    linha.className = "linha";
    linha.setAttribute("role", "listitem");
    linha.tabIndex = 0;
    linha.title = `Abrir o painel de ${d.nome}`;
    const rot = `<span class="uf"><span class="nome-longo">${d.nome}</span><span class="sigla">${d.uf.toUpperCase()}</span>`;
    if (d.erro || !d.totalVal){
      linha.innerHTML = `${rot}<small>${d.erro ? "erro na leitura" : "0,00% apurado"}</small></span>
        <div class="empilhada"><span class="vazia">${d.erro ? "Não foi possível ler" : "Sem votos apurados"}</span></div>`;
    } else {
      const seg = (k, o) => `<span class="${k}" style="flex:0 0 calc(${o.pct}% - 2px)">${o.pct >= 12 ? fmtPct1(o.pct) + "%" : ""}</span>`;
      linha.innerHTML = `${rot}<small>${fmtPct(d.pst)}%<span class="nome-longo"> apurado</span></small></span>
        <div class="empilhada">${seg("s1", d.a)}${seg("s2", d.b)}<span class="so" style="flex:1 1 0"></span></div>
        ${pres ? "" : '<div class="g-nomes"><span></span><span></span></div>'}`;
      if (!pres){
        const [n1, n2] = linha.querySelectorAll(".g-nomes span");
        n1.textContent = `1º ${d.a.nome} (${d.a.partido}) ${fmtPct1(d.a.pct)}%`;
        n2.textContent = `2º ${d.b.nome} (${d.b.partido}) ${fmtPct1(d.b.pct)}%`;
      }
      linha.setAttribute("aria-label", `${d.nome}: ${d.a.nome} ${fmtPct(d.a.pct)}%, ${d.b.nome} ${fmtPct(d.b.pct)}%, outros ${fmtPct(d.outros.pct)}%. ${fmtPct(d.pst)}% das seções apuradas.`);
      const mostrar = ev => dica(ev, d, linha);
      linha.addEventListener("mousemove", mostrar);
      linha.addEventListener("focus", mostrar);
      linha.addEventListener("mouseleave", esconderDica);
      linha.addEventListener("blur", esconderDica);
    }
    // Clicar num estado abre o painel dele.
    const abrir = () => { esconderDica(); selecionarUF(d.uf, true); abrirAba("painel"); scrollTo({top: 0}); };
    linha.addEventListener("click", abrir);
    linha.addEventListener("keydown", ev => { if (ev.key === "Enter") abrir(); });
    box.appendChild(linha);
  });

  const t = $("gTabela");
  t.innerHTML = `<thead><tr><th>Estado</th><th>% apurado</th><th></th><th></th><th>Outros</th></tr></thead><tbody></tbody>`;
  t.rows[0].cells[2].textContent = pres ? gLideres[0].nome : "1º";
  t.rows[0].cells[3].textContent = pres ? gLideres[1].nome : "2º";
  const quem = o => pres ? "" : ` ${o.nome} (${o.partido})`;
  [...gDados].sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR")).forEach(d => {
    const tr = t.tBodies[0].insertRow();
    const cel = d.erro || !d.totalVal ? [d.nome, d.erro ? "—" : "0,00%", "—", "—", "—"]
      : [d.nome, fmtPct(d.pst) + "%", `${fmtPct(d.a.pct)}% (${fmtInt(d.a.votos)})${quem(d.a)}`,
         `${fmtPct(d.b.pct)}% (${fmtInt(d.b.votos)})${quem(d.b)}`, `${fmtPct(d.outros.pct)}%`];
    cel.forEach(v => { tr.insertCell().textContent = v; });
  });
}

function dica(ev, d, linha){
  const el = $("gDica"), sec = $("aba-grafico");
  el.innerHTML = `<b></b><br>${fmtPct(d.pst)}% das seções apuradas<br>
    <i style="background:var(--serie-1)"></i><span></span>: <b>${fmtPct(d.a.pct)}%</b> · ${fmtInt(d.a.votos)} votos<br>
    <i style="background:var(--serie-2)"></i><span></span>: <b>${fmtPct(d.b.pct)}%</b> · ${fmtInt(d.b.votos)} votos<br>
    <i style="background:var(--serie-outros)"></i>Outros: <b>${fmtPct(d.outros.pct)}%</b> · ${fmtInt(d.outros.votos)} votos<br>
    <small>Clique para abrir o painel do estado</small>`;
  el.querySelector("b").textContent = d.nome;
  const sp = el.querySelectorAll("span");
  sp[0].textContent = `${d.a.nome} (${d.a.partido})`; sp[1].textContent = `${d.b.nome} (${d.b.partido})`;
  el.hidden = false;
  const caixa = sec.getBoundingClientRect(), lr = linha.getBoundingClientRect();
  const x = ev.clientX != null ? ev.clientX : lr.left + lr.width / 2;
  const left = Math.min(Math.max(8, x - caixa.left + 14), caixa.width - el.offsetWidth - 8);
  el.style.left = left + "px";
  el.style.top = (lr.bottom - caixa.top + 6) + "px";
}
function esconderDica(){ $("gDica").hidden = true; }

/* ---------- Abas ----------
   Cada aba com dados próprios registra {abrir, fechar} em ABAS; só busca dados enquanto está aberta. */
const ABAS = {
  painel: {hash: ""},
  grafico: {hash: "#por-estado",
            abrir(){ if (!gTimer){ carregarGrafico(); gTimer = setInterval(carregarGrafico, G_INTERVALO_SEG * 1000); } },
            fechar(){ clearInterval(gTimer); gTimer = null; }},
};
let abaAtual = "painel";
function abrirAba(qual){
  if (!ABAS[qual]) qual = "painel";
  if (abaAtual !== qual && ABAS[abaAtual].fechar) ABAS[abaAtual].fechar();
  abaAtual = qual;
  Object.keys(ABAS).forEach(k => {
    const ativo = k === qual;
    $("tab-" + k).setAttribute("aria-selected", ativo);
    $("tab-" + k).tabIndex = ativo ? 0 : -1;
    $("aba-" + k).hidden = !ativo;
  });
  if (ABAS[qual].abrir) ABAS[qual].abrir();
  history.replaceState(null, "", location.pathname + location.search + ABAS[qual].hash);
}
document.querySelector(".abas").addEventListener("click", ev => {
  const t = ev.target.closest("[role=tab]");
  if (t) abrirAba(t.id.slice(4));
});
document.querySelector(".abas").addEventListener("keydown", ev => {
  if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;
  const ks = Object.keys(ABAS), i = ks.indexOf(abaAtual);
  const prox = ks[(i + (ev.key === "ArrowRight" ? 1 : ks.length - 1)) % ks.length];
  abrirAba(prox); $("tab-" + prox).focus();
});
$("gOrdem").addEventListener("change", desenhar);
$("gCargo").addEventListener("change", () => {
  gCargo = $("gCargo").value;
  gDados = null;
  $("gBarras").innerHTML = "";
  $("gResumo").textContent = "Carregando resultados dos 27 estados…";
  carregarGrafico();
});
/* Abre a aba pedida no endereço depois que todos os scripts registraram as suas. */
addEventListener("DOMContentLoaded", () => {
  const h = location.hash === "#presidente-por-estado" ? "#por-estado" : location.hash;
  const k = Object.keys(ABAS).find(k => h && ABAS[k].hash === h);
  if (k) abrirAba(k);
});
