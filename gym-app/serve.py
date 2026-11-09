"""Servidor local para probar GymLog: python serve.py  →  http://localhost:8000

Igual que `python -m http.server`, pero fuerza los tipos MIME correctos
(en Windows el registro a veces sirve .js como text/plain y los módulos fallan).
"""
import http.server
import os


PORT = 8000
os.chdir(os.path.dirname(os.path.abspath(__file__)))  # sirve esta carpeta aunque se lance desde otra


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        '.js': 'text/javascript',
        '.css': 'text/css',
        '.html': 'text/html',
        '.svg': 'image/svg+xml',
        '.webmanifest': 'application/manifest+json',
        '.json': 'application/json',
    }

    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()


with http.server.ThreadingHTTPServer(("", PORT), Handler) as httpd:
    print(f'GymLog en http://localhost:{PORT}  (Ctrl+C para parar)')
    httpd.serve_forever()
