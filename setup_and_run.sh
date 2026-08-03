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

echo -e "\n🐍 2/4 Installing Strix CLI globally..."
cd "$(dirname "$0")/strix"
# Ubuntu 23+ requires --break-system-packages for system-wide pip installs
sudo pip3 install -e . --break-system-packages || sudo pip3 install -e .

echo -e "\n🌐 3/4 Installing Dashboard dependencies..."
cd ../strix-dashboard
npm install

echo -e "\n✅ 4/4 Setup complete! Starting the dashboard..."
echo "===================================================="
echo "🌐 The dashboard will be available on Port 3000"
echo "👉 Make sure Port 3000 is OPEN in your AWS Security Group!"
echo "===================================================="
npm run dev -- -H 0.0.0.0
