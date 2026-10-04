"""Gera a página do painel (index.html), o sitemap.xml e o robots.txt.

Uso: python3 gerar.py
Edite SITE, GA_ID ou ESTADOS e rode de novo.
"""
import json, os, html

SITE = "https://eleicoesbrasil.vercel.app"
GA_ID = "G-25D1149GZ8"            # Google Analytics 4, ex.: "G-ABC123XYZ". Vazio = sem Analytics.
HOJE = "2026-10-04"

AQUI = os.path.dirname(os.path.abspath(__file__))

# Códigos do TSE: eleição federal 6257 (Presidente) e estadual 6259 (Governador, Senador e Deputados).
# Uma página só: as tags trocam o estado no navegador (?uf=sp); a lista de cards e os códigos ficam em painel.js.
PAGINA = {"slug": "", "nome": "Brasil", "geo": (-15.7939, -47.8828),
          "titulo": "Apuração Eleições 2026 ao vivo: Presidente, Governador, Senador e Deputados por estado",
          "descricao": "Apuração ao vivo das Eleições 2026 com dados oficiais do TSE: Presidente, Governador, Senador, Deputado federal e estadual nos 27 estados, urnas apuradas e previsão de término.",
          "h1": "Apuração Eleições 2026", "sub": "Brasil, ao vivo"}
ESTADOS = {"ac": "Acre", "al": "Alagoas", "ap": "Amapá", "am": "Amazonas", "ba": "Bahia", "ce": "Ceará",
           "df": "Distrito Federal", "es": "Espírito Santo", "go": "Goiás", "ma": "Maranhão", "mt": "Mato Grosso",
           "ms": "Mato Grosso do Sul", "mg": "Minas Gerais", "pa": "Pará", "pb": "Paraíba", "pr": "Paraná",
           "pe": "Pernambuco", "pi": "Piauí", "rj": "Rio de Janeiro", "rn": "Rio Grande do Norte",
           "rs": "Rio Grande do Sul", "ro": "Rondônia", "rr": "Roraima", "sc": "Santa Catarina",
           "sp": "São Paulo", "se": "Sergipe", "to": "Tocantins"}
CARGOS = [("pres", "Presidente"), ("gov", "Governador"), ("sen", "Senador"),
          ("depf", "Deputado federal"), ("depe", "Deputado estadual")]


def url(l):
    return f"{SITE}/{l['slug']}/" if l["slug"] else f"{SITE}/"


def card_html(id, titulo):
    return f"""    <section class="painel" data-card="{id}"{"" if id == "pres" else " hidden"}>
      <div class="painel-head" aria-live="polite">
        <h2><span data-k="titulo">{titulo}</span><small data-k="escopo">Brasil</small></h2>
        <div class="pct" data-k="pct">0,00<small>% das seções apuradas</small></div>
        <div class="track"><div class="fill" data-k="pctBar" style="width:0%"></div></div>
        <div class="urnas" data-k="urnas"></div>
        <div class="meta" data-k="atualizado">Carregando resultados do TSE…</div>
      </div>
      <div class="msg" data-k="msg" role="alert"></div>
      <div class="cands" data-k="cands"><div class="vazio">Aguardando dados.</div></div>
      <div class="outros" data-k="outros"></div>
    </section>
"""


def json_ld(l):
    dados = {
        "@context": "https://schema.org",
        "@graph": [
            {"@type": "WebSite", "@id": f"{SITE}/#site", "url": f"{SITE}/", "name": "Apuração Eleições 2026", "inLanguage": "pt-BR"},
            {"@type": "WebPage", "@id": f"{url(l)}#pagina", "url": url(l), "name": l["titulo"], "description": l["descricao"],
             "inLanguage": "pt-BR", "isPartOf": {"@id": f"{SITE}/#site"}, "about": {"@id": f"{SITE}/#eleicao"},
             "primaryImageOfPage": f"{SITE}/og-image.png", "dateModified": HOJE,
             "spatialCoverage": {"@type": "Country", "name": "Brasil"}},
            {"@type": "Event", "@id": f"{SITE}/#eleicao", "name": "Eleições Gerais 2026 – 1º turno",
             "startDate": "2026-10-04T08:00:00-03:00", "endDate": "2026-10-04T17:00:00-03:00",
             "eventStatus": "https://schema.org/EventScheduled",
             "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
             "location": {"@type": "Place", "name": "Brasil", "address": {"@type": "PostalAddress", "addressCountry": "BR"}},
             "organizer": {"@type": "GovernmentOrganization", "name": "Tribunal Superior Eleitoral", "url": "https://www.tse.jus.br"}},
        ],
    }
    return json.dumps(dados, ensure_ascii=False, indent=1)


