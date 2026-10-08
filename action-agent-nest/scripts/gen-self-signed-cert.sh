#!/bin/bash
# 生成自签 HTTPS 证书（仅 IP 访问场景过渡用；浏览器会有安全警告，但传输加密）
# 用法：bash scripts/gen-self-signed-cert.sh <服务器公网IP>
# 然后在 deploy/nginx-jdi.conf 里启用 HTTPS server 块，并重载 nginx
set -e

IP=${1:?用法: bash scripts/gen-self-signed-cert.sh <服务器公网IP>}
OUT_DIR="$(dirname "$0")/../deploy/certs"
mkdir -p "$OUT_DIR"

openssl req -x509 -nodes -days 825 -newkey rsa:2048 \
  -keyout "$OUT_DIR/jdi-selfsigned.key" \
  -out "$OUT_DIR/jdi-selfsigned.crt" \
  -subj "/CN=$IP" \
  -addext "subjectAltName=IP:$IP"

echo "证书已生成：$OUT_DIR/jdi-selfsigned.crt / .key"
echo "上传到服务器 /etc/nginx/certs/，启用 nginx-jdi.conf 的 HTTPS 块后 systemctl reload nginx"
