#!/usr/bin/env bash
#
# Haas Appliance - Firewall Automation Installer (Config-File Architecture)
#
# This installer:
#   - Requires Internet access to download installation packages!
#   - Assumes it is run from the repo root: Haas_Data_collect/#    -
#   - Detects the repo directory dynamically (can be anywhere)
#   - Writes /etc/haas-firewall.conf with:
#       CSV_PATH, BACKUP_DIR, HAAS_MACHINES_SUBNET_V4, HAAS_MACHINES_SUBNET_V6, SSH_PORT
#   - Copies issue.net to /etc/issue.net (Pre-logon banner)
#   - Installs firewall scripts into /usr/local/sbin
#        build-nmap.sh
#        configure_ufw_from_csv.sh
#        rollback_csv.sh
#        ssh_port.sh
#        validate_users_csv.sh
#   - Copies the service files to  /etc/systemd/system/
#      - haas-firewall.service
#      - haas-firewall.timer
#   - Copies appliance to /etc/logrotate.d/
#      - Changes ownership to chown root:root
#      - sets permissions to chmod 644
#     Copies csvlens binary to /usr/local/sbin
#   - Installs the latest nmap
#   - Installs systemd firewall service + timer
#   - Installs Samba server and updates /etc/samba/smb.conf
#   - Adds the "haas" user to Samba, and creates a "HaasGroup"
#       sets security and creates the "[Haas]" share
#   - Reads initial_users.csv and creates the Linux/Samba users
#   - Installs custom Haas_firewall Cockpit extension
#   - Installs the nala package manager
#   - Installs the linux tree command
#   - Installs pip
#   - Installs the "micro" cli text editor
#   - Installs the "fresh" cli text editor
#   - Creates the backup directory in the repo
#   - Triggers an initial firewall configuration via systemd
#
# It does NOT modify or delete anything inside the repo.
#

fix_var_log_perms() {
    perms=$(stat -c "%a" /var/log)
    owner=$(stat -c "%U" /var/log)
    group=$(stat -c "%G" /var/log)

    if [[ "$perms" != "755" || "$owner" != "root" || "$group" != "syslog" ]]; then
        echo "[FIX] /var/log was $owner:$group $perms → correcting to root:syslog 755"
        sudo chown root:syslog /var/log
        sudo chmod 755 /var/log
    else
        echo "[OK] /var/log permissions correct"
    fi
}


# Check for root FIRST
if [[ $EUID -ne 0 ]]; then
  echo "[ERROR] This script must be run as root" >&2
  exit 1
fi

set -euo pipefail

echo "[*] Starting Haas Firewall installation..."

# Ensure noble-updates is in sources (may be missing on Raspberry Pi Ubuntu images)
if ! grep -q "noble-updates" /etc/apt/sources.list.d/ubuntu.sources; then
    echo "noble-updates not found, adding to sources..."
    sudo sed -i 's/Suites: noble$/Suites: noble noble-updates/' /etc/apt/sources.list.d/ubuntu.sources
fi

echo ""
echo ""
echo "#################################################"
echo "#                                               #"
echo "#       [*]   DETECT REPO DIRECTORY             #"
echo "#                                               #"
echo "#################################################"
echo ""
REPO_DIR="$(pwd)"
REPO_NAME="$(basename "$REPO_DIR")"

if [[ "$REPO_NAME" != "Haas_Data_collect" ]]; then
    echo "[WARNING] Repo root is expected to be named 'Haas_Data_collect', but got: '$REPO_NAME'"
    echo "          Proceeding anyway, using current directory as repo root."
fi

echo ""
echo "####################################################################"
echo "                                                                   #"
echo "#  [*] Repo directory detected as: $REPO_DIR    #"
echo "                                                                   #"
echo "####################################################################"
echo ""
sleep 3

BACKUP_DIR="$REPO_DIR/backups"
COCKPIT_SRC="$REPO_DIR/cockpit"
CSV_PATH="$REPO_DIR/users.csv"


REQUIRED_FILES=(
  "configure_ufw_from_csv.sh"
  "validate_users_csv.sh"
  "haas-firewall.service"
  "haas-firewall.timer"
  "rollback_csv.sh"
  "build-nmap.sh"
  "ssh_port.sh"
  "issue.net"
)

