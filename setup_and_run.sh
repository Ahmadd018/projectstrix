#!/bin/bash

# ── Colors & helpers ─────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

ts()   { date '+%Y-%m-%d %H:%M:%S'; }
info() { echo -e "${GREEN}[$(ts)][INFO]${NC} $*"; }
warn() { echo -e "${YELLOW}[$(ts)][WARN]${NC} $*"; }
err()  { echo -e "${RED}[$(ts)][ERROR]${NC} $*"; }
ok()   { echo -e "${GREEN}[$(ts)][OK]${NC}   $*"; }
run()  {
  echo -e "${CYAN}[$(ts)][CMD]${NC}  \$ $*"
  eval "$@"
  local rc=$?
  [ $rc -ne 0 ] && warn "Command exited with code $rc: $*"
  return $rc
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DASH_DIR="$SCRIPT_DIR/strix-dashboard"
VENV_DIR="$SCRIPT_DIR/strix-venv"
STRIX_SRC="$SCRIPT_DIR/strix"

echo ""
echo "===================================================="
echo "  Project Strix — Deploy Script"
echo "  Started: $(ts)"
echo "  Dir:     $SCRIPT_DIR"
echo "===================================================="

# ── 1. Pull latest code ──────────────────────────────────
echo -e "\n${BOLD}${CYAN}══════ 1/3 Pull Latest Code ══════${NC}"

info "Pulling latest dashboard code..."
(cd "$SCRIPT_DIR" && git pull)

# Update strix CLI source if repo exists
if [ -d "$STRIX_SRC/.git" ]; then
  info "Updating strix CLI source..."
  (cd "$STRIX_SRC" && git config --global --add safe.directory "$STRIX_SRC" 2>/dev/null; git pull 2>/dev/null || warn "Strix repo update skipped (safe.directory issue)")
fi

# ── 2. Dashboard build ───────────────────────────────────
echo -e "\n${BOLD}${CYAN}══════ 2/3 Dashboard (Next.js) ══════${NC}"
cd "$DASH_DIR"

info "Cleaning old build artifacts..."
run sudo rm -rf .next

info "Installing npm dependencies..."
run npm install 2>&1 | tail -5

info "Building dashboard..."
run npm run build 2>&1
BUILD_EXIT=$?

if [ $BUILD_EXIT -eq 0 ]; then
  ok "Dashboard built successfully ✓"
else
  err "Dashboard build FAILED (exit code $BUILD_EXIT)"
  exit 1
fi

# ── 3. Restart PM2 processes ─────────────────────────────
echo -e "\n${BOLD}${CYAN}══════ 3/3 Restart Services ══════${NC}"

if command -v pm2 &>/dev/null; then
  # Restart dashboard if already running, else start it
  if pm2 show strix-dashboard &>/dev/null; then
    info "Restarting existing PM2 process: strix-dashboard"
    run sudo pm2 restart strix-dashboard
  else
    info "Starting PM2 process: strix-dashboard on port 80"
    run sudo pm2 start npm --name strix-dashboard -- start -- -p 80
  fi

  # Restart scheduler if exists
  if pm2 show strix-scheduler &>/dev/null; then
    info "Restarting existing PM2 process: strix-scheduler"
    run sudo pm2 restart strix-scheduler
  fi

  run sudo pm2 save
  ok "Services restarted ✓"
else
  warn "PM2 not installed. Start manually:"
  echo "  cd $DASH_DIR"
  echo "  sudo pm2 start npm --name strix-dashboard -- start -- -p 80"
  echo "  sudo npm install -g pm2"
fi

# ── Done ─────────────────────────────────────────────────
PUB_IP=$(curl -s --max-time 3 ifconfig.me 2>/dev/null || echo "YOUR_IP")
echo ""
echo "===================================================="
echo -e "${GREEN} Deploy complete!${NC} Finished: $(ts)"
echo ""
echo "  Open: http://$PUB_IP"
echo "===================================================="
