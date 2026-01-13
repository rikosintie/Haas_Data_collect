#!/usr/bin/env bash
set -euo pipefail

echo "[*] Uninstalling Haas Firewall Automation..."

SERVICE_FILE="/etc/systemd/system/haas-firewall.service"
TIMER_FILE="/etc/systemd/system/haas-firewall.timer"
SCRIPT_FILE="/usr/local/sbin/configure_ufw_from_csv.sh"
VALIDATOR_FILE="/usr/local/sbin/validate_users_csv.sh"

echo "[*] Stopping services and timers..."
sudo systemctl stop haas-firewall.service || true
sudo systemctl stop haas-firewall.timer || true

echo "[*] Disabling services and timers..."
sudo systemctl disable haas-firewall.service || true
sudo systemctl disable haas-firewall.timer || true

echo "[*] Removing systemd unit files..."
[[ -f "$SERVICE_FILE" ]] && sudo rm "$SERVICE_FILE"
[[ -f "$TIMER_FILE" ]] && sudo rm "$TIMER_FILE"

echo "[*] Removing installed scripts..."
[[ -f "$SCRIPT_FILE" ]] && sudo rm "$SCRIPT_FILE"
[[ -f "$VALIDATOR_FILE" ]] && sudo rm "$VALIDATOR_FILE"

echo "[*] Reloading systemd..."
sudo systemctl daemon-reload

echo "[*] Uninstallation complete."
echo "[*] Note: users.csv was intentionally preserved."
