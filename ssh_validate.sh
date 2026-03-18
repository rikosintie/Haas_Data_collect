#!/usr/bin/env bash

# Validate and correct SSH permissions for appliance admin account

SSH_USER="haas"
SSH_HOME="/home/$SSH_USER"
SSH_DIR="$SSH_HOME/.ssh"
AUTH_KEYS="$SSH_DIR/authorized_keys"

if [ -d "$SSH_DIR" ]; then
    echo "Validating SSH permissions for $SSH_USER..."

    # Fix .ssh directory permissions
    if [ "$(stat -c %a $SSH_DIR)" != "700" ]; then
        echo "Fixing $SSH_DIR permissions"
        sudo chmod 700 $SSH_DIR
    fi

    # Fix authorized_keys permissions
    if [ -f "$AUTH_KEYS" ]; then
        if [ "$(stat -c %a $AUTH_KEYS)" != "600" ]; then
            echo "Fixing authorized_keys permissions"
            sudo chmod 600 $AUTH_KEYS
        fi
    fi

    # Ensure ownership is correct
    sudo chown -R $SSH_USER:$SSH_USER $SSH_DIR

else
    echo "SSH directory not found for $SSH_USER. Skipping permission validation."
fi
