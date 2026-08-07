#!/bin/bash

# Usage:
# Usage:
#   ./manage_users.sh <username> [--set-password] [--delete-user] [--admin-user]
#                          [--ssh-key="..."] [--ssh-key-file=file]
#                          [--force] [--dry-run]
#
# Add a normal user (interactive if needed)
# sudo ./manage_users.sh jdoe
# Reset passwords
# sudo ./manage_users.sh jdoe --set-password
# Delete user (with prompt)
# sudo ./manage_users.sh jdoe --delete-user
# Delete user silently (automation safe)
# sudo ./manage_users.sh jdoe --delete-user --force
# Show what would happen (no changes made)
# sudo ./manage_users.sh jdoe --dry-run
# Combine for safe automation testing
# sudo ./manage_users.sh jdoe --delete-user --dry-run
#Add an admin user
# sudo ./manage_users.sh mspadmin --admin-user
# Add admin user with SSH key from file
# sudo ./manage_users.sh mspadmin --admin-user --ssh-key-file=/path/to/key.pub
# Add admin user with SSH key from argument
# sudo ./manage_users.sh mspadmin --ssh-key="ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQC..."


# Check for root FIRST
if [[ $EUID -ne 0 ]]; then
  echo "[ERROR] This script must be run as root" >&2
  exit 1
fi