echo ""
echo "###################################################"
echo "#                                                 #"
echo "#     [*] Verifying required files in repo...     #"
echo "#                                                 #"
echo "###################################################"
echo ""
echo ""
for f in "${REQUIRED_FILES[@]}"; do
  if [[ ! -f "$REPO_DIR/$f" ]]; then
    echo "[ERROR] Missing required file: $REPO_DIR/$f"
    exit 1
  else
      echo "✅ Success: $REPO_DIR/$f is valid."
      sleep 2
  fi
done
echo ""
echo ""
if [[ ! -f "$CSV_PATH" ]]; then
  echo "##########################################################"
  echo "#                                                        #"
  echo "#       [ERROR] CSV file not found at: $CSV_PATH         #"
  echo "# Create users.csv with header: username,ip_address,role #"
  echo "#                                                        #"
  echo "##########################################################"
  sleep 3
  exit 1
fi

if [[ ! -d "$COCKPIT_SRC" ]]; then
  echo "###########################################################"
  echo "#                                                         #"
  echo "#     [ERROR] Cockpit directory missing: $COCKPIT_SRC     #"
  echo "#                                                         #"
  echo "###########################################################"
  exit 1
fi

for f in manifest.json index.html haas-firewall.js haas-firewall.css icon.png; do
  if [[ ! -f "$COCKPIT_SRC/$f" ]]; then
    echo "###########################################################"
    echo "#                                                         #"
    echo "#      [ERROR] Missing Cockpit file: $COCKPIT_SRC/$f      #"
    echo "#                                                         #"
    echo "###########################################################"
    exit 1
  fi
done
echo ""
echo "#################################################"
echo "#                                               #"
echo "#    ✅ All required repo files are present.    #"
echo "#                                               #"
echo "#################################################"
sleep 2
echo ""
echo ""
########################################
# WRITE CONFIG FILE
########################################

CONFIG_FILE="/etc/haas-firewall.conf"
echo ""
echo "######################################################"
echo "#                                                    #"
echo "#  [*] Writing config file: $CONFIG_FILE  #"
echo "#                                                    #"
echo "######################################################"
echo ""
sudo bash -c "cat > '$CONFIG_FILE'" <<EOF
# Haas Firewall Appliance Configuration
# Generated by haas_firewall_install.sh
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
echo "####################################################"
echo "#                                                  #"
echo "#       ✅ Firewall Config file written.           #"
echo "#                                                  #"
echo "####################################################"
echo ""
echo ""

########################################
# INSTALL SCRIPTS
########################################

echo ""
echo ""
echo "############################################################"
echo "#                                                          #"
echo "# [*] Installing firewall scripts into /usr/local/sbin...  #"
echo "#                                                          #"
echo "############################################################"
echo ""
echo ""

# check /var/log permissions and fix if needed (prevents issues with logging from scripts)
fix_var_log_perms

sudo cp "$REPO_DIR/configure_ufw_from_csv.sh" /usr/local/sbin/
sudo cp "$REPO_DIR/validate_users_csv.sh" /usr/local/sbin/
sudo cp "$REPO_DIR/rollback_csv.sh" /usr/local/sbin/
sudo cp "$REPO_DIR/build-nmap.sh" /usr/local/sbin/
sudo cp "$REPO_DIR/csvlens" /usr/local/sbin/
sudo cp "$REPO_DIR/ssh_port.sh" /usr/local/sbin
sudo cp "$REPO_DIR/appliance" /etc/logrotate.d/
sudo cp "$REPO_DIR/issue.net" /etc/issue.net

# Set permissions for logrotate
sudo chown root:root /etc/logrotate.d/appliance
sudo chmod 644 /etc/logrotate.d/appliance

