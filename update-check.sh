#!/bin/bash

apt update -qq

# Simulate upgrade to find packages that would actually install.
# Unlike 'apt list --upgradable', this excludes deferred/phased packages
# that apt upgrade will not install.
INST_LINES=$(apt-get upgrade -s 2>/dev/null | grep "^Inst")
COUNT=$(echo "$INST_LINES" | grep -c "^Inst" 2>/dev/null || echo 0)

if [ "$COUNT" -gt 0 ]; then
    # Format as package|version for the table display
    echo "$INST_LINES" | awk '{
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
