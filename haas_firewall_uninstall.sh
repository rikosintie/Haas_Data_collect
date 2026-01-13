#!/usr/bin/env bash
#
# Haas Appliance - Firewall Automation Uninstaller
#
# This script removes the installed components of the Haas firewall:
#   - Systemd service and timer
#   - Installed scripts in /usr/local/sbin
#   - Cockpit extension in /usr/share/cockpit/haas-firewall
#
# It does NOT delete:
#   - The repo directory
#   - The CSV or backups inside the repo
#

set -euo pipefail

echo "[*] Starting Haas Firewall uninstallation..."

TARGET_SCRIPT="/usr/local/sbin/configure_ufw_from_csv.sh"
TARGET_VALIDATOR="/usr/local/sbin/validate_users_csv.sh"
TARGET_SERVICE="/etc/systemd/system/haas-firewall.service"
TARGET_TIMER="/etc/systemd/system/haas-firewall.timer"
COCKPIT_DST="/usr/share/cockpit/haas-firewall"

########################################
# STOP AND DISABLE SYSTEMD UNITS
########################################

echo "[*] Stopping and disabling systemd units..."

if systemctl list-unit-files | grep -q '^haas-firewall.service'; then
    sudo systemctl stop haas-firewall.service || true
    sudo systemctl disable haas-firewall.service || true
    echo "[OK] Service stopped and disabled."
else
    echo "[INFO] Service haas-firewall.service not found. Skipping."
fi

if systemctl list-unit-files | grep -q '^haas-firewall.timer'; then
    sudo systemctl stop haas-firewall.timer || true
    sudo systemctl disable haas-firewall.timer || true
    echo "[OK] Timer stopped and disabled."
else
    echo "[INFO] Timer haas-firewall.timer not found. Skipping."
fi

########################################
# REMOVE SYSTEMD UNIT FILES
########################################

echo "[*] Removing systemd unit files..."

if [[ -f "$TARGET_SERVICE" ]]; then
    sudo rm -f "$TARGET_SERVICE"
    echo "[OK] Removed: $TARGET_SERVICE"
else
    echo "[INFO] Service file not found: $TARGET_SERVICE (already removed?)"
fi

if [[ -f "$TARGET_TIMER" ]]; then
    sudo rm -f "$TARGET_TIMER"
    echo "[OK] Removed: $TARGET_TIMER"
else
    echo "[INFO] Timer file not found: $TARGET_TIMER (already removed?)"
fi

echo "[*] Reloading systemd manager configuration..."
sudo systemctl daemon-reload
echo "[OK] Systemd reload complete."

########################################
# REMOVE INSTALLED SCRIPTS
########################################

echo "[*] Removing installed scripts..."

if [[ -f "$TARGET_SCRIPT" ]]; then
    sudo rm -f "$TARGET_SCRIPT"
    echo "[OK] Removed: $TARGET_SCRIPT"
else
    echo "[INFO] Firewall script not found: $TARGET_SCRIPT (already removed?)"
fi

if [[ -f "$TARGET_VALIDATOR" ]]; then
    sudo rm -f "$TARGET_VALIDATOR"
    echo "[OK] Removed: $TARGET_VALIDATOR"
else
    echo "[INFO] Validator script not found: $TARGET_VALIDATOR (already removed?)"
fi

########################################
# REMOVE COCKPIT EXTENSION
########################################

echo "[*] Removing Cockpit extension..."

if [[ -d "$COCKPIT_DST" ]]; then
    sudo rm -rf "$COCKPIT_DST"
    echo "[OK] Cockpit extension removed: $COCKPIT_DST"
else
    echo "[INFO] Cockpit extension directory not found: $COCKPIT_DST (already removed?)"
fi

echo "[*] Restarting Cockpit..."
sudo systemctl restart cockpit
echo "[OK] Cockpit restarted."

########################################
# COMPLETION MESSAGE
########################################

echo ""
echo "=============================================="
echo "[SUCCESS] Haas Firewall uninstallation complete."
echo "=============================================="
echo ""
echo "Repo directory and CSV/backups in the repo were NOT removed."
echo ""
exit 0
