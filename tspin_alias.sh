#!/bin/bash
# tspin_alias.sh
# Create aliases for tailspin
# t-samba Check Samba logs
# t-ssh Check ssh logs
# t-cockpit Check cockpit logs
# t-health Check for Samba, ssh and Cockpit issues

# Define the aliases in a variable
ALIASES="
# Tailspin Aliases
alias t-samba='sudo tail -f /var/log/samba/log.smbd | tspin'
alias t-ssh='sudo tail -f /var/log/auth.log | tspin'
alias t-cockpit='sudo journalctl -u cockpit -f | tspin'
alias t-health='sudo journalctl -u smbd -u ssh -u cockpit -f | tspin'
"

# Check if already added to avoid duplicates, then append
if ! grep -q "t-health" ~/.bashrc; then
    echo "$ALIASES" >> ~/.bashrc
    echo "Aliases appended to ~/.bashrc"
else
    echo "Aliases already exist in ~/.bashrc"
fi

# Check if already added to avoid duplicates, then append
if ! grep -q "t-health" ~/.zshrc; then
    echo "$ALIASES" >> ~/.zshrc
    echo "Aliases appended to ~/.zshrc"
else
    echo "Aliases already exist in ~/.zshrc"
fi
