#!/bin/bash
# Strix Database Backup Script
# This script creates a compressed backup of the Strix database.

# Determine the directory where the project is located (parent of runner folder)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

BACKUP_DIR="$PROJECT_DIR/strix_backups"
mkdir -p "$BACKUP_DIR"

DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="$BACKUP_DIR/strix_db_backup_$DATE.sql.gz"

echo "Backing up Strix database to $BACKUP_FILE..."
sudo -u postgres pg_dump strix | gzip > "$BACKUP_FILE"
chmod 600 "$BACKUP_FILE"

# Keep only the last 10 backups to save space
ls -1t "$BACKUP_DIR"/strix_db_backup_*.sql.gz | tail -n +11 | xargs -r rm --

echo "Backup completed successfully."
