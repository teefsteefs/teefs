#!/usr/bin/env bash
# Install the Jarvis API as a systemd service and route /api/ through nginx.
# Prerequisite: jarvis-server.py uploaded to /root/ (scp), nginx already set
# up by server-setup.sh. Run ON THE SERVER as root: bash api-setup.sh
set -euo pipefail

mkdir -p /opt/jarvis
[ -f /root/jarvis-server.py ] && mv /root/jarvis-server.py /opt/jarvis/jarvis-server.py
[ -f /opt/jarvis/jarvis-server.py ] || { echo "ERROR: /opt/jarvis/jarvis-server.py not found — scp it first"; exit 1; }

cat > /etc/systemd/system/jarvis-api.service <<'EOF'
[Unit]
Description=Jarvis API (gold price, weather)
After=network.target

[Service]
ExecStart=/usr/bin/python3 /opt/jarvis/jarvis-server.py
Restart=always
RestartSec=3
User=www-data
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/nginx/sites-available/jarvis <<'EOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;
    ssl_certificate     /etc/ssl/certs/jarvis.crt;
    ssl_certificate_key /etc/ssl/private/jarvis.key;
    root /var/www/jarvis;
    index index.html;
    location /api/ {
        proxy_pass http://127.0.0.1:5050;
        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_read_timeout 30s;
    }
    location / { try_files $uri $uri/ =404; }
}
EOF

systemctl daemon-reload
systemctl enable --now jarvis-api
nginx -t && systemctl reload nginx

sleep 1
echo "--- API self-test ---"
curl -s --max-time 25 http://127.0.0.1:5050/api/gold | head -c 300; echo
echo "===== API SETUP OK ====="
