# Create the HaasGroup and set file permissions

----------------------------------------------------------------
![screenshot](img/Tux_groups1.resized.png)

----------------------------------------------------------------

Linux uses groups to manage permissions for users. For this project, all users will be in the same group. That isn't a security best practice since a disgruntled employee could delete everything. If you have compliance requirements or other concerns, just repeat this process to create multiple groups. For example, create a user and group for each machine. Then add the user to the machine's share and use it as the username when setting up the account on the machine.

Does this seem like a lot of extra work? Yes, but I actually had a disgruntled employee delete the configuration for the DNC system for a neighboring cell one time. Of course, he was a night shift employee, and did it at midnight on Friday. I got called on Saturday morning and had to drive an hour to the plant and restore it. So it depends on your determination of the risk in your shop.

----------------------------------------------------------------

## Create the HaasGroup group

```bash
sudo groupadd HaasGroup
```

There is no output from this command.

### Set permissions on the folders

You need to be in the root of your home director to review the current permissions. Use the following to verify that you are in the correct location:

```bash
cd ~
pwd
ls -l
```

```bash title='Command Output'
/home/mhubbard
drw-rw-r-- 9 mhubbard mhubbard  4096 Jan  4 20:26 Haas_Data_collect
```

We can see the `Haas_Data_collect` folder, so we are in the correct location. Note that the `Haas_Data_collect` directory has `mhubbard mhubbard` listed. We need to change that to `mhubbard HaasGroup`

Now run:

```bash hl_lines='2 5 8'
# Allow traversal into /home/mhubbard (needed to reach Haas subdirectory)
sudo chmod 774 /home/mhubbard

# Set ownership for everything under Haas
sudo chown -R mhubbard:HaasGroup /home/mhubbard/Haas

# View the changes
ls -l
```

```bash title='Command Output'
drwxrwxr-x 9 mhubbard HaasGroup  4096 Jan  4 20:26 Haas_Data_collect
```

Note the `Haas_Data_collect` directory had changed from `mhubbard mhubbard` to `mhubbard HaasGroup`. That means mhubbard is the owner and HaasGroup is the group that will be applied.

----------------------------------------------------------------

## Set the file permissions

Run the following:

```bash
# Set permissions: directories get execute, files don't
sudo find /home/mhubbard/Haas -type d -exec chmod 2775 {} +
sudo find /home/mhubbard/Haas -type f -exec chmod 664 {} +
chmod +x /home/$USER/Haas/Haas_Data_collect/lshare.sh
chmod +x /home/$USER/Haas/Haas_Data_collect/smb_verify.sh
chmod +x /home/$USER/Haas/Haas_Data_collect/setup_user.sh
```

There is no output from these commands.

!!! Note
    The 2 in 2775 sets the `setgid` bit, basically set group ID, which ensures that all locally created files also inherit the HaasGroup. Without this bit set, files created locally on the Raspberry Pi 5 appliance would get owner and group IDs of the user that created the file. The `setgid` bit is located in the fourth character of the permissions string (the execute position of the group permissions).

Run a directory listing to see the results:

```bash
cd ~
ls -l
```

```bash title='Command Output'
ls -l
total 44
drwxrwsr-x 6 mhubbard HaasGroup 4096 Jan  6 20:05 Haas_Data_collect
drwxrwsr-x 2 mhubbard HaasGroup 4096 Jan  9 22:43 minimill
drwxrwsr-x 2 mhubbard HaasGroup 4096 Jan  6 12:39 st30
drwxrwsr-x 2 mhubbard HaasGroup 4096 Jan  9 22:11 st30l
drwxrwsr-x 2 mhubbard HaasGroup 4096 Jan  9 20:32 st40
drwxrwsr-x 2 mhubbard HaasGroup 4096 Dec 26 21:37 vf2ss
drwxrwsr-x 2 mhubbard HaasGroup 4096 Dec 26 21:37 vf5ss
```

Now the account `mhubbard` has `rwx` (read/write/execute) and and the group `HaasGroup` has `rws` (read\write\setgid) to directories. The `other` group has `r--` (read only). Files will have rw-, read/write.

The three bash scripts in Haas_Data_collect:

```bash
~/Haas/Haas_Data_collect ‹main●›
╰─$ ls -l *.sh
-rwxrwsr-x 1 mhubbard HaasGroup  646 Jan  4 20:26 lshare.sh
-rwxrwsr-x 1 mhubbard mhubbard  2441 Jan  6 12:38 setup_user.sh
-rwxrwsr-x 1 mhubbard HaasGroup 2620 Dec 26 23:01 smb_verify.sh

```

Have eXecute so that you can run them.

----------------------------------------------------------------

### Create the users

You will need to build a list of users that will need to access the shares. In this example I have:

```text
|     Username    | Role and Responsibility                                                                                     |
|:---------------:|-------------------------------------------------------------------------------------------------------------|
|     haassvc     | The limited permission account used on the Haas CNC control                                                 |
|     haassvc2    | An account for the customer to manage the Raspberry Pi 5                                                    |
| Michael Hubbard | The administrator for the Raspberry Pi 5                                                                    |
|  Manuel Chavez  | CNC Setup technician. Needs to review the CNC Programs from his Windows desktop and review the spreadsheets |
| Robert Goodwin  | Operations. Needs access to the `cnc_logs` directory to move files                                          |
```

----------------------------------------------------------------

**Run these command for each user:**

```bash linenums='1' hl_lines='2 5 8'
# Create user without shell access
sudo useradd -M -s /usr/sbin/nologin haassvc

# Add to Samba
sudo smbpasswd -a haassvc

# Enable the Samba user
sudo smbpasswd -e haassvc
```

The first command creates the user `haassvc`.

