#!/bin/sh
set -e
API="${API_URL:-http://192.168.1.70:8000}"
sed "s|__API_URL__|${API}|g" /etc/nginx/nginx.template.conf > /etc/nginx/conf.d/default.conf
exec nginx -g 'daemon off;'
