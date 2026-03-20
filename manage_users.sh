#!/bin/bash

# Usage:
#   ./manage_users.sh <username> [--set-password] [--delete-user] [--force] [--dry-run]
# Normal use to add a user (interactive if needed)
# ./manage_users.sh jdoe

# Reset passwords
# ./manage_users.sh jdoe --set-password

# Delete user (with prompt)
# ./manage_users.sh jdoe --delete-user

# Delete user silently (automation safe)
# ./manage_users.sh jdoe --delete-user --force

# Show what would happen (no changes made)
# ./manage_users.sh jdoe --dry-run

# Combine for safe automation testing
# ./manage_users.sh jdoe --delete-user --dry-run

# Check for root FIRST
if [[ $EUID -ne 0 ]]; then
  echo "[ERROR] This script must be run as root" >&2
  exit 1
fi

create_samba_user() {
    if [ "$#" -lt 1 ]; then
        echo "Usage: $0 <username> [--set-password | --delete-user] [--force] [--dry-run]" >&2
        return 1
    fi

    local USERNAME="$1"
    local SET_PASSWORD=false
    local DELETE_USER=false
    local FORCE=false
    local DRY_RUN=false
    local GROUP_NAME="HaasGroup"
    local LOG_FILE
    LOG_FILE="/var/log/user_mgmt_$(date +%Y%m%d_%H%M%S).log"

    # ---------------------------
    # Logging setup
    # ---------------------------
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
            --force) FORCE=true ;;
            --dry-run) DRY_RUN=true ;;
        esac
    done

    # ---------------------------
    # Helper: run or echo command
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

        # Delete Samba user
        if pdbedit -L | cut -d: -f1 | grep -qx "$USERNAME"; then
            echo "Deleting Samba user $USERNAME"
            run_cmd sudo smbpasswd -x "$USERNAME"
        else
            echo "Samba user $USERNAME does not exist."
        fi

        # Delete Linux user
        if id "$USERNAME" &>/dev/null; then
            echo "Deleting Linux user $USERNAME"
            run_cmd sudo userdel "$USERNAME"
        else
            echo "Linux user $USERNAME does not exist."
        fi

        echo "Deletion complete for $USERNAME"
        return 0
    fi

    # ---------------------------
    # CREATE / UPDATE MODE
    # ---------------------------

    # Linux user
    if id "$USERNAME" &>/dev/null; then
        echo "User $USERNAME already exists."

        if ! $SET_PASSWORD && ! $FORCE; then
            read -p "Update passwords? (y/N): " choice
            [[ "$choice" =~ ^[Yy]$ ]] && SET_PASSWORD=true
        fi

        if $SET_PASSWORD; then
            echo "Updating system password"
            run_cmd sudo passwd "$USERNAME"
        fi
    else
        echo "Creating system user"
        run_cmd sudo useradd -M -s /usr/sbin/nologin "$USERNAME"
        run_cmd sudo passwd "$USERNAME"
    fi

    # Samba user
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

    # Enable Samba account
    run_cmd sudo smbpasswd -e "$USERNAME"

    # Group assignment
    if getent group "$GROUP_NAME" > /dev/null; then
        run_cmd sudo usermod -aG "$GROUP_NAME" "$USERNAME"
    else
        echo "Warning: Group $GROUP_NAME does not exist."
    fi

    echo "Final user info:"
    run_cmd id "$USERNAME"
    echo ""
    echo ""
    sudo pdbedit -l
    echo ""
    echo ""
    echo "Done."
}

create_samba_user "$@"
