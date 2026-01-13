#!/usr/bin/env bash
#
# Haas Appliance - Uninstaller
#

set -euo pipefail

echo "[*] Uninstalling Haas Firewall..."

sudo systemctl stop haas-firewall.service || true
sudo systemctl disable haas-firewall.service || true

sudo systemctl stop haas-firewall.timer || true
sudo systemctl disable haas-firewall.timer || true

sudo rm -f /etc/systemd/system/haas-firewall.service
sudo rm -f /etc/systemd/system/haas-firewall.timer
sudo systemctl daemon-reload

sudo rm -f /usr/local/sbin/configure_ufw_from_csv.sh
sudo rm -f /usr/local/sbin/validate_users_csv.sh

sudo rm -rf /usr/share/cockpit/haas-firewall

sudo rm -f /etc/haas-firewall.conf

echo ""
echo "=============================================="
echo "[SUCCESS] Haas Firewall uninstalled."
echo "=============================================="
echo ""
