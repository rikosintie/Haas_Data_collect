#!/usr/bin/env bash
echo ""
echo ""
echo "#############################################"
echo "#                                           #"
echo "#      Configure a custom port for SSH      #"
echo "#  Use port 22 or a port between 1024-65535 #"
echo "#                                           #"
echo "#############################################"
echo ""
echo ""
# Ask user if they want to configure an SSH port
# read -r -p "Do you want use a custom ssh port? (y/n): " answer

#  convert answer to lowercase for easier comparison
answer="y"
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
    # Update /etc/haas-firewall.conf
    echo ""
    echo "Updating /etc/haas-firewall.conf..."
    sudo sed -i "s/^SSH_PORT=.*/SSH_PORT=$port/" /etc/haas-firewall.conf
    echo ""
    echo "Updating /etc/ssh/sshd_config.d/99-haas-hardening.conf"
    sudo sed -i "s/^#\?Port.*/Port $port/" /etc/ssh/sshd_config.d/99-haas-hardening.conf

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
    echo "##########################################################"
    echo "                                                "
    echo "           Script is now complete!              "
    echo "  The SSH service is configured for port $port     "
    echo "  /etc/haas-firewall.conf is updated with SSH_PORT=$port  "
    echo "        Use Cockpit to update the Firewall            "
    echo "                                                "
    echo "##########################################################"
    echo ""
    echo ""
else
    SSH_PORT="22"
    echo ""
    echo ""
    echo "###########################################"
    echo "#                                         #"
    echo "#            SSH set to port 22           #"
    echo "#                                         #"
    echo "###########################################"
    echo ""
    echo ""
        sudo sed -i "s/^#\?Port.*/Port $SSH_PORT/" /etc/ssh/sshd_config
        echo "Updating /etc/haas-firewall.conf..."
        sudo sed -i "s/^SSH_PORT=.*/SSH_PORT=$SSH_PORT/" /etc/haas-firewall.conf
    echo ""
        echo "Restarting SSH Service..."
        sudo systemctl daemon-reload
        sudo systemctl restart ssh.service
        sudo systemctl status ssh.service | grep "Server listening on 0.0.0.0 "
        sudo systemctl status ssh.service | grep "Server listening on :: "
    echo ""
    echo ""
fi
echo ""
echo ""
echo "#############################################################"
echo "#                                                           #"
echo "#     Preparing to run configure_ufw_from_csv.sh            #"
echo "#     Enter the users file to use (users.csv for ex.)       #"
echo "#                                                           #"
echo "#############################################################"
echo ""
echo ""

VALIDATOR="/usr/local/sbin/validate_users_csv.sh"

while true; do
    read -r -p "Enter the CSV filename to use: " csv_file

    # Check file exists
    if [[ ! -f "$csv_file" ]]; then
        echo "Error: File '$csv_file' not found."
        echo ""
        continue
    fi

    # Check .csv extension
    if [[ "${csv_file##*.}" != "csv" ]]; then
        echo "Error: '$csv_file' does not have a .csv extension."
        echo ""
        continue
    fi

    # Check header matches expected format
    header=$(head -n 1 "$csv_file")
    if [[ "$header" != "username,ip_address,role" ]]; then
        echo "Error: Invalid header. Expected: username,ip_address,role"
        echo "  Found: $header"
        echo ""
        continue
    fi

    # Run the validator if available
    if [[ -x "$VALIDATOR" ]]; then
        if ! "$VALIDATOR" "$csv_file"; then
            echo "Error: CSV validation failed."
            echo ""
            continue
        fi
    fi

    # All checks passed — run the firewall configuration
    echo ""
    sudo ./configure_ufw_from_csv.sh "$csv_file"
    break
done
echo ""
echo ""
echo "#############################################################"
echo "#                                                           #"
echo "#                  Updated firewall rules                   #"
echo "#                                                           #"
echo "#############################################################"
echo ""
echo ""
sudo ufw status numbered | sort -k5
