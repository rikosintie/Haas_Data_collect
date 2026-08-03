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
#   - Backups are stored in BACKUP_DIR (from /etc/haas-firewall.conf).
#   - Active CSV is located at CSV_PATH (from /etc/haas-firewall.conf).
#   - This script does NOT trigger the firewall update; it only restores
#     the CSV. The operator can then manually run the service or script.
#

set -euo pipefail

########################################
# LOAD CONFIGURATION
########################################

CONFIG_FILE="/etc/haas-firewall.conf"

if [[ ! -f "$CONFIG_FILE" ]]; then
    echo "[ERROR] Configuration file not found: $CONFIG_FILE"
    exit 1
fi

# shellcheck source=/dev/null
source "$CONFIG_FILE"

if [[ -z "${BACKUP_DIR:-}" ]]; then
    echo "[ERROR] BACKUP_DIR is not set in $CONFIG_FILE"
    exit 1
fi

if [[ -z "${CSV_PATH:-}" ]]; then
    echo "[ERROR] CSV_PATH is not set in $CONFIG_FILE"
    exit 1
fi

TARGET_CSV="$CSV_PATH"

########################################
# INPUT VALIDATION
########################################

if [[ $# -ne 1 ]]; then
    echo "Usage: sudo $0 <backup_filename>"
    echo "Example: sudo $0 users_2025-01-13_12-00-00.csv"
    exit 1
fi

BACKUP_FILENAME="$1"

# Reject anything that isn't a bare filename (no "/", no leading ".") before
# it ever touches the filesystem -- cheap first check, defense in depth.
if [[ "$BACKUP_FILENAME" == */* || "$BACKUP_FILENAME" == .* ]]; then
    echo "[ERROR] Invalid backup filename: $BACKUP_FILENAME"
    echo "        Must be a plain filename with no path components."
    exit 1
fi

BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILENAME"

########################################
# BACKUP FILE VALIDATION
########################################

if [[ ! -f "$BACKUP_FILE" ]]; then
    echo ""
    echo "======"
    echo "[ERROR] Backup file not found:"
    echo "        $BACKUP_FILE"
    echo "        Use 'ls $BACKUP_DIR' to see available backups."
    echo ""
    echo "[ERROR]"
    echo "======"
    exit 1
fi

# Real containment check: resolve symlinks/".." and confirm the result is
# still inside BACKUP_DIR. Catches anything the filename-shape check above
# might miss (e.g. a symlink planted inside BACKUP_DIR pointing outside it).
RESOLVED_BACKUP_DIR="$(realpath -e "$BACKUP_DIR")"
RESOLVED_BACKUP_FILE="$(realpath -e "$BACKUP_FILE")"

if [[ "$RESOLVED_BACKUP_FILE" != "$RESOLVED_BACKUP_DIR"/* ]]; then
    echo "[ERROR] Backup file resolves outside BACKUP_DIR -- refusing to proceed."
    echo "        Requested:  $BACKUP_FILENAME"
    echo "        Resolved:   $RESOLVED_BACKUP_FILE"
    echo "        Must be inside: $RESOLVED_BACKUP_DIR"
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