# change the pre-login banner in /etc/ssh/sshd_config to point to /etc/issue.net
#sudo sed -i 's|^#Banner none|Banner /etc/issue.net|' /etc/ssh/sshd_config
# Disable direct root SSH login
#sudo sed -i 's|^[[:space:]]*#\?PermitRootLogin .*|PermitRootLogin no|' /etc/ssh/sshd_config
echo ""
echo ""
echo "############################################################"
echo "#                                                          #"
echo "#  Updating /etc/ssh/sshd_config.d/99-haas-hardening.conf  #"
echo "#                                                          #"
echo "############################################################"
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
# if [ -f /etc/issue.net ] && grep -q "^Banner" /etc/ssh/sshd_config && sudo sshd -t; then
if [ -f /etc/issue.net ] && grep -q "^Banner" /etc/ssh/sshd_config.d/99-haas-hardening.conf && sudo sshd -t; then
    echo ""
    echo ""
    echo "################################################################"
    echo "#                                                              #"
    echo "#  ✅ Success: /etc/issue.net exists and SSH config is valid.  #"
    echo "#                                                              #"
    echo "################################################################"
    echo ""
    echo ""
else
    echo ""
    echo ""
    echo "#################################################################"
    echo "#                                                               #"
    echo "#         ❌ Error: Missing file or invalid SSH config!         #"
    echo "#                                                               #"
    echo "#################################################################"
    echo ""
    echo ""

    [ ! -f /etc/issue.net ] && echo "   -> /etc/issue.net is missing."
    ! grep -q "^Banner" /etc/ssh/sshd_config && echo "   -> Banner line not found in config."
    ! sudo sshd -t && echo "   -> sshd syntax error detected."
    exit 1
fi
sleep 3

#########################################
# Add execute permission to scripts
#########################################

sudo chmod +x /usr/local/sbin/configure_ufw_from_csv.sh
sudo chmod +x /usr/local/sbin/validate_users_csv.sh
sudo chmod +x /usr/local/sbin/build-nmap.sh
sudo chmod +x /usr/local/sbin/csvlens

if [[ ! -x /usr/local/sbin/configure_ufw_from_csv.sh ]]; then
  echo ""
  echo ""
  echo "#################################################################"
  echo "#                                                               #"
  echo "#        ⚠️ Failed to install configure_ufw_from_csv.sh         #"
  echo "#                                                               #"
  echo "#################################################################"
  echo ""
  echo ""
  exit 1
fi

if [[ ! -x /usr/local/sbin/validate_users_csv.sh ]]; then

  echo ""
  echo ""
  echo "#################################################################"
  echo "#                                                               #"
  echo "#          ⚠️ Failed to install validate_users_csv.sh           #"
  echo "#                                                               #"
  echo "#################################################################"
  echo ""
  echo ""
  exit 1
fi
sleep 3
echo ""
echo ""
echo "####################################################"
echo "#                                                  #"
echo "#         ✅ Firewall scripts installed.           #"
echo "#                                                  #"
echo "####################################################"
echo ""
echo ""

########################################
# INSTALL SYSTEMD Firewall UNITS
########################################
echo ""
echo ""
echo "#####################################################"
echo "#                                                   #"
echo "#      Installing systemd service and timer...      #"
echo "#                                                   #"
echo "#####################################################"
echo ""
echo ""

sudo cp "$REPO_DIR/haas-firewall.service" /etc/systemd/system/
sudo cp "$REPO_DIR/haas-firewall.timer" /etc/systemd/system/

sudo systemctl daemon-reload

sudo systemctl enable haas-firewall.service
sudo systemctl enable --now haas-firewall.timer
echo ""
echo ""
echo "###########################################################"
echo "#                                                         #"
echo "#   ✅ Systemd service and timer installed and enabled.   #"
echo "#                                                         #"
echo "###########################################################"
echo ""
echo ""
sleep 3

########################################
# Install Nala
########################################
echo ""
echo ""
echo "####################################################"
echo "#                                                  #"
echo "#      Installing the Nala Package Manager...      #"
echo "#                                                  #"
echo "####################################################"
echo ""
echo ""

if sudo apt install nala -y; then
    NALA_VERSION=$(nala --version)
    sudo nala upgrade -y
    echo ""
    echo ""
    echo "####################################################"
    echo "#                                                  #"
    echo "#      ✅ $NALA_VERSION installed...                 #"
    echo "#                                                  #"
    echo "####################################################"
    echo ""
    echo ""
    sleep 3
