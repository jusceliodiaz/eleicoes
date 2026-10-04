"""Gera as páginas do painel (index.html e uma pasta por local), o sitemap.xml e o robots.txt.

Uso: python3 gerar.py
Edite SITE, GA_ID ou a lista LOCAIS e rode de novo.
"""
import json, os, html

SITE = "https://eleicoesbrasil.vercel.app"
GA_ID = "G-25D1149GZ8"            # Google Analytics 4, ex.: "G-ABC123XYZ". Vazio = sem Analytics.
HOJE = "2026-10-04"

AQUI = os.path.dirname(os.path.abspath(__file__))

# Códigos do TSE: eleição federal 6257 (Presidente) e estadual 6259 (Senador e Deputados).
# "mun" é o código TSE do município (config/mun-e006259-cm.json).
LOCAIS = [
    {"slug": "", "nome": "Brasil", "tipo": "pais", "geo": (-25.4284, -49.2733),
     "titulo": "Apuração Eleições 2026 ao vivo: Presidente, Senado e Deputados PR",
     "descricao": "Apuração ao vivo das Eleições 2026 com dados do TSE: Presidente, Senador do Paraná e deputados mais votados no PR. Atualiza a cada 30 segundos.",
     "h1": "Apuração Eleições 2026", "sub": "Brasil · Paraná · Curitiba, ao vivo"},
    {"slug": "parana", "nome": "Paraná", "tipo": "estado", "geo": (-25.4284, -49.2733),
     "titulo": "Apuração Paraná 2026 ao vivo: Senador, Deputados e Presidente no PR",
     "descricao": "Resultado da eleição 2026 no Paraná ao vivo: quem lidera para Senador, Deputado federal, Deputado estadual e Presidente no PR. Dados do TSE.",
     "h1": "Apuração no Paraná 2026", "sub": "Votos no estado do Paraná, ao vivo"},
    {"slug": "curitiba", "nome": "Curitiba", "mun": "75353", "geo": (-25.4284, -49.2733)},
    {"slug": "londrina", "nome": "Londrina", "mun": "76678", "geo": (-23.3045, -51.1696)},
    {"slug": "maringa", "nome": "Maringá", "mun": "76910", "geo": (-23.4205, -51.9333)},
    {"slug": "ponta-grossa", "nome": "Ponta Grossa", "mun": "77771", "geo": (-25.0916, -50.1668)},
    {"slug": "cascavel", "nome": "Cascavel", "mun": "74934", "geo": (-24.9578, -53.4595)},
    {"slug": "sao-jose-dos-pinhais", "nome": "São José dos Pinhais", "mun": "78859", "geo": (-25.5307, -49.2063)},
    {"slug": "foz-do-iguacu", "nome": "Foz do Iguaçu", "mun": "75639", "geo": (-25.5163, -54.5854)},
]
for l in LOCAIS:
    if "mun" in l:
        n = l["nome"]
        l.update(tipo="cidade",
                 titulo=f"Apuração em {n} 2026 ao vivo: resultado da eleição",
                 descricao=f"Resultado da eleição 2026 em {n} (PR) ao vivo: quem lidera para Presidente, Senador e Deputados em {n}. Dados oficiais do TSE.",
                 h1=f"Apuração em {n} 2026", sub=f"Votos em {n}, Paraná, ao vivo")


def cards(l):
    mun = l.get("mun", "")
    if l["tipo"] == "pais":
        esc = {"pres": "Brasil", "sen": "Paraná · 2 vagas", "depf": "Paraná · 30 vagas", "depe": "Paraná · 54 vagas"}
        pres_uf = "br"
    else:
        alvo = "Paraná" if l["tipo"] == "estado" else l["nome"]
        esc = dict.fromkeys(["pres", "sen", "depf", "depe"], f"Votos em {alvo}")
        pres_uf = "pr"
    return [
        {"id": "pres", "titulo": "Presidente", "escopo": esc["pres"], "eleicao": "6257", "uf": pres_uf, "mun": mun, "cargo": "0001"},
        {"id": "sen", "titulo": "Senador", "escopo": esc["sen"], "eleicao": "6259", "uf": "pr", "mun": mun, "cargo": "0005"},
        {"id": "depf", "titulo": "Deputado federal", "escopo": esc["depf"], "eleicao": "6259", "uf": "pr", "mun": mun, "cargo": "0006"},
        {"id": "depe", "titulo": "Deputado estadual", "escopo": esc["depe"], "eleicao": "6259", "uf": "pr", "mun": mun, "cargo": "0007"},
    ]


def url(l):
    return f"{SITE}/{l['slug']}/" if l["slug"] else f"{SITE}/"


