#!/usr/bin/env bash
echo ""
echo ""
echo "############################################"
echo "#                                          #"
echo "#    Configure a custom port for SSH?      #"
echo "#  Use a port between 22, or 1024-65535    #"
echo "#                                          #"
echo "############################################"
echo ""
echo ""
# Ask user if they want to configure an SSH port
read -r -p "Do you want use a custom ssh port? (y/n): " answer

# convert answer to lowercase for easier comparison

answer=$(echo "$answer" | tr '[:upper:]' '[:lower:]')

if [[ "$answer" == "y" || "$answer" == "yes" ]]; then
    #prompt for an integer
    while true; do
    read -r -p "Enter the SSH port number (22, 1024-65535): " port
    # validate that the input is an integer and within the specified range
    if [[ "$port" =~ ^[0-9]+$ ]] && { [[ $port -eq 22 ]] || [[ $port -ge 1024 && $port -le 65535 ]]; }; then
    echo ""
        break
    else
        echo "Invalid port (must be 22, 1024-65535)"
        read -r -p "Try again? (y/n): " retry
        if [[ "$retry" != "y" && "$retry" != "yes" ]]; then
            echo "Exiting."
            exit 1
            fi
        fi
    done
        echo "SSH_PORT set to $port"
        # Update /etc/ssh/ssd_config
        echo "Updating /etc/ssh/sshd_config..."
        sudo sed -i "s/^#\?Port.*/Port $port/" /etc/ssh/sshd_config
        # Update /etc/haas-firewall.conf
        echo "Updating /etc/haas-firewall.conf..."
        sudo sed -i "s/^SSH_PORT=.*/SSH_PORT=$port/" /etc/haas-firewall.conf

        # Reload systemd and restart SSH Service
        echo ""
        echo "Restarting SSH Service..."
        echo ""
        sudo systemctl daemon-reload
        sudo systemctl restart ssh.service
        echo ""
        sudo systemctl status ssh.service | grep "Server listening on 0.0.0.0 "
        sudo systemctl status ssh.service | grep "Server listening on :: "
        echo ""
        echo ""
        echo "################################################"
        echo "                                                "
        echo "           Script is now complete!              "
        echo "  The SSH service is configured for port $port     "
        echo "        Use Cockpit to update the Firewall            "
        echo "                                                "
        echo "################################################"
        echo ""
        echo ""
fi