else
    echo ""
    echo ""
    echo "###########################################################"
    echo "#                                                         #"
    echo "#   ⚠️ Failed to install Nala package manager. Skipping   #"
    echo "#                                                         #"
    echo "###########################################################"
    echo ""
    echo ""
    exit 1
fi
sleep 5


if sudo nala install tree -y; then
    TREE_VERSION=$(tree --version | head -n1 | awk '{print $2}')
    sudo nala upgrade -y
    echo ""
    echo ""
    echo "#############################################"
    echo "#                                           #"
    echo "#     ✅ Tree $TREE_VERSION installed...           #"
    echo "#                                           #"
    echo "#############################################"
    echo ""
    echo ""
    sleep 3
else
    echo ""
    echo ""
    echo "###########################################################"
    echo "#                                                         #"
    echo "#   ⚠️ Failed to install the tree command. Skipping...    #"
    echo "#                                                         #"
    echo "###########################################################"
    echo ""
    echo ""
    exit 0
fi

echo ""
echo ""
echo "########################################################"
echo "#                                                      #"
echo "#             Installing Python pip package            #"
echo "#                                                      #"
echo "########################################################"
echo ""
echo ""

if sudo nala install python3-pip -y; then
    PIP_VERSION=$(python3 -m pip --version | head -n1 | awk '{print $2}')
    echo ""
    echo ""
    echo "####################################################"
    echo "#                                                  #"
    echo "#      ✅ PIP  $PIP_VERSION installed...                #"
    echo "#                                                  #"
    echo "####################################################"
    echo ""
    echo ""
    sleep 3
else
    echo ""
    echo ""
    echo "###############################################################"
    echo "#                                                             #"
    echo "#       ⚠️ Failed to install Python pip. Skipping...          #"
    echo "#                                                             #"
    echo "###############################################################"
    echo ""
    echo ""
    exit 0
fi


echo ""
echo ""
echo "#################################################"
echo "#                                               #"
echo "#      Installing Fresh CLI Text Editor...      #"
echo "#                                               #"
echo "#################################################"
echo ""
echo ""

