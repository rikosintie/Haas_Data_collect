#!/usr/bin/env bash
set -euo pipefail

echo "[*] Installing Haas Firewall Automation..."

SRC_DIR="$(pwd)"

SERVICE_FILE="haas-firewall.service"
TIMER_FILE="haas-firewall.timer"
SCRIPT_FILE="configure_ufw_from_csv.sh"
VALIDATOR_FILE="validate_users_csv.sh"

# Verify required files exist
for f in "$SERVICE_FILE" "$TIMER_FILE" "$SCRIPT_FILE" "$VALIDATOR_FILE"; do
    if [[ ! -f "$SRC_DIR/$f" ]]; then
        echo "[ERROR] Missing required file: $f"
        exit 1
    fi
done

echo "[*] Copying systemd units..."
sudo cp "$SERVICE_FILE" /etc/systemd/system/
sudo cp "$TIMER_FILE" /etc/systemd/system/

echo "[*] Installing firewall script..."
sudo cp "$SCRIPT_FILE" /usr/local/sbin/
sudo chmod +x /usr/local/sbin/configure_ufw_from_csv.sh

echo "[*] Installing CSV validator..."
sudo cp "$VALIDATOR_FILE" /usr/local/sbin/
sudo chmod +x /usr/local/sbin/validate_users_csv.sh

# Verify successful script installation
if [[ ! -x /usr/local/sbin/configure_ufw_from_csv.sh ]]; then
    echo "[ERROR] Failed to install configure_ufw_from_csv.sh"
    exit 1
fi

# Verify successful validator installation
if [[ ! -x /usr/local/sbin/validate_users_csv.sh ]]; then
    echo "[ERROR] Failed to install validate_users_csv.sh"
    exit 1
fi

echo "[*] Script and validator installed successfully."

echo "[*] Reloading systemd..."
sudo systemctl daemon-reload

echo "[*] Enabling firewall service (runs at boot)..."
sudo systemctl enable haas-firewall.service

echo "[*] Starting firewall service now..."
sudo systemctl start haas-firewall.service

echo "[*] Enabling daily timer as backup..."
sudo systemctl enable --now haas-firewall.timer

echo "[*] Removing installer copies from customer directory..."
rm "$SCRIPT_FILE"
rm "$VALIDATOR_FILE"

echo "[*] Installation complete."
echo "[*] The appliance will now manage firewall rules automatically."
