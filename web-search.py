#!/usr/bin/env python3
"""Simple web search proxy using DuckDuckGo HTML. Runs on port 9124."""

import http.server
import json
import urllib.request
import urllib.parse
import re

PORT = 9124

class SearchHandler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        params = urllib.parse.parse_qs(parsed.query)
        query = params.get('q', [''])[0]

        if not query:
            self.send_response(400)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": "Missing q parameter"}).encode())
            return

        try:
            results = self.search_ddg(query)
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(results).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"error": str(e)}).encode())

    def search_ddg(self, query):
        url = 'https://html.duckduckgo.com/html/?q=' + urllib.parse.quote(query)
        req = urllib.request.Request(url, headers={
            'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        })
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode('utf-8', errors='ignore')

        results = []
        blocks = re.findall(r'<a rel="nofollow" class="result__a" href="([^"]*)"[^>]*>(.*?)</a>.*?<a class="result__snippet"[^>]*>(.*?)</a>', html, re.DOTALL)
        for href, title, desc in blocks[:8]:
            href = re.sub(r'//duckduckgo\.com/l/\?uddg=', '', href)
            href = urllib.parse.unquote(href.split('&rut=')[0])
            title = re.sub(r'<[^>]+>', '', title).strip()
            desc = re.sub(r'<[^>]+>', '', desc).strip()
            if title and href.startswith('http'):
                results.append({"title": title, "url": href, "description": desc})

        return results

    def log_message(self, format, *args):
        pass

if __name__ == '__main__':
    server = http.server.HTTPServer(('127.0.0.1', PORT), SearchHandler)
    print(f'Web search proxy running on port {PORT}')
    server.serve_forever()