# 1. Attempt to get the download URL and install in one safe block
if ARCH_URL=$(curl -s https://api.github.com/repos/sinelaw/fresh/releases/latest | grep "browser_download_url.*_$(dpkg --print-architecture)\.deb" | cut -d '"' -f 4) && [ -n "$ARCH_URL" ]; then

    if curl -sL "$ARCH_URL" -o fresh-editor.deb && sudo dpkg -i fresh-editor.deb; then
        echo ""
        echo ""
        echo "###########################################################"
        echo "#                                                         #"
        echo "#         ✅ Fresh Editor installed successfully.         #"
        echo "#                                                         #"
        echo "###########################################################"
        echo ""
        echo ""
    else
        echo ""
        echo ""
        echo "##########################################################################"
        echo "#                                                                        #"
        echo "#  ⚠️ Failed to install Fresh Editor .deb package. Continuing script...  #"
        echo "#                                                                        #"
        echo "##########################################################################"
        echo ""
        echo ""
        exit 0
    fi

else
    echo ""
    echo ""
    echo "################################################################################################"
    echo "#                                                                                              #"
    echo "#    ⚠️ Could not find a Fresh Editor release for $(dpkg --print-architecture). Skipping...    #"
    echo "#                                                                                              #"
    echo "################################################################################################"
    echo ""
    echo ""
    exit 0
fi

# 2. Cleanup (the -f ensures this won't error if the file was never made)
rm -f fresh-editor.deb
echo ""
sleep 3
# echo [OK] Fresh Editor installation attempted.

########################################
# Install micro text editor
########################################
echo ""
echo ""
echo "#################################################"
echo "#                                               #"
echo "#     Installing the Micro cli text editor      #"
echo "#                                               #"
echo "#################################################"
echo ""
echo ""

if sudo apt install micro -y; then
    MICRO_VERSION=$(micro --version)
    echo ""
    echo ""
    echo "##########################################################"
    echo "#                                                        #"
    echo "#      ✅ micro text editor $MICRO_VERSION installed    #"
    echo "#                                                        #"
    echo "##########################################################"
    echo ""
    echo ""
else
    echo ""
    echo ""
    echo "####################################################################"
    echo "#                                                                  #"
    echo "# ⚠️ Failed to install micro cli text editor. Continuing Script... #"
    echo "#                                                                  #"
    echo "####################################################################"
    echo ""
    echo ""
    exit 0
fi

########################################
# Install inetutils-traceroute
########################################
echo ""
echo ""
echo "#################################################"
echo "#                                               #"
echo "#        Installing inetutils-traceroute        #"
echo "#                                               #"
echo "#################################################"
echo ""
echo ""
if sudo nala install inetutils-traceroute -y; then
    echo ""
    echo ""
    echo "#################################################"
    echo "#                                               #"
    echo "#       ✅ inetutils-traceroute installed       #"
    echo "#                                               #"
    echo "#################################################"
    echo ""
    echo ""
sleep 3
else
    echo ""
    echo ""
    echo "#######################################################"
    echo "#                                                     #"
    echo "#  ⚠️ Failed to install inetutils. Continuing script  #"
    echo "#                                                     #"
    echo "#######################################################"
    echo ""
    echo ""
    exit 0
fi

########################################
# Install Samba Server
########################################
echo ""
echo ""
echo "#################################################"
echo "#                                               #"
echo "#            Installing Samba Server            #"
echo "#                                               #"
echo "#################################################"
echo ""
echo ""

# Install Samba
if sudo apt install samba -y; then
    echo ""
    echo ""
    echo "#######################################################"
    echo "#                                                     #"
    echo "#        ✅ Samba Server installed successfully       #"
    echo "#                                                     #"
    echo "#######################################################"
    echo ""
    echo ""

    # Enable and start Samba services
    sudo systemctl enable --now smbd

    # Create the HaasGroup
    echo ""
    echo ""
    echo "#######################################################"
    echo "#                                                     #"
    echo "#             Creating the Linux HaasGroup            #"
    echo "#                                                     #"
    echo "#######################################################"
    echo ""
    echo ""
    sudo groupadd HaasGroup 2>/dev/null || echo "HaasGroup already exists"

    # Create the haas user and add to HaasGroup
    echo ""
    echo ""
    echo "#######################################################"
    echo "#                                                     #"
    echo "#  Creating the Linux haas user and adding HaasGroup  #"
    echo "#                                                     #"
    echo "#######################################################"
    echo ""
    echo ""
    sudo useradd -m -G HaasGroup haas 2>/dev/null || echo "User haas already exists"

# Add hass user to Samba HaasGroup
echo ""
echo ""
echo "#########################################"
echo "#         Add haas user to Samba        #"
echo "#########################################"
echo ""
if pdbedit -L | cut -d: -f1 | grep -qx "haas"; then
    echo "Samba user haas already exists."

else
    echo "Creating Samba user haas"
    sudo smbpasswd -a "haas" || {
        echo "Error adding user to Samba database haas." >&2
        return 1
    }
fi

# Ensure Samba account is enabled
sudo smbpasswd -e "haas" || {
    echo "Error enabling Samba account for haas." >&2
    return 1
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
                echo "#######################################"
                echo ""
                echo "Creating user: $username       "
                echo ""
                echo "#######################################"
                # Create system user and add to HaasGroup. -M don't create home directory.
                # -s /usr/sbin/nologin" No login shell, user is just for Samaba access.
                sudo useradd -M -G HaasGroup -s /usr/sbin/nologin "$username" 2>/dev/null || echo "User $username already exists"

                # Add user to HaasGroup (in case they existed but weren't in the group)
                sudo usermod -aG HaasGroup "$username"

                # Set Samba password non-interactively
                echo -e "$password\n$password" | sudo smbpasswd -a "$username" -s
                echo ""
                echo "##############################################"
                echo ""
                echo "User $username created with Samba access  "
                echo ""
                echo "##############################################"
                echo ""
            fi
        done

        echo ""
        echo ""
        echo "############################################################################################"
        echo "#                                                                                          #"
        echo "#     All users from initial_users.csv have been processed                                 #"
        echo "#--------------------------------------------------------                                  #"
        printf "#     \e[1;31mIMPORTANT\e[0m: Delete %s now for security!   #\n" "$USER_FILE"
        echo "#                                                                                          #"
        echo "############################################################################################"
        echo ""
        echo ""
    else
        echo ""
        echo ""
        echo "##########################################################"
        echo "#                                                        #"
        echo "#   Warning: initial_users.csv not found at $USER_FILE   #"
        echo "#--------------------------------------------------------#"
        echo "#             Skipping initial user creation             #"
        echo "#                                                        #"
        echo "##########################################################"
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
    panic action = /usr/share/samba/panic-action %d

    # Authentication
    map to guest = Never

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
        echo "##########################################################"
        echo "#                                                        #"
        echo "#            Samba configuration is valid                #"
        echo "#                                                        #"
        echo "##########################################################"
        echo ""
        echo ""
    else
        echo ""
        echo ""
        echo "##########################################################"
        echo "#                                                        #"
        echo "#      Warning: Samba configuration may have issues      #"
        echo "#--------------------------------------------------------#"
        echo "#             Running testparm for details:              #"
        echo "#                                                        #"
        echo "##########################################################"
        echo ""
        echo ""
        sudo testparm -s /etc/samba/smb.conf
    fi

    # Restart Samba to apply changes
    sudo systemctl restart smbd

    echo ""
    echo ""
    echo "###############################################"
    echo "#                                             #"
    echo "#  Samba configured with security hardening:  #"
    echo "#---------------------------------------------#"
    echo "#  - SMBv2/SMBv3 only, no SMBv1               #"
    echo "#---------------------------------------------#"
    echo "#  - NetBIOS disabled                         #"
    echo "#---------------------------------------------#"
    echo "#  - Printing disabled                        #"
    echo "#                                             #"
    echo "###############################################"
    echo ""
    echo ""

    IP_ADDR=$(hostname -I | awk '{print $1}')
    share="\\\\$IP_ADDR\\Haas"
    sharenix="smb://$IP_ADDR/Haas"
    echo ""
    echo ""
    echo "############################################################"
    echo "#                                                          #"
    echo "#        Samba share 'Haas' configured successfully        #"
    echo "#                                                          #"
    printf "#  Share for Windows is available at %s\n" "$share"
    echo "#                                                          #"
    printf "#  Share for Mac/Linux is available at %s\n" "$sharenix"
    echo "#                                                          #"
    echo "############################################################"
    echo ""
    echo ""

else
    echo ""
    echo ""
    echo "##########################################################"
    echo "#                                                        #"
    echo "#           ⚠️ Failed to install Samba Server            #"
    echo "#                                                        #"
    echo "##########################################################"
    echo ""
    echo ""
    exit 1
fi
sleep 5

echo ""
echo ""
echo "#######################################################"
echo "#                                                     #"
echo "#              Installing Samba Client                #"
echo "#                                                     #"
echo "#######################################################"
echo ""
echo ""
if sudo apt install smbclient -y; then
    echo ""
    echo ""
    echo "#######################################################"
    echo "#                                                     #"
    echo "#        ✅ Samba Client installed successfully       #"
    echo "#                                                     #"
    echo "#######################################################"
    echo ""
    echo ""
fi
echo ""


echo ""
echo "################################################"
echo "#                                              #"
echo "#   Installing Redhat Cockpit for management   #"
echo "#                                              #"
echo "################################################"
echo ""
echo ""

# Install Cockpit
if sudo nala install cockpit cockpit-pcp -y; then

    # Enable and start Cockpit
    sudo systemctl enable --now cockpit.socket
    sudo systemctl restart cockpit
    echo ""
    echo ""
    echo "#########################################################"
    echo "#                                                       #"
    echo "#          ✅ Cockpit installed successfully            #"
    echo "#                                                       #"
    echo "#  Cockpit is running at https://$(hostname -I | awk '{print $1}'):9090    #"
    echo "#                                                       #"
    echo "#########################################################"
    echo ""
    echo ""
else
    echo ""
    echo ""
    echo "##############################################################################"
    echo "#                                                                            #"
    echo "#                    ⚠️ Failed to install Cockpit                            #"
    echo "#         Review the messages on screen and troubleshoot with chatGPT        #"
    echo "#  The script will continue, Cockpit is not needed for script functionality  #"
    echo "#                                                                            #"
    echo "##############################################################################"
    echo ""
    echo ""
fi
sleep 3

########################################
# INSTALL COCKPIT EXTENSION
########################################

COCKPIT_DST="/usr/share/cockpit/haas-firewall"

echo ""
echo ""
echo "#########################################################################"
echo "#                                                                       #"
echo "#  Installing Cockpit extension to $COCKPIT_DST...  #"
echo "#                                                                       #"
echo "#########################################################################"
echo ""
echo ""

sudo mkdir -p "$COCKPIT_DST"
sudo cp "$COCKPIT_SRC"/* "$COCKPIT_DST"/

echo ""
echo ""
echo "#####################################################"
echo "#                                                   #"
echo "#            [*] Restarting Cockpit...              #"
echo "#                                                   #"
echo "#####################################################"
echo ""
echo ""

sudo systemctl restart cockpit

if [[ -f "$COCKPIT_DST/index.html" ]]; then

echo ""
echo ""
echo "###########################################################"
echo "#                                                         #"
echo "#  ✅ Cockpit extension installed and Cockpit restarted.  #"
echo "#                                                         #"
echo "###########################################################"
echo ""
echo ""

else
echo ""
echo ""
echo "###########################################################"
echo "#                                                         #"
echo "#           ⚠️ Cockpit extension not installed.           #"
echo "#                                                         #"
echo "###########################################################"
echo ""
echo ""
fi
sleep 3

########################################
# ENSURE BACKUP DIRECTORY EXISTS
########################################
echo ""
echo ""
echo "########################################################################################"
echo "#                                                                                      #"
echo "#  [*] Ensuring backup directory exists in repo: $BACKUP_DIR  #"
echo "#                                                                                      #"
echo "########################################################################################"
echo ""
echo ""
mkdir -p "$BACKUP_DIR"

echo ""
echo ""
echo "##################################"
echo "#                                #"
echo "#  [OK] Backup directory ready.  #"
echo "#                                #"
echo "##################################"
echo ""
echo ""

sleep 3

########################################
# RUN INITIAL FIREWALL CONFIG VIA SYSTEMD
########################################
echo ""
echo ""
echo "#############################################################################"
echo "#                                                                           #"
echo "#  [*] Running initial firewall configuration via haas-firewall.service...  #"
echo "#                                                                           #"
echo "#############################################################################"
echo ""
echo ""

sudo systemctl start haas-firewall.service || true

echo ""
echo ""
echo "####################################################"
echo "#                                                  #"
echo "#  [SUCCESS] Haas Firewall installation complete.  #"
echo "#                                                  #"
echo "####################################################"
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
sudo chmod -R 2775 /home/haas/Haas_Data_collect
# The 2 in 2775 sets the setgid bit, which ensures that all locally created
# files also inherit the HaasGroup.
echo ""
echo ""
echo "#####################################################"
echo "#                                                   #"
echo "#      Save the following output for reference      #"
echo "#                                                   #"
echo "#####################################################"
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
echo "#####################################################################################"
echo "#-----------------------------------------------------------------------------------#"
echo "#  To enable a Haas subnet later, edit:                                             #"
echo "#---------------------------------------------------------------------------------- #"
echo "# $CONFIG_FILE                                                           #"
echo "#---------------------------------------------------------------------------------- #"
echo "#  set HAAS_MACHINES_SUBNET_V4="" to your CNC machines' IPv4 subnet                   #"
echo "#-----------------------------------------------------------------------------------#"
echo "#  set HAAS_MACHINES_SUBNET_V6="" to your CNC machines' IPv6 subnet (if applicable)   #"
echo "#---------------------------------------------------------------------------------- #"
echo "#####################################################################################"
echo ""
echo ""
echo "Check firewall status with:"
echo "sudo ufw status numbered"
echo ""
echo "Current UFW rules:"
sudo ufw status numbered | sort -k5
echo ""
