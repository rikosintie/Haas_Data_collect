#!/usr/bin/env bash
#
# Haas Appliance - UFW Configuration from CSV (Config-File Architecture)
#
# Uses:
#   - /etc/haas-firewall.conf for:
#       CSV_PATH   - path to users.csv
#       BACKUP_DIR - directory for CSV backups
#
# Defaults (if config missing):
#   CSV_PATH   = <script_dir>/users.csv
#   BACKUP_DIR = <script_dir>/backups
#
# Supports:
#   --dry-run     (simulate changes)
#   --compare     (compare current vs planned rules)
#   --show-rules  (show current UFW rules)
#

set -euo pipefail

########################################
# PATHS AND CONFIG
########################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="/etc/haas-firewall.conf"

LOG_FILE="/var/log/haas-firewall.log"
VALIDATOR="/usr/local/sbin/validate_users_csv.sh"

# Default values (used if config is missing)
CSV_PATH="$SCRIPT_DIR/users.csv"
BACKUP_DIR="$SCRIPT_DIR/backups"

# Haas subnet for CNC machines
HAAS_MACHINES_SUBNET_V4="192.168.10.0/24"
HAAS_MACHINES_SUBNET_V6=""

# Load config if present (overrides defaults)
if [[ -f "$CONFIG_FILE" ]]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi

########################################
# FLAGS
########################################

DRY_RUN=false
SHOW_RULES=false
COMPARE=false

########################################
# LOGGING
########################################

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
    --dry-run)
      DRY_RUN=true
      ;;
    --show-rules)
      SHOW_RULES=true
      ;;
    --compare)
      COMPARE=true
      ;;
    -h|--help)
      echo "Usage: $0 [--dry-run] [--show-rules] [--compare] [CSV_FILE]"
      exit 0
      ;;
    *)
      CSV_ARG="$1"
      ;;
  esac
  shift
done

CSV_FILE="${CSV_ARG:-$CSV_PATH}"

########################################
# SHOW RULES MODE
########################################

if $SHOW_RULES; then
  log "Showing current UFW rules..."
  ufw status numbered | tee -a "$LOG_FILE"
  exit 0
fi

########################################
# BASIC VALIDATION
########################################

log "Starting UFW configuration from CSV."
log "Using CSV file: $CSV_FILE"

if [[ ! -f "$CSV_FILE" ]]; then
  log_error "CSV file not found: $CSV_FILE"
  exit 1
fi

if [[ ! -x "$VALIDATOR" ]]; then
  log_error "CSV validator script missing or not executable: $VALIDATOR"
  exit 1
fi

log "Validating CSV..."
if ! "$VALIDATOR" "$CSV_FILE"; then
  log_error "CSV validation failed."
  exit 1
fi
log "CSV validation passed."

########################################
# BACKUP CSV
########################################

mkdir -p "$BACKUP_DIR"
TS=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/users_$TS.csv"

cp "$CSV_FILE" "$BACKUP_FILE"
log "CSV backup created at: $BACKUP_FILE"

########################################
# PLANNED RULES BUILDER (FOR COMPARE)
########################################

build_planned_rules() {
  local csv="$1"
  local outfile="$2"

  echo "ALLOW 445/tcp FROM $HAAS_MACHINES_SUBNET_V4" >> "$outfile"

  tail -n +2 "$csv" | while IFS=',' read -r user ip role; do
    [[ -z "$user" && -z "$ip" && -z "$role" ]] && continue
    role_lower=$(echo "$role" | tr 'A-Z' 'a-z')
    case "$role_lower" in
      administrator)
        echo "ADMIN  FROM $ip : 22/tcp" >> "$outfile"
        echo "ADMIN  FROM $ip : 445/tcp" >> "$outfile"
        echo "ADMIN  FROM $ip : 9090/tcp" >> "$outfile"
        ;;
      user)
        echo "USER   FROM $ip : 445/tcp" >> "$outfile"
        ;;
      *)
        echo "UNKNOWN ROLE '$role' FOR $user@$ip" >> "$outfile"
        ;;
    esac
  done
}

########################################
# COMPARE MODE
########################################

if $COMPARE; then
  log "COMPARE mode: current vs planned rules."

  TMP_CURRENT=$(mktemp)
  TMP_PLANNED=$(mktemp)

  ufw status numbered > "$TMP_CURRENT"
  build_planned_rules "$CSV_FILE" "$TMP_PLANNED"

  diff -u "$TMP_CURRENT" "$TMP_PLANNED" || true

  rm -f "$TMP_CURRENT" "$TMP_PLANNED"

  log "COMPARE mode complete. No firewall changes applied."
  exit 0
fi

########################################
# APPLY RULES
########################################

apply_ufw_rules() {
  local csv="$1"

  if ! ufw status | grep -q "Status: active"; then
    log "UFW is not active. Enabling..."
    ufw --force enable
  fi

  log "Applying Haas subnet rule: ALLOW 445/tcp FROM $HAAS_MACHINES_SUBNET_V4"
  if ! $DRY_RUN; then
    ufw allow from "$HAAS_MACHINES_SUBNET_V4" to any port 445 comment "haas-smb"
  else
    log "DRY-RUN: Would allow 445/tcp from $HAAS_MACHINES_SUBNET_V4"
  fi

  if [[ -n "$HAAS_MACHINES_SUBNET_V6" ]]; then
    log "Applying Haas IPv6 subnet rule: ALLOW 445/tcp FROM $HAAS_MACHINES_SUBNET_V6"
    if ! $DRY_RUN; then
      ufw allow from "$HAAS_MACHINES_SUBNET_V6" to any port 445 comment "haas-smb-v6"
    else
      log "DRY-RUN: Would allow 445/tcp from $HAAS_MACHINES_SUBNET_V6"
    fi
  fi

  tail -n +2 "$csv" | while IFS=',' read -r user ip role; do
    [[ -z "$user" && -z "$ip" && -z "$role" ]] && continue
    role_lower=$(echo "$role" | tr 'A-Z' 'a-z')

    case "$role_lower" in
      administrator)
        log "ADMIN: $user@$ip → 22, 445, 9090"
        if ! $DRY_RUN; then
          ufw allow from "$ip" to any port 22 comment "${user}-admin-ssh"
          ufw allow from "$ip" to any port 445 comment "${user}-admin-smb"
          ufw allow from "$ip" to any port 9090 comment "${user}-admin-cockpit"
        else
          log "DRY-RUN: Would allow 22,445,9090 from $ip (admin $user)"
        fi
        ;;
      user)
        log "USER: $user@$ip → 445"
        if ! $DRY_RUN; then
          ufw allow from "$ip" to any port 445 comment "${user}-user-smb"
        else
          log "DRY-RUN: Would allow 445 from $ip (user $user)"
        fi
        ;;
      *)
        log_error "Unknown role '$role' for $user@$ip. Skipping."
        ;;
    esac
  done

  log "Firewall rule application complete."
}

if $DRY_RUN; then
  log "DRY-RUN mode: No firewall changes will be applied."
  apply_ufw_rules "$CSV_FILE"
  log "DRY-RUN finished."
else
  apply_ufw_rules "$CSV_FILE"
fi

exit 0
