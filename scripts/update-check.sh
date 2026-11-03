#!/bin/bash

# Errors go to stderr with a non-zero exit so cockpit.spawn() rejects and
# the page shows "Error checking updates" instead of a false "up to date".

# Keep apt update quiet on success, but capture its output for the error case.
# apt-get update can exit 0 when a repo is unreachable (it only warns), so
# also treat fetch failures in the output as an error.
UPDATE_OUT=$(apt-get update -qq 2>&1 </dev/null)
UPDATE_RC=$?
if [ "$UPDATE_RC" -ne 0 ] || echo "$UPDATE_OUT" | grep -qE "Failed to fetch|Some index files failed"; then
    echo "apt-get update failed (exit $UPDATE_RC):" >&2
    echo "$UPDATE_OUT" >&2
    exit 1
fi

# Simulate upgrade to determine what would actually be installed.
# The summary line "N upgraded" is the authoritative count — it respects
# phased/deferred packages the same way a real apt upgrade does.
SIMULATE=$(apt-get upgrade -s 2>&1 </dev/null)
SIMULATE_RC=$?
if [ "$SIMULATE_RC" -ne 0 ]; then
    echo "apt-get upgrade -s failed (exit $SIMULATE_RC):" >&2
    echo "$SIMULATE" >&2
    exit 1
fi

UPGRADED=$(echo "$SIMULATE" | grep -E "^[0-9]+ upgraded" | awk '{print $1}')
if [ -z "$UPGRADED" ]; then
    echo "Could not find the 'N upgraded' summary in apt-get upgrade -s output:" >&2
    echo "$SIMULATE" >&2
    exit 1
fi

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
