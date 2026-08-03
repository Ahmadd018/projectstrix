#!/bin/bash
set -e

echo "===================================================="
echo "🚀 Starting full setup for Project Strix..."
echo "===================================================="

echo -e "\n📦 1/4 Installing system dependencies (Docker, Python, Node.js)..."
sudo apt-get update
sudo apt-get install -y docker.io python3-pip curl

# Install Node.js 20.x if npm is not installed
if ! command -v npm &> /dev/null; then
    echo "Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

# Start and enable docker
echo "Configuring Docker..."
sudo systemctl enable --now docker
sudo usermod -aG docker $USER || true

echo -e "\n🐍 2/4 Installing Strix CLI globally (via venv)..."
cd "$(dirname "$0")/strix"
sudo apt-get install -y python3-venv
python3 -m venv venv
./venv/bin/pip install -e .
sudo ln -sf "$(pwd)/venv/bin/strix" /usr/local/bin/strix

echo -e "\n🌐 3/4 Installing Dashboard dependencies and building..."
cd ../strix-dashboard
npm install
npm run build

echo -e "\n✅ 4/4 Setup complete!"
echo "===================================================="
echo "Strix is now installed and the dashboard is built."
echo "To run the dashboard later, navigate to strix-dashboard and use PM2 or 'sudo npm start -p 80'"
echo "===================================================="
