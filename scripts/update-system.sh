#!/bin/bash
set -e

export DEBIAN_FRONTEND=noninteractive

# DEBIAN_FRONTEND only silences debconf. dpkg's own "configuration file
# modified" prompt (e.g. a hand-edited /etc/issue.net) still blocks, and
# cockpit.spawn() has no way to answer it. confdef takes the maintainer's
# default when there is one; confold otherwise keeps the local file
# (the same as answering N). stdin is /dev/null so anything else that
# still prompts fails immediately instead of hanging the page.
APT_OPTS=(-y -o Dpkg::Options::=--force-confdef -o Dpkg::Options::=--force-confold)

echo "Updating package lists..."
apt-get update </dev/null

echo ""
echo "Upgrading packages..."
apt-get "${APT_OPTS[@]}" upgrade </dev/null

echo ""
echo "Checking reboot status..."
if [ -f /var/run/reboot-required ]; then
  echo "Reboot is required."
else
  echo "No reboot required."
fi

echo ""
echo "Update complete."
