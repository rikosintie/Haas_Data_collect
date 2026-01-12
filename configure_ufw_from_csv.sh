#!/bin/bash
#
# configure_ufw_from_csv.sh
#
# Reads a CSV file with header:
#   username,desktop_ip_address,role
#
# Roles:
#   user          -> Samba (445/tcp)
#   Administrator -> Samba (445/tcp), SSH (22/tcp), Cockpit (9090/tcp)
#
# Supports:
#   --dry-run     -> Show rules but do NOT apply them
#   --reset       -> Reset all UFW rules before applying new ones
#

set -euo pipefail

########################################
# ARGUMENT PARSING
########################################

DRY_RUN=false
RESET=false
CSV_FILE=""

for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN=true
      ;;
    --reset)
      RESET=true
      ;;
    *.csv)
      CSV_FILE="$arg"
      ;;
    *)
      echo "Unknown argument: $arg"
      echo "Usage: sudo $0 [--dry-run] [--reset] users.csv"
      exit 1
      ;;
  esac
done

if [[ -z "$CSV_FILE" ]]; then
  echo "Usage: sudo $0 [--dry-run] [--reset] users.csv"
  exit 1
fi

if [[ ! -f "$CSV_FILE" ]]; then
  echo "Error: CSV file '$CSV_FILE' not found."
  exit 1
fi

if [[ "$EUID" -ne 0 ]]; then
  echo "This script must be run as root (use sudo)."
  exit 1
fi

########################################
# LOGGING
########################################

LOGFILE="/var/log/haas-firewall.log"
exec > >(tee -a "$LOGFILE") 2>&1

########################################
# CONFIGURATION
########################################

HAAS_MACHINES_SUBNET_V4="192.168.50.0/24"
HAAS_MACHINES_SUBNET_V6=""

PORT_SAMBA=445
PORT_SSH=22
PORT_COCKPIT=9090

CONFIGURE_UFW_DEFAULTS=true

########################################
# HELPER: APPLY OR PRINT RULE
########################################

apply_rule() {
  local rule="$1"

  if $DRY_RUN; then
    echo "[DRY-RUN] ufw $rule"
  else
    ufw $rule
  fi
}

########################################
# RESET MODE
########################################

if $RESET; then
  if $DRY_RUN; then
    echo "[DRY-RUN] Would reset all UFW rules"
  else
    echo "[*] Resetting UFW rules..."
    ufw --force reset
  fi
fi

########################################
# INITIAL HARDENING
########################################

if $CONFIGURE_UFW_DEFAULTS; then
  echo "[*] Setting UFW base policy..."

  if $DRY_RUN; then
    echo "[DRY-RUN] Would set IPV6=yes in /etc/default/ufw"
    echo "[DRY-RUN] ufw default deny incoming"
    echo "[DRY-RUN] ufw default allow outgoing"
    echo "[DRY-RUN] ufw allow in on lo"
    echo "[DRY-RUN] ufw allow out on lo"
    echo "[DRY-RUN] ufw limit ${PORT_SSH}/tcp"
    echo "[DRY-RUN] ufw deny 137/udp"
    echo "[DRY-RUN] ufw deny 138/udp"
    echo "[DRY-RUN] ufw deny 139/tcp"
  else
    sed -i 's/^IPV6=.*/IPV6=yes/' /etc/default/ufw || echo "IPV6=yes" >> /etc/default/ufw
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow in on lo
    ufw allow out on lo
    ufw limit ${PORT_SSH}/tcp
    ufw deny 137/udp
    ufw deny 138/udp
    ufw deny 139/tcp
  fi
fi

########################################
# HAAS MACHINE RULES
########################################

echo "[*] Creating rules for Haas machines (haassvc)..."

if [[ -n "$HAAS_MACHINES_SUBNET_V4" ]]; then
  apply_rule "allow from ${HAAS_MACHINES_SUBNET_V4} to any port ${PORT_SAMBA} proto tcp comment 'Haas machines IPv4 -> Samba'"
fi

if [[ -n "$HAAS_MACHINES_SUBNET_V6" ]]; then
  apply_rule "allow from ${HAAS_MACHINES_SUBNET_V6} to any port ${PORT_SAMBA} proto tcp comment 'Haas machines IPv6 -> Samba'"
fi

########################################
# PROCESS CSV
########################################

echo "[*] Processing CSV: $CSV_FILE"

tail -n +2 "$CSV_FILE" | while IFS=',' read -r username ip role; do
  username="$(echo "$username" | xargs)"
  ip="$(echo "$ip" | xargs)"
  role="$(echo "$role" | xargs)"

  [[ -z "$username" && -z "$ip" && -z "$role" ]] && continue

  case "$role" in
    user|User|USER)
      echo "[*] Adding USER '$username' from $ip"
      apply_rule "allow from $ip to any port ${PORT_SAMBA} proto tcp comment 'User $username -> Samba'"
      ;;

    Administrator|admin|Admin|ADMIN)
      echo "[*] Adding ADMIN '$username' from $ip"
      apply_rule "allow from $ip to any port ${PORT_SAMBA} proto tcp comment 'Admin $username -> Samba'"
      apply_rule "allow from $ip to any port ${PORT_SSH} proto tcp comment 'Admin $username -> SSH'"
      apply_rule "allow from $ip to any port ${PORT_COCKPIT} proto tcp comment 'Admin $username -> Cockpit'"
      ;;

    *)
      echo "[!] Unknown role '$role' for user '$username'. Skipping."
      ;;
  esac
done

########################################
# ENABLE UFW
########################################

if $DRY_RUN; then
  echo "[DRY-RUN] Would enable UFW"
  echo "[DRY-RUN] Would show UFW status"
else
  ufw --force enable
  ufw status numbered
fi

echo "[*] Done."
