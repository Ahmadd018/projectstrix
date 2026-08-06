#!/bin/bash

# Port 80-i istifadə edən hər hansı asılı (zombie) Next.js və ya PM2 prosesini təmizləmək
echo "[1/3] Port 80-də olan köhnə proseslər silinir..."
sudo fuser -k 80/tcp 2>/dev/null

echo "[2/3] PM2 dashboard prosesi (əgər varsa) dayandırılır..."
sudo pm2 delete strix-dashboard 2>/dev/null
sudo pm2 save 2>/dev/null

echo "[3/4] Asılılıqlar və Verilənlər Bazası yenilənir..."
cd "$(dirname "$0")/strix-dashboard" || exit 1
npm install
npx prisma generate
npx prisma db push --accept-data-loss

echo "[4/4] Next.js DEV rejimində 80-ci portda və Scheduler başladılır..."
sudo pm2 start scripts/scheduler.js --name "strix-scheduler"
sudo pm2 save
sudo npm run dev -- -H 0.0.0.0 -p 80
