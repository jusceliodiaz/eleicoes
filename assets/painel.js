/* Painel de apuração. Cada página define window.PAGINA = {cards:[...]} e já traz
   o HTML dos cards (data-card="id"); este script só busca os dados e preenche. */
const MOSTRAR = 2; // só 1º e 2º lugar em cada card
const INTERVALO_SEG = 30;
const $ = id => document.getElementById(id);

const fmtInt = n => Number(n || 0).toLocaleString("pt-BR");
const toNum = s => typeof s === "number" ? s : parseFloat(String(s || "0").replace(/\./g,"").replace(",", ".")) || 0;
const fmtPct = n => n.toLocaleString("pt-BR", {minimumFractionDigits:2, maximumFractionDigits:2});

const CARDS = window.PAGINA.cards.map(c => {
  const root = document.querySelector(`[data-card="${c.id}"]`);
  return {...c, el: k => root.querySelector(`[data-k="${k}"]`)};
});

/* O TSE não envia cabeçalho CORS: no ar (Vercel) e no servidor.py, /tse/ é um proxy. */
const BASE_TSE = location.protocol.startsWith("http") ? "/tse" : "https://resultados.tse.jus.br";
function buildUrl(c){
  return `${BASE_TSE}/oficial/ele2026/${c.eleicao}/dados/${c.uf}/${c.uf}${c.mun || ""}-c${c.cargo}-e${c.eleicao.padStart(6,"0")}-u.json`;
}

/* ---------- Normaliza o arquivo unificado do TSE (-u.json, formato de 2026) ---------- */
function normalize(d){
  const cands = [];
  (d.carg || []).forEach(cg => (cg.agr || []).forEach(ag => (ag.par || []).forEach(pa => (pa.cand || []).forEach(c => cands.push({
    nome: c.nmu || c.nm || "Sem nome",
    partido: pa.sg || "",
    votos: toNum(c.vap),
    pct: toNum(c.pvap),
    eleito: (c.e === "s" || /^eleit/i.test(c.st || "")),
    segundo: /2º turno/i.test(c.st || "")
  })))));
  const s = d.s || {}, v = d.v || {}, e = d.e || {};
  return {
    pst: toNum(s.pst),
    cands,
    brancos: {v: toNum(v.vb), p: toNum(v.pvb)},
    nulos: {v: toNum(v.tvn), p: toNum(v.ptvn)},
    abst: {v: toNum(e.a), p: toNum(e.pa)},
    hora: d.hg ? `${d.dg || ""} ${d.hg}`.trim() : null
  };
}

/* ---------- Render ---------- */
function render(c, r){
  c.el("pct").firstChild.nodeValue = fmtPct(r.pst);
  c.el("pctBar").style.width = r.pst + "%";
  c.el("atualizado").textContent = r.hora ? `Atualizado às ${r.hora}` : "Atualizado agora";
  const list = [...r.cands].sort((a,b)=>b.votos-a.votos).slice(0, MOSTRAR);
  const max = Math.max(...list.map(x=>x.pct), 1);
  const box = c.el("cands");
  box.innerHTML = "";
  list.forEach((x,i) => {
    const el = document.createElement("div");
    el.className = "cand" + (i===0 ? " lead" : "");
    const tag = x.eleito ? '<span class="tag">Eleito</span>' : x.segundo ? '<span class="tag">2º turno</span>' : "";
    el.innerHTML = `<span class="pos">${i+1}º</span>
      <span><span class="nome"></span><span class="partido"></span>${tag}</span>
      <span class="num">${fmtPct(x.pct)}%<span class="votos">${fmtInt(x.votos)} votos</span></span>
      <div class="bar"><div class="fill" style="width:${x.pct/max*100}%"></div></div>`;
    el.querySelector(".nome").textContent = x.nome;
    el.querySelector(".partido").textContent = x.partido;
    box.appendChild(el);
  });
  c.el("outros").innerHTML = [["Brancos",r.brancos],["Nulos",r.nulos],["Abstenções",r.abst]]
    .map(([n,o]) => `<div><b>${fmtPct(o.p)}%</b><span>${n}: ${fmtInt(Math.round(o.v))}</span></div>`).join("");
}
function showMsg(c, t){ const m = c.el("msg"); m.textContent = t || ""; m.style.display = t ? "block" : "none"; }
function setStatus(kind, txt){ $("dot").className = "dot " + kind; $("statusTxt").textContent = txt; }

/* ---------- Contador de atualizações ---------- */
let proximaEm = null, totalAtual = 0, historico = [], relogio = null, timer = null;
const CIRC = 94.25;
function registrarAtualizacao(){
  totalAtual++;
  const agora = Date.now();
  historico.push(agora);
  historico = historico.filter(t => agora - t <= 60000);
  $("total").textContent = fmtInt(totalAtual);
  $("ritmo").textContent = historico.length;
}
function atualizarRelogio(){
  if (!timer || !proximaEm){ $("proxima").textContent = "—"; $("ringFg").style.strokeDashoffset = CIRC; return; }
  const rest = Math.max(0, Math.ceil((proximaEm - Date.now())/1000));
  const m = Math.floor(rest/60), s = rest % 60;
  $("proxima").textContent = m ? `${m}min ${String(s).padStart(2,"0")}s` : `${s}s`;
  $("ringFg").style.strokeDashoffset = CIRC * (rest / INTERVALO_SEG);
  const agora = Date.now();
  historico = historico.filter(t => agora - t <= 60000);
  $("ritmo").textContent = historico.length;
}

/* ---------- Loop ---------- */
async function carregar(c){
  try{
    const res = await fetch(buildUrl(c) + "?t=" + Date.now(), {cache:"no-store"});
    if (!res.ok) throw new Error(res.status === 404 ? "O TSE ainda não publicou este arquivo (404)." : `O TSE respondeu com erro ${res.status}.`);
    render(c, normalize(await res.json()));
    showMsg(c, "");
    return true;
  }catch(e){
    showMsg(c, e.message.includes("Failed to fetch") || e.name === "TypeError"
      ? "O navegador não conseguiu ler o arquivo do TSE. Rode “python3 servidor.py” e abra http://localhost:8000."
      : e.message);
    return false;
  }
}
async function tick(){
  proximaEm = Date.now() + INTERVALO_SEG*1000;
  registrarAtualizacao();
  const oks = await Promise.all(CARDS.map(carregar));
  oks.every(Boolean) ? setStatus("live","Ao vivo")
    : oks.some(Boolean) ? setStatus("err","Falha em parte dos painéis")
    : setStatus("err","Falha na leitura");
}
function start(){
  stop(); totalAtual = 0; historico = [];
  timer = setInterval(tick, INTERVALO_SEG*1000);
  relogio = setInterval(atualizarRelogio, 250);
  $("toggle").textContent = "Pausar";
  tick();
}
function stop(txt, kind){
  if (timer){ clearInterval(timer); timer = null; }
  if (relogio){ clearInterval(relogio); relogio = null; }
  proximaEm = null; atualizarRelogio();
  $("toggle").textContent = "Retomar";
  if (txt) setStatus(kind || "", txt);
}
$("toggle").addEventListener("click", () => timer ? stop("Pausado") : start());
start();
