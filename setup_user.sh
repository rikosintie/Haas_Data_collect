#!/bin/bash

# Function to create a new system user with specific configurations (e.g., Samba, group membership)
# Usage: create_samba_user <username>
create_samba_user() {
    # Check if exactly one argument (the username) was provided
    if [ "$#" -ne 1 ]; then
        echo "Error: Usage requires exactly one argument: create_samba_user <username>" >&2
        return 1
    fi

    local USERNAME="$1"
    local GROUP_NAME="HaasGroup"

    echo "Attempting to create and configure user: $USERNAME"

    # 1. Create the system user without a home directory and a nologin shell
    # Error trapping: '|| { ...; return 1; }' stops execution if a command fails
    sudo useradd -M -s /usr/sbin/nologin "$USERNAME" || {
        echo "Error creating system user $USERNAME. User may already exist or permissions issue." >&2
        return 1
    }
    echo "System user $USERNAME created."

    # 2. Set the system password (will prompt for a new password interactively)
    # The user running this script will be prompted by 'passwd' to set the password.
    sudo passwd "$USERNAME" || {
        echo "Error setting system password for $USERNAME." >&2
        return 1
    }

    # 3. Add user to Samba database and set the Samba password
    # The user running this script will be prompted by 'smbpasswd' to set the Samba password.
    sudo smbpasswd -a "$USERNAME" || {
        echo "Error adding user to Samba database $USERNAME." >&2
        # Clean up the system user if Samba setup fails
        sudo userdel "$USERNAME"
        return 1
    }

    # 4. Enable the Samba account
    sudo smbpasswd -e "$USERNAME" || {
        echo "Error enabling Samba account for $USERNAME." >&2
        sudo userdel "$USERNAME"
        return 1
    }

    # 5. Add the user to the specified group (e.g., HaasGroup)
    # Note: Ensure 'HaasGroup' exists on your system beforehand.
    sudo usermod -aG "$GROUP_NAME" "$USERNAME" || {
        echo "Warning: Failed to add $USERNAME to the group $GROUP_NAME. Proceeding anyway." >&2
    }

    echo "Configuration complete for $USERNAME."

    # 6. Display the final user ID/group information for verification
    echo "Verifying user configuration:"
    id "$USERNAME"
}

create_samba_user "$@"

# --- Example Usage ---
# To run this function, save the script (e.g., as setup_user.sh),
# make it executable (chmod +x setup_user.sh), and run it.

# Example 1: Create user 'jdoe'
# create_samba_user jdoe
