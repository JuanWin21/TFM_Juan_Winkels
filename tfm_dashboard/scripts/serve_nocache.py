"""Servidor HTTP local con cabecera Cache-Control: no-store.
Util para evitar problemas de cache del navegador mientras iteramos el dashboard.

Uso: python scripts/serve_nocache.py [puerto]   (default 8765)
"""

import sys
from http.server import HTTPServer, SimpleHTTPRequestHandler


class NoCacheHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    addr = ("", port)
    print(f"Serving on http://localhost:{port}/ with no-cache headers")
    HTTPServer(addr, NoCacheHandler).serve_forever()


if __name__ == "__main__":
    main()