def analytics():
    if not GA_ID:
        return ""
    return f"""<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id={GA_ID}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){{dataLayer.push(arguments)}}gtag("js",new Date());gtag("config","{GA_ID}");</script>
"""


def pagina(l):
    e = html.escape
    lat, lon = l["geo"]
    nomes = list(ESTADOS.values())
    palavras = ("apuração 2026, eleições 2026, apuração ao vivo, resultado eleição 2026, apuração presidente 2026, "
                "governador 2026, senador 2026, deputado federal 2026, deputado estadual 2026, resultado por estado, "
                "TSE ao vivo, urnas apuradas, " + ", ".join(f"apuração {n}" for n in nomes))
    linhas_estados = "".join(f"<tr><td>{n}</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>" for n in sorted(nomes))
    nav = "\n".join(['      <li><a href="/" data-uf="br" aria-current="page">Brasil</a></li>'] + [
        f'      <li><a href="/?uf={uf}" data-uf="{uf}" title="{e(n)}" aria-label="{e(n)}">{uf.upper()}</a></li>'
        for uf, n in sorted(ESTADOS.items())])
    corpo = "".join(card_html(id, t) for id, t in CARGOS) + """    <p class="dica-estado" id="dicaEstado">Escolha um estado acima para ver Governador, Senador e Deputados.</p>
"""
    opcoes_cargo = "".join(f'<option value="{id}">{t}</option>' for id, t in CARGOS)
    lista_estados = ", ".join(nomes[:-1]) + " e " + nomes[-1]
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(l['titulo'])}</title>
<meta name="description" content="{e(l['descricao'])}">
<meta name="keywords" content="{e(palavras)}">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<meta name="author" content="Juscelio Diaz">
<meta name="theme-color" content="#E9EEF2" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0F1A28" media="(prefers-color-scheme: dark)">
<link rel="canonical" href="{url(l)}">
<link rel="alternate" hreflang="pt-BR" href="{url(l)}">
<link rel="alternate" hreflang="x-default" href="{url(l)}">

<meta name="geo.region" content="BR">
<meta name="geo.placename" content="Brasil">
<meta name="geo.position" content="{lat};{lon}">
<meta name="ICBM" content="{lat}, {lon}">
<meta name="language" content="pt-BR">

<meta property="og:type" content="website">
<meta property="og:locale" content="pt_BR">
<meta property="og:site_name" content="Apuração Eleições 2026">
<meta property="og:title" content="{e(l['titulo'])}">
<meta property="og:description" content="{e(l['descricao'])}">
<meta property="og:url" content="{url(l)}">
<meta property="og:image" content="{SITE}/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Painel de apuração das Eleições 2026">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="{e(l['titulo'])}">
<meta name="twitter:description" content="{e(l['descricao'])}">
<meta name="twitter:image" content="{SITE}/og-image.png">

