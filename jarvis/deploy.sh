#!/usr/bin/env bash
# Deploy jarvis/index.html to a VPS running nginx.
# Usage: ./deploy.sh root@YOUR_SERVER_IP
set -euo pipefail
HOST="${1:?Usage: ./deploy.sh root@YOUR_SERVER_IP}"
DIR="$(cd "$(dirname "$0")" && pwd)"
scp "$DIR/index.html" "$HOST:/var/www/jarvis/index.html"
echo "Deployed. Open https://${HOST#*@}"
