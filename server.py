#!/usr/bin/env python3
"""Simple REST API server for interview analysis reports.

Endpoints:
  GET /api/reports          - List all available reports
  GET /api/reports/{name}   - Get a specific report's JSON data
"""

import json
import os
import glob
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, unquote

PORT = 8000
DATA_DIR = os.path.dirname(os.path.abspath(__file__))


def find_reports():
    """Scan for *_analysis_data.json files and return report list."""
    pattern = os.path.join(DATA_DIR, "*_analysis_data.json")
    reports = []
    for path in sorted(glob.glob(pattern)):
        basename = os.path.basename(path)
        name = basename.replace("_analysis_data.json", "")
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            meta = data.get("meta", {})
            reports.append({
                "name": name,
                "position": meta.get("position", name),
                "date": meta.get("date", ""),
            })
        except (json.JSONDecodeError, IOError):
            reports.append({"name": name, "position": name, "date": ""})
    return reports


def load_report(name: str):
    """Load a specific report's JSON data."""
    path = os.path.join(DATA_DIR, f"{name}_analysis_data.json")
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


class APIHandler(BaseHTTPRequestHandler):
    def _set_headers(self, status=200, content_type="application/json"):
        self.send_response(status)
        self.send_header("Content-Type", f"{content_type}; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_OPTIONS(self):
        self._set_headers(204)

    def do_GET(self):
        parsed = urlparse(self.path)
        path = unquote(parsed.path).rstrip("/")

        if path == "/api/reports":
            reports = find_reports()
            self._set_headers(200)
            self.wfile.write(json.dumps({"reports": reports}, ensure_ascii=False).encode("utf-8"))

        elif path.startswith("/api/reports/"):
            name = path[len("/api/reports/"):]
            data = load_report(name)
            if data is None:
                self._set_headers(404)
                self.wfile.write(json.dumps({"error": "Report not found"}, ensure_ascii=False).encode("utf-8"))
            else:
                self._set_headers(200)
                self.wfile.write(json.dumps(data, ensure_ascii=False).encode("utf-8"))

        else:
            self._set_headers(404)
            self.wfile.write(json.dumps({"error": "Not found"}).encode("utf-8"))

    def log_message(self, format, *args):
        print(f"[API] {args[0]}")


def main():
    server = HTTPServer(("0.0.0.0", PORT), APIHandler)
    print(f"API server running on http://0.0.0.0:{PORT}")
    print(f"  GET /api/reports         - List reports")
    print(f"  GET /api/reports/{{name}} - Get report data")
    print(f"Data directory: {DATA_DIR}")
    reports = find_reports()
    print(f"Found {len(reports)} report(s): {[r['name'] for r in reports]}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down...")
        server.server_close()


if __name__ == "__main__":
    main()
