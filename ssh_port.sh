#!/usr/bin/env bash
echo ""
echo ""
echo "###########################################"
echo "#                                         #"
echo "#     Configure a custom port for SSH     #"
echo "#                                         #"
echo "###########################################"
echo ""
echo ""
# Ask user if they want to configure an SSH port
read -r -p "Do you want use a custom ssh port? (y/n): " answer

# convert answer to lowercase for easier comparison

answer=$(echo "$answer" | tr '[:upper:]' '[:lower:]')

if [[ "$answer" == "y" || "$answer" == "yes" ]]; then
    #prompt for an integer
    read -r -p "Enter the SSH port number: " port
    # validate that the input is an integer
    if [[ "$port" =~ ^[0-9]+$ ]] && (( port >= 1024 )); then
    # if [[ "$port" =~ ^[0-9]+$ ]] && (( port >= 1024 )) && (( port =< 65535 )); then
        SSH_PORT=\"$port\"
        echo "SSH_PORT set to $port"
        # Update /etc/ssh/ssd_config
        echo "Updating /etc/ssh/sshd_config..."
        sudo sed -i "s/^#\?Port.*/Port $port/" /etc/ssh/sshd_config

        # Reload systemd and restart SSH Service
        echo "Restarting SSH Service..."
        sudo systemctl daemon-reload
        sudo systemctl restart ssh.service
        # echo "SSH service restarted with port $port"
        sudo systemctl status ssh.service | grep "Server listening on 0.0.0.0 "
        sudo systemctl status ssh.service | grep "Server listening on :: "
    else
        echo ""
        echo "#######################################################"
        echo "#                                                     #"
        echo "#  Error: Please enter an integer between 1025-65535  #"
        echo "#  You need to restart the script!                    #"
        echo "#  Press the up arrow key and then [enter]            #"
        echo "#                                                     #"
        echo "#######################################################"
        exit 1
    fi
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
echo ""
    echo "Restarting SSH Service..."
    sudo systemctl daemon-reload
    sudo systemctl restart ssh.service
    sudo systemctl status ssh.service | grep "Server listening on 0.0.0.0 "
    sudo systemctl status ssh.service | grep "Server listening on :: "
echo ""
echo ""
fi
