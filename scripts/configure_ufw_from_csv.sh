#!/usr/bin/env bash
#
# Haas Appliance - UFW Configuration from CSV (Config-File Architecture)
#
# Uses:
#   - /etc/haas-firewall.conf for:
#       CSV_PATH
#       BACKUP_DIR
#       HAAS_MACHINES_SUBNET_V4
#       HAAS_MACHINES_SUBNET_V6
#
# Defaults (if config missing):
#   CSV_PATH               = <script_dir>/users-a.csv
#   BACKUP_DIR             = <script_dir>/backups
#   HAAS_MACHINES_SUBNET_V4 = ""
#   HAAS_MACHINES_SUBNET_V6 = ""
#
# Supports:
#   --dry-run     (simulate changes)
#   --compare     (compare current vs planned rules)
#   --show-rules  (show current UFW rules)
#   --persist     (after a real apply, also update CSV_PATH in
#                  /etc/haas-firewall.conf to whatever CSV was just used,
#                  and reset haas-firewall.timer's countdown — mirrors
#                  what Cockpit's Apply Firewall Changes button does, for
#                  terminal-only use. Cannot be combined with --dry-run,
#                  --compare, or --show-rules, since none of those apply
#                  a real change to persist. Without this flag, a CSV
#                  path given on the command line is a one-off override
#                  only, same as always — the appliance's daily/periodic
#                  self-heal will keep reinforcing whatever CSV_PATH was
#                  already set, not the one-off path.)
#

# Check for root FIRST
if [[ $EUID -ne 0 ]]; then
  echo "[ERROR] This script must be run as root" >&2
  exit 1
fi

set -euo pipefail

########################################
# PATHS AND CONFIG
########################################

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="/etc/haas-firewall.conf"

LOG_FILE="/var/log/haas-firewall.log"
VALIDATOR="/usr/local/sbin/validate_users_csv.sh"

# Default values (used if config is missing)
CSV_PATH_DEFAULT="${SCRIPT_DIR}/users-a.csv"
BACKUP_DIR_DEFAULT="${SCRIPT_DIR}/backups"
HAAS_MACHINES_SUBNET_V4_DEFAULT=""
HAAS_MACHINES_SUBNET_V6_DEFAULT=""
SSH_PORT="22"

# Load config if present (overrides defaults)
if [[ -f "$CONFIG_FILE" ]]; then
    # shellcheck disable=SC1090
    source "$CONFIG_FILE"
else
    echo "[WARN] Config file missing: $CONFIG_FILE"
    echo "[WARN] Falling back to script-local defaults."
fi

# Apply defaults if config did not define them
CSV_PATH="${CSV_PATH:-$CSV_PATH_DEFAULT}"
BACKUP_DIR="${BACKUP_DIR:-$BACKUP_DIR_DEFAULT}"
HAAS_MACHINES_SUBNET_V4="${HAAS_MACHINES_SUBNET_V4:-$HAAS_MACHINES_SUBNET_V4_DEFAULT}"
HAAS_MACHINES_SUBNET_V6="${HAAS_MACHINES_SUBNET_V6:-$HAAS_MACHINES_SUBNET_V6_DEFAULT}"

# Sanity checks
if [[ ! -f "$CSV_PATH" ]]; then
    echo "[ERROR] CSV file not found: $CSV_PATH"
    exit 1
fi

if [[ ! -d "$BACKUP_DIR" ]]; then
    echo "[INFO] Creating backup directory: $BACKUP_DIR"
    mkdir -p "$BACKUP_DIR"
fi

echo "[INFO] Using CSV file: $CSV_PATH"
echo "[INFO] Using backup directory: $BACKUP_DIR"
echo ""

########################################
# FLAGS
########################################

DRY_RUN=false
SHOW_RULES=false
COMPARE=false
PERSIST=false

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
    --persist)
      PERSIST=true
      ;;
    -h|--help)
      echo "Usage: $0 [--dry-run] [--show-rules] [--compare] [--persist] [CSV_FILE]"
      echo "If CSV_FILE is omitted, uses CSV_PATH from $CONFIG_FILE or default."
      echo "--persist updates CSV_PATH in $CONFIG_FILE and resets haas-firewall.timer"
      echo "after a real apply, so the appliance's self-heal keeps reinforcing this CSV"
      echo "instead of whatever it was set to before. Cannot combine with --dry-run,"
      echo "--compare, or --show-rules."
      exit 0
      ;;
    *)
      CSV_ARG="$1"
      ;;
  esac
  shift
done

CSV_FILE="${CSV_ARG:-$CSV_PATH}"

if $PERSIST && { $DRY_RUN || $COMPARE || $SHOW_RULES; }; then
  echo "[ERROR] --persist cannot be combined with --dry-run, --compare, or --show-rules — none of those apply a real change to persist." >&2
  exit 1
