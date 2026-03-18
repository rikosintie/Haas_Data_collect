#!/usr/bin/env bash
while true; do
    read -r -p "Enter the SSH port number (1024-65535): " port
    # if [[ "$port" =~ ^[0-9]+$ ]] && [[ $port -eq 22 ]] && [[ port -ge 1024 ]] && [[ port -le 65535 ]]; then
    if [[ "$port" =~ ^[0-9]+$ ]] && { [[ $port -eq 22 ]] || [[ $port -ge 1024 && $port -le 65535 ]]; }; then
        break
    else
        echo "Invalid port (must be 1024-65535)"
        read -r -p "Try again? (y/n): " retry
        if [[ "$retry" != "y" && "$retry" != "yes" ]]; then
            echo "Exiting."
            exit 1
        fi
    fi
done
echo "SSH_PORT set to $port"
