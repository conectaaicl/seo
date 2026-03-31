#!/bin/bash
# Deploy SEO UltraPRO → seo.conectaai.cl
# Ejecutar desde tu máquina local

set -e

VPS="root@62.169.17.214"
REMOTE_DIR="/var/www/seo"

echo "=== Build frontend ==="
cd frontend
npm install
npm run build
cd ..

echo "=== Subiendo archivos al VPS ==="
ssh $VPS "mkdir -p $REMOTE_DIR/dist $REMOTE_DIR/backend"

# Subir dist del frontend
scp -r frontend/dist/* $VPS:$REMOTE_DIR/dist/

# Subir backend
scp -r backend/* $VPS:$REMOTE_DIR/backend/
scp backend/.env $VPS:$REMOTE_DIR/backend/.env
scp docker-compose.yml $VPS:$REMOTE_DIR/

echo "=== Deploy backend en VPS ==="
ssh $VPS "cd $REMOTE_DIR && docker-compose down && docker-compose up -d --build"

echo "=== Configurando Nginx ==="
scp nginx.conf $VPS:/etc/nginx/sites-available/seo.conectaai.cl
ssh $VPS "ln -sf /etc/nginx/sites-available/seo.conectaai.cl /etc/nginx/sites-enabled/ && nginx -t && systemctl reload nginx"

echo "=== Listo! https://seo.conectaai.cl ==="