def card_html(c):
    return f"""    <section class="painel" data-card="{c['id']}" aria-label="{html.escape(c['titulo'])}, {html.escape(c['escopo'])}">
      <div class="painel-head" aria-live="polite">
        <h2>{html.escape(c['titulo'])}<small>{html.escape(c['escopo'])}</small></h2>
        <div class="pct" data-k="pct">0,00<small>% das seções apuradas</small></div>
        <div class="track"><div class="fill" data-k="pctBar" style="width:0%"></div></div>
        <div class="meta" data-k="atualizado">Carregando resultados do TSE…</div>
      </div>
      <div class="msg" data-k="msg" role="alert"></div>
      <div class="cands" data-k="cands"><div class="vazio">Aguardando dados.</div></div>
      <div class="outros" data-k="outros"></div>
    </section>
"""


# Anúncios Adsterra (banners iframe). Cada célula entra no grid entre os cards.
AD_TOPO = """    <div class="ad ad-largo">
      <script>
        if (innerWidth >= 760) anuncioAdsterra("91e78889b4d1a1abb8bf514774f1d2f7", 728, 90);
        else if (innerWidth >= 500) anuncioAdsterra("8c108bb08b83f87383dddcffb69a1658", 468, 60);
        else anuncioAdsterra("3fed9f6a3aab2213b0c29a5ce6998f19", 320, 50);
      </script>
    </div>
"""
AD_RETANGULO = """    <div class="ad ad-retangulo">
      <script>anuncioAdsterra("b0edda91e7818c8857b4e08bf59b45be", 300, 250);</script>
    </div>
"""
# Em telas largas, os dois arranha-céus lado a lado (ocupa duas linhas do grid); no resto, um 300x250.
AD_ALTO = """    <div class="ad ad-retangulo">
      <script>
        if (innerWidth >= 1100){
          document.currentScript.parentElement.classList.add("ad-alto");
          document.write('<div class="ad-par"><div>');
          anuncioAdsterra("2e475f82fe9a3fe70c927b401e1b6dad", 160, 600);
          document.write('</div><div>');
          anuncioAdsterra("76885d096ff2769e62141c29986a9c51", 160, 300);
          document.write('</div></div>');
        } else anuncioAdsterra("b0edda91e7818c8857b4e08bf59b45be", 300, 250);
      </script>
    </div>
"""
AD_NATIVO = """    <div class="ad ad-largo">
      <script async="async" data-cfasync="false" src="https://bicea.org/21/813f7a11f64eeb9cae8767af1a4a75e0"></script>
      <div id="container-813f7a11f64eeb9cae8767af1a4a75e0"></div>
    </div>
    <p class="patrocinado"><a href="https://arwf.org/4/5a1e35ec282ca23bba451c632d59aa7d" target="_blank" rel="sponsored noopener">Patrocinado</a></p>
"""


