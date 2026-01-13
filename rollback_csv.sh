#!/usr/bin/env bash
#
# Haas Appliance - CSV Rollback Utility
#
# This script restores a previous CSV backup into the active CSV location.
#
# USAGE:
#   sudo ./rollback_csv.sh <backup_filename>
#
# EXAMPLE:
#   sudo ./rollback_csv.sh users_2025-01-13_12-00-00.csv
#
# DESIGN:
#   - Backups are stored in BACKUP_DIR.
#   - Active CSV is located at TARGET_CSV.
#   - This script does NOT trigger the firewall update; it only restores
#     the CSV. The operator can then manually run the service or script.
#

set -euo pipefail

########################################
# PATH CONFIGURATION
########################################

BACKUP_DIR="/home/mhubbard/Haas_Data_collect/backups"
TARGET_CSV="/home/mhubbard/Haas_Data_collect/users.csv"

########################################
# INPUT VALIDATION
########################################

if [[ $# -ne 1 ]]; then
    echo "Usage: sudo $0 <backup_filename>"
    echo "Example: sudo $0 users_2025-01-13_12-00-00.csv"
    exit 1
fi

BACKUP_FILENAME="$1"
BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILENAME"

########################################
# BACKUP FILE VALIDATION
########################################

if [[ ! -f "$BACKUP_FILE" ]]; then
    echo "[ERROR] Backup file not found:"
    echo "        $BACKUP_FILE"
    echo "        Use 'ls $BACKUP_DIR' to see available backups."
    exit 1
fi

########################################
# RESTORE OPERATION
########################################

echo "[*] Restoring CSV from backup:"
echo "    Source: $BACKUP_FILE"
echo "    Target: $TARGET_CSV"

cp "$BACKUP_FILE" "$TARGET_CSV"

echo "[*] CSV restore completed successfully."

echo ""
echo "Next steps:"
echo "  - You may now re-run the firewall configuration:"
echo "        sudo /usr/local/sbin/configure_ufw_from_csv.sh"
echo "  - Or start the systemd service:"
echo "        sudo systemctl start haas-firewall.service"
echo ""

exit 0
