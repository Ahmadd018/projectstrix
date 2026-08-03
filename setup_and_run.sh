#!/bin/bash
set -e

echo "===================================================="
echo "🚀 Starting full setup for Project Strix..."
echo "===================================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# ── 1. System deps ──────────────────────────────────────
echo -e "\n📦 1/4 Installing system dependencies..."
sudo apt-get update -y
sudo apt-get install -y docker.io python3 python3-venv curl pipx

# Node.js 20 if missing
if ! command -v npm &>/dev/null; then
    echo "  → Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Docker
sudo systemctl enable --now docker || true
sudo usermod -aG docker "$USER" || true

# ── 2. Strix CLI ────────────────────────────────────────
echo -e "\n🐍 2/4 Installing Strix CLI (via isolated venv)..."
VENV_DIR="$SCRIPT_DIR/strix-venv"

# Always use a clean venv — avoids ALL system pip conflicts
python3 -m venv "$VENV_DIR"
"$VENV_DIR/bin/pip" install --upgrade pip -q
"$VENV_DIR/bin/pip" install -e "$SCRIPT_DIR/strix" -q

# Symlink so 'strix' works globally from any shell
sudo ln -sf "$VENV_DIR/bin/strix" /usr/local/bin/strix
echo "  ✅ strix → /usr/local/bin/strix"
strix --version 2>/dev/null && echo "  ✅ strix command works!" || echo "  ⚠️  strix --version failed (may still work at runtime)"

# ── 3. Dashboard ────────────────────────────────────────
echo -e "\n🌐 3/4 Installing & building Dashboard..."
cd "$SCRIPT_DIR/strix-dashboard"
npm install
npm run build
echo "  ✅ Dashboard built successfully"

# ── 4. PM2 (process manager) ────────────────────────────
echo -e "\n⚙️  4/4 Installing PM2 process manager..."
sudo npm install -g pm2 -q

echo ""
echo "===================================================="
echo "✅ Setup complete! Everything is installed."
echo ""
echo "👉 To START the dashboard on port 80:"
echo "   cd $SCRIPT_DIR/strix-dashboard"
echo "   sudo pm2 start npm --name strix-dashboard -- start -- -p 80"
echo "   sudo pm2 save && sudo pm2 startup"
echo ""
echo "👉 Then open: http://$(curl -s ifconfig.me 2>/dev/null || echo 'YOUR_IP')"
echo "===================================================="
