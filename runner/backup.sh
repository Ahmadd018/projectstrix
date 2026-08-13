#!/bin/bash
# Strix Database Backup Script
# This script creates a compressed backup of the Strix database.

# Detect the real user's home directory (if run with sudo, use SUDO_USER)
if [ -n "$SUDO_USER" ]; then
    USER_HOME=$(eval echo ~$SUDO_USER)
else
    USER_HOME=$HOME
fi

BACKUP_DIR="$USER_HOME/strix_backups"
mkdir -p "$BACKUP_DIR"

DATE=$(date +%Y-%m-%d_%H-%M-%S)
BACKUP_FILE="$BACKUP_DIR/strix_db_backup_$DATE.sql.gz"

echo "Backing up Strix database to $BACKUP_FILE..."
sudo -u postgres pg_dump strix | gzip > "$BACKUP_FILE"
chmod 600 "$BACKUP_FILE"

# Keep only the last 10 backups to save space
ls -1t "$BACKUP_DIR"/strix_db_backup_*.sql.gz | tail -n +11 | xargs -r rm --

echo "Backup completed successfully."
