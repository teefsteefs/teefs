#!/usr/bin/env bash
# One-time VPS setup: nginx + self-signed HTTPS for the Jarvis interface.
# Run ON THE SERVER as root:  bash server-setup.sh
# HTTPS (even self-signed) is required for the microphone to work in browsers.
set -euo pipefail

apt-get update -qq
apt-get install -y -qq nginx openssl

mkdir -p /var/www/jarvis

IP="$(curl -s ifconfig.me || hostname -I | awk '{print $1}')"
openssl req -x509 -nodes -days 3650 -newkey rsa:2048 \
  -keyout /etc/ssl/private/jarvis.key \
  -out /etc/ssl/certs/jarvis.crt \
  -subj "/CN=${IP}"

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
    location / { try_files $uri $uri/ =404; }
}
EOF
ln -sf /etc/nginx/sites-available/jarvis /etc/nginx/sites-enabled/default

# open firewall if ufw is active
if command -v ufw >/dev/null && ufw status | grep -q "Status: active"; then
  ufw allow 80/tcp; ufw allow 443/tcp
fi

nginx -t && systemctl reload nginx
echo "Done. Upload index.html to /var/www/jarvis/ then open https://${IP}"
