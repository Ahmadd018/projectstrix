#!/bin/bash
set -e

echo "===================================================="
echo "🚀 Starting full setup for Project Strix..."
echo "===================================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo -e "\n📦 1/4 Installing system dependencies (Docker, Python, Node.js)..."
if command -v apt-get &> /dev/null; then
    sudo apt-get update -y || true
    sudo apt-get install -y docker.io python3-pip python3-venv curl || true
fi

# Install Node.js 20 if npm is not installed
if ! command -v npm &> /dev/null; then
    echo "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - || true
    sudo apt-get install -y nodejs || true
fi

# Configure Docker if systemctl is available
if command -v systemctl &> /dev/null; then
    echo "Configuring Docker..."
    sudo systemctl enable --now docker || true
    sudo usermod -aG docker "$USER" || true
fi

echo -e "\n🐍 2/4 Installing Strix CLI..."
cd "$SCRIPT_DIR/strix"

# Robust pip installation with fallbacks for system-managed Python environments
if sudo pip3 install --ignore-installed --break-system-packages -e . 2>/dev/null; then
    echo "✅ Strix CLI installed globally (system pip3 --ignore-installed)"
elif pip3 install --user -e . 2>/dev/null; then
    echo "✅ Strix CLI installed for current user (~/.local/bin)"
elif pip3 install -e . --break-system-packages 2>/dev/null; then
    echo "✅ Strix CLI installed via pip3 --break-system-packages"
else
    echo "⚠️ System pip failed, setting up dedicated Python virtualenv..."
    python3 -m venv "$SCRIPT_DIR/venv"
    source "$SCRIPT_DIR/venv/bin/activate"
    pip install -e .
    sudo ln -sf "$SCRIPT_DIR/venv/bin/strix" /usr/local/bin/strix 2>/dev/null || true
    echo "✅ Strix CLI installed in virtual environment"
fi

echo -e "\n🌐 3/4 Installing Dashboard dependencies and building..."
cd "$SCRIPT_DIR/strix-dashboard"
npm install
npm run build

echo -e "\n✅ 4/4 Setup complete!"
echo "===================================================="
echo "Strix CLI is installed and the Dashboard is built."
echo ""
echo "To run the dashboard:"
echo "  Option A (Root):       npm start"
echo "  Option B (Dashboard):  cd strix-dashboard && npm start"
echo "  Option C (Dev mode):   cd strix-dashboard && npm run dev"
echo "===================================================="

if [ "$1" == "--start" ]; then
    echo -e "\n🚀 Auto-starting Dashboard on http://localhost:3000..."
    npm start -- -p 3000
fi
