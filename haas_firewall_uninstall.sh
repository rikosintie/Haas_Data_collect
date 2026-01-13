#!/usr/bin/env bash
#
# Haas Appliance - Firewall Automation Uninstaller
#
# Removes:
#   - Systemd service and timer
#   - Installed scripts in /usr/local/sbin
#   - Cockpit extension in /usr/share/cockpit/haas-firewall
#   - /etc/haas-firewall.conf
#
# It does NOT delete:
#   - The repo directory
#   - users.csv or backups inside the repo
#

set -euo pipefail

echo "[*] Uninstalling Haas Firewall..."

########################################
# STOP AND DISABLE SYSTEMD UNITS
########################################

if systemctl list-unit-files | grep -q '^haas-firewall.service'; then
  echo "[*] Stopping haas-firewall.service..."
  sudo systemctl stop haas-firewall.service || true
  sudo systemctl disable haas-firewall.service || true
else
  echo "[INFO] haas-firewall.service not found. Skipping stop/disable."
fi

if systemctl list-unit-files | grep -q '^haas-firewall.timer'; then
  echo "[*] Stopping haas-firewall.timer..."
  sudo systemctl stop haas-firewall.timer || true
  sudo systemctl disable haas-firewall.timer || true
else
  echo "[INFO] haas-firewall.timer not found. Skipping stop/disable."
fi

########################################
# REMOVE SYSTEMD UNIT FILES
########################################

echo "[*] Removing systemd unit files..."

sudo rm -f /etc/systemd/system/haas-firewall.service
sudo rm -f /etc/systemd/system/haas-firewall.timer

sudo systemctl daemon-reload

########################################
# REMOVE INSTALLED SCRIPTS
########################################

echo "[*] Removing installed scripts..."

sudo rm -f /usr/local/sbin/configure_ufw_from_csv.sh
sudo rm -f /usr/local/sbin/validate_users_csv.sh

########################################
# REMOVE COCKPIT EXTENSION
########################################

COCKPIT_DST="/usr/share/cockpit/haas-firewall"

echo "[*] Removing Cockpit extension..."

if [[ -d "$COCKPIT_DST" ]]; then
  sudo rm -rf "$COCKPIT_DST"
  echo "[OK] Cockpit extension removed."
else
  echo "[INFO] Cockpit extension directory not found: $COCKPIT_DST"
fi

echo "[*] Restarting Cockpit..."
sudo systemctl restart cockpit || true

########################################
# REMOVE CONFIG FILE
########################################

CONFIG_FILE="/etc/haas-firewall.conf"

echo "[*] Removing config file: $CONFIG_FILE"
sudo rm -f "$CONFIG_FILE"

########################################
# DONE
########################################

echo ""
echo "=============================================="
echo "[SUCCESS] Haas Firewall uninstalled."
echo "=============================================="
echo ""
echo "Note: Your repo, users.csv, and backups in the repo were NOT removed."
echo ""
