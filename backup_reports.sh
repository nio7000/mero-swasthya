#!/bin/bash

# === CONFIGURATION ===
DB_NAME="reports_ocr"
DB_USER="postgres"
BACKUP_DIR="/Users/nikesholi/Desktop/db_backups"
DATE=$(date +"%Y%m%d_%H%M%S")

# === CREATE BACKUP FOLDER IF NOT EXISTS ===
mkdir -p "$BACKUP_DIR"

# === CREATE NEW BACKUP ===
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${DATE}.sql"
pg_dump -U $DB_USER -d $DB_NAME > "$BACKUP_FILE"

if [ $? -eq 0 ]; then
    echo "✅ Backup completed: $BACKUP_FILE"
else
    echo "❌ Backup failed at $(date)" >> "$BACKUP_DIR/cron_backup.log"
    exit 1
fi

# === COMPRESS OLD BACKUPS (>7 days) ===
find "$BACKUP_DIR" -type f -name "*.sql" -mtime +7 -exec zip -m "{}.zip" "{}" \;

# === OPTIONAL: DELETE COMPRESSED BACKUPS OLDER THAN 30 DAYS ===
find "$BACKUP_DIR" -type f -name "*.zip" -mtime +30 -exec rm {} \;

# === LOG SUCCESS ===
echo "🗂 Backup and cleanup completed successfully at $(date)" >> "$BACKUP_DIR/cron_backup.log"
#!/bin/bash
# Automated backup for reports_ocr database

DB_NAME="reports_ocr"
DB_USER="postgres"
BACKUP_DIR="$HOME/Desktop/db_backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql"

mkdir -p "$BACKUP_DIR"

pg_dump -U "$DB_USER" -d "$DB_NAME" -f "$BACKUP_FILE"

echo "✅ Backup completed: $BACKUP_FILE"

