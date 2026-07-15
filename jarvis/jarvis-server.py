#!/usr/bin/env python3
"""Jarvis API — tiny stdlib-only backend for the Jarvis web interface.

Runs on 127.0.0.1:5050 behind nginx (location /api/). The browser page is
sandboxed and cannot read other websites; this server does that reading:

  GET /api/gold     -> SJC gold prices (vàng miếng + nhẫn trơn), 60s cache
  GET /api/weather  -> current weather located by the caller's IP
"""
import json, re, time, threading
import urllib.request
import xml.etree.ElementTree as ET
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = 5050
UA = {"User-Agent": "Mozilla/5.0 (JarvisHome/1.0)"}

def http_get(url, timeout=8):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()

# ---------------- gold (SJC) ----------------
_gold_cache = {"t": 0, "data": None}
_gold_lock = threading.Lock()

def normalize_price(raw):
    """SJC has shipped values as '118,600' (nghìn đ/lượng), '118600000' (đ)
    or '118.6' (triệu) over the years — normalize everything to đồng."""
    v = float(str(raw).replace(",", "").replace(" ", ""))
    if v < 1000:          # triệu đồng
        return int(v * 1_000_000)
    if v < 1_000_000:     # nghìn đồng
        return int(v * 1000)
    return int(v)         # đồng

def parse_sjc(xml_bytes):
    root = ET.fromstring(xml_bytes)
    ratelist = root.find(".//ratelist")
    updated = ratelist.get("updated", "") if ratelist is not None else ""
    items = []
    for it in root.iter("item"):
        try:
            items.append({
                "type": it.get("type", ""),
                "buy": normalize_price(it.get("buy")),
                "sell": normalize_price(it.get("sell")),
            })
        except (TypeError, ValueError):
            continue
    return {"ok": bool(items), "source": "SJC", "updated": updated, "items": items}

def get_gold():
    with _gold_lock:
        if time.time() - _gold_cache["t"] < 60 and _gold_cache["data"]:
            return _gold_cache["data"]
        try:
            data = parse_sjc(http_get("https://sjc.com.vn/xml/tygiavang.xml"))
        except Exception as e:
            data = {"ok": False, "error": str(e)[:200]}
        if data.get("ok"):
            _gold_cache.update(t=time.time(), data=data)
        return data

# ---------------- weather (by caller IP) ----------------
def get_weather(client_ip):
    try:
        ip = "" if (not client_ip or client_ip.startswith(("10.", "127.", "192.168.", "172.16."))) else client_ip
        geo = json.loads(http_get(f"https://ipapi.co/{ip + '/' if ip else ''}json/"))
        lat, lon, city = geo["latitude"], geo["longitude"], geo.get("city", "")
        cur = json.loads(http_get(
            "https://api.open-meteo.com/v1/forecast"
            f"?latitude={lat}&longitude={lon}&current=temperature_2m,weather_code,wind_speed_10m"
        ))["current"]
        return {"ok": True, "city": city, "temp": cur["temperature_2m"],
                "wind": cur["wind_speed_10m"], "code": cur.get("weather_code")}
    except Exception as e:
        return {"ok": False, "error": str(e)[:200]}

# ---------------- http ----------------
class Handler(BaseHTTPRequestHandler):
    def _send(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        path = self.path.split("?")[0].rstrip("/")
        if path == "/api/gold":
            return self._send(get_gold())
        if path == "/api/weather":
            ip = self.headers.get("X-Forwarded-For", "").split(",")[0].strip() \
                 or self.client_address[0]
            return self._send(get_weather(ip))
        return self._send({"ok": False, "error": "not found"}, 404)

    def log_message(self, fmt, *args):
        pass  # keep journal quiet

if __name__ == "__main__":
    print(f"Jarvis API listening on 127.0.0.1:{PORT}")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
