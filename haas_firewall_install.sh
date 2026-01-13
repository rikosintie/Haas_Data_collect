#!/usr/bin/env bash
#
# Haas Appliance - UFW Configuration from CSV
#
# This script configures UFW firewall rules based on a CSV file containing
# username, IP address, and role information.
#
# DESIGN GOALS:
#  - Safe by default:
#      * Strict CSV validation (header, IPs, roles, duplicates, structure)
#      * Automatic CSV backups on every run
#  - Portable:
#      * No hard-coded usernames or home directories
#      * Defaults derived from script location, with override options
#  - Appliance-friendly:
#      * No arguments required when run by systemd
#      * Sensible default CSV location
#  - Operator- and developer-friendly:
#      * --dry-run     : simulate changes without applying them
#      * --compare     : show diff between current and planned rules
#      * --show-rules  : show current UFW rules
#
# FIREWALL POLICY:
#  - Global Haas subnet rule:
#      * Allow SMB (port 445) FROM 192.168.10.0/24 (Haas CNC machines)
#  - Per-user rules (from CSV):
#      * Role "administrator":
#           - Allow 22/tcp (SSH) FROM <ip>
#           - Allow 445/tcp (SMB) FROM <ip>
#           - Allow 9090/tcp (Cockpit) FROM <ip>
#        (Admin IPs may be on ANY subnet)
#      * Role "user":
#           - Allow 445/tcp (SMB) FROM <ip>
#
# CSV FORMAT (STRICT):
#   Header (must match exactly):
#       username,ip_address,role
#
# NOTES ON PATHS:
#   This script determines paths in this order:
#     1) If HAAS_CSV_PATH env var is set, use that for CSV.
#        If HAAS_BACKUP_DIR env var is set, use that for backups.
#     2) Else, if /etc/haas-firewall.conf exists, source it and use:
#           CSV_PATH=...
#           BACKUP_DIR=...
#     3) Else, fall back to:
#           CSV_PATH  = <script_dir>/users.csv
#           BACKUP_DIR= <script_dir>/backups
#
#   This makes the script work:
#     - From inside the repo (relative paths)
#     - From systemd (via config file or env override)
#

set -euo pipefail

########################################
# BASIC PATH CONTEXT
########################################

# Directory where this script resides (not the CWD).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

########################################
# DEFAULT CONFIG (CAN BE OVERRIDDEN)
########################################

# Log file for firewall operations.
LOG_FILE="/var/log/haas-firewall.log"

# Haas subnet for global SMB access to CNC machines.
HAAS_MACHINES_SUBNET_V4="192.168.10.0/24"

# Optional IPv6 subnet (left empty if not used).
HAAS_MACHINES_SUBNET_V6=""

# Default CSV and backup paths (relative to script dir).
DEFAULT_CSV="${SCRIPT_DIR}/users.csv"
DEFAULT_BACKUP_DIR="${SCRIPT_DIR}/backups"

# CSV validator script path.
# By default we expect it to be installed to /usr/local/sbin.
VALIDATOR="/usr/local/sbin/validate_users_csv.sh"

# Config file that can override CSV_PATH and BACKUP_DIR.
CONFIG_FILE="/etc/haas-firewall.conf"

# Initialize variables that may be overridden.
CSV_PATH="${DEFAULT_CSV}"
BACKUP_DIR="${DEFAULT_BACKUP_DIR}"

########################################
# LOAD CONFIG / ENV OVERRIDES
########################################
# Priority:
#   1) Environment variables: HAAS_CSV_PATH, HAAS_BACKUP_DIR
#   2) Config file: /etc/haas-firewall.conf
#   3) Script-relative defaults (already set above)
########################################

# 1) Environment overrides
if [[ -n "${HAAS_CSV_PATH:-}" ]]; then
    CSV_PATH="$HAAS_CSV_PATH"
fi

if [[ -n "${HAAS_BACKUP_DIR:-}" ]]; then
    BACKUP_DIR="$HAAS_BACKUP_DIR"
fi

# 2) Config file overrides (only if env didn't explicitly set)
if [[ -f "$CONFIG_FILE" ]]; then
    # shellcheck disable=SC1090
    source "$CONFIG_FILE"

    # If config defines CSV_PATH/BACKUP_DIR, prefer them.
    if [[ -n "${CSV_PATH:-}" ]]; then
        CSV_PATH="$CSV_PATH"
    fi
    if [[ -n "${BACKUP_DIR:-}" ]]; then
        BACKUP_DIR="$BACKUP_DIR"
    fi
