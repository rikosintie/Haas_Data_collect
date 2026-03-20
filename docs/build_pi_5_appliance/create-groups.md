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

**There is no output from this command.**

### Set permissions on the folders

You need to be in the root of your home director to review the current permissions. Use the following to verify that you are in the correct location:

```bash
cd ~
pwd
ls -l
```

```bash title='Command Output'
/home/haas
drw-rw-r-- 9 haas haas  4096 Jan  4 20:26 Haas_Data_collect
```

We can see the `Haas_Data_collect` folder, so we are in the correct location. Note that the `Haas_Data_collect` directory has `haas haas` listed. We need to change that to `haas HaasGroup`

Now run:

```bash hl_lines='2 5 8'
# Allow traversal into /home/haas (needed to reach Haas subdirectory)
sudo chmod 774 /home/haas

# Set ownership for everything under Haas
sudo chown -R haas:HaasGroup /home/haas/Haas_Data_Collect

# View the changes
ls -l
```

```bash title='Command Output'
drwxrwxr-x 9 haas HaasGroup  4096 Jan  4 20:26 Haas_Data_collect
```

Note the `Haas_Data_collect` directory had changed from `haas haas` to `haas HaasGroup`. That means haas is the owner and HaasGroup is the group that will be applied.

----------------------------------------------------------------

## Set the file permissions

Run the following:

```bash
# Set permissions: directories get execute, files don't
sudo find /home/haas/Haas_Data_Collect -type d -exec chmod 2775 {} +
sudo find /home/haas/Haas_Data_Collect -type f -exec chmod 664 {} +
chmod +x /home/$USER/Haas_Data_collect/lshare.sh
chmod +x /home/$USER/Haas_Data_collect/smb_verify.sh
chmod +x /home/$USER/Haas_Data_collect/setup_user.sh
```

There is no output from these commands.

!!! Note
    The 2 in 2775 sets the `setgid` bit, basically set group ID, which ensures that all locally created files also inherit the HaasGroup. Without this bit set, files created locally on the appliance would get owner and group IDs of the user that created the file. The `setgid` bit is located in the fourth character of the permissions string (the execute position of the group permissions).

Run a directory listing to see the results:

```bash
cd ~
ls -l
```

```unixconfig title='Command Output'
ls -l
total 44
drwxrwsr-x 6 haas HaasGroup 4096 Jan  6 20:05 Haas_Data_collect
drwxrwsr-x 2 haas HaasGroup 4096 Jan  9 22:43 minimill
drwxrwsr-x 2 haas HaasGroup 4096 Jan  6 12:39 st30
drwxrwsr-x 2 haas HaasGroup 4096 Jan  9 22:11 st30l
drwxrwsr-x 2 haas HaasGroup 4096 Jan  9 20:32 st40
drwxrwsr-x 2 haas HaasGroup 4096 Dec 26 21:37 vf2ss
drwxrwsr-x 2 haas HaasGroup 4096 Dec 26 21:37 vf5ss
```

Now the account `haas` has `rwx` (read/write/execute) and and the group `HaasGroup` has `rws` (read\write\setgid) to directories. The `other` group has `r--` (read only). Files will have rw-, read/write.

The three bash scripts in Haas_Data_collect:

```bash
~/Haas_Data_collect ‹main●›
╰─$ ls -l *.sh
-rwxrwsr-x 1 haas HaasGroup  646 Jan  4 20:26 lshare.sh
-rwxrwsr-x 1 haas haas  2441 Jan  6 12:38 setup_user.sh
-rwxrwsr-x 1 haas HaasGroup 2620 Dec 26 23:01 smb_verify.sh
```

Have eXecute so that you can run them.

----------------------------------------------------------------

## Create the users

All users, whether they are a machine tool, a CNC programmer, or the Operations personnel, need a Linux and a Samba account. The installation script reads the file `initial_users.csv` and creates both the Linux and Samba users during the installation.

