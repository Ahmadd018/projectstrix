#!/bin/bash

echo "=============================================="
echo "    Strix PostgreSQL Auto-Setup Script"
echo "=============================================="

# Check if running as root or with sudo privileges
if [ "$EUID" -eq 0 ]; then
  echo "Please DO NOT run this script as root directly."
  echo "Run it as your normal user (e.g., ubuntu). The script will prompt for sudo password when needed."
  exit 1
fi

echo "[1/4] Updating packages and installing PostgreSQL..."
sudo apt update
sudo apt install postgresql postgresql-contrib -y

echo "[2/4] Creating database and user..."
# We use sudo -i -u postgres to safely execute psql commands
sudo -u postgres psql -c "CREATE DATABASE strix;" || echo "Database 'strix' might already exist."
sudo -u postgres psql -c "CREATE USER strixuser WITH ENCRYPTED PASSWORD 'strix_pass_123';" || echo "User 'strixuser' might already exist."
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE strix TO strixuser;"
sudo -u postgres psql -c "ALTER DATABASE strix OWNER TO strixuser;"

echo "[3/4] Setting up .env file in strix-dashboard..."
ENV_FILE="$(dirname "$0")/../.env"

if grep -q "DATABASE_URL" "$ENV_FILE" 2>/dev/null; then
  echo "DATABASE_URL already exists in .env. Updating it..."
  sed -i 's|^DATABASE_URL=.*|DATABASE_URL="postgresql://strixuser:strix_pass_123@localhost:5432/strix?schema=public"|' "$ENV_FILE"
else
  echo "DATABASE_URL=\"postgresql://strixuser:strix_pass_123@localhost:5432/strix?schema=public\"" >> "$ENV_FILE"
  echo "Added DATABASE_URL to .env."
fi

echo "[4/4] Verifying connection..."
if sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw strix; then
    echo "✅ Database 'strix' successfully created!"
else
    echo "❌ Failed to create database."
    exit 1
fi

echo "=============================================="
echo " Setup Complete! "
echo " You can now proceed with the implementation plan."
echo "=============================================="
