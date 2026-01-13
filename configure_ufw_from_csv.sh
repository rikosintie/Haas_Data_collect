#!/usr/bin/env bash
set -euo pipefail

#
# Haas Appliance - UFW Configuration from CSV
#
# Features:
#   - Validates CSV before applying rules
#   - Creates timestamped backups
#   - Supports --dry-run, --show-rules, --compare
#   - Applies firewall rules based on CSV
#   - Designed for systemd automation AND manual developer use
#

LOG_FILE="/var/log/haas-firewall.log"

# Default CSV location (used by systemd)
DEFAULT_CSV="/home/mhubbard/Haas_Data_collect/users.csv"

# Backup directory
BACKUP_DIR="/home/mhubbard/Haas_Data_collect/backups"

# Validator script path
VALIDATOR="/usr/local/sbin/validate_users_csv.sh"

# Flags
DRY_RUN=false
SHOW_RULES=false
COMPARE=false

#######################################
# Logging helpers
#######################################
log() {
    echo "$(date +"%Y-%m-%d %H:%M:%S") [INFO] $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo "$(date +"%Y-%m-%d %H:%M:%S") [ERROR] $1" | tee -a "$LOG_FILE" >&2
}

#######################################
# Usage
#######################################
usage() {
    cat <<EOF
Usage: $0 [--dry-run] [--show-rules] [--compare] [CSV_FILE]

Options:
  --dry-run       Simulate firewall changes without applying them
  --show-rules    Display current UFW rules and exit
  --compare       Show diff between current rules and planned rules
  CSV_FILE        Optional path to users.csv (default: $DEFAULT_CSV)

Examples:
  $0
  $0 --dry-run
  $0 --show-rules
  $0 --compare
  $0 /tmp/test.csv
EOF
    exit 1
}

#######################################
# Parse arguments
#######################################
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
                log_error "Multiple CSV paths provided."
                usage
            fi
            CSV_ARG="$1"
            shift
            ;;
    esac
done

# Use provided CSV or fallback to default
CSV_FILE="${CSV_ARG:-$DEFAULT_CSV}"

#######################################
# --show-rules mode
#######################################
if [[ "$SHOW_RULES" == true ]]; then
    log "Displaying current UFW rules:"
    ufw status numbered | tee -a "$LOG_FILE"
    exit 0
fi

#######################################
# Start
#######################################
log "Starting UFW configuration from CSV."
log "Using CSV file: $CSV_FILE"
$DRY_RUN && log "Running in DRY-RUN mode. No changes will be applied."

# Verify CSV exists
if [[ ! -f "$CSV_FILE" ]]; then
    log_error "CSV file not found: $CSV_FILE"
    exit 1
fi

# Verify validator exists
if [[ ! -x "$VALIDATOR" ]]; then
    log_error "Validator script missing or not executable: $VALIDATOR"
    exit 1
fi

#######################################
# Validate CSV
#######################################
log "Validating CSV..."
if ! "$VALIDATOR" "$CSV_FILE"; then
    log_error "CSV validation failed. Aborting."
    exit 1
fi
log "CSV validation passed."

#######################################
# Backup CSV
#######################################
mkdir -p "$BACKUP_DIR"

TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/users_$TIMESTAMP.csv"

log "Creating backup: $BACKUP_FILE"
cp "$CSV_FILE" "$BACKUP_FILE"
log "Backup created."

#######################################
# Build planned rules (for compare/dry-run)
#######################################
build_planned_rules() {
    local csv="$1"
    local outfile="$2"

    tail -n +2 "$csv" | while IFS=',' read -r username ip role; do
        [[ -z "$username" && -z "$ip" && -z "$role" ]] && continue
        role_lower=$(echo "$role" | tr 'A-Z' 'a-z')
        echo "ALLOW from $ip to port 22 # $username-$role_lower" >> "$outfile"
    done
}

#######################################
# --compare mode
#######################################
if [[ "$COMPARE" == true ]]; then
    log "Comparing current UFW rules with planned rules..."

    TMP_CURRENT=$(mktemp)
    TMP_PLANNED=$(mktemp)

    ufw status numbered > "$TMP_CURRENT"
    build_planned_rules "$CSV_FILE" "$TMP_PLANNED"

    diff -u "$TMP_CURRENT" "$TMP_PLANNED" || true

    rm "$TMP_CURRENT" "$TMP_PLANNED"
    exit 0
fi

#######################################
# Apply UFW rules
#######################################
apply_ufw_rules() {
    local csv="$1"

    log "Applying UFW rules..."

    # Ensure UFW is enabled
    if ! ufw status | grep -q "Status: active"; then
        log "UFW not active. Enabling..."
        ufw --force enable
    fi

    # Apply rules
    tail -n +2 "$csv" | while IFS=',' read -r username ip role; do
        [[ -z "$username" && -z "$ip" && -z "$role" ]] && continue

        role_lower=$(echo "$role" | tr 'A-Z' 'a-z')
        rule_desc="Allow SSH from $username@$ip (role: $role_lower)"

        log "Planned rule: $rule_desc"

        if [[ "$DRY_RUN" == false ]]; then
            ufw allow from "$ip" to any port 22 comment "$username-$role_lower"
        fi
    done

    log "UFW rule application complete."
}

#######################################
# Execute rule application
#######################################
if [[ "$DRY_RUN" == true ]]; then
    log "Dry-run mode: simulating firewall changes."
    apply_ufw_rules "$CSV_FILE"
    log "Dry-run complete. No changes applied."
else
    apply_ufw_rules "$CSV_FILE"
    log "Firewall updated successfully."
fi

exit 0
