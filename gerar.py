"""Gera a página do painel (index.html), o sitemap.xml e o robots.txt.

Uso: python3 gerar.py
Edite SITE ou GA_ID e rode de novo.
"""
import json, os, html, hashlib

SITE = "https://eleicoesbrasil.vercel.app"
GA_ID = "G-25D1149GZ8"            # Google Analytics 4, ex.: "G-ABC123XYZ". Vazio = sem Analytics.
HOJE = "2026-10-25"

AQUI = os.path.dirname(os.path.abspath(__file__))

# Só Presidente, 2º turno (eleição federal 6258 do TSE); o código fica em painel.js.
PAGINA = {"slug": "", "nome": "Brasil", "geo": (-15.7939, -47.8828),
          "titulo": "Apuração Presidente 2026 ao vivo: 2º turno",
          "descricao": "Apuração ao vivo do 2º turno da eleição para Presidente 2026 com dados oficiais do TSE: votos de cada candidato, urnas apuradas e previsão de vitória.",
          "h1": "Presidente 2026", "sub": "2º turno, ao vivo"}


def url(l):
    return f"{SITE}/{l['slug']}/" if l["slug"] else f"{SITE}/"


def json_ld(l):
    dados = {
        "@context": "https://schema.org",
        "@graph": [
            {"@type": "WebSite", "@id": f"{SITE}/#site", "url": f"{SITE}/", "name": "Apuração Eleições 2026", "inLanguage": "pt-BR"},
            {"@type": "WebPage", "@id": f"{url(l)}#pagina", "url": url(l), "name": l["titulo"], "description": l["descricao"],
             "inLanguage": "pt-BR", "isPartOf": {"@id": f"{SITE}/#site"}, "about": {"@id": f"{SITE}/#eleicao"},
             "primaryImageOfPage": f"{SITE}/og-image.png", "dateModified": HOJE,
             "spatialCoverage": {"@type": "Country", "name": "Brasil"}},
            {"@type": "Event", "@id": f"{SITE}/#eleicao", "name": "Eleições Gerais 2026 – 2º turno",
             "startDate": "2026-10-25T08:00:00-03:00", "endDate": "2026-10-25T17:00:00-03:00",
             "eventStatus": "https://schema.org/EventScheduled",
             "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
             "location": {"@type": "Place", "name": "Brasil", "address": {"@type": "PostalAddress", "addressCountry": "BR"}},
             "organizer": {"@type": "GovernmentOrganization", "name": "Tribunal Superior Eleitoral", "url": "https://www.tse.jus.br"}},
        ],
    }
    return json.dumps(dados, ensure_ascii=False, indent=1)


def v(arquivo):
    """Versão do arquivo (hash do conteúdo) para o navegador não usar cópia antiga do cache."""
    with open(os.path.join(AQUI, arquivo), "rb") as f:
        return f"/{arquivo}?v={hashlib.md5(f.read()).hexdigest()[:8]}"


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
    palavras = ("apuração presidente 2026, 2º turno 2026, segundo turno presidente, eleições 2026, apuração ao vivo, "
                "resultado eleição 2026, TSE ao vivo, urnas apuradas, previsão de vitória")
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
<link rel="stylesheet" href="{v('assets/painel.css')}">
</head>
<body>
<div class="wrap">
  <header>
    <h1>{e(l['h1'])} <small>{e(l['sub'])}</small></h1>
    <div class="apurado">
      <span><b id="pctApurado">0,00%</b> apurado</span>
      <span id="secoes"></span>
      <span id="hora"></span>
      <span class="status"><span class="dot" id="dot"></span><span id="statusTxt">Carregando</span></span>
    </div>
  </header>
  <div class="track"><div class="fill" id="barraApurado" style="width:0%"></div></div>
  <p class="msg" id="msg" role="alert" hidden></p>

  <main class="cands" id="cands" aria-live="polite"></main>

  <aside class="previsao" id="previsao" aria-live="polite" aria-label="Previsão de vitória">
    <span class="pv-chip" id="pvChip">Previsão</span>
    <span id="pvTxt">Calculando…</span>
  </aside>

  <noscript><p class="msg">Ative o JavaScript para ver a apuração ao vivo.</p></noscript>
</div>

<script src="{v('assets/painel.js')}"></script>
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
