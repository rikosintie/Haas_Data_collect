#!/usr/bin/env bash
set -euo pipefail

LOG_FILE="/var/log/haas-firewall.log"

DEFAULT_CSV="/home/mhubbard/Haas_Data_collect/users.csv"
BACKUP_DIR="/home/mhubbard/Haas_Data_collect/backups"
VALIDATOR="/usr/local/sbin/validate_users_csv.sh"

HAAS_MACHINES_SUBNET_V4="192.168.50.0/24"
HAAS_MACHINES_SUBNET_V6=""

DRY_RUN=false
SHOW_RULES=false
COMPARE=false

log() {
    echo "$(date +"%Y-%m-%d %H:%M:%S") [INFO] $1" | tee -a "$LOG_FILE"
}

log_error() {
    echo "$(date +"%Y-%m-%d %H:%M:%S") [ERROR] $1" | tee -a "$LOG_FILE" >&2
}

usage() {
    cat <<EOF
Usage: $0 [--dry-run] [--show-rules] [--compare] [CSV_FILE]
EOF
    exit 1
}

CSV_ARG=""
while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run) DRY_RUN=true; shift ;;
        --show-rules) SHOW_RULES=true; shift ;;
        --compare) COMPARE=true; shift ;;
        -h|--help) usage ;;
        *) CSV_ARG="$1"; shift ;;
    esac
done

CSV_FILE="${CSV_ARG:-$DEFAULT_CSV}"

if [[ "$SHOW_RULES" == true ]]; then
    log "Displaying current UFW rules:"
    ufw status numbered | tee -a "$LOG_FILE"
    exit 0
fi

log "Starting UFW configuration."
log "Using CSV: $CSV_FILE"
$DRY_RUN && log "Dry-run mode enabled."

if [[ ! -f "$CSV_FILE" ]]; then
    log_error "CSV not found: $CSV_FILE"
    exit 1
fi

if [[ ! -x "$VALIDATOR" ]]; then
    log_error "Validator missing: $VALIDATOR"
    exit 1
fi

log "Validating CSV..."
if ! "$VALIDATOR" "$CSV_FILE"; then
    log_error "CSV validation failed."
    exit 1
fi
log "CSV validation passed."

mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="$BACKUP_DIR/users_$TIMESTAMP.csv"

log "Backing up CSV to $BACKUP_FILE"
cp "$CSV_FILE" "$BACKUP_FILE"

build_planned_rules() {
    local csv="$1"
    local outfile="$2"

    echo "ALLOW from $HAAS_MACHINES_SUBNET_V4 to port 445 # haassvc-smb" >> "$outfile"

    tail -n +2 "$csv" | while IFS=',' read -r username ip role; do
        [[ -z "$username" && -z "$ip" && -z "$role" ]] && continue
        role_lower=$(echo "$role" | tr 'A-Z' 'a-z')
        echo "ALLOW from $ip to port 22 # $username-$role_lower" >> "$outfile"
    done
}

if [[ "$COMPARE" == true ]]; then
    log "Comparing current vs planned rules..."

    TMP_CURRENT=$(mktemp)
    TMP_PLANNED=$(mktemp)

    ufw status numbered > "$TMP_CURRENT"
    build_planned_rules "$CSV_FILE" "$TMP_PLANNED"

    diff -u "$TMP_CURRENT" "$TMP_PLANNED" || true

    rm "$TMP_CURRENT" "$TMP_PLANNED"
    exit 0
fi

apply_ufw_rules() {
    local csv="$1"

    log "Applying UFW rules..."

    if ! ufw status | grep -q "Status: active"; then
        log "Enabling UFW..."
        ufw --force enable
    fi

    log "Allowing SMB from Haas subnet: $HAAS_MACHINES_SUBNET_V4"
    [[ "$DRY_RUN" == false ]] && ufw allow from "$HAAS_MACHINES_SUBNET_V4" to any port 445 comment "haassvc-smb"

    if [[ -n "$HAAS_MACHINES_SUBNET_V6" ]]; then
        log "Allowing SMB from Haas IPv6 subnet: $HAAS_MACHINES_SUBNET_V6"
        [[ "$DRY_RUN" == false ]] && ufw allow from "$HAAS_MACHINES_SUBNET_V6" to any port 445 comment "haassvc-smb-v6"
    fi

    tail -n +2 "$csv" | while IFS=',' read -r username ip role; do
        [[ -z "$username" && -z "$ip" && -z "$role" ]] && continue

        role_lower=$(echo "$role" | tr 'A-Z' 'a-z')
        log "Allowing SSH from $username@$ip"

        [[ "$DRY_RUN" == false ]] && ufw allow from "$ip" to any port 22 comment "$username-$role_lower"
    done

    log "Firewall update complete."
}

if [[ "$DRY_RUN" == true ]]; then
    log "Dry-run: simulating firewall changes."
    apply_ufw_rules "$CSV_FILE"
    log "Dry-run complete."
else
    apply_ufw_rules "$CSV_FILE"
fi

exit 0