To add users later you can follow these instructions or run the `manage_users.sh` script that is in the `Haas_Data_collect` directory. See [Manage users by script](../build_pi_5_appliance/create-groups.md/#manage-users-by-script) for instructions for the Manager Users script.

In this example I have:

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

**Run for each user:**

```bash linenums='1' hl_lines='2 5 8'
# Create user without shell access
sudo useradd -M -s /usr/sbin/nologin haassvc

# Add to Samba
sudo smbpasswd -a haassvc

# Enable the Samba user
sudo smbpasswd -e haassvc
```

----------------------------------------------------------------

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

**There is no output from this command.**

----------------------------------------------------------------

### List all users in the HaasGroup

```bash hl_lines='1'
cat /etc/group | grep Haas
```

```bash title='Command Output'
HaasGroup:x:1002:haassvc,haas
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

### Manage users by script

It's fairly simple to create a user but it's a lot of individual commands which leaves room for errors. If you need to add or remove users after the initial installation, use the `manage_users.sh` script that is located in the `Haas_Data_collect` directory. The script creates users that can map drives. The script DOES NOT add a user to the `sudoers` file so they cannot run Linux commands or log in over SSH.

The script has the following optional arguments:

- --set-password
- --delete-user
- --delete-user --force
- --delete-user --dry-run
- --dry-run

----------------------------------------------------------------

To use the scrit, first run the following command to make it executable:

```bash linenums='1' hl_lines='1'
cd /home/haas/Haas_Data_Collect
chmod +x manage_users.sh
```

****There is no output from this command.****

Now you can create new users by running the following. Here I am creating the `rgoodwin` user. Replace `rgoodwin` with the username you need to create:

```bash linenums='1' hl_lines='1'
sudo ./setup_user.sh rgoodwin
```

#### How the script works

- You will be asked for your password to activate `sudo` (the haas user password).
- You will be asked for the password to use for the new Linux username.
- You will be asked for the smbuser password. It MUST be the same as the Linux user!
- It will then create and enable the smb user, add it to the `HaasGroup` and display the result.

----------------------------------------------------------------

#### Examples

```bash hl_lines='2 5 8 11 14 17'
# To add a user
sudo ./manage_users.sh bob

# Reset passwords
sudo ./manage_users.sh bob --set-password

# Delete user (with prompt)
sudo ./manage_users.sh bob --delete-user

# Combine for safe automation testing
sudo ./manage_users.sh bob --delete-user --dry-run

# Delete user silently (automation safe)
sudo ./manage_users.sh bob --delete-user --force

# Show what would happen (no changes made)
sudo ./manage_users.sh bob --dry-run
```

### Script outputs

Before adding a new user, list the existing users in case it already exists:

#### Linux users

```bash hl_lines='1'
awk -F: '$3 >= 1000 {print $1}' /etc/passwd
```

```bash title='Command Output'
nobody
haas
mhubbard
haassvc
mchavez
thubbard
test
```

#### Display the Samba users

```bash hl_lines='1'
sudo pdbedit -L
```

```bash title='Command Output'
mhubbard:1001:
mchavez:1003:
haassvc:1002:
thubbard:1004:
test:1005:
haas:1000:
```

----------------------------------------------------------------

#### Add a user

```bash hl_lines='1 3 5 6 7 10 11 12 13 15'
sudo ./manage_users.sh bob
==== Wed Mar 18 14:19:45 PDT 2026 ====
Log file: /var/log/user_mgmt_20260318_141945.log
Processing user: bob
Creating system user
New password:
Retype new password:
passwd: password updated successfully
Creating Samba user
New SMB password:
Retype new SMB password:
Added user bob.
Enabled user bob.
Final user info:
uid=1006(bob) gid=1010(bob) groups=1010(bob),1004(HaasGroup)
Done.
```

----------------------------------------------------------------

#### Update user's password on Linux and Samba

```bash hl_lines='1 3 7 8 12 13 19'
sudo ./manage_users.sh bob --set-password
==== Wed Mar 18 14:29:20 PDT 2026 ====
Log file: /var/log/user_mgmt_20260318_142920.log
Processing user: bob
User bob already exists.
Updating system password
New password:
Retype new password:
passwd: password updated successfully
Samba user exists
Updating Samba password
New SMB password:
Retype new SMB password:
Enabled user bob.
Final user info:
uid=1006(bob) gid=1010(bob) groups=1010(bob),1004(HaasGroup)
Done.

```

#### Delete a User with prompts

```bash hl_lines='1 3 5'
sudo ./manage_users.sh bob --delete-user --dry-run
==== Wed Mar 18 14:25:53 PDT 2026 ====
Log file: /var/log/user_mgmt_20260318_142553.log
Processing user: bob
DELETE MODE ENABLED for bob
Are you sure you want to delete user 'bob'? (y/N): N
Aborting.
```

#### Silently delete a user

Use the `--force` in a script to delete users without being prompted

```bash hl_lines='1 3 6 7-10'
sudo ./manage_users.sh bob --delete-user --force
==== Wed Mar 18 14:42:23 PDT 2026 ====
Log file: /var/log/user_mgmt_20260318_144223.log
Processing user: bob
DELETE MODE ENABLED for bob
[FORCE] Skipping confirmation
Deleting Samba user bob
Deleted user bob.
Deleting Linux user bob
Deletion complete for bob

```

----------------------------------------------------------------

#### Add a user with dry run

These arguments don't create the user, they show you what commands would be used.

```bash linenums='1' hl_lines='1'
sudo ./manage_users.sh bob --dry-run
==== Wed Mar 18 14:44:50 PDT 2026 ====
Log file: /var/log/user_mgmt_20260318_144450.log
Processing user: bob
Creating system user
[DRY-RUN] sudo [DRY-RUN] useradd [DRY-RUN] -M [DRY-RUN] -s [DRY-RUN] /usr/sbin/nologin [DRY-RUN] bob
[DRY-RUN] sudo [DRY-RUN] passwd [DRY-RUN] bob
Creating Samba user
[DRY-RUN] sudo [DRY-RUN] smbpasswd [DRY-RUN] -a [DRY-RUN] bob
[DRY-RUN] sudo [DRY-RUN] smbpasswd [DRY-RUN] -e [DRY-RUN] bob
[DRY-RUN] sudo [DRY-RUN] usermod [DRY-RUN] -aG [DRY-RUN] HaasGroup [DRY-RUN] bob
Final user info:
[DRY-RUN] id [DRY-RUN] bob
Done.
```

----------------------------------------------------------------

Here is the code for the manage_users.sh script:

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

Then run the script from the `/home/Haas_Data_collect` directory using:

```bash linenums='1' hl_lines='1'
./lshare.sh
```

----------------------------------------------------------------

Here is the output of the function:

```bash
smb-shares
Haas         /home/haas/Haas
ST40         /home/haas/Haas/st40
minimill     /home/haas/Haas/minimill
VF2SS        /home/haas/Haas/vf2ss
VF5SS        /home/haas/Haas/vf5ss
ST30         /home/haas/Haas/st30
ST30L        /home/haas/Haas/st30l
```

----------------------------------------------------------------

## Troubleshooting

```bash title='Review the Journal for user haassvc' hl_lines='1'
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
smbclient -L //192.168.10.223 -U haas

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
