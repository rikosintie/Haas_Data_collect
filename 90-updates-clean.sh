#!/bin/bash

# /etc/update-motd.d/90-updates-clean

# Run Canonical's apt-check but filter out ESM noise
/usr/lib/update-notifier/apt-check --human-readable 2>/dev/null \
  | grep -v "ESM" \
  | grep -v "Expanded Security Maintenance" \
  | grep -v "ubuntu.com/esm"

# Don't forget to make it executable
# sudo chmod +x /etc/update-motd.d/90-updates-clean
