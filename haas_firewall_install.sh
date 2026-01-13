#!/usr/bin/env bash
#
# Haas Appliance - Firewall Automation Installer
#
# This script installs and configures the Haas firewall automation:
#   - Installs systemd service and timer
#   - Installs the main firewall script
#   - Installs the CSV validator
#   - Ensures backup directory exists (inside the repo)
#   - Verifies that UFW and the CSV file are present
#   - Installs the Cockpit UI extension
#   - Enables and starts the service and timer
#
# IMPORTANT:
#   - This script assumes it is run from the root of the repo:
#       Haas_Data_collect/
#   - All repo files are resolved relative to the current working directory.
#   - Nothing in the repo is deleted by this script.
#

set -euo pipefail

echo "[*] Starting Haas Firewall installation..."

########################################
# REPO CONTEXT AND FILE PATHS
########################################

# Treat the current working directory as the repo root.
REPO_DIR="$(pwd)"

# Repo-local files
SERVICE_FILE="haas-firewall.service"
TIMER_FILE="haas-firewall.timer"
SCRIPT_FILE="configure_ufw_from_csv.sh"
VALIDATOR_FILE="validate_users_csv.sh"
COCKPIT_DIR="cockpit"
CSV_BASENAME="users.csv"

# System installation locations
TARGET_SCRIPT="/usr/local/sbin/configure_ufw_from_csv.sh"
TARGET_VALIDATOR="/usr/local/sbin/validate_users_csv.sh"
TARGET_SERVICE="/etc/systemd/system/haas-firewall.service"
TARGET_TIMER="/etc/systemd/system/haas-firewall.timer"
COCKPIT_DST="/usr/share/cockpit/haas-firewall"

# Repo-local CSV and backup directory (inside the repo)
CSV_PATH="$REPO_DIR/$CSV_BASENAME"
BACKUP_DIR="$REPO_DIR/backups"

echo "[*] Using repo directory: $REPO_DIR"

########################################
# VERIFY INSTALLER FILES EXIST IN REPO
########################################
# We refuse to proceed if any required file is missing from
# the repo directory. This prevents partial installs.
########################################

echo "[*] Verifying presence of installer files in repo..."

for f in "$SERVICE_FILE" "$TIMER_FILE" "$SCRIPT_FILE" "$VALIDATOR_FILE"; do
    if [[ ! -f "$REPO_DIR/$f" ]]; then
        echo "[ERROR] Missing required file in repo: $REPO_DIR/$f"
        exit 1
    fi
done

# Verify Cockpit directory and files
if [[ ! -d "$REPO_DIR/$COCKPIT_DIR" ]]; then
    echo "[ERROR] Cockpit directory not found in repo: $REPO_DIR/$COCKPIT_DIR"
    exit 1
fi

for f in manifest.json index.html haas-firewall.js icon.png; do
    if [[ ! -f "$REPO_DIR/$COCKPIT_DIR/$f" ]]; then
        echo "[ERROR] Missing Cockpit file in repo: $REPO_DIR/$COCKPIT_DIR/$f"
        exit 1
    fi
done

echo "[OK] All required installer and Cockpit files are present."

########################################
# VERIFY CSV EXISTS IN REPO
########################################
# The design expects users.csv to live in the shared Haas directory,
# which in this repo is the root (Haas_Data_collect/users.csv).
########################################

if [[ ! -f "$CSV_PATH" ]]; then
    echo "[ERROR] CSV file not found at expected repo location:"
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

sudo cp "$REPO_DIR/$SERVICE_FILE" "$TARGET_SERVICE"
sudo cp "$REPO_DIR/$TIMER_FILE" "$TARGET_TIMER"

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

sudo cp "$REPO_DIR/$SCRIPT_FILE" "$TARGET_SCRIPT"
sudo cp "$REPO_DIR/$VALIDATOR_FILE" "$TARGET_VALIDATOR"

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
# ENSURE BACKUP DIRECTORY EXISTS (IN REPO)
########################################
# The firewall script will write CSV backups here on each run.
########################################

echo "[*] Ensuring backup directory exists in repo: $BACKUP_DIR"
mkdir -p "$BACKUP_DIR"

if [[ ! -d "$BACKUP_DIR" ]]; then
    echo "[ERROR] Failed to create backup directory in repo: $BACKUP_DIR"
    exit 1
fi

echo "[OK] Backup directory in repo is ready."

########################################
# INSTALL COCKPIT EXTENSION
########################################
# Cockpit extensions must be installed into:
#   /usr/share/cockpit/<extension-name>/
#
# We copy:
#   $REPO_DIR/cockpit/manifest.json   → /usr/share/cockpit/haas-firewall/
#   $REPO_DIR/cockpit/index.html      → /usr/share/cockpit/haas-firewall/
#   $REPO_DIR/cockpit/haas-firewall.js→ /usr/share/cockpit/haas-firewall/
#   $REPO_DIR/cockpit/icon.png        → /usr/share/cockpit/haas-firewall/
########################################

echo "[*] Installing Cockpit extension..."

sudo mkdir -p "$COCKPIT_DST"
sudo cp "$REPO_DIR/$COCKPIT_DIR"/* "$COCKPIT_DST"/

# Verify installation
for f in manifest.json index.html haas-firewall.js icon.png; do
    if [[ ! -f "$COCKPIT_DST/$f" ]]; then
        echo "[ERROR] Failed to install Cockpit file: $COCKPIT_DST/$f"
        exit 1
    fi
done

echo "[OK] Cockpit extension installed at: $COCKPIT_DST"

echo "[*] Restarting Cockpit to load extension..."
sudo systemctl restart cockpit
echo "[OK] Cockpit restarted."

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
# COMPLETION MESSAGE
########################################

echo ""
echo "=============================================="
echo "[SUCCESS] Haas Firewall installation complete."
echo "=============================================="
echo ""
echo "Repo location:        $REPO_DIR"
echo "CSV in repo:          $CSV_PATH"
echo "Backups directory:    $BACKUP_DIR"
echo "Firewall script:      $TARGET_SCRIPT"
echo "CSV validator:        $TARGET_VALIDATOR"
echo "Systemd service:      $TARGET_SERVICE"
echo "Systemd timer:        $TARGET_TIMER"
echo "Cockpit extension:    $COCKPIT_DST"
echo ""
echo "You can manually test the configuration with:"
echo "  sudo $TARGET_SCRIPT --dry-run"
echo "  sudo $TARGET_SCRIPT --compare"
echo "  sudo $TARGET_SCRIPT --show-rules"
echo ""
exit 0