- The `-M` skips creating a user `home` directory..
- The `-s /usr/sbin/nologin` disables shell login (good for service accounts that only need SMB access)

The second command creates the Samba Server user. You will be prompted to enter and confirm a password. Here is the output for the `haassvc` user:

```bash hl_lines='1'
sudo smbpasswd -a haassvc
```

```bash title='Command Output
New SMB password:
Retype new SMB password:
Added user haassvc.
```

Finally,

```bash
`sudo smbpasswd -e haassvc` enables the smb username.
```

```bash title='Command Output'
Enabled user haassvc.
```

----------------------------------------------------------------

**Add the haassvc User account to the `HaasGroup` group:**

```bash
sudo usermod -aG HaasGroup haassvc
```

There is no output from this command.

----------------------------------------------------------------

#### List all users in the HaasGroup

```bash hl_lines='1'
cat /etc/group | grep Haas
```

```bash title='Command Output'
HaasGroup:x:1002:haassvc,mhubbard
```

----------------------------------------------------------------

#### Verify the `haassvc` user settings

```bash linenums='1' hl_lines='1'
id haassvc
```

```bash title='Command Output'
uid=1001(haassvc) gid=1001(haassvc) groups=1001(haassvc),1002(HaasGroup)
```

----------------------------------------------------------------

### Create users the easy way

It's fairly simple to create a user but it's a lot of individual commands which leaves room for errors. There is bash script to do the heavy lifting included in the repository. It gets installed when you clone the repository. To use it, first run the following command:

```bash linenums='1' hl_lines='1'
cd /home/mhubbard/Haas/Haas_Data_collect
chmod +x setup_user.sh
```

There is no output from this command.

Now you can create new users by running the following. Here I am creating the `rgoodwin` user. Replace `rgoodwin` with the username you need to create:

```bash linenums='1' hl_lines='1'
sudo ./setup_user.sh rgoodwin
```

*How the script works**

- You will be asked for your password to activate `sudo`.
- You will be  asked for the password to use for the username.
- You will be  asked for the smbuser password. It MUST be the same as the Linux user!
- It will then create and enable the smb user, add it to the group and display the result.

Here is the output of the script for the rgoodwin user:

----------------------------------------------------------------

```bash linenums='1' hl_lines='1'
[sudo] password for mhubbard:
Attempting to create and configure user: rgoodwin
System user rgoodwin created.
New password:
Retype new password:
passwd: password updated successfully
New SMB password:
Retype new SMB password:
Added user rgoodwin.
Enabled user rgoodwin.
Configuration complete for rgoodwin.
Verifying user configuration:
uid=1004(rgoodwin) gid=1005(rgoodwin) groups=1005(rgoodwin),1002(HaasGroup)

```

----------------------------------------------------------------
Here is the code for the setup_user.sh script:

```bash linenums='1' hl_lines='1'
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
```

----------------------------------------------------------------

### Verify the Samba Server

Here is a function that you can add to your `~/.bashrc` or `~/.zshrc` file to display the paths to each share. Use the following to open your ~./bashrc (or ~/.zshrc) file:

```bash linenums='1' hl_lines='1'
nano ~/.bashrc
```

Then paste this at the bottom of the file, save and exit.

----------------------------------------------------------------

```bash linenums='1' hl_lines='1'
smb-shares() {
    while IFS= read -r line; do
        if [[ "$line" == \[*\] ]]; then
            # Extract share name without brackets
            name="${line#\[}"
            name="${name%\]}"
        fi
        if [[ "$line" == *path\ =* ]]; then
            # Skip global, printers, and print$ shares
            if [[ "$name" != "global" && "$name" != "printers" && "$name" != "print$" ]]; then
                # Extract path after "path = "
                sharepath="${line#*path = }"
                # Print formatted output
                printf "%-12s %s\n" "$name" "$sharepath"
            fi
        fi
    done < /etc/samba/smb.conf
}
```

If you don't want to add the function to your .bashrc file you can use the `lshares.sh` file that is included with the repository. You have to make it executable using:

```bash linenums='1' hl_lines='1'
chmod +x lshare.sh
```

Then run the script from the `/home/mhubbard/Haas/Haas_Data_collect` direcory using:

```bash linenums='1' hl_lines='1'
./lshare.sh
```

----------------------------------------------------------------

Here is the output of the function:

```bash
smb-shares
Haas         /home/mhubbard/Haas
ST40         /home/mhubbard/Haas/st40
minimill     /home/mhubbard/Haas/minimill
VF2SS        /home/mhubbard/Haas/vf2ss
VF5SS        /home/mhubbard/Haas/vf5ss
ST30         /home/mhubbard/Haas/st30
ST30L        /home/mhubbard/Haas/st30l
```

----------------------------------------------------------------

## Troubleshooting

```bash title='Review the Jounal for user haassvc' hl_lines='1'
id haassvc
sudo journalctl -u smbd.service -n 50 --no-pager
```

```bash
uid=1001(haassvc) gid=1001(haassvc) groups=1001(haassvc),1002(HaasGroup)
Jan 05 11:05:55 ubuntu-server smbd[96113]: pam_unix(samba:session): session opened for user haassvc(uid=1001) by (uid=0)
```

- smbclient //localhost/st40 -U haassvc
-

testparm -s
smbclient -L //192.168.10.223 -U mhubbard

List only shares:
```bash
sudo smbstatus -S
```

sudo smbstatus -L -b

Managing Locked Files
If a file is inappropriately locked (e.g., a client disconnected improperly), you can identify the process and kill it:

Run smbstatus to find the PID of the process that has the lock on the file.
Verify the user and hostname associated with that PID in the output.
Kill the specific smbd process using the PID:

```bash
sudo kill <PID>
```

This action should release the lock.

----------------------------------------------------------------
