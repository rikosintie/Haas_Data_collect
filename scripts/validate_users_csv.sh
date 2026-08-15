#!/usr/bin/env bash
#
# Haas Appliance - CSV Validator for Firewall Configuration
#
# This script validates the CSV file used to configure the firewall.
# It is intentionally STRICT to prevent bad data from affecting UFW.
#
# The validator checks:
#   1. Header is exactly: username,ip_address,role
#   2. Each non-empty row has exactly 3 fields.
#   3. IP address is a valid IPv4 address.
#   4. Role is either "user" or "administrator" (case-insensitive).
#   5. No duplicate usernames.
#   6. No duplicate IP addresses.
#   7. No missing values for any field.
#
# If any check fails, the script exits with a non-zero status.
# This ensures the main firewall script aborts BEFORE making changes.
#

set -euo pipefail

########################################
# INPUT VALIDATION
########################################

if [[ $# -ne 1 ]]; then
    echo "[ERROR] Usage: $0 <csv_file>"
    exit 1
fi

CSV_FILE="$1"

if [[ -z "$CSV_FILE" ]]; then
    echo "[ERROR] No CSV file path provided."
    exit 1
fi

if [[ ! -f "$CSV_FILE" ]]; then
    echo "[ERROR] CSV file not found: $CSV_FILE"
    exit 1
fi

echo "[*] Validating CSV: $CSV_FILE"

########################################
# HEADER VALIDATION
########################################

EXPECTED_HEADER="username,ip_address,role"
HEADER="$(head -n 1 "$CSV_FILE")"

if [[ "$HEADER" != "$EXPECTED_HEADER" ]]; then
    echo "[ERROR] Invalid CSV header."
    echo "        Expected: $EXPECTED_HEADER"
    echo "        Found:    $HEADER"
    exit 1
fi

########################################
# ROW-BY-ROW VALIDATION (STRICT)
########################################
# For each data row:
#   - Ensure exactly 3 fields.
#   - Ensure no empty fields.
#   - Ensure valid IPv4 for ip_address.
#   - Ensure role is user/administrator.
#   - Ensure username is unique.
#   - Ensure IP address is unique.
########################################

# Bash associative arrays to track duplicates.
declare -A SEEN_USERNAMES
declare -A SEEN_IPS

LINE_NUM=1  # Start at 1 for header; increment as we read data rows.

# Use process substitution to keep everything in the same shell.
while IFS=',' read -r username ip role; do
    LINE_NUM=$((LINE_NUM + 1))

    # Skip completely empty lines (defensive, but usually not present).
    if [[ -z "$username" && -z "$ip" && -z "$role" ]]; then
        continue
    fi

    # Ensure exactly 3 fields (no extra commas).
    FIELD_COUNT=$(echo "$username,$ip,$role" | awk -F',' '{print NF}')
    if [[ "$FIELD_COUNT" -ne 3 ]]; then
        echo "[ERROR] Line $LINE_NUM: Expected 3 fields, found $FIELD_COUNT."
        echo "        Line content: $username,$ip,$role"
        exit 1
    fi

    # Ensure no field is empty.
    if [[ -z "$username" || -z "$ip" || -z "$role" ]]; then
        echo "[ERROR] Line $LINE_NUM: One or more fields are empty."
        echo "        username='$username', ip_address='$ip', role='$role'"
        exit 1
    fi

    # Validate IPv4 format. This checks structure, not subnet.
    if ! echo "$ip" | grep -Eq '^([0-9]{1,3}\.){3}[0-9]{1,3}$'; then
        echo "[ERROR] Line $LINE_NUM: Invalid IPv4 address: $ip"
        exit 1
    fi

    # Additional sanity: ensure each octet is 0-255.
    IFS='.' read -r o1 o2 o3 o4 <<< "$ip"
    for octet in "$o1" "$o2" "$o3" "$o4"; do
        if (( octet < 0 || octet > 255 )); then
            echo "[ERROR] Line $LINE_NUM: IPv4 octet out of range (0-255): $ip"
            exit 1
        fi
    done

    # Normalize role and ensure it's known.
    role_lower=$(echo "$role" | tr 'A-Z' 'a-z')
    case "$role_lower" in
        user|administrator)
            # Valid roles.
            ;;
        *)
            echo "[ERROR] Line $LINE_NUM: Invalid role: $role"
            echo "        Allowed roles: user, administrator"
            exit 1
            ;;
    esac

    # Check for duplicate username.
    if [[ -n "${SEEN_USERNAMES[$username]:-}" ]]; then
        echo "[ERROR] Line $LINE_NUM: Duplicate username detected: $username"
        echo "        First seen earlier at line: ${SEEN_USERNAMES[$username]}"
        exit 1
    fi

    # Check for duplicate IP.
    if [[ -n "${SEEN_IPS[$ip]:-}" ]]; then
        echo "[ERROR] Line $LINE_NUM: Duplicate IP address detected: $ip"
        echo "        First seen earlier at line: ${SEEN_IPS[$ip]}"
        exit 1
    fi

    # Mark username and IP as seen.
    SEEN_USERNAMES["$username"]="$LINE_NUM"
    SEEN_IPS["$ip"]="$LINE_NUM"

done < <(tail -n +2 "$CSV_FILE")

echo "[*] CSV validation PASSED successfully."
exit 0
