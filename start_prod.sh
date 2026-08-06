#!/bin/bash

# ─────────────────────────────────────────────────────────────────────────────
# Strix Dashboard — Production Server Starter
# 
# Bu skript Next.js-i Production (Məhsuldarlıq) rejimində işə salır.
# Tablar arası keçid anında (gecikmədən) olacaq və yaddaş (RAM) problemi yaşanmayacaq.
# ─────────────────────────────────────────────────────────────────────────────

echo "[1/4] Port 80-də olan köhnə proseslər silinir..."
sudo fuser -k 80/tcp 2>/dev/null || true

echo "[2/4] Asılılıqlar və Verilənlər Bazası yenilənir..."
cd "$(dirname "$0")/strix-dashboard" || exit 1
npm install --legacy-peer-deps
npx prisma generate
npx prisma db push --accept-data-loss

echo "[3/4] Next.js Production üçün yığılır (Build)... (Bu 1-2 dəqiqə çəkə bilər)"
# Clear cache to prevent "definition" error from previous memory crashes
rm -rf .next
npm run build

echo "[4/4] Next.js Production rejimində başladılır..."
# Start production server
sudo npm run start -- -H 0.0.0.0 -p 80
