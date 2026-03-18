#!/bin/bash

# Usage:
#   ./script.sh <username> [--set-password]

create_samba_user() {
    if [ "$#" -lt 1 ]; then
        echo "Usage: $0 <username> [--set-password]" >&2
        return 1
    fi

    local USERNAME="$1"
    local SET_PASSWORD=false
    local GROUP_NAME="HaasGroup"

    if [[ "$2" == "--set-password" ]]; then
        SET_PASSWORD=true
    fi

    echo "Processing user: $USERNAME"

    # Check if Linux user exists
    if id "$USERNAME" &>/dev/null; then
        echo "User $USERNAME already exists."

        # Optional interactive prompt if flag not set
        if [ "$SET_PASSWORD" = false ]; then
            read -p "User exists. Update passwords? (y/N): " choice
            [[ "$choice" =~ ^[Yy]$ ]] && SET_PASSWORD=true
        fi

        if $SET_PASSWORD; then
            echo "Updating system password for $USERNAME"
            sudo passwd "$USERNAME" || {
                echo "Error setting system password for $USERNAME." >&2
                return 1
            }
        fi
    else
        echo "Creating system user $USERNAME"
        sudo useradd -M -s /usr/sbin/nologin "$USERNAME" || {
            echo "Error creating system user $USERNAME." >&2
            return 1
        }

        sudo passwd "$USERNAME" || {
            echo "Error setting system password for $USERNAME." >&2
            return 1
        }
    fi

    # Check if Samba user exists
    if pdbedit -L | cut -d: -f1 | grep -qx "$USERNAME"; then
        echo "Samba user $USERNAME already exists."

        if $SET_PASSWORD; then
            echo "Updating Samba password for $USERNAME"
            sudo smbpasswd "$USERNAME" || {
                echo "Error updating Samba password for $USERNAME." >&2
                return 1
            }
        fi
    else
        echo "Creating Samba user $USERNAME"
        sudo smbpasswd -a "$USERNAME" || {
            echo "Error adding user to Samba database $USERNAME." >&2
            return 1
        }
    fi

    # Ensure Samba account is enabled
    sudo smbpasswd -e "$USERNAME" || {
        echo "Error enabling Samba account for $USERNAME." >&2
        return 1
    }

    # Add user to group (if it exists)
    if getent group "$GROUP_NAME" > /dev/null; then
        sudo usermod -aG "$GROUP_NAME" "$USERNAME" || {
            echo "Warning: Failed to add $USERNAME to $GROUP_NAME" >&2
        }
    else
        echo "Warning: Group $GROUP_NAME does not exist. Skipping group assignment."
    fi

    echo "Configuration complete for $USERNAME"
    echo "User info:"
    id "$USERNAME"
}

create_samba_user "$@"
