#!/usr/bin/env bash
#
# Haas Appliance - UFW Configuration from CSV (Config-File Architecture)
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="/etc/haas-firewall.conf"

LOG_FILE="/var/log/haas-firewall.log"
VALIDATOR="/usr/local/sbin/validate_users_csv.sh"

HAAS_MACHINES_SUBNET_V4="192.168.10.0/24"

CSV_PATH="$SCRIPT_DIR/users.csv"
BACKUP_DIR="$SCRIPT_DIR/backups"

if [[ -f "$CONFIG_FILE" ]]; then
  source "$CONFIG_FILE"
fi

DRY_RUN=false
SHOW_RULES=false
COMPARE=false

log() {
  echo "$(date +"%Y-%m-%d %H:%M:%S") [INFO] $1" | tee -a "$LOG_FILE"
}

log_error() {
  echo "$(date +"%Y-%m-%d %H:%M:%S") [ERROR] $1" | tee -a "$LOG_FILE" >&2
}

########################################
# ARGUMENT PARSING
########################################

CSV_ARG=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=true ;;
    --show-rules) SHOW_RULES=true ;;
    --compare) COMPARE=true ;;
    *) CSV_ARG="$1" ;;
  esac
  shift
done

CSV_FILE="${CSV_ARG:-$CSV_PATH}"

########################################
# SHOW RULES
########################################

if $SHOW_RULES; then
  ufw status numbered
  exit 0
fi

########################################
# VALIDATE CSV
########################################

if [[ ! -f "$CSV_FILE" ]]; then
  log_error "CSV file not found: $CSV_FILE"
  exit 1
fi

if ! "$VALIDATOR" "$CSV_FILE"; then
  log_error "CSV validation failed."
  exit 1
fi

########################################
# BACKUP CSV
########################################

mkdir -p "$BACKUP_DIR"
TS=$(date +"%Y-%m-%d_%H-%M-%S")
cp "$CSV_FILE" "$BACKUP_DIR/users_$TS.csv"

########################################
# COMPARE MODE
########################################

if $COMPARE; then
  TMP1=$(mktemp)
  TMP2=$(mktemp)

  ufw status numbered > "$TMP1"

  echo "ALLOW 445 FROM $HAAS_MACHINES_SUBNET_V4" > "$TMP2"

  tail -n +2 "$CSV_FILE" | while IFS=',' read -r user ip role; do
    role=$(echo "$role" | tr 'A-Z' 'a-z')
    case "$role" in
      administrator)
        echo "ADMIN $ip 22" >> "$TMP2"
        echo "ADMIN $ip 445" >> "$TMP2"
        echo "ADMIN $ip 9090" >> "$TMP2"
        ;;
      user)
        echo "USER $ip 445" >> "$TMP2"
        ;;
    esac
  done

  diff -u "$TMP1" "$TMP2" || true
  exit 0
fi

########################################
# APPLY RULES
########################################

log "Applying firewall rules..."

ufw allow from "$HAAS_MACHINES_SUBNET_V4" to any port 445 comment "haas-smb"

tail -n +2 "$CSV_FILE" | while IFS=',' read -r user ip role; do
  role=$(echo "$role" | tr 'A-Z' 'a-z')
  case "$role" in
    administrator)
      ufw allow from "$ip" to any port 22 comment "$user-admin-ssh"
      ufw allow from "$ip" to any port 445 comment "$user-admin-smb"
      ufw allow from "$ip" to any port 9090 comment "$user-admin-cockpit"
      ;;
    user)
      ufw allow from "$ip" to any port 445 comment "$user-user-smb"
      ;;
  esac
done

log "Firewall configuration complete."
