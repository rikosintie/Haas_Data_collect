#!/bin/bash

apt update -qq

apt list --upgradable 2>/dev/null | \
grep -v Listing | \
awk -F/ '{print $1 "|" $2}'

COUNT=$(apt list --upgradable 2>/dev/null | grep -v Listing | wc -l)

if [ "$COUNT" -gt 0 ]; then
  echo "UPDATES_AVAILABLE"
else
  echo "System is up to date"
fi

if [ -f /var/run/reboot-required ]; then
  echo "REBOOT_REQUIRED"
fi
