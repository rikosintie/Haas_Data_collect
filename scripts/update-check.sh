#!/bin/bash

# Errors go to stderr with a non-zero exit so cockpit.spawn() rejects and
# the page shows "Error checking updates" instead of a false "up to date".

# Right after boot, unattended-upgrades / apt-daily often hold apt's locks
# for a few minutes. Wait for them (up to 5 minutes) rather than failing
# with "Could not get lock". Keep in sync with update-system.sh.
#
# Not `pgrep -x unattended-upgr`: process names are cut to 15 characters,
# so that also matches unattended-upgrade-shutdown, a helper that runs
# permanently (waiting for a reboot signal), never holds the lock, and made
# every check wait 5 minutes and fail. Match the real updater by its full
# command line instead.
apt_busy() {
    pgrep -x 'apt|apt-get|dpkg' >/dev/null ||
        pgrep -f 'python3 /usr/bin/unattended-upgrade( |$)' >/dev/null
}

wait_for_apt() {
    local waited=0
    while apt_busy; do
        if [ "$waited" -ge 300 ]; then
            echo "Another apt/dpkg process is still running after 5 minutes:" >&2
            pgrep -ax 'apt|apt-get|dpkg' >&2
            pgrep -af 'python3 /usr/bin/unattended-upgrade( |$)' >&2
            return 1
        fi
        if [ $((waited % 30)) -eq 0 ]; then
            echo "Waiting for another apt/dpkg process (automatic updates) to finish..." >&2
        fi
        sleep 5
        waited=$((waited + 5))
    done
}

wait_for_apt || exit 1

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
# --with-new-pkgs must match update-system.sh: plain `apt-get upgrade`
# never installs new packages, so it keeps back every kernel update (each
# one is a new linux-image-<version> package) and reported "up to date"
# while the login banner showed updates waiting.
SIMULATE=$(apt-get upgrade -s --with-new-pkgs 2>&1 </dev/null)
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

# Anything still left over is deferred by Ubuntu's phased rollout (it
# arrives on its own over a few days) or held back. Say so, so this count
# doesn't look like a contradiction of the login banner's "N updates".
NOT_UPGRADED=$(echo "$SIMULATE" | grep -E "^[0-9]+ upgraded" | grep -oE "[0-9]+ not upgraded" | awk '{print $1}')
if [ "${NOT_UPGRADED:-0}" -gt 0 ]; then
    echo "Note: $NOT_UPGRADED more package(s) deferred by Ubuntu's phased rollout or held back — not installed yet."
fi

if [ -f /var/run/reboot-required ]; then
    echo "REBOOT_REQUIRED"
fi
