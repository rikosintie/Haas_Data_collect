#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="/home/mhubbard/Haas_Data_collect/backups"
TARGET_CSV="/home/mhubbard/Haas_Data_collect/users.csv"

if [[ $# -ne 1 ]]; then
    echo "Usage: sudo ./rollback_csv.sh <backup_filename>"
    exit 1
fi

BACKUP_FILE="$BACKUP_DIR/$1"

if [[ ! -f "$BACKUP_FILE" ]]; then
    echo "[ERROR] Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "[*] Restoring CSV from backup: $BACKUP_FILE"
cp "$BACKUP_FILE" "$TARGET_CSV"

echo "[*] CSV restored successfully."
echo "[*] You may now run: sudo systemctl start haas-firewall.service"