<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<script type="application/ld+json">
{json_ld(l)}
</script>
{analytics()}<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/painel.css">
</head>
<body>
<div class="wrap">
  <header>
    <h1>{e(l['h1'])} <span class="h1-sub" id="sub">{e(l['sub'])}</span></h1>
    <div class="controls">
      <div class="status"><span class="dot" id="dot"></span><span id="statusTxt">Carregando</span></div>
      <button class="primary" id="toggle">Pausar</button>
    </div>
  </header>

  <nav aria-label="Apuração por estado">
    <ul class="locais estados">
{nav}
    </ul>
  </nav>

  <div class="contador" aria-live="off">
    <span class="ring" aria-hidden="true"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" class="ring-bg"/><circle cx="18" cy="18" r="15" class="ring-fg" id="ringFg"/></svg></span>
    <span><b id="proxima">—</b> para a próxima atualização</span>
    <span class="sep"></span>
    <span><b id="ritmo">0</b> atualizações por minuto</span>
    <span class="sep"></span>
    <span><b id="total">0</b> no total</span>
  </div>

  <div class="abas" role="tablist" aria-label="Visualização">
    <button role="tab" id="tab-painel" aria-controls="aba-painel" aria-selected="true">Painel</button>
    <button role="tab" id="tab-grafico" aria-controls="aba-grafico" aria-selected="false" tabindex="-1">Por estado</button>
    <button role="tab" id="tab-previsao" aria-controls="aba-previsao" aria-selected="false" tabindex="-1">Previsão 1º e 2º turno</button>
  </div>

  <main class="grid" id="aba-painel" role="tabpanel" aria-labelledby="tab-painel">
{corpo}  </main>

  <section class="grafico" id="aba-grafico" role="tabpanel" aria-labelledby="tab-grafico" hidden>
    <div class="grafico-topo">
      <div>
        <h2 id="gTitulo">Presidente por estado</h2>
        <p class="grafico-sub" id="gResumo">Carregando resultados dos 27 estados…</p>
      </div>
      <label class="ordem">Cargo
        <select id="gCargo">{opcoes_cargo}</select>
      </label>
      <label class="ordem">Ordenar por
        <select id="gOrdem">
          <option value="vantagem">Vantagem do 1º colocado</option>
          <option value="nome">Estado (A–Z)</option>
          <option value="apurado">Mais apurado</option>
        </select>
      </label>
    </div>
    <ul class="legenda" id="gLegenda"></ul>
    <div class="barras" id="gBarras" role="list"></div>
    <div class="g-dica" id="gDica" role="tooltip" hidden></div>
    <details class="g-tabela">
      <summary>Ver como tabela</summary>
      <div class="g-tabela-rolagem"><table id="gTabela"><thead><tr><th>Estado</th><th>% apurado</th><th>1º</th><th>2º</th><th>Outros</th></tr></thead><tbody>{linhas_estados}</tbody></table></div>
    </details>
    <p class="grafico-nota">Resultado da eleição para Presidente, Governador, Senador e Deputados em todos os estados do Brasil: {lista_estados}. Percentuais sobre os votos válidos em cada estado. Clique num estado para abrir o painel dele. Dados oficiais do TSE, atualizados a cada minuto enquanto esta aba está aberta.</p>
  </section>

  <section class="grafico previsao" id="aba-previsao" role="tabpanel" aria-labelledby="tab-previsao" hidden>
    <h2>Presidente: projeção do resultado final</h2>
    <p class="grafico-sub" id="pvPresResumo">Carregando resultados dos 27 estados…</p>
    <div class="pv-veredito" id="pvPresVeredito" aria-live="polite"></div>
    <div class="pv-barras" id="pvPresBarras"></div>
    <p class="grafico-nota">Como calculamos: em cada estado, os votos que faltam apurar são distribuídos na mesma proporção dos votos já apurados naquele estado, e somamos o resultado do país (sem o exterior). Isso corrige o fato de alguns estados apurarem mais rápido que outros. É uma tendência, não um resultado oficial.</p>

    <h2 class="pv-sec">Governador: 1º ou 2º turno?</h2>
    <p class="grafico-sub" id="pvGovResumo">Carregando…</p>
    <div class="pv-gov" id="pvGovLista"></div>
    <p class="grafico-nota">Vence no 1º turno quem tiver mais de 50% dos votos válidos. Com pouca apuração, uma margem pequena sobre 50% ainda pode virar, por isso marcamos como “indefinido”. O 2º turno será em 25 de outubro de 2026. Senado e deputados não têm 2º turno.</p>
  </section>

  <noscript><p class="rodape">Ative o JavaScript para ver a apuração ao vivo.</p></noscript>
</div>

<script src="/assets/painel.js"></script>
<script src="/assets/grafico.js"></script>
<script src="/assets/previsao.js"></script>
</body>
</html>
"""


with open(os.path.join(AQUI, "index.html"), "w", encoding="utf-8") as f:
    f.write(pagina(PAGINA))

with open(os.path.join(AQUI, "sitemap.xml"), "w", encoding="utf-8") as f:
    f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            f"  <url>\n    <loc>{url(PAGINA)}</loc>\n    <lastmod>{HOJE}</lastmod>\n    <changefreq>always</changefreq>\n"
            "    <priority>1.0</priority>\n  </url>\n</urlset>\n")

with open(os.path.join(AQUI, "robots.txt"), "w", encoding="utf-8") as f:
    f.write(f"User-agent: *\nAllow: /\nDisallow: /tse/\n\nSitemap: {SITE}/sitemap.xml\n")

print("index.html gerado" + ("" if GA_ID else " (sem Google Analytics: preencha GA_ID)"))
