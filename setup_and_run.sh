#!/bin/bash
# set -e removed so we can log errors without stopping immediately

# ── Colors & helpers ─────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

LOG_FILE="$(pwd)/setup.log"
exec > >(tee -a "$LOG_FILE") 2>&1   # All output goes to console AND setup.log

ts()   { date '+%Y-%m-%d %H:%M:%S'; }
info() { echo -e "${GREEN}[$(ts)][INFO]${NC}  $*"; }
warn() { echo -e "${YELLOW}[$(ts)][WARN]${NC}  $*"; }
err()  { echo -e "${RED}[$(ts)][ERROR]${NC} $*"; }
step() { echo -e "\n${BOLD}${CYAN}══════ $* ══════${NC}"; }
ok()   { echo -e "${GREEN}[$(ts)][OK]${NC}    ✅ $*"; }
run()  {
  echo -e "${CYAN}[$(ts)][CMD]${NC}   \$ $*"
  eval "$@"
  local rc=$?
  if [ $rc -ne 0 ]; then
    warn "Command exited with code $rc: $*"
  fi
  return $rc
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "===================================================="
echo "  🚀 Project Strix — Setup Script"
echo "  Log file: $LOG_FILE"
echo "  Started:  $(ts)"
echo "  Dir:      $SCRIPT_DIR"
echo "===================================================="

# ── 1. System deps ──────────────────────────────────────
step "1/4  System Dependencies"
info "Updating apt package list..."
run sudo apt-get update -y

info "Installing: docker.io python3 python3-venv curl"
run sudo apt-get install -y docker.io python3 python3-venv curl

# Node.js check
if command -v npm &>/dev/null; then
    NODE_VER=$(node --version 2>/dev/null || echo "unknown")
    NPM_VER=$(npm --version 2>/dev/null || echo "unknown")
    ok "Node.js already installed: node=$NODE_VER npm=$NPM_VER"
else
    warn "npm not found — installing Node.js 20 from nodesource..."
    run curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    run sudo apt-get install -y nodejs
    ok "Node.js installed: $(node --version), npm $(npm --version)"
fi

# Docker
info "Enabling and starting Docker service..."
run sudo systemctl enable --now docker
run sudo usermod -aG docker "$USER" || true
DOCKER_VER=$(docker --version 2>/dev/null || echo "not available")
ok "Docker: $DOCKER_VER"

# ── 2. Strix venv ───────────────────────────────────────
step "2/4  Strix CLI (isolated virtualenv)"
VENV_DIR="$SCRIPT_DIR/strix-venv"
STRIX_SRC="$SCRIPT_DIR/strix"

if [ -d "$STRIX_SRC/.git" ]; then
    info "Strix repository already exists, updating..."
    (cd "$STRIX_SRC" && git pull)
else
    info "Cloning Strix repository..."
    # Change this URL if the original Strix repository is different
    run git clone https://github.com/infat0x/strix.git "$STRIX_SRC" || run git clone https://github.com/strix-ai/strix.git "$STRIX_SRC"
fi

info "Creating Python venv at: $VENV_DIR"
run python3 -m venv "$VENV_DIR"
PYTHON_VER=$("$VENV_DIR/bin/python" --version 2>&1)
ok "venv Python: $PYTHON_VER"

info "Upgrading pip inside venv..."
run "$VENV_DIR/bin/pip" install --upgrade pip -q

info "Installing strix-agent from source: $STRIX_SRC"
run "$VENV_DIR/bin/pip" install -e "$STRIX_SRC" -v 2>&1 | tail -20
# (tail -20 shows last 20 lines to avoid wall of text)

if "$VENV_DIR/bin/strix" --version &>/dev/null; then
    ok "strix works: $($VENV_DIR/bin/strix --version 2>/dev/null)"
else
    warn "strix --version failed — it may still work at runtime"
fi

info "Symlinking strix → /usr/local/bin/strix"
run sudo ln -sf "$VENV_DIR/bin/strix" /usr/local/bin/strix
ok "strix command available globally"

# ── 3. Dashboard ────────────────────────────────────────
step "3/4  Dashboard (Next.js)"
DASH_DIR="$SCRIPT_DIR/strix-dashboard"
info "Dashboard directory: $DASH_DIR"
cd "$DASH_DIR"

info "Running npm install..."
run npm install --prefer-offline 2>&1 | tail -10

info "Running npm run build..."
run npm run build 2>&1
BUILD_EXIT=$?

if [ $BUILD_EXIT -eq 0 ]; then
    ok "Dashboard built successfully"
else
    err "Dashboard build FAILED (exit code $BUILD_EXIT). Check output above."
fi

# ── 4. PM2 ──────────────────────────────────────────────
step "4/4  PM2 Process Manager"
if command -v pm2 &>/dev/null; then
    ok "PM2 already installed: $(pm2 --version 2>/dev/null)"
else
    info "Installing PM2 globally..."
    run sudo npm install -g pm2
    ok "PM2 installed: $(pm2 --version)"
fi

# ── Done ─────────────────────────────────────────────────
echo ""
echo "===================================================="
echo -e "${GREEN}✅  Setup complete!${NC}  Finished: $(ts)"
echo ""
echo "To check the log: cat $LOG_FILE"
echo ""
echo "👉 To START the dashboard on port 80:"
echo "   cd $DASH_DIR"
echo "   sudo pm2 start npm --name strix-dashboard -- start -- -p 80"
echo "   sudo pm2 save && sudo pm2 startup"
echo ""
PUB_IP=$(curl -s --max-time 3 ifconfig.me 2>/dev/null || echo "YOUR_IP")
echo "   Open: http://$PUB_IP"
echo "===================================================="
