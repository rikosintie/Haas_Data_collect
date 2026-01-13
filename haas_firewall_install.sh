#!/usr/bin/env bash
#
# Haas Appliance - Firewall Automation Installer
#
# This script installs and configures the Haas firewall automation:
#   - Installs systemd service and timer
#   - Installs the main firewall script
#   - Installs the CSV validator
#   - Ensures backup directory exists
#   - Verifies that UFW and the CSV file are present
#   - Enables and starts the service and timer
#
# It is designed to be safe, repeatable, and self-verifying.
#

set -euo pipefail

echo "[*] Starting Haas Firewall installation..."

########################################
# INSTALLER CONTEXT
########################################

# Assume this script is run from the directory containing the unit files
# and scripts to be installed.
SRC_DIR="$(pwd)"

SERVICE_FILE="haas-firewall.service"
TIMER_FILE="haas-firewall.timer"
SCRIPT_FILE="configure_ufw_from_csv.sh"
VALIDATOR_FILE="validate_users_csv.sh"

TARGET_SCRIPT="/usr/local/sbin/configure_ufw_from_csv.sh"
TARGET_VALIDATOR="/usr/local/sbin/validate_users_csv.sh"
TARGET_SERVICE="/etc/systemd/system/haas-firewall.service"
TARGET_TIMER="/etc/systemd/system/haas-firewall.timer"

CSV_PATH="/home/mhubbard/Haas_Data_collect/users.csv"
BACKUP_DIR="/home/mhubbard/Haas_Data_collect/backups"

########################################
# VERIFY INSTALLER FILES EXIST
########################################
# We refuse to proceed if any required file is missing from
# the current directory. This prevents partial installs.
########################################

echo "[*] Verifying presence of installer files in: $SRC_DIR"

for f in "$SERVICE_FILE" "$TIMER_FILE" "$SCRIPT_FILE" "$VALIDATOR_FILE"; do
    if [[ ! -f "$SRC_DIR/$f" ]]; then
        echo "[ERROR] Missing required file in installer directory: $f"
        echo "        Ensure all files are present before running this installer."
        exit 1
    fi
done

echo "[OK] All required installer files are present."

########################################
# VERIFY CSV EXISTS
########################################
# The appliance design expects the CSV at a known location.
# If it's missing, we fail early to avoid a broken systemd setup.
########################################

if [[ ! -f "$CSV_PATH" ]]; then
    echo "[ERROR] CSV file not found at expected location:"
    echo "        $CSV_PATH"
    echo "        Create the CSV with header: username,ip_address,role"
    echo "        and re-run the installer."
    exit 1
fi

echo "[OK] Initial CSV file found at: $CSV_PATH"

########################################
# VERIFY UFW IS INSTALLED
########################################
# Firewall automation depends on UFW being installed and available.
########################################

if ! command -v ufw >/dev/null 2>&1; then
    echo "[ERROR] UFW is not installed on this system."
    echo "        Install it with:"
    echo "        sudo apt install ufw"
    exit 1
fi

echo "[OK] UFW is installed."

########################################
# INSTALL SYSTEMD SERVICE AND TIMER
########################################

echo "[*] Installing systemd service and timer..."

sudo cp "$SERVICE_FILE" "$TARGET_SERVICE"
sudo cp "$TIMER_FILE" "$TARGET_TIMER"

# Post-copy verification.
if [[ ! -f "$TARGET_SERVICE" ]]; then
    echo "[ERROR] Service file failed to install to: $TARGET_SERVICE"
    exit 1
fi

if [[ ! -f "$TARGET_TIMER" ]]; then
    echo "[ERROR] Timer file failed to install to: $TARGET_TIMER"
    exit 1
fi

echo "[OK] Systemd service and timer installed."

########################################
# INSTALL FIREWALL SCRIPT AND VALIDATOR
########################################

echo "[*] Installing firewall script and CSV validator..."

sudo cp "$SCRIPT_FILE" "$TARGET_SCRIPT"
sudo cp "$VALIDATOR_FILE" "$TARGET_VALIDATOR"

sudo chmod +x "$TARGET_SCRIPT"
sudo chmod +x "$TARGET_VALIDATOR"

# Verify executability.
if [[ ! -x "$TARGET_SCRIPT" ]]; then
    echo "[ERROR] Firewall script is not executable at: $TARGET_SCRIPT"
    exit 1
fi

if [[ ! -x "$TARGET_VALIDATOR" ]]; then
    echo "[ERROR] CSV validator is not executable at: $TARGET_VALIDATOR"
    exit 1
fi

echo "[OK] Firewall script and validator installed and executable."

########################################
# ENSURE BACKUP DIRECTORY EXISTS
########################################
# The firewall script will write CSV backups here on each run.
########################################

echo "[*] Ensuring backup directory exists: $BACKUP_DIR"
sudo mkdir -p "$BACKUP_DIR"

if [[ ! -d "$BACKUP_DIR" ]]; then
    echo "[ERROR] Failed to create backup directory: $BACKUP_DIR"
    exit 1
fi

echo "[OK] Backup directory is ready."

########################################
# RELOAD SYSTEMD CONFIGURATION
########################################

echo "[*] Reloading systemd manager configuration..."
sudo systemctl daemon-reload

########################################
# ENABLE AND START FIREWALL SERVICE
########################################
# The service is a oneshot unit that applies the firewall configuration
# once on boot (and on demand when manually started).
########################################

echo "[*] Enabling firewall service (haas-firewall.service)..."
sudo systemctl enable haas-firewall.service

echo "[*] Starting firewall service..."
sudo systemctl start haas-firewall.service

# Give systemd a brief moment, then check status.
sleep 1

if ! sudo systemctl is-active --quiet haas-firewall.service; then
    echo "[ERROR] Firewall service failed to start."
    echo "        Use the following command to inspect details:"
    echo "        sudo systemctl status haas-firewall.service --no-pager"
    exit 1
fi

echo "[OK] Firewall service started successfully."

########################################
# ENABLE AND START DAILY TIMER
########################################
# The timer ensures the firewall configuration is refreshed daily.
########################################

echo "[*] Enabling and starting daily timer (haas-firewall.timer)..."
sudo systemctl enable --now haas-firewall.timer

if ! sudo systemctl is-active --quiet haas-firewall.timer; then
    echo "[ERROR] Timer failed to activate."
    echo "        Check with: sudo systemctl status haas-firewall.timer --no-pager"
    exit 1
fi

echo "[OK] Daily timer is active."

########################################
# CLEAN UP INSTALLER WORKING FILES
########################################
# These are no longer needed in the working directory once installed.
########################################

echo "[*] Cleaning up installer directory..."
rm -f "$SCRIPT_FILE" "$VALIDATOR_FILE"

########################################
# COMPLETION MESSAGE
########################################

echo ""
echo "=============================================="
echo "[SUCCESS] Haas Firewall installation complete."
echo "=============================================="
echo ""
echo "The firewall automation is now configured to:"
echo "  - Run at boot via haas-firewall.service"
echo "  - Refresh daily via haas-firewall.timer"
echo ""
echo "You can manually test the configuration with:"
echo "  sudo $TARGET_SCRIPT --dry-run"
echo "  sudo $TARGET_SCRIPT --compare"
echo "  sudo $TARGET_SCRIPT --show-rules"
echo ""
exit 0
