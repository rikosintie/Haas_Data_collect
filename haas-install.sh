#!/usr/bin/env bash
#
# Haas Appliance - Firewall Automation Installer (Config-File Architecture)
#
# This installer:
#   - Requires Internet access to download installation packages!
#   - Assumes it is run from the repo root: Haas_Data_collect/
#   - Detects the repo directory dynamically (can be anywhere)
#   - Writes /etc/haas-firewall.conf with:
#       CSV_PATH, BACKUP_DIR, HAAS_MACHINES_SUBNET_V4, HAAS_MACHINES_SUBNET_V6, SSH_PORT
#   - Copies issue.net to /etc/issue.net (Pre-logon banner)
#   - Installs firewall scripts into /usr/local/sbin
#        build-nmap.sh
#        configure_ufw_from_csv.sh
#        gh-updater.lib.sh
#        install-tools.sh
#        cockpit_samba/list_shares.sh
#        cockpit_samba/list_shares_csv.sh
#        rollback_csv.sh
#        ssh_port.sh
#        tools.yaml
#        update-check.sh
#        update-system.sh
#        validate_users_csv.sh
#   - Installs 90-updates-clean.sh and 99-custom-function.sh into
#     /etc/update-motd.d/ (without the .sh extension, since run-parts
#     ignores filenames containing a dot)
#   - Copies the service files to  /etc/systemd/system/
#      - haas-firewall.service
#      - haas-firewall.timer
#   - Installs systemd firewall service + timer
#   - Installs the Link Layer Discovery Protocol daemon (lldpd) for network visibility
#   - Installs Samba server and updates /etc/samba/smb.conf
#   - Adds the "haas" user to Samba, and creates a "HaasGroup"
#       sets security and creates the "[Haas]" share
#   - Reads initial_users.csv and creates the Linux/Samba users
#   - Installs custom Cockpit extensions:
#       /usr/share/cockpit/haas-firewall          (from cockpit_firewall/)
#       /usr/share/cockpit/haas-samba             (from cockpit_samba/)
#       /usr/share/cockpit/haas-update-appliance  (from cockpit_updates/)
#       /usr/share/cockpit/haas-python            (from cockpit_python/)
#   - Installs the nala package manager
#   - Installs the linux tree command
#   - Installs pip
#   - Runs install-tools.sh to install the CLI tools listed in tools.yaml
#     (csvlens, tspin, bat, fresh, superfile, zoxide, ...)
#   - Populates the zoxide database for the haas user with the
#     appliance's common directories
#   - Creates the backup directory in the repo
#   - Triggers an initial firewall configuration via systemd
#   - Removes the ubuntu ESM and K8 boot messages from the boot menu
#   - Prints an install summary (repo paths, config, UFW rules, zoxide
#     entries) after the reboot-status check, and saves the same summary
#     to $REPO_DIR/haas-firewall-install-summary.txt
#
# It does NOT modify or delete anything inside the repo.
#

# | Color        | Code     | Example in Bash                  |
# | ------------ | -------- | -------------------------------- |
# | Black        | 30       | `\e[30m`                         |
# | Red          | 31       | `\e[31m`                         |
# | Green        | 32       | `\e[32m`                         |
# | Yellow       | 33       | `\e[33m`                         |
# | Blue         | 34       | `\e[34m`                         |
# | Magenta      | 35       | `\e[35m`                         |
# | Cyan         | 36       | `\e[36m`                         |
# | White        | 37       | `\e[37m`                         |
# | Bold/Intense | add `1;` | e.g., `\e[1;33m` for bold yellow |


    # color scheme
    # Import Message text → bold red
    # Header text → bold cyan
    # Share paths → bold green
    # Failure message → bold yellow
    # Everything else → normal

# Colors
CYAN="\e[1;36m" # ${CYAN}
GREEN="\e[1;32m" # ${GREEN}
YELLOW="\e[1;33m" # ${YELLOW}
RED="\e[1;31m" # ${RED}
RESET="\e[0m" # ${RESET}

# Check for root FIRST
if [[ $EUID -ne 0 ]]; then
  echo -e "${RED}[ERROR] This script must be run as root${RESET}" >&2
  exit 1
fi

