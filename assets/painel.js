/* Apuração do 2º turno para Presidente: um card por candidato e, no canto, a previsão de vitória.
   O navegador busca direto no TSE (que libera CORS): cada visitante usa o próprio IP e o cache do TSE.
   Pelo proxy /tse/ (Vercel ou servidor.py) todos saem do mesmo IP e o TSE bloqueia com 429,
   então ele fica só como reserva. */
const ELEICAO = "6258", CARGO = "0001";
const INTERVALO_SEG = 30;
const PREVISAO_SEG = 90; // 28 arquivos por leitura: mais espaçado para não pesar no TSE
const $ = id => document.getElementById(id);

const fmtInt = n => Number(n || 0).toLocaleString("pt-BR");
const toNum = s => typeof s === "number" ? s : parseFloat(String(s || "0").replace(/\./g,"").replace(",", ".")) || 0;
const fmtPct = n => n.toLocaleString("pt-BR", {minimumFractionDigits:2, maximumFractionDigits:2});
const UFS = ["ac","al","am","ap","ba","ce","df","es","go","ma","mg","ms","mt","pa","pb","pe","pi","pr",
             "rj","rn","ro","rr","rs","sc","se","sp","to"];

const BASE_TSE = "https://resultados.tse.jus.br";
const PROXY_TSE = location.protocol.startsWith("http") ? "/tse" : null;
async function buscarTSE(url){
  try{
    const res = await fetch(url);
    if (res.ok || res.status === 404 || !PROXY_TSE) return res;
  }catch(e){
    if (!PROXY_TSE) throw e;
  }
  return fetch(url.replace(BASE_TSE, PROXY_TSE));
}
const urlDados = uf => `${BASE_TSE}/oficial/ele2026/${ELEICAO}/dados/${uf}/${uf}-c${CARGO}-e${ELEICAO.padStart(6,"0")}-u.json`;
const urlFoto = sq => `${BASE_TSE}/oficial/ele2026/${ELEICAO}/fotos/br/${sq}.jpeg`;
const SEM_FOTO = new Set(["13"]); // números dos candidatos que aparecem sem foto (Lula)

/* Arquivo unificado do TSE (-u.json) -> seções, eleitorado e candidatos. */
function ler(d){
  const cands = [];
  (d.carg || []).forEach(cg => (cg.agr || []).forEach(ag => (ag.par || []).forEach(pa => (pa.cand || []).forEach(c => cands.push({
    n: c.n, sq: c.sqcand, nome: c.nmu || c.nm || "Sem nome", partido: pa.sg || "",
    votos: toNum(c.vap), pct: toNum(c.pvap), eleito: c.e === "s" || /^eleit/i.test(c.st || "")
  })))));
  const s = d.s || {}, e = d.e || {};
  return {
    pst: toNum(s.pst), te: toNum(e.te), est: toNum(e.est),
    secoes: {total: toNum(s.ts), apuradas: toNum(s.st)},
    hora: d.hg || null, cands, validos: cands.reduce((t, c) => t + c.votos, 0)
  };
}
async function buscar(uf){
  const res = await buscarTSE(urlDados(uf));
  if (!res.ok) throw new Error(
    res.status === 404 ? "O TSE ainda não publicou os resultados (404)."
    : res.status === 429 ? "O TSE está limitando os acessos agora (429). Tentando de novo em instantes."
    : `O TSE respondeu com erro ${res.status}.`);
  return ler(await res.json());
}

/* ---------- Cards ----------
   Ordem fixa pelo número do candidato, para os cards não trocarem de lado quando a liderança virar. */