fi

########################################
# RUNTIME FLAGS
########################################

DRY_RUN=false       # If true, log planned changes without applying them.
SHOW_RULES=false    # If true, show current UFW rules and exit.
COMPARE=false       # If true, compare current vs planned rules and exit.

########################################
# LOGGING HELPERS
########################################

log() {
    echo "$(date +"%Y-%m-%d %H:%M:%S") [INFO] $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo "$(date +"%Y-%m-%d %H:%M:%S") [ERROR] $1" | tee -a "$LOG_FILE" >&2
}

########################################
# USAGE MESSAGE
########################################

usage() {
    cat <<EOF
Usage: $0 [--dry-run] [--show-rules] [--compare] [CSV_FILE]

Options:
  --dry-run       Simulate firewall changes without applying them.
  --show-rules    Display current UFW rules and exit.
  --compare       Show a textual diff between current and planned rules.
  CSV_FILE        Optional path to users CSV. If omitted, the script uses:
                    1) \$HAAS_CSV_PATH (if set), else
                    2) CSV_PATH from /etc/haas-firewall.conf (if present), else
                    3) ${DEFAULT_CSV}

Current resolved defaults:
  CSV_PATH   = ${CSV_PATH}
  BACKUP_DIR = ${BACKUP_DIR}

Examples:
  $0
  $0 --dry-run
  $0 --compare
  $0 --show-rules
  $0 /tmp/test_users.csv
EOF
    exit 1
}

########################################
# ARGUMENT PARSING
########################################

CSV_ARG=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --show-rules)
            SHOW_RULES=true
            shift
            ;;
        --compare)
            COMPARE=true
            shift
            ;;
        -h|--help)
            usage
            ;;
        *)
            if [[ -n "$CSV_ARG" ]]; then
                log_error "Multiple CSV file paths provided. Only one is allowed."
                usage
            fi
            CSV_ARG="$1"
            shift
            ;;
    esac
done

# Final CSV file to use: explicit CLI argument, else resolved default.
CSV_FILE="${CSV_ARG:-$CSV_PATH}"

########################################
# SHOW-RULES MODE (NO CHANGES)
########################################

if [[ "$SHOW_RULES" == true ]]; then
    log "Displaying current UFW rules (no changes will be made):"
    ufw status numbered | tee -a "$LOG_FILE"
    exit 0
fi

########################################
# INITIAL VALIDATION AND SETUP
########################################

log "Starting UFW configuration from CSV."
log "Using CSV file: $CSV_FILE"
$DRY_RUN && log "Dry-run mode ENABLED: no firewall changes will be applied."

# Ensure the CSV exists.
if [[ ! -f "$CSV_FILE" ]]; then
    log_error "CSV file not found at: $CSV_FILE"
    exit 1
fi

# Ensure the validator script exists and is executable.
if [[ ! -x "$VALIDATOR" ]]; then
    log_error "CSV validator script missing or not executable: $VALIDATOR"
    exit 1
fi

########################################
# CSV VALIDATION (STRICT)
########################################

log "Validating CSV file format and contents..."
if ! "$VALIDATOR" "$CSV_FILE"; then
    log_error "CSV validation FAILED. Aborting firewall configuration."
    exit 1
fi
log "CSV validation PASSED."

########################################
# CSV BACKUP
########################################

mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/users_$TIMESTAMP.csv"

log "Creating CSV backup at: $BACKUP_FILE"
cp "$CSV_FILE" "$BACKUP_FILE"
log "CSV backup created successfully."

########################################
# PLANNED RULES BUILDER (FOR COMPARE MODE)
########################################

build_planned_rules() {
    local csv="$1"
    local outfile="$2"

    echo "ALLOW SMB (445/tcp) FROM $HAAS_MACHINES_SUBNET_V4" >> "$outfile"

    tail -n +2 "$csv" | while IFS=',' read -r username ip role; do
        [[ -z "$username" && -z "$ip" && -z "$role" ]] && continue

        role_lower=$(echo "$role" | tr 'A-Z' 'a-z')

        case "$role_lower" in
            administrator)
                echo "ADMIN  FROM $ip : ALLOW 22/tcp (SSH)" >> "$outfile"
                echo "ADMIN  FROM $ip : ALLOW 445/tcp (SMB)" >> "$outfile"
                echo "ADMIN  FROM $ip : ALLOW 9090/tcp (Cockpit)" >> "$outfile"
                ;;
            user)
                echo "USER   FROM $ip : ALLOW 445/tcp (SMB)" >> "$outfile"
                ;;
            *)
                echo "SKIP UNKNOWN ROLE '$role' FOR $username@$ip" >> "$outfile"
                ;;
        esac
    done
}