create_samba_user() {
    if [ "$#" -lt 1 ]; then
        echo "Usage: $0 <username> [options]" >&2
        return 1
    fi

    local USERNAME="$1"
    local SET_PASSWORD=false
    local DELETE_USER=false
    local ADMIN_USER=false
    local FORCE=false
    local DRY_RUN=false
    local GROUP_NAME="HaasGroup"

    local SSH_KEY=""
    local SSH_KEY_FILE=""

    # ---------------------------
    # Logging
    # ---------------------------
    local LOG_FILE
    LOG_FILE="/var/log/user_mgmt_$(date +%Y%m%d_%H%M%S).log"
    exec > >(tee -a "$LOG_FILE") 2>&1

    echo "==== $(date) ===="
    echo "Log file: $LOG_FILE"

    # ---------------------------
    # Parse arguments
    # ---------------------------
    for arg in "$@"; do
        case "$arg" in
            --set-password) SET_PASSWORD=true ;;
            --delete-user) DELETE_USER=true ;;
            --admin-user) ADMIN_USER=true ;;
            --force) FORCE=true ;;
            --dry-run) DRY_RUN=true ;;
            --ssh-key=*)
                SSH_KEY="${arg#*=}"
                ;;
            --ssh-key-file=*)
                SSH_KEY_FILE="${arg#*=}"
                ;;
        esac
    done

    # ---------------------------
    # Enforce SSH key requires admin
    # ---------------------------
    if [[ -n "$SSH_KEY" || -n "$SSH_KEY_FILE" ]]; then
        if [[ "$ADMIN_USER" == false ]]; then
            echo "ERROR: --ssh-key requires --admin-user" >&2
            echo "Reason: SSH access requires a valid shell, which is only assigned to admin users." >&2
            return 1
        fi
    fi

    # ---------------------------
    # Helper: run command
    # ---------------------------
    run_cmd() {
        if $DRY_RUN; then
            printf '[DRY-RUN] %q ' "$@"
            echo
        else
            "$@"
        fi
    }

    echo "Processing user: $USERNAME"

    # ---------------------------
    # Load SSH key from file
    # ---------------------------
    if [[ -n "$SSH_KEY_FILE" ]]; then
        if [[ -f "$SSH_KEY_FILE" ]]; then
            SSH_KEY=$(<"$SSH_KEY_FILE")
        else
            echo "Error: SSH key file not found: $SSH_KEY_FILE" >&2
            return 1
        fi
    fi

    # ---------------------------
    # DELETE MODE
    # ---------------------------
    if $DELETE_USER; then
        echo "DELETE MODE ENABLED for $USERNAME"

        if ! $FORCE; then
            read -p "Are you sure you want to delete user '$USERNAME'? (y/N): " confirm
            [[ ! "$confirm" =~ ^[Yy]$ ]] && { echo "Aborting."; return 1; }
        else
            echo "[FORCE] Skipping confirmation"
        fi

        local SAMBA_DELETE_FAILED=false
        local LINUX_DELETE_FAILED=false

        # Remove Samba user
        if pdbedit -L | cut -d: -f1 | grep -qx "$USERNAME"; then
            echo "Deleting Samba user"
            run_cmd sudo smbpasswd -x "$USERNAME"
            local SMBPASSWD_STATUS=$?
            if [[ $SMBPASSWD_STATUS -ne 0 ]]; then
                echo "ERROR: Failed to delete Samba user '$USERNAME' (smbpasswd -x exit $SMBPASSWD_STATUS)." >&2
                SAMBA_DELETE_FAILED=true
            fi
        else
            echo "Samba user does not exist"
        fi

        # Remove Linux user
        if id "$USERNAME" &>/dev/null; then
            echo "Deleting Linux user"
            run_cmd sudo userdel "$USERNAME"
            local USERDEL_STATUS=$?
            if [[ $USERDEL_STATUS -ne 0 ]]; then
                if [[ $USERDEL_STATUS -eq 8 ]]; then
                    echo "ERROR: '$USERNAME' still has an active login session (running process) — not deleted." >&2
                    echo "Terminate their session first (e.g. 'sudo pkill -KILL -u $USERNAME'), then retry --delete-user." >&2
                else
                    echo "ERROR: Failed to delete Linux user '$USERNAME' (userdel exit $USERDEL_STATUS)." >&2
                fi
                LINUX_DELETE_FAILED=true
            fi
        else
            echo "Linux user does not exist"
        fi

        if $SAMBA_DELETE_FAILED || $LINUX_DELETE_FAILED; then
            echo "Deletion FAILED — see errors above. Account may be only partially removed." >&2
            return 1
        fi

        echo "Deletion complete"
        return 0
    fi

    # ---------------------------
    # CREATE / UPDATE USER
    # ---------------------------
    if id "$USERNAME" &>/dev/null; then
        echo "User exists"

        # Prevent SSH key on nologin user unless admin flag used
        current_shell=$(getent passwd "$USERNAME" | cut -d: -f7)
        if [[ "$current_shell" == "/usr/sbin/nologin" && -n "$SSH_KEY" ]]; then
            echo "ERROR: Existing user has nologin shell." >&2
            echo "Use --admin-user to enable SSH access." >&2
            return 1
        fi

        if ! $SET_PASSWORD && ! $FORCE; then
            read -p "Update passwords? (y/N): " choice
            [[ "$choice" =~ ^[Yy]$ ]] && SET_PASSWORD=true
        fi

        if $SET_PASSWORD; then
            echo "Updating system password"
            run_cmd sudo passwd "$USERNAME"
        fi
    else
        if $ADMIN_USER; then
            echo "Creating ADMIN user"
            run_cmd sudo useradd -m -s /bin/bash -c "MSP Admin Account" "$USERNAME"
            run_cmd sudo usermod -aG sudo "$USERNAME"
        else
            echo "Creating standard Samba user"
            run_cmd sudo useradd -M -s /usr/sbin/nologin "$USERNAME"
        fi

        run_cmd sudo passwd "$USERNAME"
    fi

    # ---------------------------
    # Samba configuration
    # ---------------------------
    if pdbedit -L | cut -d: -f1 | grep -qx "$USERNAME"; then
        echo "Samba user exists"

        if $SET_PASSWORD; then
            echo "Updating Samba password"
            run_cmd sudo smbpasswd "$USERNAME"
        fi
    else
        echo "Creating Samba user"
        run_cmd sudo smbpasswd -a "$USERNAME"
    fi

    run_cmd sudo smbpasswd -e "$USERNAME"

    # ---------------------------
    # Group assignment
    # ---------------------------
    if getent group "$GROUP_NAME" > /dev/null; then
        run_cmd sudo usermod -aG "$GROUP_NAME" "$USERNAME"
    else
        echo "Warning: Group $GROUP_NAME does not exist"
    fi

    # ---------------------------
    # SSH Key Setup (admin only)
    # ---------------------------
    if [[ -n "$SSH_KEY" ]]; then
        echo "Configuring SSH key"

        SSH_DIR="/home/$USERNAME/.ssh"
        AUTH_KEYS="$SSH_DIR/authorized_keys"

        run_cmd sudo mkdir -p "$SSH_DIR"
        run_cmd sudo chmod 700 "$SSH_DIR"

        if ! sudo grep -qxF "$SSH_KEY" "$AUTH_KEYS" 2>/dev/null; then
            run_cmd sudo bash -c "echo '$SSH_KEY' >> '$AUTH_KEYS'"
        else
            echo "SSH key already exists"
        fi

        run_cmd sudo chmod 600 "$AUTH_KEYS"
        run_cmd sudo chown -R "$USERNAME":"$USERNAME" "$SSH_DIR"
    fi

    # ---------------------------
    # Final verification
    # ---------------------------
    echo "Final user info:"
    run_cmd id "$USERNAME"

    echo "Done."
}

create_samba_user "$@"
