#!/bin/bash
set -e

echo "Updating package lists..."
apt update

echo ""
echo "Upgrading packages..."
DEBIAN_FRONTEND=noninteractive apt -y upgrade

echo ""
echo "Checking reboot status..."
if [ -f /var/run/reboot-required ]; then
  echo "Reboot is required."
else
  echo "No reboot required."
fi

echo ""
echo "Update complete."