let ultimo = null;
function desenharCards(r){
  const cands = [...r.cands].sort((a, b) => a.n - b.n);
  const lider = Math.max(...cands.map(c => c.votos));
  $("pctApurado").textContent = fmtPct(r.pst) + "%";
  $("barraApurado").style.width = r.pst + "%";
  $("secoes").textContent = `${fmtInt(r.secoes.apuradas)} de ${fmtInt(r.secoes.total)} urnas`;
  $("hora").textContent = r.hora ? `Atualizado às ${r.hora}` : "";
  const box = $("cands");
  if (box.children.length !== cands.length) box.innerHTML = cands.map((_, i) => `
    <section class="cand s${i + 1}">
      <div class="quem"><img alt="" width="56" height="56"><span><b class="nome"></b><small class="partido"></small></span></div>
      <div class="pct"><span class="v">0,00</span><small>%</small></div>
      <div class="votos"><b>0</b> votos</div>
      <div class="trilho"><div class="fill"></div></div>
      <span class="tag" hidden>Eleito</span>
    </section>`).join("");
  cands.forEach((c, i) => {
    const el = box.children[i];
    el.classList.toggle("lead", c.votos === lider && c.votos > 0);
    el.setAttribute("aria-label", `${c.nome} (${c.partido}): ${fmtPct(c.pct)}%, ${fmtInt(c.votos)} votos`);
    const img = el.querySelector("img");
    if (SEM_FOTO.has(c.n)){ img.hidden = true; img.removeAttribute("src"); }
    else if (img.dataset.sq !== c.sq){
      img.dataset.sq = c.sq;
      img.hidden = false;
      img.onerror = () => { img.hidden = true; };
      img.src = urlFoto(c.sq);
    }
    el.querySelector(".nome").textContent = c.nome;
    el.querySelector(".partido").textContent = c.partido;
    el.querySelector(".pct .v").textContent = fmtPct(c.pct);
    el.querySelector(".votos b").textContent = fmtInt(c.votos);
    el.querySelector(".fill").style.width = c.pct + "%";
    el.querySelector(".tag").hidden = !c.eleito;
  });
}

/* ---------- Previsão de vitória ----------
   Em cada estado, os votos que faltam são distribuídos na proporção já apurada naquele estado
   (corrige estados que apuram mais rápido); soma-se o país, sem o exterior. */
const margemIncerta = pst => Math.max(0.3, 6 * (1 - pst / 100));
function projetar(br, estados){
  const partNac = {};
  br.cands.forEach(c => { partNac[c.n] = br.validos ? c.votos / br.validos : 0; });
  const validosPorEleitor = estados.reduce((t, r) => t + (r ? r.validos : 0), 0) /
                            Math.max(1, estados.reduce((t, r) => t + (r ? r.est : 0), 0));
  const proj = {};
  br.cands.forEach(c => { proj[c.n] = 0; });
  estados.forEach(r => {
    if (!r) return;
    const faltamValidos = Math.max(0, r.te - r.est) * (r.est ? r.validos / r.est : validosPorEleitor);
    r.cands.forEach(c => {
      const parte = r.validos ? c.votos / r.validos : (partNac[c.n] || 0);
      proj[c.n] = (proj[c.n] || 0) + c.votos + faltamValidos * parte;
    });
  });
  const total = Object.values(proj).reduce((t, v) => t + v, 0) || 1;
  return br.cands.map(c => ({...c, projPct: proj[c.n] / total * 100})).sort((a, b) => b.projPct - a.projPct);
}
function desenharPrevisao(br, estados){
  const box = $("previsao");
  const [a, b] = projetar(br, estados);
  if (!a || !b || !br.validos){ box.className = "previsao"; $("pvChip").textContent = "Previsão"; $("pvTxt").textContent = "Aguardando votos apurados."; return; }
  const oficial = br.cands.find(c => c.eleito);
  const [chip, tipo] = oficial ? ["Eleito", "ok"]
    : Math.abs(a.projPct - 50) < margemIncerta(br.pst) ? ["Indefinido", "indef"] : ["Tendência de vitória", "ok"];
  box.className = "previsao " + tipo;
  $("pvChip").textContent = chip;
  const quem = oficial || a;
  $("pvTxt").innerHTML = `<b></b><span class="pv-proj"></span>`;
  $("pvTxt").querySelector("b").textContent = `${quem.nome} (${quem.partido})`;
  $("pvTxt").querySelector(".pv-proj").textContent = oficial ? "Confirmado pelo TSE"
    : `Projeção final: ${a.nome} ${fmtPct(a.projPct)}% × ${b.nome} ${fmtPct(b.projPct)}%`;
}

/* ---------- Loop ---------- */
function setStatus(kind, txt){ $("dot").className = "dot " + kind; $("statusTxt").textContent = txt; }
function showMsg(t){ $("msg").textContent = t || ""; $("msg").hidden = !t; }
async function atualizar(){
  try{
    ultimo = await buscar("br");
    desenharCards(ultimo);
    showMsg("");
    setStatus("live", "Ao vivo");
  }catch(e){
    showMsg(e.name === "TypeError" ? "Não foi possível falar com o TSE agora. Tentando de novo em instantes." : e.message);
    setStatus("err", "Falha na leitura");
  }
}
async function atualizarPrevisao(){
  const estados = await Promise.all(UFS.map(uf => buscar(uf).catch(() => null)));
  if (ultimo) desenharPrevisao(ultimo, estados);
}
atualizar().then(atualizarPrevisao);
setInterval(atualizar, INTERVALO_SEG * 1000);
setInterval(atualizarPrevisao, PREVISAO_SEG * 1000);
