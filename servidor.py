"""Serve o painel e repassa /tse/... para resultados.tse.jus.br (o TSE não libera CORS).

Uso: python3 servidor.py  ->  abra http://localhost:8000
"""
import http.server, urllib.request, urllib.error, webbrowser, os

PORTA = 8000
TSE = "https://resultados.tse.jus.br"

class Handler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if not self.path.startswith("/tse/"):
            return super().do_GET()
        url = TSE + self.path[4:].split("?")[0]
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "painel-apuracao"}), timeout=20) as r:
                corpo, status = r.read(), r.status
        except urllib.error.HTTPError as e:
            corpo, status = b"", e.code
        except Exception:
            corpo, status = b"", 502
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(corpo)

    def log_message(self, *a):
        pass

os.chdir(os.path.dirname(os.path.abspath(__file__)))
print(f"Painel em http://localhost:{PORTA}  (Ctrl+C para parar)")
webbrowser.open(f"http://localhost:{PORTA}")
http.server.ThreadingHTTPServer(("", PORTA), Handler).serve_forever()
