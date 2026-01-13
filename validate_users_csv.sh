#!/usr/bin/env bash
set -euo pipefail

CSV_FILE="$1"

if [[ -z "$CSV_FILE" ]]; then
    echo "[ERROR] No CSV file provided."
    exit 1
fi

if [[ ! -f "$CSV_FILE" ]]; then
    echo "[ERROR] CSV file not found: $CSV_FILE"
    exit 1
fi

echo "[*] Validating CSV: $CSV_FILE"

HEADER="$(head -n 1 "$CSV_FILE")"
if [[ "$HEADER" != "username,desktop_ip_address,role" ]]; then
    echo "[ERROR] Invalid CSV header. Expected:"
    echo "username,desktop_ip_address,role"
    exit 1
fi

LINE_NUM=1
tail -n +2 "$CSV_FILE" | while IFS=',' read -r username ip role; do
    LINE_NUM=$((LINE_NUM+1))

    [[ -z "$username" && -z "$ip" && -z "$role" ]] && continue

    FIELD_COUNT=$(echo "$username,$ip,$role" | awk -F',' '{print NF}')
    if [[ "$FIELD_COUNT" -ne 3 ]]; then
        echo "[ERROR] Line $LINE_NUM: Expected 3 fields, got $FIELD_COUNT"
        exit 1
    fi

    if ! echo "$ip" | grep -Eq '^([0-9]{1,3}\.){3}[0-9]{1,3}$'; then
        echo "[ERROR] Line $LINE_NUM: Invalid IPv4 address: $ip"
        exit 1
    fi

    case "$(echo "$role" | tr 'A-Z' 'a-z')" in
        user|administrator)
            ;;
        *)
            echo "[ERROR] Line $LINE_NUM: Invalid role: $role"
            exit 1
            ;;
    esac
done

echo "[*] CSV validation passed."
