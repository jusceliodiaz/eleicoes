/* Aba "Presidente por estado": barras 100% empilhadas (1º e 2º colocados no Brasil + outros)
   para as 27 UFs. Só busca os dados enquanto a aba está aberta. Usa toNum/fmtInt/fmtPct/BASE_TSE
   de painel.js. */
const UFS = {
  ac:"Acre", al:"Alagoas", am:"Amazonas", ap:"Amapá", ba:"Bahia", ce:"Ceará", df:"Distrito Federal",
  es:"Espírito Santo", go:"Goiás", ma:"Maranhão", mg:"Minas Gerais", ms:"Mato Grosso do Sul",
  mt:"Mato Grosso", pa:"Pará", pb:"Paraíba", pe:"Pernambuco", pi:"Piauí", pr:"Paraná",
  rj:"Rio de Janeiro", rn:"Rio Grande do Norte", ro:"Rondônia", rr:"Roraima", rs:"Rio Grande do Sul",
  sc:"Santa Catarina", se:"Sergipe", sp:"São Paulo", to:"Tocantins"
};
const G_INTERVALO_SEG = 60;
const urlPres = uf => `${BASE_TSE}/oficial/ele2026/6257/dados/${uf}/${uf}-c0001-e006257-u.json`;
const fmtPct1 = n => n.toLocaleString("pt-BR", {minimumFractionDigits:1, maximumFractionDigits:1});

let gTimer = null, gDados = null, gLideres = null;

/* Lê um arquivo de presidente: % apurado e votos/percentual de cada candidato, pelo número. */
function lerPres(d){
  const cands = {};
  (d.carg || []).forEach(cg => (cg.agr || []).forEach(ag => (ag.par || []).forEach(pa => (pa.cand || []).forEach(c => {
    cands[c.n] = {nome: c.nmu || c.nm || "Sem nome", partido: pa.sg || "", votos: toNum(c.vap), pct: toNum(c.pvap)};
  }))));
  return {pst: toNum((d.s || {}).pst), cands};
}

async function buscar(uf){
  const res = await fetch(urlPres(uf) + "?t=" + Date.now(), {cache:"no-store"});
  if (!res.ok) throw new Error(res.status);
  return lerPres(await res.json());
}

async function carregarGrafico(){
  const ufs = Object.keys(UFS);
  const [br, ...estados] = await Promise.allSettled([buscar("br"), ...ufs.map(buscar)]);
  // As cores seguem os dois primeiros colocados no Brasil, não a posição em cada estado.
  if (br.status === "fulfilled"){
    gLideres = Object.entries(br.value.cands).sort((a,b) => b[1].votos - a[1].votos).slice(0, 2)
      .map(([n, c]) => ({n, nome: c.nome, partido: c.partido}));
  }
  if (!gLideres){ $("gResumo").textContent = "Não foi possível ler o resultado nacional do TSE."; return; }
  gDados = ufs.map((uf, i) => {
    const r = estados[i];
    if (r.status !== "fulfilled") return {uf, nome: UFS[uf], erro: true};
    const [a, b] = gLideres.map(l => r.value.cands[l.n] || {votos:0, pct:0});
    const totalVal = Object.values(r.value.cands).reduce((s, c) => s + c.votos, 0);
    return {uf, nome: UFS[uf], pst: r.value.pst, a, b,
            outros: {votos: totalVal - a.votos - b.votos, pct: Math.max(0, 100 - a.pct - b.pct)}, totalVal};
  });
  desenhar();
}

