#!/bin/bash
set -e

export DEBIAN_FRONTEND=noninteractive
# Same "keep the local file" answer for ucf-managed configs (e.g.
# /etc/samba/smb.conf, which haas-install.sh rewrites).
export UCF_FORCE_CONFFOLD=1

# DEBIAN_FRONTEND only silences debconf. dpkg's own "configuration file
# modified" prompt (e.g. a hand-edited /etc/issue.net) still blocks, and
# cockpit.spawn() has no way to answer it. confdef takes the maintainer's
# default when there is one; confold otherwise keeps the local file
# (the same as answering N). stdin is /dev/null so anything else that
# still prompts fails immediately instead of hanging the page.
# Lock::Timeout makes apt wait for the dpkg lock instead of failing at once.
APT_OPTS=(-y -o DPkg::Lock::Timeout=300 -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold)

# Right after boot, unattended-upgrades / apt-daily often hold apt's locks
# for a few minutes. Wait for them (up to 5 minutes) rather than failing
# with "Could not get lock". Keep in sync with update-check.sh.
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
            echo "Waiting for another apt/dpkg process (automatic updates) to finish..."
        fi
        sleep 5
        waited=$((waited + 5))
    done
}

wait_for_apt

echo "Updating package lists..."
apt-get update </dev/null

echo ""
echo "Upgrading packages..."
# --with-new-pkgs: what the original `apt upgrade` did by default. Plain
# `apt-get upgrade` never installs new packages, so it silently skips
# every kernel update. Keep in sync with update-check.sh.
apt-get "${APT_OPTS[@]}" upgrade --with-new-pkgs </dev/null

echo ""
echo "Checking reboot status..."
if [ -f /var/run/reboot-required ]; then
  echo "Reboot is required."
else
  echo "No reboot required."
fi

echo ""
echo "Update complete."
