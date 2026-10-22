"""Preview GitHub Pages' extensionless HTML routes locally."""
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse


class PagesHandler(SimpleHTTPRequestHandler):
    def translate_path(self, path):
        resolved = Path(super().translate_path(path))
        html = resolved.with_suffix('.html')
        if not resolved.suffix and html.is_file():
            return str(html)
        return str(resolved)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8765)
    args = parser.parse_args()
    root = Path(__file__).resolve().parent.parent
    handler = lambda *a, **kw: PagesHandler(*a, directory=str(root), **kw)
    ThreadingHTTPServer(('127.0.0.1', args.port), handler).serve_forever()