function desenhar(){
  if (!gDados) return;
  const [{nome: nA, partido: pA}, {nome: nB, partido: pB}] = gLideres;

  $("gLegenda").innerHTML = "";
  [[nA, pA, "s1"], [nB, pB, "s2"], ["Outros candidatos", "", "so"]].forEach(([n, p, k]) => {
    const li = document.createElement("li");
    li.innerHTML = `<i style="background:var(--serie-${k === "so" ? "outros" : k.slice(1)})"></i><span></span>`;
    li.querySelector("span").textContent = p ? `${n} (${p})` : n;
    $("gLegenda").appendChild(li);
  });
  $("gOrdem").options[0].textContent = "Vantagem de " + nA;

  const ok = gDados.filter(d => !d.erro && d.totalVal);
  const ganhaA = ok.filter(d => d.a.votos > d.b.votos).length, ganhaB = ok.filter(d => d.b.votos > d.a.votos).length;
  $("gResumo").textContent = ok.length
    ? `${nA} à frente em ${ganhaA} ${ganhaA === 1 ? "estado" : "estados"}, ${nB} em ${ganhaB}` + (ok.length < 27 ? ` · ${27 - ok.length} ainda sem votos` : "")
    : "Nenhum estado com votos apurados ainda.";

  const ordem = $("gOrdem").value;
  const lista = [...gDados].sort((x, y) =>
    ordem === "nome" ? x.nome.localeCompare(y.nome, "pt-BR")
    : ordem === "apurado" ? (y.pst || -1) - (x.pst || -1)
    : ((y.a ? y.a.pct - y.b.pct : -999) - (x.a ? x.a.pct - x.b.pct : -999)));

  const box = $("gBarras");
  box.innerHTML = "";
  lista.forEach(d => {
    const linha = document.createElement("div");
    linha.className = "linha";
    linha.setAttribute("role", "listitem");
    linha.tabIndex = 0;
    const rot = `<span class="uf"><span class="nome-longo">${d.nome}</span><span class="sigla">${d.uf.toUpperCase()}</span>`;
    if (d.erro || !d.totalVal){
      linha.innerHTML = `${rot}<small>${d.erro ? "erro na leitura" : "0,00% apurado"}</small></span>
        <div class="empilhada"><span class="vazia">${d.erro ? "Não foi possível ler" : "Sem votos apurados"}</span></div>`;
    } else {
      const seg = (k, o) => `<span class="${k}" style="flex:0 0 calc(${o.pct}% - 2px)">${o.pct >= 12 ? fmtPct1(o.pct) + "%" : ""}</span>`;
      linha.innerHTML = `${rot}<small>${fmtPct(d.pst)}%<span class="nome-longo"> apurado</span></small></span>
        <div class="empilhada">${seg("s1", d.a)}${seg("s2", d.b)}<span class="so" style="flex:1 1 0"></span></div>`;
      linha.setAttribute("aria-label", `${d.nome}: ${nA} ${fmtPct(d.a.pct)}%, ${nB} ${fmtPct(d.b.pct)}%, outros ${fmtPct(d.outros.pct)}%. ${fmtPct(d.pst)}% das seções apuradas.`);
      const mostrar = ev => dica(ev, d, nA, nB, linha);
      linha.addEventListener("mousemove", mostrar);
      linha.addEventListener("focus", mostrar);
      linha.addEventListener("mouseleave", esconderDica);
      linha.addEventListener("blur", esconderDica);
    }
    box.appendChild(linha);
  });

  const t = $("gTabela");
  t.innerHTML = `<thead><tr><th>Estado</th><th>% apurado</th><th></th><th></th><th>Outros</th></tr></thead><tbody></tbody>`;
  t.rows[0].cells[2].textContent = nA;
  t.rows[0].cells[3].textContent = nB;
  [...gDados].sort((x, y) => x.nome.localeCompare(y.nome, "pt-BR")).forEach(d => {
    const tr = t.tBodies[0].insertRow();
    const cel = d.erro || !d.totalVal ? [d.nome, d.erro ? "—" : "0,00%", "—", "—", "—"]
      : [d.nome, fmtPct(d.pst) + "%", `${fmtPct(d.a.pct)}% (${fmtInt(d.a.votos)})`, `${fmtPct(d.b.pct)}% (${fmtInt(d.b.votos)})`, `${fmtPct(d.outros.pct)}%`];
    cel.forEach(v => { tr.insertCell().textContent = v; });
  });
}

function dica(ev, d, nA, nB, linha){
  const el = $("gDica"), sec = $("aba-grafico");
  el.innerHTML = `<b></b><br>${fmtPct(d.pst)}% das seções apuradas<br>
    <i style="background:var(--serie-1)"></i><span></span>: <b>${fmtPct(d.a.pct)}%</b> · ${fmtInt(d.a.votos)} votos<br>
    <i style="background:var(--serie-2)"></i><span></span>: <b>${fmtPct(d.b.pct)}%</b> · ${fmtInt(d.b.votos)} votos<br>
    <i style="background:var(--serie-outros)"></i>Outros: <b>${fmtPct(d.outros.pct)}%</b> · ${fmtInt(d.outros.votos)} votos`;
  el.querySelector("b").textContent = d.nome;
  const sp = el.querySelectorAll("span");
  sp[0].textContent = nA; sp[1].textContent = nB;
  el.hidden = false;
  const caixa = sec.getBoundingClientRect(), lr = linha.getBoundingClientRect();
  const x = ev.clientX != null ? ev.clientX : lr.left + lr.width / 2;
  const left = Math.min(Math.max(8, x - caixa.left + 14), caixa.width - el.offsetWidth - 8);
  el.style.left = left + "px";
  el.style.top = (lr.bottom - caixa.top + 6) + "px";
}
function esconderDica(){ $("gDica").hidden = true; }

/* ---------- Abas ---------- */
function abrirAba(qual){
  const grafico = qual === "grafico";
  [["tab-painel", "aba-painel", !grafico], ["tab-grafico", "aba-grafico", grafico]].forEach(([t, p, ativo]) => {
    $(t).setAttribute("aria-selected", ativo);
    $(t).tabIndex = ativo ? 0 : -1;
    $(p).hidden = !ativo;
  });
  if (grafico && !gTimer){
    carregarGrafico();
    gTimer = setInterval(carregarGrafico, G_INTERVALO_SEG * 1000);
  } else if (!grafico && gTimer){
    clearInterval(gTimer); gTimer = null;
  }
  if (history.replaceState) history.replaceState(null, "", grafico ? "#presidente-por-estado" : location.pathname);
}
$("tab-painel").addEventListener("click", () => abrirAba("painel"));
$("tab-grafico").addEventListener("click", () => abrirAba("grafico"));
document.querySelector(".abas").addEventListener("keydown", ev => {
  if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;
  const prox = $("tab-grafico").getAttribute("aria-selected") === "true" ? "painel" : "grafico";
  abrirAba(prox); $("tab-" + prox).focus();
});
$("gOrdem").addEventListener("change", desenhar);
if (location.hash === "#presidente-por-estado") abrirAba("grafico");