########################################
# COMPARE MODE (NO CHANGES)
########################################

if [[ "$COMPARE" == true ]]; then
    log "COMPARE mode: showing differences between current and planned rules."

    TMP_CURRENT=$(mktemp)
    TMP_PLANNED=$(mktemp)

    ufw status numbered > "$TMP_CURRENT"
    build_planned_rules "$CSV_FILE" "$TMP_PLANNED"

    diff -u "$TMP_CURRENT" "$TMP_PLANNED" || true

    rm -f "$TMP_CURRENT" "$TMP_PLANNED"

    log "COMPARE mode complete. No firewall changes were applied."
    exit 0
fi

########################################
# APPLY UFW RULES
########################################

apply_ufw_rules() {
    local csv="$1"

    log "Applying UFW rules based on CSV."

    if ! ufw status | grep -q "Status: active"; then
        log "UFW is not active. Enabling UFW..."
        ufw --force enable
    fi

    ########################################
    # GLOBAL HAAS SUBNET SMB RULE
    ########################################
    log "Applying global Haas subnet rule: ALLOW 445/tcp FROM $HAAS_MACHINES_SUBNET_V4"
    if [[ "$DRY_RUN" == false ]]; then
        ufw allow from "$HAAS_MACHINES_SUBNET_V4" to any port 445 comment "haassvc-smb"
    else
        log "DRY-RUN: Would run: ufw allow from $HAAS_MACHINES_SUBNET_V4 to any port 445 comment 'haassvc-smb'"
    fi

    if [[ -n "$HAAS_MACHINES_SUBNET_V6" ]]; then
        log "Applying Haas IPv6 subnet rule: ALLOW 445/tcp FROM $HAAS_MACHINES_SUBNET_V6"
        if [[ "$DRY_RUN" == false ]]; then
            ufw allow from "$HAAS_MACHINES_SUBNET_V6" to any port 445 comment "haassvc-smb-v6"
        else
            log "DRY-RUN: Would run: ufw allow from $HAAS_MACHINES_SUBNET_V6" \
                "to any port 445 comment 'haassvc-smb-v6'"
        fi
    fi

    ########################################
    # PER-USER ROLE-BASED RULES
    ########################################

    while IFS=',' read -r username ip role; do
        [[ -z "$username" && -z "$ip" && -z "$role" ]] && continue

        role_lower=$(echo "$role" | tr 'A-Z' 'a-z')

        case "$role_lower" in
            administrator)
                log "ADMIN: Allowing ports 22, 445, 9090 FROM $username@$ip"

                if [[ "$DRY_RUN" == false ]]; then
                    ufw allow from "$ip" to any port 22 comment "${username}-admin-ssh"
                    ufw allow from "$ip" to any port 445 comment "${username}-admin-smb"
                    ufw allow from "$ip" to any port 9090 comment "${username}-admin-cockpit"
                else
                    log "DRY-RUN: Would allow 22/tcp FROM $ip comment '${username}-admin-ssh'"
                    log "DRY-RUN: Would allow 445/tcp FROM $ip comment '${username}-admin-smb'"
                    log "DRY-RUN: Would allow 9090/tcp FROM $ip comment '${username}-admin-cockpit'"
                fi
                ;;
            user)
                log "USER: Allowing port 445 FROM $username@$ip"

                if [[ "$DRY_RUN" == false ]]; then
                    ufw allow from "$ip" to any port 445 comment "${username}-user-smb"
                else
                    log "DRY-RUN: Would allow 445/tcp FROM $ip comment '${username}-user-smb'"
                fi
                ;;
            *)
                log_error "Encountered unknown role '$role' for user '$username' at IP '$ip'. Skipping entry."
                ;;
        esac

    done < <(tail -n +2 "$csv")

    log "UFW rule application complete."
}

########################################
# MAIN EXECUTION FLOW
########################################

if [[ "$DRY_RUN" == true ]]; then
    log "DRY-RUN mode: No firewall changes will be applied."
    apply_ufw_rules "$CSV_FILE"
    log "DRY-RUN execution finished."
else
    apply_ufw_rules "$CSV_FILE"
    log "Firewall configuration completed successfully."
fi

exit 0
