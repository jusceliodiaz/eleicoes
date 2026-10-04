/* Painel de apuração. A página já traz o HTML dos cards (data-card="id"); este script escolhe
   o estado (tags ?uf=sp), busca os dados no TSE e preenche. */
const MIN_MOSTRAR = 2; // cargos de 1 vaga mostram 1º e 2º (2º turno); os demais, uma linha por vaga
const INTERVALO_SEG = 30;
const $ = id => document.getElementById(id);

const fmtInt = n => Number(n || 0).toLocaleString("pt-BR");
const toNum = s => typeof s === "number" ? s : parseFloat(String(s || "0").replace(/\./g,"").replace(",", ".")) || 0;
const fmtPct = n => n.toLocaleString("pt-BR", {minimumFractionDigits:2, maximumFractionDigits:2});

const NOMES_UF = {
  ac:"Acre", al:"Alagoas", am:"Amazonas", ap:"Amapá", ba:"Bahia", ce:"Ceará", df:"Distrito Federal",
  es:"Espírito Santo", go:"Goiás", ma:"Maranhão", mg:"Minas Gerais", ms:"Mato Grosso do Sul",
  mt:"Mato Grosso", pa:"Pará", pb:"Paraíba", pe:"Pernambuco", pi:"Piauí", pr:"Paraná",
  rj:"Rio de Janeiro", rn:"Rio Grande do Norte", ro:"Rondônia", rr:"Roraima", rs:"Rio Grande do Sul",
  sc:"Santa Catarina", se:"Sergipe", sp:"São Paulo", to:"Tocantins"
};
/* Cargo de cada card por UF. No DF a Câmara Legislativa é distrital (cargo 0008). */
function cargoDe(id, uf){
  return {pres: {eleicao:"6257", cargo:"0001", titulo:"Presidente"},
          gov:  {eleicao:"6259", cargo:"0003", titulo:"Governador"},
          sen:  {eleicao:"6259", cargo:"0005", titulo:"Senador"},
          depf: {eleicao:"6259", cargo:"0006", titulo:"Deputado federal"},
          depe: uf === "df" ? {eleicao:"6259", cargo:"0008", titulo:"Deputado distrital"}
                            : {eleicao:"6259", cargo:"0007", titulo:"Deputado estadual"}}[id];
}

let UF = "br", CARDS = [], geracao = 0;
function montarCards(){
  const nomeLocal = UF === "br" ? "Brasil" : NOMES_UF[UF];
  CARDS = [];
  document.querySelectorAll("[data-card]").forEach(root => {
    const id = root.dataset.card, ativo = UF !== "br" || id === "pres";
    root.hidden = !ativo;
    if (!ativo) return;
    const c = {id, uf: UF, ...cargoDe(id, UF), el: k => root.querySelector(`[data-k="${k}"]`)};
    c.el("titulo").textContent = c.titulo;
    c.el("escopo").textContent = nomeLocal;
    c.el("pct").firstChild.nodeValue = "0,00";
    c.el("pctBar").style.width = "0%";
    c.el("urnas").innerHTML = "";
    c.el("atualizado").textContent = "Carregando resultados do TSE…";
    c.el("cands").innerHTML = '<div class="vazio">Aguardando dados.</div>';
    c.el("outros").innerHTML = "";
    root.setAttribute("aria-label", `${c.titulo}, ${nomeLocal}`);
    CARDS.push(c);
  });
  $("dicaEstado").hidden = UF !== "br";
  $("sub").textContent = `${nomeLocal}, ao vivo`;
  document.title = UF === "br" ? TITULO_BASE : `Apuração ${nomeLocal} 2026 ao vivo: Governador, Senador e Deputados`;
  document.querySelectorAll("[data-uf]").forEach(a => a.dataset.uf === UF ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
}
const TITULO_BASE = document.title;

/* O TSE não envia cabeçalho CORS: no ar (Vercel) e no servidor.py, /tse/ é um proxy. */
const BASE_TSE = location.protocol.startsWith("http") ? "/tse" : "https://resultados.tse.jus.br";
function buildUrl(c){
  return `${BASE_TSE}/oficial/ele2026/${c.eleicao}/dados/${c.uf}/${c.uf}-c${c.cargo}-e${c.eleicao.padStart(6,"0")}-u.json`;
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
    vagas: toNum(((d.carg || [])[0] || {}).nv) || 1,
    pst: toNum(s.pst),
    secoes: {total: toNum(s.ts), apuradas: toNum(s.st), faltam: toNum(s.snt)},
    quando: dataTSE(d.dg, d.hg),
    cands,
    brancos: {v: toNum(v.vb), p: toNum(v.pvb)},
    nulos: {v: toNum(v.tvn), p: toNum(v.ptvn)},
    abst: {v: toNum(e.a), p: toNum(e.pa)},
    hora: d.hg ? `${d.dg || ""} ${d.hg}`.trim() : null
  };
}

