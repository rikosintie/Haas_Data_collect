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
#        (Admin IPs may be on ANY subnet, not just 192.168.10.0/24)
#      * Role "user":
#           - Allow 445/tcp (SMB) FROM <ip>
#
# CSV FORMAT (STRICT):
#   Header (must match exactly):
#       username,ip_address,role
#
#   Example:
#       username,ip_address,role
#       mhubbard,192.168.1.50,Administrator
#       haassvc,192.168.10.104,user
#
# NOTES:
#   - This script must be run as root or via sudo.
#   - UFW must be installed and available.
#

set -euo pipefail

########################################
# CONFIGURATION CONSTANTS
########################################

# Central log file for firewall operations.
LOG_FILE="/var/log/haas-firewall.log"

# Default CSV file location used by systemd and normal operation.
DEFAULT_CSV="/home/mhubbard/Haas_Data_collect/users.csv"

# Directory where CSV backups will be stored.
BACKUP_DIR="/home/mhubbard/Haas_Data_collect/backups"

# CSV validator script path.
VALIDATOR="/usr/local/sbin/validate_users_csv.sh"

# Haas subnet for global SMB access to CNC machines.
HAAS_MACHINES_SUBNET_V4="192.168.50.0/24"

# Optional IPv6 subnet (left empty if not used).
HAAS_MACHINES_SUBNET_V6=""

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
    #
    # Log informational messages with timestamps.
    #
    echo "$(date +"%Y-%m-%d %H:%M:%S") [INFO] $1" | tee -a "$LOG_FILE"
}

log_error() {
    #
    # Log error messages with timestamps.
    #
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
  CSV_FILE        Optional path to users CSV. Defaults to:
                  ${DEFAULT_CSV}

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
            #
            # Any non-flag argument is treated as the CSV filepath.
            # Only a single CSV argument is allowed for simplicity.
            #
            if [[ -n "$CSV_ARG" ]]; then
                log_error "Multiple CSV file paths provided. Only one is allowed."
                usage
            fi
            CSV_ARG="$1"
            shift
            ;;
    esac
done

# Resolve final CSV path: explicit argument or default.
CSV_FILE="${CSV_ARG:-$DEFAULT_CSV}"

########################################
# SHOW-RULES MODE (NO CHANGES)
########################################

if [[ "$SHOW_RULES" == true ]]; then
    #
    # This mode is read-only. It simply displays the current UFW rules
    # in numbered form and exits. Useful for operators and debugging.
    #
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
# The validator script is responsible for:
#  - Header correctness (username,ip_address,role)
#  - Valid IP format
#  - Valid role names (user/administrator)
#  - No duplicate usernames
#  - No duplicate IP addresses
#  - No missing or extra fields
#
# If validation fails, we abort BEFORE any firewall changes or backups.
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
# For auditability and rollback safety, we back up the exact CSV used
# for each run, with a timestamped filename.
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
# This function does NOT call UFW; it only writes a textual representation of
# the rules that WOULD be applied, in a simplified human-readable format.
########################################

build_planned_rules() {
    local csv="$1"
    local outfile="$2"

    # Global Haas subnet SMB rule.
    echo "ALLOW SMB (445/tcp) FROM $HAAS_MACHINES_SUBNET_V4" >> "$outfile"

    # Per-user role-based rules from CSV.
    # We skip the header and process each data row.
    tail -n +2 "$csv" | while IFS=',' read -r username ip role; do
        # Skip completely empty lines.
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
                # Strict validator should prevent this, but we guard for safety.
                echo "SKIP UNKNOWN ROLE '$role' FOR $username@$ip" >> "$outfile"
                ;;
        esac
    done
}

########################################
# COMPARE MODE (NO CHANGES)
########################################
# In this mode, we compare:
#   - The current UFW rules (as reported by "ufw status numbered")
#   - The planned rules derived from the CSV and our policy
#
# The output is a unified diff (diff -u) to help operators see what
# would change WITHOUT applying any firewall modifications.
########################################

if [[ "$COMPARE" == true ]]; then
    log "COMPARE mode: showing differences between current and planned rules."

    TMP_CURRENT=$(mktemp)
    TMP_PLANNED=$(mktemp)

    # Capture current UFW rules.
    ufw status numbered > "$TMP_CURRENT"

    # Build a textual representation of planned rules.
    build_planned_rules "$CSV_FILE" "$TMP_PLANNED"

    # Display a unified diff. If there are differences, diff exits with 1,
    # so we OR with "true" to avoid failing the script.
    diff -u "$TMP_CURRENT" "$TMP_PLANNED" || true

    # Clean up temporary files.
    rm -f "$TMP_CURRENT" "$TMP_PLANNED"

    log "COMPARE mode complete. No firewall changes were applied."
    exit 0
fi

########################################
# APPLY UFW RULES
########################################
# This function performs the actual firewall configuration.
# It respects DRY_RUN mode:
#   - When DRY_RUN=true, it only logs intended changes.
#   - When DRY_RUN=false, it applies UFW rules.
########################################

apply_ufw_rules() {
    local csv="$1"

    log "Applying UFW rules based on CSV."

    #
    # Ensure UFW is enabled. We do not disable or reset UFW here;
    # that should be a separate explicit operation if ever required.
    #
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

    # Optional IPv6 rule if configured.
    if [[ -n "$HAAS_MACHINES_SUBNET_V6" ]]; then
        log "Applying Haas IPv6 subnet rule: ALLOW 445/tcp FROM $HAAS_MACHINES_SUBNET_V6"
        if [[ "$DRY_RUN" == false ]]; then
            ufw allow from "$HAAS_MACHINES_SUBNET_V6" to any port 445 comment "haassvc-smb-v6"
        else
            log "DRY-RUN: Would run: ufw allow from $HAAS_MACHINES_SUBNET_V6 to any port 445 comment 'haassvc-smb-v6'"
        fi
    fi

    ########################################
    # PER-USER ROLE-BASED RULES
    ########################################
    # For each CSV row:
    #   - Determine role (administrator/user)
    #   - Apply port rules accordingly
    ########################################

    # We use process substitution (< <(...)) instead of a pipe so that any
    # variables modified inside the loop (if needed in the future) remain
    # in the same shell process.
    while IFS=',' read -r username ip role; do
        # Skip empty lines (defensive; validator should catch malformed lines).
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
                # This should not occur due to strict validation, but logged defensively.
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