# Render a bordered, self-aligning banner. Each argument is one content
# line and may include color vars (${CYAN}, ${RESET}, etc). Box width is
# derived from the longest line's visible width (color escapes stripped),
# so it can never fall out of alignment the way hand-padded boxes did.
# Pass the literal string "---" as an argument to draw a full-width
# dashed divider row instead of a text row.
banner() {
    local -a msgs=("$@")
    local -a clean
    local msg c len max=0 width border blank sep i pad padstr

    for msg in "${msgs[@]}"; do
        if [[ "$msg" == "---" ]]; then
            clean+=("")
            continue
        fi
        c=$(echo -e "$msg" | sed -E 's/\x1b\[[0-9;]+m//g')
        clean+=("$c")
        len=${#c}
        if (( len > max )); then
            max=$len
        fi
    done

    width=$(( max + 4 ))

    printf -v border '%*s' "$(( width + 2 ))" ''
    border=${border// /#}

    printf -v blank '%*s' "$width" ''
    blank="#${blank}#"

    printf -v sep '%*s' "$width" ''
    sep="#${sep// /-}#"

    echo "$border"
    echo "$blank"
    for i in "${!msgs[@]}"; do
        if [[ "${msgs[$i]}" == "---" ]]; then
            echo "$sep"
            continue
        fi
        pad=$(( max - ${#clean[$i]} + 2 ))
        printf -v padstr '%*s' "$pad" ''
        echo -e "#  ${msgs[$i]}${padstr}#"
    done
    echo "$blank"
    echo "$border"
}

fix_var_log_perms() {
    perms=$(stat -c "%a" /var/log)
    owner=$(stat -c "%U" /var/log)
    group=$(stat -c "%G" /var/log)

    if [[ "$perms" != "755" || "$owner" != "root" || "$group" != "syslog" ]]; then
        echo "[FIX] /var/log was $owner:$group $perms → correcting to root:syslog 755"
        sudo chown root:syslog /var/log
        sudo chmod 755 /var/log
    else
        echo ""
        banner "${CYAN}[*] [OK] /var/log permissions correct...${RESET}"
        echo ""
        echo ""
        # echo "[OK] /var/log permissions correct"
    fi
}

########################################
# PRE-FLIGHT: confirm users.csv / initial_users.csv are correct
# for THIS appliance before anything is actually installed.
########################################
echo ""
echo ""
banner "${YELLOW}[!] BEFORE YOU CONTINUE${RESET}" "---" "${CYAN}Review and update these two files for THIS appliance:${RESET}" "${GREEN}  users.csv${RESET}" "${GREEN}  initial_users.csv${RESET}" "---" "${YELLOW}Ctrl+C will stop this installer right now, before anything${RESET}" "${YELLOW}is installed or changed, so you can go edit them.${RESET}"
echo ""
read -rp "Press Enter to continue once these files are correct for this appliance... "
echo ""

# === remove the ubuntu ESM and K8 boot messages ======
# Disable these scripts (skip any that don't exist on this image)
for f in 90-updates-available 50-motd-news 80-livepatch 91-contract-ua-esm-status; do
    if [[ -f "/etc/update-motd.d/$f" ]]; then
        sudo chmod -x "/etc/update-motd.d/$f"
    fi
done

set -euo pipefail

echo "[*] Starting Haas Firewall installation..."

# Ensure noble-updates is in sources (may be missing on Raspberry Pi Ubuntu images)
if ! grep -q "noble-updates" /etc/apt/sources.list.d/ubuntu.sources; then
    echo "noble-updates not found, adding to sources..."
    sudo sed -i 's/Suites: noble$/Suites: noble noble-updates/' /etc/apt/sources.list.d/ubuntu.sources
fi

echo ""
echo ""
banner "${CYAN}[*]   DETECT REPO DIRECTORY ${RESET}"
echo ""
REPO_DIR="$(pwd)"
REPO_NAME="$(basename "$REPO_DIR")"

if [[ "$REPO_NAME" != "Haas_Data_collect" ]]; then
    echo "[WARNING] Repo root is expected to be named 'Haas_Data_collect', but got: '$REPO_NAME'"
    echo "          Proceeding anyway, using current directory as repo root."
fi

echo ""
banner "${CYAN}[*] Repo directory detected as: $REPO_DIR ${RESET}"
echo ""
sleep 3

BACKUP_DIR="$REPO_DIR/backups"
COCKPIT_SRC="$REPO_DIR/cockpit_firewall"
COCKPIT_UPDATE_SRC="$REPO_DIR/cockpit_updates"
COCKPIT_SAMBA_SRC="$REPO_DIR/cockpit_samba"
COCKPIT_PYTHON_SRC="$REPO_DIR/cockpit_python"
CSV_PATH="$REPO_DIR/users.csv"


REQUIRED_FILES=(
  "build-nmap.sh"
  "configure_ufw_from_csv.sh"
  "gh-updater.lib.sh"
  "install-tools.sh"
  "issue.net"
  "cockpit_samba/list_shares.sh"
  "cockpit_samba/list_shares_csv.sh"
  "rollback_csv.sh"
  "ssh_port.sh"
  "tools.yaml"
  "update-check.sh"
  "update-system.sh"
  "validate_users_csv.sh"
  "haas-firewall.service"
  "haas-firewall.timer"
  "99-custom-function.sh"
  "90-updates-clean.sh"
  "lshares.sh"
  "manage_users.sh"
  "smb_verify.sh"
  "ssh_validate.sh"
)

echo ""
banner "${CYAN}[*] Verifying required files in repo...${RESET}"
echo ""
echo ""
for f in "${REQUIRED_FILES[@]}"; do
  if [[ ! -f "$REPO_DIR/$f" ]]; then
    echo "[ERROR] Missing required file: $REPO_DIR/$f"
    exit 1
  else
      echo -e "✅ ${CYAN}Success: $REPO_DIR/$f is valid.${RESET}"
      sleep 2
  fi
done
echo ""
echo ""
if [[ ! -f "$CSV_PATH" ]]; then
  banner "${RED}[ERROR] CSV file not found at: $CSV_PATH${RESET}" "${CYAN}Create users.csv with header: username,ip_address,role${RESET}"
  sleep 3
  exit 1
fi

if [[ ! -d "$COCKPIT_SRC" ]]; then
  banner "${YELLOW}[ERROR] Cockpit directory missing:${RESET}${CYAN} $COCKPIT_SRC ${RESET}"
  exit 1
fi

for f in manifest.json index.html haas-firewall.js haas-firewall.css icon.png; do
  if [[ ! -f "$COCKPIT_SRC/$f" ]]; then
    banner "${YELLOW}[ERROR] Missing Cockpit file:${RESET}${CYAN} $COCKPIT_SRC/$f ${RESET}"
    exit 1
  fi
done
echo ""
echo ""

if [[ ! -d "$COCKPIT_UPDATE_SRC" ]]; then
  banner "${YELLOW}[ERROR] Cockpit Update directory missing:${RESET}${CYAN} $COCKPIT_UPDATE_SRC ${RESET}"
  exit 1
fi

for f in manifest.json index.html update.css update.js; do
  if [[ ! -f "$COCKPIT_UPDATE_SRC/$f" ]]; then
    banner "${YELLOW}[ERROR] Missing Cockpit Update file:${RESET}${CYAN} $COCKPIT_UPDATE_SRC/$f ${RESET}"
    exit 1
  fi
done

if [[ ! -d "$COCKPIT_PYTHON_SRC" ]]; then
  banner "${YELLOW}[ERROR] Cockpit Python directory missing:${RESET}${CYAN} $COCKPIT_PYTHON_SRC ${RESET}"
  exit 1
fi

for f in manifest.json index.html haas-python.css haas-python.js; do
  if [[ ! -f "$COCKPIT_PYTHON_SRC/$f" ]]; then
    banner "${YELLOW}[ERROR] Missing Cockpit Python file:${RESET}${CYAN} $COCKPIT_PYTHON_SRC/$f ${RESET}"
    exit 1
  fi
done


echo ""
banner "✅ ${CYAN}All required repo files are present.${RESET}"
sleep 2
echo ""
echo ""
sleep 3
########################################
# WRITE CONFIG FILE
########################################

CONFIG_FILE="/etc/haas-firewall.conf"
echo ""
banner "${CYAN}[*] Writing config file: $CONFIG_FILE${RESET}"
echo ""
sudo bash -c "cat > '$CONFIG_FILE'" <<EOF
# Haas Firewall Appliance Configuration
# Generated by haas-install.sh
#
# CSV_PATH:
#   Path to the users.csv file that controls firewall rules.
#
# BACKUP_DIR:
#   Directory where CSV backups will be stored.
#
# HAAS_MACHINES_SUBNET_V4 / HAAS_MACHINES_SUBNET_V6:
#   Optional subnets for Haas CNC machines.
#   If left empty, no subnet-wide Haas rules are applied.
#   Example:
#     HAAS_MACHINES_SUBNET_V4="192.168.10.0/24"

CSV_PATH="$CSV_PATH"
BACKUP_DIR="$BACKUP_DIR"

HAAS_MACHINES_SUBNET_V4=""
HAAS_MACHINES_SUBNET_V6=""
SSH_PORT="22"
EOF

sudo chmod 644 "$CONFIG_FILE"
echo ""
echo ""
banner "✅ ${CYAN}Firewall Config file written.${RESET}"
echo ""
echo ""

########################################
# INSTALL SCRIPTS
########################################

echo ""
echo ""
banner "${CYAN}[*] Installing appliance scripts into /usr/local/sbin...${RESET}"
echo ""
echo ""

# check /var/log permissions and fix if needed (prevents issues with logging from scripts)
fix_var_log_perms

sudo cp "$REPO_DIR/build-nmap.sh" /usr/local/sbin/
sudo cp "$REPO_DIR/configure_ufw_from_csv.sh" /usr/local/sbin/
sudo cp "$REPO_DIR/gh-updater.lib.sh" /usr/local/sbin/
sudo cp "$REPO_DIR/install-tools.sh" /usr/local/sbin/
sudo cp "$REPO_DIR/issue.net" /etc/issue.net
sudo cp "$REPO_DIR/cockpit_samba/list_shares.sh" /usr/local/sbin
sudo cp "$REPO_DIR/cockpit_samba/list_shares_csv.sh" /usr/local/sbin
sudo cp "$REPO_DIR/rollback_csv.sh" /usr/local/sbin/
sudo cp "$REPO_DIR/ssh_port.sh" /usr/local/sbin
sudo cp "$REPO_DIR/tools.yaml" /usr/local/sbin/
sudo cp "$REPO_DIR/update-check.sh" /usr/local/sbin/
sudo cp "$REPO_DIR/update-system.sh" /usr/local/sbin/
sudo cp "$REPO_DIR/validate_users_csv.sh" /usr/local/sbin/
sudo cp "$REPO_DIR/90-updates-clean.sh" /etc/update-motd.d/90-updates-clean
sudo cp "$REPO_DIR/99-custom-function.sh" /etc/update-motd.d/99-custom-function

########################################
# Create custom SSH hardening config
########################################
echo ""
echo ""
banner "${CYAN}Updating /etc/ssh/sshd_config.d/99-haas-hardening.conf${RESET}"
echo ""
echo ""
# remove existing file if it exists.
sudo rm -f /etc/ssh/sshd_config.d/99-haas-hardening.conf
# Create a custom ssh options file for hardening
sudo tee /etc/ssh/sshd_config.d/99-haas-hardening.conf > /dev/null << 'EOF'
#pre-authentication login banner
Banner /etc/issue.net
ChallengeResponseAuthentication no
LogLevel VERBOSE
PasswordAuthentication yes
PermitEmptyPasswords no
PermitRootLogin no
PubkeyAuthentication yes
X11Forwarding no
Port 22

# Crypto hardening
Protocol 2
MACs hmac-sha2-256-etm@openssh.com,hmac-sha2-512-etm@openssh.com,umac-128-etm@openssh.com
KexAlgorithms curve25519-sha256,curve25519-sha256@libssh.org
HostKeyAlgorithms ssh-ed25519,ssh-ed25519-cert-v01@openssh.com
PubkeyAcceptedAlgorithms ssh-ed25519,ssh-ed25519-cert-v01@openssh.com
GSSAPIAuthentication no

# Attack surface reduction
AllowAgentForwarding no
AllowTcpForwarding no
PermitTunnel no
PermitUserEnvironment no
PermitUserRC no
GatewayPorts no
Compression no

# Authentication behavior
MaxAuthTries 3
MaxSessions 2
LoginGraceTime 30
PrintLastLog yes
PrintMotd no
StrictModes yes
EOF

sudo systemctl restart ssh

# Verify the banner setting in sshd_config
if [ -f /etc/issue.net ] && grep -q "^Banner" /etc/ssh/sshd_config.d/99-haas-hardening.conf && sudo sshd -t; then
    echo ""
    echo ""
    banner "✅ ${CYAN}Success: /etc/issue.net exists and SSH config is valid.${RESET}"
    echo ""
    echo ""
else
    echo ""
    echo ""
    banner "❌ ${RED}Error: Missing file or invalid SSH config!${RESET}"
    echo ""
    echo ""

    [ ! -f /etc/issue.net ] && echo "   -> /etc/issue.net is missing."
    ! grep -q "^Banner" /etc/ssh/sshd_config.d/99-haas-hardening.conf && echo "   -> Banner line not found in config."
    ! sudo sshd -t && echo "   -> sshd syntax error detected."
    exit 1
fi
sleep 3

#########################################
# Add execute permission to scripts
#########################################

sudo chmod +x /usr/local/sbin/build-nmap.sh
sudo chmod +x /usr/local/sbin/configure_ufw_from_csv.sh
sudo chmod +x /usr/local/sbin/gh-updater.lib.sh
sudo chmod +x /usr/local/sbin/install-tools.sh
sudo chmod +x /usr/local/sbin/list_shares.sh
sudo chmod +x /usr/local/sbin/list_shares_csv.sh
sudo chmod +x /usr/local/sbin/rollback_csv.sh
sudo chmod +x /usr/local/sbin/ssh_port.sh
sudo chmod +x /usr/local/sbin/update-check.sh
sudo chmod +x /usr/local/sbin/update-system.sh
sudo chmod +x /usr/local/sbin/validate_users_csv.sh
sudo chmod +x /etc/update-motd.d/90-updates-clean
sudo chmod +x /etc/update-motd.d/99-custom-function

# scripts in the Haas_Data_collect repo (not copied to /usr/local/sbin)
sudo chmod +x "$REPO_DIR/setup_zsh.sh"
sudo chmod +x "$REPO_DIR/haas_firewall_uninstall.sh"
sudo chmod +x "$REPO_DIR/lshares.sh"
sudo chmod +x "$REPO_DIR/manage_users.sh"
sudo chmod +x "$REPO_DIR/smb_verify.sh"
sudo chmod +x "$REPO_DIR/ssh_port.sh"
sudo chmod +x "$REPO_DIR/ssh_validate.sh"


if [[ ! -x /usr/local/sbin/configure_ufw_from_csv.sh ]]; then
  echo ""
  echo ""
  banner "⚠️ ${YELLOW}Failed to install configure_ufw_from_csv.sh${RESET}"
  echo ""
  echo ""
  exit 1
fi

if [[ ! -x /usr/local/sbin/validate_users_csv.sh ]]; then

  echo ""
  echo ""
  banner "⚠️ ${YELLOW}Failed to install validate_users_csv.sh${RESET}"
  echo ""
  echo ""
  exit 1
fi
sleep 3
echo ""
echo ""
banner "✅ ${CYAN}Firewall scripts installed.${RESET}"
echo ""
echo ""
sleep 3

########################################
# INSTALL SYSTEMD Firewall UNITS
########################################
echo ""
echo ""
banner "${CYAN}Installing systemd service and timer...${RESET}"
echo ""
echo ""
sleep 3

sudo cp "$REPO_DIR/haas-firewall.service" /etc/systemd/system/
sudo cp "$REPO_DIR/haas-firewall.timer" /etc/systemd/system/

sudo systemctl daemon-reload

sudo systemctl enable haas-firewall.service
sudo systemctl enable --now haas-firewall.timer
echo ""
echo ""
banner "✅ ${CYAN}Systemd service and timer installed and enabled.${RESET}"
echo ""
echo ""
sleep 3

################################################################################

########################################
# Install CLI tools from tools.yaml (csvlens, tspin, bat, fresh, spf, ...)
########################################
echo ""
echo ""
banner "${CYAN}Installing CLI tools from tools.yaml...${RESET}"
echo ""
echo ""

if sudo /usr/local/sbin/install-tools.sh; then
    echo ""
    echo ""
    banner "✅ ${CYAN}CLI tools installed.${RESET}"
    echo ""
    echo ""
else
    echo ""
    echo ""
    banner "⚠️ ${YELLOW}One or more CLI tools failed to install. Continuing...${RESET}"
    echo ""
    echo ""
fi
sleep 3

########################################
# Install Nala package manager
########################################
echo ""
echo ""
banner "${CYAN}Installing the Nala Package Manager...${RESET}"
echo ""
echo ""

if sudo apt install nala -y; then
    NALA_VERSION=$(nala --version)
    sudo nala upgrade -y
    echo ""
    echo ""
    banner "✅ ${CYAN}$NALA_VERSION installed...${RESET}"
    echo ""
    echo ""
    sleep 3
else
    echo ""
    echo ""
    banner "❌ ${RED}Failed to install the Nala package manager.${RESET}" "${YELLOW}Cannot continue — tree, lldpd, pip, inetutils-traceroute, and Cockpit all install via nala.${RESET}"
    echo ""
    echo ""
    exit 1
fi
sleep 5

################################################################################

if sudo nala install tree -y; then
    TREE_VERSION=$(tree --version | head -n1 | awk '{print $2}')
    sudo nala upgrade -y
    echo ""
    echo ""
    banner "✅ ${CYAN}Tree $TREE_VERSION installed...${RESET}"
    echo ""
    echo ""
    sleep 3
else
    echo ""
    echo ""
    banner "⚠️ ${YELLOW}Failed to install the tree command. Skipping...${RESET}"
    echo ""
    echo ""
fi

################################################################################

if sudo nala install lldpd -y; then
    LLDPD_VERSION=$(lldpd -v | head -n1 | awk '{print $1}')
    sudo nala upgrade -y
    echo ""
    echo ""
    banner "✅ ${CYAN}LLDPD $LLDPD_VERSION installed...${RESET}"
    echo ""
    echo ""
    sleep 3
else
    echo ""
    echo ""
    banner "⚠️ ${YELLOW}Failed to install the lldpd command. Skipping...${RESET}"
    echo ""
    echo ""
fi

################################################################################

echo ""
echo ""
banner "${CYAN}Installing Python pip package${RESET}"
echo ""
echo ""

if sudo nala install python3-pip -y; then
    PIP_VERSION=$(python3 -m pip --version | head -n1 | awk '{print $2}')
    echo ""
    echo ""
    banner "✅ ${CYAN}Python pip $PIP_VERSION installed...${RESET}"
    echo ""
    echo ""
    sleep 3
else
    echo ""
    echo ""
    banner "⚠️ ${YELLOW}Failed to install Python pip. Skipping...${RESET}"
    echo ""
    echo ""
fi

########################################
# Install micro text editor
########################################
echo ""
echo ""
banner "${CYAN}Installing the Micro cli text editor${RESET}"
echo ""
echo ""

if sudo nala install micro -y; then
    MICRO_VERSION=$(micro --version)
    echo ""
    echo ""
    banner "✅ ${CYAN}micro text editor $MICRO_VERSION installed${RESET}"
    echo ""
    echo ""
else
    echo ""
    echo ""
    banner "⚠️ ${YELLOW}Failed to install micro cli text editor. Continuing Script...${RESET}"
    echo ""
    echo ""
fi

########################################
# Install inetutils-traceroute
########################################
echo ""
echo ""
banner "${CYAN}Installing inetutils-traceroute${RESET}"
echo ""
echo ""
if sudo nala install inetutils-traceroute -y; then
    echo ""
    echo ""
    banner "✅ ${CYAN}inetutils-traceroute installed${RESET}"
    echo ""
    echo ""
sleep 3
else
    echo ""
    echo ""
    banner "⚠️ ${YELLOW}Failed to install inetutils. Continuing script${RESET}"
    echo ""
    echo ""
fi

########################################
# Install Samba Server
########################################
echo ""
echo ""
banner "${CYAN}Installing Samba Server${RESET}"
echo ""
echo ""

# Install Samba
if sudo nala install samba -y; then
    echo ""
    echo ""
    banner "✅ ${CYAN}Samba Server installed successfully${RESET}"
    echo ""
    echo ""

    # Enable and start Samba services
    sudo systemctl enable --now smbd

    # Create the HaasGroup
    echo ""
    echo ""
    banner "${CYAN}Creating the Linux HaasGroup${RESET}"
    echo ""
    echo ""
    sudo groupadd HaasGroup 2>/dev/null || echo "HaasGroup already exists"

    # Create the haas user and add to HaasGroup
    echo ""
    echo ""
    banner "${CYAN}Creating the Linux haas user and adding HaasGroup${RESET}"
    echo ""
    echo ""
    sudo useradd -m -G HaasGroup haas 2>/dev/null || echo "User haas already exists"

# Add hass user to Samba HaasGroup
echo ""
echo ""
banner "${CYAN}Add haas user to Samba${RESET}"
echo ""
if pdbedit -L | cut -d: -f1 | grep -qx "haas"; then
    echo "Samba user haas already exists."

else
    echo "Creating Samba user haas"
    sudo smbpasswd -a "haas" || {
        echo "Error adding user to Samba database haas." >&2
        exit 1
    }
fi

# Ensure Samba account is enabled
sudo smbpasswd -e "haas" || {
    echo "Error enabling Samba account for haas." >&2
    exit 1
}

# Add user to HaasGroup
if getent group "HaasGroup" > /dev/null; then
    sudo usermod -aG "HaasGroup" "haas" || {
        echo "Warning: Failed to add haas to HaasGroup" >&2
    }
else
    echo "Warning: Group HaasGroup does not exist. Skipping group assignment."
fi
echo "Configuration complete for haas"
echo "User info:"
id "haas"

    # Read users from initial_users.csv and create them
    USER_FILE="$REPO_DIR/initial_users.csv"

    if [ -f "$USER_FILE" ]; then
        echo "Reading users from $USER_FILE"

        # Skip header line and read username and password columns
        tail -n +2 "$USER_FILE" | while IFS=',' read -r username password; do
            # Trim whitespace
            username=$(echo "$username" | xargs)
            password=$(echo "$password" | xargs)

            if [ -n "$username" ] && [ -n "$password" ]; then
                echo ""
                banner "${CYAN}Creating user: $username       ${RESET}"
                # Create system user and add to HaasGroup. -M don't create home directory.
                # -s /usr/sbin/nologin" No login shell, user is just for Samaba access.
                sudo useradd -M -G HaasGroup -s /usr/sbin/nologin "$username" 2>/dev/null || echo "User $username already exists"

                # Add user to HaasGroup (in case they existed but weren't in the group)
                sudo usermod -aG HaasGroup "$username"

                # Set Samba password non-interactively
                echo -e "$password\n$password" | sudo smbpasswd -a "$username" -s
                echo ""
                banner "${CYAN}User $username created with Samba access  ${RESET}"
                echo ""
            fi
        done

        echo ""
        echo ""
        banner "${CYAN}All users from initial_users.csv have been processed${RESET}" "---" "${RED}IMPORTANT${RESET}: Delete $USER_FILE now for security!"
        echo ""
        echo ""
        sleep 5
    else
        echo ""
        echo ""
        banner "${YELLOW}Warning: initial_users.csv not found at $USER_FILE${RESET}" "---" "${CYAN}Skipping initial user creation${RESET}"
        echo ""
        echo ""
    fi

    # Create the share directory
    sudo mkdir -p /home/haas/Haas_Data_collect
    sudo chown haas:HaasGroup /home/haas/Haas_Data_collect
    sudo chmod 2775 /home/haas/Haas_Data_collect

    # Backup original smb.conf
    sudo cp /etc/samba/smb.conf /etc/samba/smb.conf.backup

    # Create new smb.conf with security hardening
    sudo tee /etc/samba/smb.conf > /dev/null <<EOF
[global]
    workgroup = WORKGROUP
    server string = Haas Data Collector (Samba, Ubuntu)
    server role = standalone server

    # Logging
    log file = /var/log/samba/log.%m
    max log size = 10000
    logging = file
    log level = 3 auth:10
    panic action = /usr/share/samba/panic-action %d

    # Authentication
    map to guest = Never
    ntlm auth = ntlmv2-only

    # Protocol Security - Force SMB2/SMB3 only
    client min protocol = SMB2
    client max protocol = SMB3
    server min protocol = SMB2
    server max protocol = SMB3

    # Network
    # interfaces = eth0
    # bind interfaces only = Yes
    socket options = TCP_NODELAY IPTOS_LOWDELAY

    # Disable unused services
    disable netbios = Yes
    disable spoolss = Yes
    load printers = No
    printing = bsd
    printcap name = /dev/null


[Haas]
    comment = Haas Data Collection Share
    path = /home/haas/Haas_Data_collect
    browseable = Yes
    writable = Yes
    public = No
    valid users = @HaasGroup, haas
    force user = haas
    force group = HaasGroup
    create mask = 0664
    force create mode = 0664
    directory mask = 0775
    force directory mode = 0775
EOF

    # Test the configuration
    if sudo testparm -s /etc/samba/smb.conf > /dev/null 2>&1; then
        echo ""
        echo ""
        banner "${CYAN}Samba configuration is valid${RESET}"
        echo ""
        echo ""
    else
        echo ""
        echo ""
        banner "${YELLOW}Warning: Samba configuration may have issues${RESET}" "---" "${CYAN}Running testparm for details:${RESET}"
        echo ""
        echo ""
        sudo testparm -s /etc/samba/smb.conf
    fi

    # Restart Samba to apply changes
    sudo systemctl restart smbd

    echo ""
    echo ""
    banner "${RED}Samba configured with security hardening:${RESET}" "---" "${CYAN} - SMBv2/SMBv3 only, no SMBv1${RESET}" "---" "${CYAN} - NetBIOS disabled${RESET}" "---" "${CYAN} - Printing disabled${RESET}"
    echo ""
    echo ""

    IP_ADDR=$(hostname -I | awk '{print $1}')
    share="\\\\$IP_ADDR\\Haas"
    sharenix="smb://$IP_ADDR/Haas"


banner "${CYAN}✔ Samba share 'Haas' configured successfully${RESET}" "${CYAN}Share for Windows is available at${RESET} ${GREEN}${share}${RESET}" "${CYAN}Share for Mac/Linux is available at${RESET} ${GREEN}${sharenix}${RESET}"
sleep 5
else
    echo ""
    echo ""
    banner "${YELLOW}⚠️ Failed to install Samba Server${RESET}"
    echo ""
    echo ""
    exit 1
fi
sleep 5

echo ""
echo ""
banner "${CYAN}Installing Samba Client${RESET}"
echo ""
echo ""
if sudo nala install smbclient -y; then
    echo ""
    echo ""
    banner "${CYAN}✅ Samba Client installed successfully${RESET}"
    echo ""
    echo ""
fi
echo ""


echo ""
banner "${CYAN}Installing Redhat Cockpit for management${RESET}"
echo ""
echo ""

# Install Cockpit
if sudo nala install cockpit cockpit-pcp -y; then

    # Enable and start Cockpit
    sudo systemctl enable --now cockpit.socket
    sudo systemctl restart cockpit
    echo ""
    echo ""
    banner "${CYAN}✅ Cockpit installed successfully${RESET}" "${CYAN}Cockpit is running at${RESET}${GREEN} https://$(hostname -I | awk '{print $1}'):9090${RESET}"
    echo ""
    echo ""
else
    echo ""
    echo ""
    banner "${YELLOW}⚠️ Failed to install Cockpit${RESET}" "${CYAN}Review the messages on screen and troubleshoot with chatGPT${RESET}" "${CYAN}The script will continue, Cockpit is not needed for script functionality${RESET}"
    echo ""
    echo ""
fi
sleep 3

########################################
# INSTALL COCKPIT FIREWALL EXTENSION
########################################

COCKPIT_DST="/usr/share/cockpit/haas-firewall"

echo ""
echo ""
banner "${CYAN}Installing Cockpit Firewall extension to $COCKPIT_DST...${RESET}"
echo ""
echo ""

sudo mkdir -p "$COCKPIT_DST"
sudo cp "$COCKPIT_SRC"/* "$COCKPIT_DST"/

echo ""
echo ""
banner "${CYAN}[*] Restarting Cockpit...${RESET}"
echo ""
echo ""

sudo systemctl restart cockpit

if [[ -f "$COCKPIT_DST/index.html" ]]; then

echo ""
echo ""
banner "${CYAN}✅ Cockpit Firewall extension installed and Cockpit restarted.${RESET}"
echo ""
echo ""

else
echo ""
echo ""
banner "${YELLOW} ⚠️ Cockpit Firewall extension not installed.${RESET}"
echo ""
echo ""
fi
sleep 3

echo ""
echo ""


########################################
# INSTALL COCKPIT UPDATES EXTENSION
########################################


COCKPIT_UPDATE_DST="/usr/share/cockpit/haas-update-appliance"

echo ""
echo ""
banner "${CYAN}Installing Cockpit Update extension to $COCKPIT_UPDATE_DST...${RESET}"
echo ""
echo ""

sudo mkdir -p "$COCKPIT_UPDATE_DST"
sudo cp "$COCKPIT_UPDATE_SRC"/* "$COCKPIT_UPDATE_DST"/

echo ""
echo ""
banner "${CYAN}[*] Restarting Cockpit...${RESET}"
echo ""
echo ""

sudo systemctl enable --now cockpit.socket
sudo systemctl restart cockpit
sudo systemctl restart cockpit.socket

if [[ -f "$COCKPIT_UPDATE_DST/index.html" ]]; then

echo ""
echo ""
banner "${CYAN}✅ Cockpit extension Update installed and Cockpit restarted.${RESET}"
echo ""
echo ""

else
echo ""
echo ""
banner "${YELLOW} ⚠️ Cockpit Update extension not installed.${RESET}"
echo ""
echo ""
fi
sleep 3

########################################
# INSTALL COCKPIT PYTHON EXTENSION
########################################


COCKPIT_PYTHON_DST="/usr/share/cockpit/haas-python"

echo ""
echo ""
banner "${CYAN}Installing Cockpit Python extension to $COCKPIT_PYTHON_DST...${RESET}"
echo ""
echo ""

sudo mkdir -p "$COCKPIT_PYTHON_DST"
sudo cp "$COCKPIT_PYTHON_SRC"/* "$COCKPIT_PYTHON_DST"/

echo ""
echo ""
banner "${CYAN}[*] Restarting Cockpit...${RESET}"
echo ""
echo ""

sudo systemctl enable --now cockpit.socket
sudo systemctl restart cockpit
sudo systemctl restart cockpit.socket

if [[ -f "$COCKPIT_PYTHON_DST/index.html" ]]; then

echo ""
echo ""
banner "${CYAN}✅ Cockpit extension Python installed and Cockpit restarted.${RESET}"
echo ""
echo ""

else
echo ""
echo ""
banner "${YELLOW} ⚠️ Cockpit Python extension not installed.${RESET}"
echo ""
echo ""
fi
sleep 3

########################################
# INSTALL COCKPIT SAMBA EXTENSION
########################################

COCKPIT_SAMBA_DST="/usr/share/cockpit/haas-samba"

echo ""
echo ""
banner "${CYAN}Installing Cockpit Samba extension to $COCKPIT_SAMBA_DST...${RESET}"
echo ""
echo ""

sudo mkdir -p "$COCKPIT_SAMBA_DST"
sudo cp "$COCKPIT_SAMBA_SRC"/{index.html,samba.js,samba.css,manifest.json} "$COCKPIT_SAMBA_DST"/

echo ""
echo ""
banner "${CYAN}[*] Restarting Cockpit...${RESET}"
echo ""
echo ""

sudo systemctl restart cockpit

if [[ -f "$COCKPIT_SAMBA_DST/index.html" ]]; then

echo ""
echo ""
banner "${CYAN}✅ Cockpit extension SAMBA installed and Cockpit restarted.${RESET}"
echo ""
echo ""

else
echo ""
echo ""
banner "${YELLOW} ⚠️ Cockpit SAMBA extension not installed.${RESET}"
echo ""
echo ""
fi
sleep 3

########################################
# CUSTOMIZE COCKPIT LOGIN PAGE BRANDING
########################################
echo ""
echo ""
banner "${CYAN}[*] Customizing Cockpit login page branding...${RESET}"
echo ""
echo ""

# $ID (e.g. "ubuntu") takes precedence over cockpit's built-in "default"/
# "static" branding tiers, so dropping our files there is guaranteed to
# win regardless of what the distro ships out of the box. See:
# https://github.com/cockpit-project/cockpit/blob/main/doc/branding.md
COCKPIT_OS_ID=$( . /etc/os-release && echo "$ID" )
COCKPIT_BRANDING_DST="/usr/share/cockpit/branding/${COCKPIT_OS_ID:-default}"

sudo mkdir -p "$COCKPIT_BRANDING_DST"
sudo cp "$REPO_DIR/docs/manage_the_appliance/img/tux_terminal1.resized.jpg" "$COCKPIT_BRANDING_DST/background.jpg"

sudo tee "$COCKPIT_BRANDING_DST/branding.css" > /dev/null << 'BRANDING_EOF'
/* Haas CNC Data Collection Appliance — custom Cockpit login branding */

html body.login-pf {
    background: url("background.jpg");
    background-size: cover;
    background-position: center;
}

#brand::before {
    content: "Haas CNC Data Collection Appliance";
}
BRANDING_EOF

sudo chown root:root "$COCKPIT_BRANDING_DST/background.jpg" "$COCKPIT_BRANDING_DST/branding.css"
sudo chmod 644 "$COCKPIT_BRANDING_DST/background.jpg" "$COCKPIT_BRANDING_DST/branding.css"
sudo systemctl restart cockpit

if [[ -f "$COCKPIT_BRANDING_DST/branding.css" ]]; then
    echo ""
    echo ""
    banner "${CYAN}✅ Cockpit login branding installed → $COCKPIT_BRANDING_DST${RESET}"
    echo ""
    echo ""
else
    echo ""
    echo ""
    banner "${YELLOW}⚠️ Cockpit login branding not installed.${RESET}"
    echo ""
    echo ""
fi
sleep 3

########################################
# INSTALL ZSH + OH MY ZSH
########################################

echo ""
echo ""
banner "${CYAN}Installing zsh + Oh My Zsh for haas user${RESET}"
echo ""
echo ""

if bash "$REPO_DIR/setup_zsh.sh" "$REPO_DIR"; then
    echo ""
    banner "✅ ${CYAN}zsh configured successfully for haas user${RESET}"
    echo ""
else
    echo ""
    banner "⚠️ ${YELLOW}zsh setup failed — bash remains the default shell${RESET}" "${CYAN}Run manually: sudo bash $REPO_DIR/setup_zsh.sh $REPO_DIR${RESET}"
    echo ""
fi
sleep 3

########################################
# ENSURE BACKUP DIRECTORY EXISTS
########################################
echo ""
echo ""
banner "${CYAN}[*] Ensuring backup directory exists in repo: $BACKUP_DIR${RESET}"
echo ""
echo ""
mkdir -p "$BACKUP_DIR"

echo ""
echo ""
banner "${CYAN}[OK] Backup directory ready.${RESET}"
echo ""
echo ""

sleep 3

########################################
# RUN INITIAL FIREWALL CONFIG VIA SYSTEMD
########################################
echo ""
echo ""
banner "${CYAN}[*] Running initial firewall configuration via haas-firewall.service...${RESET}"
echo ""
echo ""

sudo systemctl start haas-firewall.service || true

echo ""
echo ""
banner "${CYAN}[SUCCESS] Haas Firewall installation complete.${RESET}"
echo ""
echo ""

########################################
# Install nmap
########################################
# to install nmap, remove the # on the next 5 lines
# sudo /usr/local/sbin/build-nmap.sh
# VERSION=$(nmap --version | head -n1 | awk '{print $3}')
# echo "nmap version $VERSION was successfully installed."
# echo ""
# sleep 3

# Ensure the underlying Linux directory permissions are correct:
sudo chown -R haas:HaasGroup /home/haas/Haas_Data_collect
sudo chmod -R 2774 /home/haas/Haas_Data_collect
# The 2 in 2774 sets the setgid bit, which ensures that all locally created
# files also inherit the HaasGroup.

########################################
# Populate zoxide database for the haas user
########################################
if command -v zoxide >/dev/null 2>&1; then
    echo ""
    echo ""
    banner "${CYAN}[*] Populating zoxide database for haas user...${RESET}"
    echo ""
    for dir in \
        /usr/local/sbin \
        /usr/share/cockpit/haas-firewall/ \
        /var/log/ \
        /home/haas/Haas_Data_collect/ \
        /usr/share/cockpit/haas-samba/ \
        /etc/ssh/sshd_config.d \
        /etc/systemd/system \
        /usr/share/cockpit/haas-update-appliance/ \
        /usr/share/cockpit/haas-python/
    do
        sudo -H -u haas zoxide add "$dir"
    done
    echo ""
fi

echo ""
echo ""
echo ""
banner "${CYAN}[*] Checking reboot status...${RESET}"
echo ""
echo ""
if [ -f /var/run/reboot-required ]; then
  echo ""
  echo ""
  banner "${CYAN}[*] Reboot is required${RESET}"
  echo ""
else
  echo ""
  echo ""
  banner "${CYAN}[*] No reboot required${RESET}"
  echo ""
fi

########################################
# WRITE + DISPLAY FINAL INSTALL SUMMARY
# Printed last (after the reboot-status check, so nothing scrolls it
# off screen) and also saved to disk, since the terminal output is
# gone once the SSH session that ran this script is closed.
########################################

UFW_STATUS=$(sudo ufw status numbered | sort -k5)

if command -v zoxide >/dev/null 2>&1; then
    ZOXIDE_LIST=$(sudo -H -u haas zoxide query -l)
else
    ZOXIDE_LIST="(zoxide not installed)"
fi

SUMMARY_FILE="$REPO_DIR/haas-install-summary.txt"
sudo bash -c "cat > '$SUMMARY_FILE'" <<EOF
Haas Firewall Appliance - Install Summary
Generated by haas-install.sh

Repo root:     $REPO_DIR
CSV Path:      $CSV_PATH
Backup Dir:    $BACKUP_DIR
Config File:   $CONFIG_FILE
Scripts:       /usr/local/sbin/configure_ufw_from_csv.sh
               /usr/local/sbin/validate_users_csv.sh
               /usr/local/sbin/rollback_csv.sh
               /usr/local/sbin/ssh_port.sh
               /usr/local/sbin/build-nmap.sh
Systemd:       /etc/systemd/system/haas-firewall.service
               /etc/systemd/system/haas-firewall.timer
Cockpit UI:    /usr/share/cockpit/haas-firewall/

To enable a Haas subnet later, run:
  sudo nano $CONFIG_FILE
  set HAAS_MACHINES_SUBNET_V4="<your_ipv4_subnet>" to your CNC machines' IPv4 subnet
  set HAAS_MACHINES_SUBNET_V6="<your_ipv6_subnet>" to your CNC machines' IPv6 subnet (if applicable)

Current UFW rules:
$UFW_STATUS

Zoxide directories (haas user):
$ZOXIDE_LIST
EOF
sudo chown haas:HaasGroup "$SUMMARY_FILE"
sudo chmod 664 "$SUMMARY_FILE"

echo ""
echo ""
banner "${CYAN}Save the following output for reference${RESET}"
echo ""
echo ""
echo "Repo root:     $REPO_DIR"
echo "CSV Path:      $CSV_PATH"
echo "Backup Dir:    $BACKUP_DIR"
echo "Config File:   $CONFIG_FILE"
echo "Scripts:       /usr/local/sbin/configure_ufw_from_csv.sh"
echo "               /usr/local/sbin/validate_users_csv.sh"
echo "               /usr/local/sbin/rollback_csv.sh"
echo "               /usr/local/sbin/ssh_port.sh"
echo "               /usr/local/sbin/build-nmap.sh"
echo "Systemd:       /etc/systemd/system/haas-firewall.service"
echo "               /etc/systemd/system/haas-firewall.timer"
echo "Cockpit UI:    /usr/share/cockpit/haas-firewall/"
echo ""
echo ""
banner "---" "${CYAN}To enable a Haas subnet later, run:${RESET}" "---" "${GREEN} sudo nano $CONFIG_FILE${RESET}" "---" "${CYAN}set HAAS_MACHINES_SUBNET_V4=\"<your_ipv4_subnet>\" to your CNC machines' IPv4 subnet${RESET}" "---" "${CYAN}set HAAS_MACHINES_SUBNET_V6=\"<your_ipv6_subnet>\" to your CNC machines' IPv6 subnet (if applicable)${RESET}" "---"
echo ""
echo ""
echo "Check firewall status with:"
echo "sudo ufw status numbered"
echo ""
echo "Current UFW rules:"
echo "$UFW_STATUS"
echo ""
echo ""
echo "Zoxide directories (haas user):"
echo "$ZOXIDE_LIST"
echo ""
echo ""
banner "${GREEN}This summary was also saved to: $SUMMARY_FILE${RESET}"
echo ""