fi

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
echo ""

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

  if [[ -n "$HAAS_MACHINES_SUBNET_V4" ]]; then
    echo "ALLOW 445/tcp FROM $HAAS_MACHINES_SUBNET_V4" >> "$outfile"
  fi

  if [[ -n "$HAAS_MACHINES_SUBNET_V6" ]]; then
    echo "ALLOW 445/tcp FROM $HAAS_MACHINES_SUBNET_V6 (v6)" >> "$outfile"
  fi

  tail -n +2 "$csv" | while IFS=',' read -r user ip role || [[ -n "$user" ]]; do
    [[ -z "$user" && -z "$ip" && -z "$role" ]] && continue
    role_lower=$(echo "$role" | tr 'A-Z' 'a-z')
    case "$role_lower" in
      administrator)
        echo "ADMIN  FROM $ip : $SSH_PORT/tcp" >> "$outfile"
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
    echo ""
    ufw --force enable
  fi

  if [[ -n "$HAAS_MACHINES_SUBNET_V4" ]]; then
    log "Applying Haas subnet rule: ALLOW 445/tcp FROM $HAAS_MACHINES_SUBNET_V4"
    if ! $DRY_RUN; then
      ufw allow from "$HAAS_MACHINES_SUBNET_V4" to any port 445 comment "haas-smb"
    else
      log "DRY-RUN: Would allow 445/tcp from $HAAS_MACHINES_SUBNET_V4"
    fi
  fi

  if [[ -n "$HAAS_MACHINES_SUBNET_V6" ]]; then
    log "Applying Haas IPv6 subnet rule: ALLOW 445/tcp FROM $HAAS_MACHINES_SUBNET_V6"
    if ! $DRY_RUN; then
      ufw allow from "$HAAS_MACHINES_SUBNET_V6" to any port 445 comment "haas-smb-v6"
    else
      log "DRY-RUN: Would allow 445/tcp from $HAAS_MACHINES_SUBNET_V6"
    fi
  fi

  tail -n +2 "$csv" | while IFS=',' read -r user ip role || [[ -n "$user" ]]; do
    [[ -z "$user" && -z "$ip" && -z "$role" ]] && continue
    role_lower=$(echo "$role" | tr 'A-Z' 'a-z')

    case "$role_lower" in
      administrator)
        echo ""
        log "ADMIN: $user@$ip → $SSH_PORT, 445, 9090"
        if ! $DRY_RUN; then
          ufw allow from "$ip" to any port $SSH_PORT comment "${user}-admin-ssh"
          ufw allow from "$ip" to any port 445 comment "${user}-admin-smb"
          ufw allow from "$ip" to any port 9090 comment "${user}-admin-cockpit"
        else
          log "DRY-RUN: Would allow $SSH_PORT,445,9090 from $ip (admin $user)"
        fi
        ;;
      user)
        echo ""
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
  echo ""
  log "Firewall rule application complete."
}

########################################
# PERSIST (--persist only)
########################################

# Mirrors what cockpit_firewall/haas-firewall.js's Apply Firewall Changes
# button does after a successful apply: update CSV_PATH in the conf file
# to whatever CSV was just used, and reset haas-firewall.timer's
# countdown, so the appliance's periodic self-heal reinforces this CSV
# going forward instead of whatever CSV_PATH was set to before.
persist_csv_path() {
  local new_path="$1"

  if grep -q '^CSV_PATH=' "$CONFIG_FILE" 2>/dev/null; then
    sed -i "s|^CSV_PATH=.*|CSV_PATH=\"${new_path}\"|" "$CONFIG_FILE"
  else
    echo "CSV_PATH=\"${new_path}\"" >> "$CONFIG_FILE"
  fi
  log "Persisted CSV_PATH=${new_path} to $CONFIG_FILE"

  if systemctl restart haas-firewall.timer; then
    log "Reset haas-firewall.timer's countdown."
  else
    log_error "Failed to reset haas-firewall.timer — the next scheduled self-heal may still use a stale reference point."
  fi
}

if $DRY_RUN; then
  log "DRY-RUN mode: No firewall changes will be applied."
  apply_ufw_rules "$CSV_FILE"
  log "DRY-RUN finished."
else
  log "Resetting UFW to remove all existing rules before applying CSV..."
  echo ""
  ufw --force reset
  echo ""
  apply_ufw_rules "$CSV_FILE"
  if $PERSIST; then
    persist_csv_path "$CSV_FILE"
  fi
fi
echo ""
echo "#################################################################################################"
echo "#                                                                                               #"
echo "#                                       Updated UFW rules                                       #"
echo "#                                                                                               #"
echo "#################################################################################################"
sudo ufw status numbered | sort -k5
exit 0
