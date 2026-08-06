#!/bin/bash

# ─────────────────────────────────────────────────────────────────────────────
# Strix Dashboard — Dev Server Starter
# 
# The scheduler now runs EMBEDDED inside the Next.js process via 
# src/instrumentation.ts — NO PM2 needed for the scheduler.
# ─────────────────────────────────────────────────────────────────────────────

echo "[1/4] Port 80-də olan köhnə proseslər silinir..."
sudo fuser -k 80/tcp 2>/dev/null || true

echo "[2/4] Git: ən son kodlar çəkilir..."
cd "$(dirname "$0")" || exit 1
# Stash any local changes (e.g. package-lock.json), pull, then restore
git stash push -m "auto-stash before pull" 2>/dev/null || true
git pull --rebase 2>/dev/null || git pull 2>/dev/null || echo "[WARN] git pull failed — running with local version"
git stash pop 2>/dev/null || true

echo "[3/4] Asılılıqlar və Verilənlər Bazası yenilənir..."
cd "$(dirname "$0")/strix-dashboard" || exit 1
npm install --legacy-peer-deps
npx prisma generate
npx prisma db push --accept-data-loss

echo "[4/4] Next.js başladılır (Scheduler avtomatik Next.js içində işləyəcək)..."
# The embedded scheduler starts automatically via src/instrumentation.ts
sudo npm run dev -- -H 0.0.0.0 -p 80
