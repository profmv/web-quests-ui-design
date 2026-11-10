"""
OBJECTIVE: Lightweight zero-dependency HTTP server with UTF-8 encoding and MIME handling for Web Quests UI Design.
USAGE: python scripts/server/serve.py [--port 8080] [--no-browser]
PARAMETERS:
    --port: Port number (default: 8080)
    --no-browser: Suppress automatic browser launch
OUTPUTS: Serves static files over HTTP at http://localhost:<port>/
"""

import argparse
import http.server
import os
import sys
import webbrowser

class CustomHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Disable caching for active local development
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def guess_type(self, path):
        content_type = super().guess_type(path)
        if content_type.startswith("text/") or content_type in ["application/javascript", "application/json"]:
            return f"{content_type}; charset=utf-8"
        return content_type

def run_server(port=8080, open_browser=True):
    # Ensure current working directory is project root
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    os.chdir(project_root)

    handler = CustomHTTPHandler
    for p in range(port, port + 20):
        try:
            with http.server.ThreadingHTTPServer(("127.0.0.1", p), handler) as httpd:
                url = f"http://localhost:{p}/"
                print(f"[OK] Serving Web Quests UI Design at {url}")
                print("[INFO] Press Ctrl+C to stop the server.")
                if open_browser:
                    webbrowser.open(url)
                httpd.serve_forever()
                break
        except OSError:
            print(f"[WARN] Port {p} is in use, attempting next port...")
            continue

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Web Quests UI Design local server")
    parser.add_argument("--port", type=int, default=8080, help="Port to serve on")
    parser.add_argument("--no-browser", action="store_true", help="Do not open browser automatically")
    args = parser.parse_args()

    try:
        run_server(port=args.port, open_browser=not args.no_browser)
    except KeyboardInterrupt:
        print("\n[OK] Server stopped.")
        sys.exit(0)
