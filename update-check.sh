#!/bin/bash

# Suppress all apt update output, including the "N packages can be upgraded" summary
apt-get update -qq >/dev/null 2>&1

# Simulate upgrade to determine what would actually be installed.
# The summary line "N upgraded" is the authoritative count — it respects
# phased/deferred packages the same way a real apt upgrade does.
SIMULATE=$(apt-get upgrade -s 2>/dev/null)

UPGRADED=$(echo "$SIMULATE" | grep -E "^[0-9]+ upgraded" | awk '{print $1}')
UPGRADED=${UPGRADED:-0}

if [ "$UPGRADED" -gt 0 ]; then
    # Output package|version lines for the table display
    echo "$SIMULATE" | grep "^Inst" | awk '{
        pkg = $2
        for (i = 3; i <= NF; i++) {
            if (substr($i, 1, 1) == "(") {
                ver = substr($i, 2)
                print pkg "|" ver
                break
            }
        }
    }'
    echo "UPDATES_AVAILABLE"
else
    echo "System is up to date"
fi

if [ -f /var/run/reboot-required ]; then
    echo "REBOOT_REQUIRED"
fi
