#!/usr/bin/env bash
#
# Validate the network configuration
echo "Validating network configuration..."
if sudo netplan generate; then
    echo "Configuration is valid!"
    echo ""
    echo "Testing network configuration with auto-revert..."
    echo "If the network configuration works, you'll be prompted to confirm."
    echo "If you don't confirm within 120 seconds, it will auto-revert."
    echo ""

    # Use netplan try for safe testing with auto-revert
    sudo netplan try

    echo "Network configuration completed!"
else
    echo "ERROR: Invalid netplan configuration!"
    echo "Restoring backup..."
    sudo cp "$BACKUP_FILE" "$NETPLAN_FILE"
    exit 1
fi