/* Data e hora do TSE vêm no horário de Brasília ("04/10/2026", "18:12:13"). */
function dataTSE(dg, hg){
  const m = /^(\d\d)\/(\d\d)\/(\d{4})$/.exec(dg || "");
  if (!m || !hg) return null;
  const t = Date.parse(`${m[3]}-${m[2]}-${m[1]}T${hg}-03:00`);
  return isNaN(t) ? null : t;
}

/* ---------- Previsão de término ----------
   Ritmo = seções apuradas por minuto entre leituras do TSE (janela de até 10 min).
   Sem histórico ainda, usa a média desde o fechamento das urnas (17h de Brasília). */
const FECHAMENTO = Date.parse("2026-10-04T17:00:00-03:00");
const JANELA_MS = 10 * 60000;
function ritmoPorMin(c, r){
  if (!r.quando) return null;
  c.amostras = (c.amostras || []).filter(a => a.t < r.quando && r.quando - a.t <= JANELA_MS);
  const ant = c.amostras[0];
  c.amostras.push({t: r.quando, st: r.secoes.apuradas});
  if (ant && r.quando - ant.t >= 60000 && r.secoes.apuradas > ant.st)
    return (r.secoes.apuradas - ant.st) / ((r.quando - ant.t) / 60000);
  const desde = (r.quando - FECHAMENTO) / 60000;
  return desde > 5 && r.secoes.apuradas > 0 ? r.secoes.apuradas / desde : null;
}
function fmtDuracao(min){
  if (min < 1) return "menos de 1 min";
  const h = Math.floor(min / 60), m = Math.round(min % 60);
  return h ? `${h}h${String(m).padStart(2,"0")}` : `${m} min`;
}
const fmtHora = t => new Date(t).toLocaleTimeString("pt-BR", {hour:"2-digit", minute:"2-digit", timeZone:"America/Sao_Paulo"});
function textoPrevisao(c, r){
  const {total, faltam} = r.secoes;
  if (!total) return "";
  if (!faltam) return "Apuração concluída";
  const ritmo = ritmoPorMin(c, r);
  if (!ritmo) return "Previsão de término: calculando…";
  const min = faltam / ritmo;
  return `Previsão de término: <b>~${fmtDuracao(min)}</b> (por volta das ${fmtHora(r.quando + min*60000)}) · ${fmtInt(Math.round(ritmo))} urnas/min`;
}

/* ---------- Render ---------- */
function render(c, r){
  c.el("pct").firstChild.nodeValue = fmtPct(r.pst);
  c.el("pctBar").style.width = r.pst + "%";
  const u = r.secoes;
  c.el("urnas").innerHTML = u.total ? `<div><b>${fmtInt(u.apuradas)}</b>urnas apuradas</div>
    <div><b>${fmtInt(u.total)}</b>total de urnas</div>
    <div><b>${fmtInt(u.faltam)}</b>faltam</div>
    <div class="eta">${textoPrevisao(c, r)}</div>` : "";
  c.el("atualizado").textContent = r.hora ? `Atualizado às ${r.hora}` : "Atualizado agora";
  c.el("escopo").textContent = (UF === "br" ? "Brasil" : NOMES_UF[UF]) + (r.vagas > 1 ? ` · ${r.vagas} vagas` : "");
  const list = [...r.cands].sort((a,b)=>b.votos-a.votos).slice(0, Math.max(r.vagas, MIN_MOSTRAR));
  const max = Math.max(...list.map(x=>x.pct), 1);
  const box = c.el("cands");
  const topo = box.scrollTop;
  box.innerHTML = "";
  box.classList.toggle("rolagem", list.length > MIN_MOSTRAR);
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
  if (list.length > MIN_MOSTRAR){
    const dica = document.createElement("div");
    dica.className = "lista-dica";
    dica.textContent = `Os ${list.length} mais votados (nº de vagas) · role para ver`;
    box.prepend(dica);
  }
  box.scrollTop = topo;
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
  const g = geracao;
  try{
    const res = await fetch(buildUrl(c) + "?t=" + Date.now(), {cache:"no-store"});
    if (!res.ok) throw new Error(res.status === 404 ? "O TSE ainda não publicou este arquivo (404)." : `O TSE respondeu com erro ${res.status}.`);
    const dados = await res.json();
    if (g !== geracao) return true; // o estado mudou enquanto esperava
    render(c, normalize(dados));
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

/* ---------- Tags de estado ---------- */
function selecionarUF(uf, empilhar){
  UF = NOMES_UF[uf] ? uf : "br";
  geracao++;
  montarCards();
  if (empilhar) history.pushState(null, "", (UF === "br" ? "/" : `/?uf=${UF}`) + location.hash);
  if (typeof gtag === "function") gtag("event", "escolher_estado", {uf: UF});
  start();
}
document.querySelector(".estados").addEventListener("click", ev => {
  const a = ev.target.closest("[data-uf]");
  if (!a || ev.metaKey || ev.ctrlKey || ev.shiftKey) return;
  ev.preventDefault();
  selecionarUF(a.dataset.uf, true);
});
addEventListener("popstate", () => selecionarUF(new URLSearchParams(location.search).get("uf") || "br"));
selecionarUF(new URLSearchParams(location.search).get("uf") || "br");