def json_ld(l):
    lugar = ({"@type": "Country", "name": "Brasil"} if l["tipo"] == "pais"
             else {"@type": "State", "name": "Paraná", "containedInPlace": {"@type": "Country", "name": "Brasil"}} if l["tipo"] == "estado"
             else {"@type": "City", "name": l["nome"], "containedInPlace": {"@type": "State", "name": "Paraná"}})
    migalhas = [{"@type": "ListItem", "position": 1, "name": "Eleições 2026", "item": f"{SITE}/"}]
    if l["tipo"] != "pais":
        migalhas.append({"@type": "ListItem", "position": 2, "name": "Paraná", "item": f"{SITE}/parana/"})
    if l["tipo"] == "cidade":
        migalhas.append({"@type": "ListItem", "position": 3, "name": l["nome"], "item": url(l)})
    dados = {
        "@context": "https://schema.org",
        "@graph": [
            {"@type": "WebSite", "@id": f"{SITE}/#site", "url": f"{SITE}/", "name": "Apuração Eleições 2026", "inLanguage": "pt-BR"},
            {"@type": "WebPage", "@id": f"{url(l)}#pagina", "url": url(l), "name": l["titulo"], "description": l["descricao"],
             "inLanguage": "pt-BR", "isPartOf": {"@id": f"{SITE}/#site"}, "about": {"@id": f"{SITE}/#eleicao"},
             "primaryImageOfPage": f"{SITE}/og-image.png", "dateModified": HOJE, "spatialCoverage": lugar},
            {"@type": "BreadcrumbList", "itemListElement": migalhas},
            {"@type": "Event", "@id": f"{SITE}/#eleicao", "name": "Eleições Gerais 2026 – 1º turno",
             "startDate": "2026-10-04T08:00:00-03:00", "endDate": "2026-10-04T17:00:00-03:00",
             "eventStatus": "https://schema.org/EventScheduled",
             "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
             "location": {"@type": "Place", "name": "Brasil", "address": {"@type": "PostalAddress", "addressLocality": "Curitiba", "addressRegion": "PR", "addressCountry": "BR"}},
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
    regiao = "BR" if l["tipo"] == "pais" else "BR-PR"
    lugar_geo = "Curitiba" if l["tipo"] != "cidade" else l["nome"]
    cs = cards(l)
    atual = ' aria-current="page"'
    nav = "\n".join(
        f'      <li><a href="/{o["slug"] + "/" if o["slug"] else ""}"{atual if o is l else ""}>{e(o["nome"])}</a></li>'
        for o in LOCAIS)
    corpo = (AD_TOPO + card_html(cs[0]) + card_html(cs[1]) + AD_RETANGULO
             + card_html(cs[2]) + card_html(cs[3]) + AD_ALTO + AD_NATIVO)
    config = json.dumps({"cards": [{k: c[k] for k in ("id", "eleicao", "uf", "mun", "cargo")} for c in cs]})
    return f"""<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{e(l['titulo'])}</title>
<meta name="description" content="{e(l['descricao'])}">
<meta name="keywords" content="apuração 2026, eleições 2026, resultado eleição {e(l['nome'])}, apuração {e(l['nome'])}, apuração Paraná, apuração Curitiba, senador Paraná 2026, deputado federal Paraná, deputado estadual Paraná, presidente 2026, TSE ao vivo">
<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
<meta name="author" content="Juscelio Diaz">
<meta name="theme-color" content="#E9EEF2" media="(prefers-color-scheme: light)">
<meta name="theme-color" content="#0F1A28" media="(prefers-color-scheme: dark)">
<link rel="canonical" href="{url(l)}">
<link rel="alternate" hreflang="pt-BR" href="{url(l)}">
<link rel="alternate" hreflang="x-default" href="{url(l)}">

<meta name="geo.region" content="{regiao}">
<meta name="geo.placename" content="{e(lugar_geo)}">
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
{analytics()}<script>
/* Banners iframe da Adsterra: cada um precisa do seu atOptions logo antes do script. */
function anuncioAdsterra(key, width, height){{
  document.write(`<script>atOptions={{key:"${{key}}",format:"iframe",height:${{height}},width:${{width}},params:{{}}}};<\\/script><script src="https://bicea.org/22/${{key}}"><\\/script>`);
}}
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/painel.css">
</head>
<body>
<div class="wrap">
  <header>
    <h1>{e(l['h1'])} <span class="h1-sub">{e(l['sub'])}</span></h1>
    <div class="controls">
      <div class="status"><span class="dot" id="dot"></span><span id="statusTxt">Carregando</span></div>
      <button class="primary" id="toggle">Pausar</button>
    </div>
  </header>

  <nav aria-label="Apuração por local">
    <ul class="locais">
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

  <main class="grid">
{corpo}  </main>

  <noscript><p class="rodape">Ative o JavaScript para ver a apuração ao vivo.</p></noscript>
</div>

<script>window.PAGINA = {config};</script>
<script src="/assets/painel.js"></script>
<!-- Adsterra -->
<script data-cfasync="false" src="https://afders.org/1/1509e2503a8d75d315fd21393ebc4c13"></script>
<script data-cfasync="false" src="https://bicea.org/14/e1dd02e019e5cd1f0d1ac25f7d4fbcfc"></script>
</body>
</html>
"""


for l in LOCAIS:
    pasta = os.path.join(AQUI, l["slug"])
    os.makedirs(pasta, exist_ok=True)
    with open(os.path.join(pasta, "index.html"), "w", encoding="utf-8") as f:
        f.write(pagina(l))

with open(os.path.join(AQUI, "sitemap.xml"), "w", encoding="utf-8") as f:
    f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
    for l in LOCAIS:
        f.write(f"  <url>\n    <loc>{url(l)}</loc>\n    <lastmod>{HOJE}</lastmod>\n    <changefreq>always</changefreq>\n"
                f"    <priority>{'1.0' if not l['slug'] else '0.9' if l['tipo'] == 'estado' else '0.8'}</priority>\n  </url>\n")
    f.write("</urlset>\n")

with open(os.path.join(AQUI, "robots.txt"), "w", encoding="utf-8") as f:
    f.write(f"User-agent: *\nAllow: /\nDisallow: /tse/\n\nSitemap: {SITE}/sitemap.xml\n")

print(f"{len(LOCAIS)} páginas geradas" + ("" if GA_ID else " (sem Google Analytics: preencha GA_ID)"))
