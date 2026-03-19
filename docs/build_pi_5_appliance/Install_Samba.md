# Install Samba for Windows integration

----------------------------------------------------------------

![screenshot](img/Tux-DC.resized.jpeg)

----------------------------------------------------------------

**What is a Samba Server?**

A [Samba server](https://www.samba.org/) is an open-source software suite that enables seamless file and printer sharing between Linux/Unix systems and Windows systems. It implements the Server Message Block (SMB) and Common Internet File System (CIFS) protocols, which are standard for Windows-based file sharing. Samba also supports integration with Active Directory (AD) environments, making it a versatile tool for mixed-OS networks.

- Active Directory Integration: Samba can act as an Active Directory Domain Controller or a member server, supporting protocols like LDAP and Kerberos.

!!! Note
    If the appliance isn't added to Active Directory as a member server it will only offer `NTLMv2` authentication to Windows. If your company's security policy doesn't allow NTLMV2, then you must join the appliance to the domain. Microsoft plans to disable `NTLMv2` in 2028 so you will have to Active Directory integrate it then or re-enable NTLMv2 on the desktops connecting to it!

----------------------------------------------------------------

For my project I chose not to use Active Directory integration because most small/medium manufacturing companies use Managed Service Providers (MSP) to support their IT operations. MSP don't normally run Linux servers and push back if you say you need a Linux server connected to Active Directory. We are only dealing with:

- One account for the machines (haassvc)
- A handful of accounts for the CNC Programmers
- A handful of accounts for Operations personnel that will use the spreadsheets created by the scripts

Creating local Linux accounts on the appliance is straight forward and the project includes a script to create users. See the section [There are two trains of thoughts on usernames](../build_pi_5_appliance/configuring_appliance.md/#there-are-two-trains-of-thoughts-on-usernames) before deciding what accounts to use.

If you want use Active Directory integration there are plenty of blogs/YouTube Videos available.

----------------------------------------------------------------

## Install Samba Server

The installation script, `haas_firewall_install.sh`, completes all of the steps needed to install Samba Server on the appliance. These instructions are provided for reference if you want to understand what installation script does.

If you plan to use the installation script and don't want to read the details of installing Samba Server jump to [The Directory Structure](../build_pi_5_appliance/Install_Samba.md/#the-directory-structure) to learn about the directory structure that is needed.

----------------------------------------------------------------

Open a terminal on the appliance and enter

```bash
sudo apt update && sudo apt install -y samba
```

This will install the Samba Server packages. The `-y` means "Don't prompt for yes". If you want to be in control during the installation don't include the `-y`.

----------------------------------------------------------------

Configure the Samba Server to start on boot and start the Samba Server

```bash
sudo systemctl enable --now smbd
sudo systemctl start smbd
```

----------------------------------------------------------------

Anytime you need to restart the Samba Server, use the following:

```bash
sudo systemctl restart smbd
```

----------------------------------------------------------------

### Verify the installation

Run the following to verify the Samba Server installation and location:

```bash
whereis samba
```

```bash title='Command Output'
samba: /usr/sbin/samba /usr/lib/x86_64-linux-gnu/samba /etc/samba /usr/libexec/samba /usr/share/samba /usr/share/man/man8/samba.8.gz /usr/share/man/man7/samba.7.gz
```

----------------------------------------------------------------

Run this to view the Samba Server version:

```bash
samba --version
```

```bash title='Command Output'
Version 4.19.5-Ubuntu
```

As you can see, on January 4th, 2026 the current version is 4.19.5.

----------------------------------------------------------------

Run the this to see the smb.conf file and service status

```bash
testparm -s
```

```bash title='Command Output'
Load smb config files from /etc/samba/smb.conf
Loaded services file OK.
Weak crypto is allowed by GnuTLS (e.g. NTLM as a compatibility fallback)

Server role: ROLE_STANDALONE
```

This is just the top of the file. The entire smb.conf file will be displayed

----------------------------------------------------------------

Run the following to display the Samba Server service status:

```bash
sudo systemctl status smbd
```

```bash title='Command Output'
● smbd.service - Samba SMB Daemon
     Loaded: loaded (/usr/lib/systemd/system/smbd.service; enabled; preset: enabled)
     Active: active (running) since Fri 2025-12-26 21:59:34 PST; 1 week 1 day ago
       Docs: man:smbd(8)
             man:samba(7)
             man:smb.conf(5)
   Main PID: 10736 (smbd)
     Status: "smbd: ready to serve connections..."
      Tasks: 4 (limit: 4601)
     Memory: 24.9M (peak: 48.2M swap: 1.4M swap peak: 1.4M)
        CPU: 23.914s
     CGroup: /system.slice/smbd.service
             ├─10736 /usr/sbin/smbd --foreground --no-process-group
             ├─10739 "smbd: notifyd" .
             ├─10740 "smbd: cleanupd "
             └─75813 "smbd: client [192.168.10.143]"

Dec 27 19:07:06 ubuntu-server smbd[20940]: pam_unix(samba:session): session opened for user haas(uid=1000) by (uid=0)
```

----------------------------------------------------------------

## Create users

All users, whether they are a machine tool, a CNC programmer, or the Operations personnel, need a Linux and a Samba account. The installation script reads the file `initial_users.csv` and creates both the Linux and Samba users during the installation.

If you need to add or remove users after the initial installation use the `manage_users.sh` script that is located in the `Haas_Data_collect` directory. The script creates users that can map drives. The script DOES NOT add a user to the `sudoers` file so they cannot run Linux commands or log in over SSH.

The script has the following optional arguments:

- --set-password
- --delete-user
- --delete-user --force
- --delete-user --dry-run
- --dry-run

----------------------------------------------------------------

```bash hl_lines='2 5 8 11 14 17'
# To add a user
sudo ./manage_users.sh jdoe

# Reset passwords
sudo ./manage_users.sh jdoe --set-password

# Delete user (with prompt)
sudo ./manage_users.sh jdoe --delete-user

# Combine for safe automation testing
sudo ./manage_users.sh jdoe --delete-user --dry-run

# Delete user silently (automation safe)
sudo ./manage_users.sh jdoe --delete-user --force

# Show what would happen (no changes made)
sudo ./manage_users.sh jdoe --dry-run
```

### Script outputs

First, check the existing Linux Users:

#### Linux users

```bash hl_lines='1'
awk -F: '$3 >= 1000 {print $1}' /etc/passwd
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

## The directory structure

We will need the table we created earlier for reference. The concept is to create a share on the `Haas_Data_collect` directory named `Haas`. This top level share will be able so see the entire directory structure when it's mapped to a Windows network drive. Operations personnel will map to this share so that they can pull spreadsheets from every machine.

Then create a directory/share for each Haas machine tool. The Haas machine tool share will be used:

- By for the CNC programmer to drop programs into
- The machine operator to load programs from.
- A subdirectory, cnc_logs, will hold the data collected from DPRNT.

This share is used when setting up the Ethernet on the CNC control. The format will be `\\<appliance_ip>\st30` for a share named st30.

The Haas data collection script creates the spreadsheets in the `cnc_logs` directory under the machine directory.

The final structure will look like this:

```bash
├── haas
     └── Haas_Data_collect
         ├── machines
             ├── st30
             │   └── cnc_logs
             ├── st30l
             │   └── cnc_logs
             └── st40
                 └── cnc_logs
```

----------------------------------------------------------------

### Create the shares

First we need to create the directories. We can refer to our table for the names:

----------------------------------------------------------------

| Machine  | Port# |   IP Address   |
|----------|-------|:--------------:|
| ST40     | 5052  | 192.168.10.141 |
| VF2SS    | 5052  | 192.168.10.142 |
| VF5SS    | 5052  | 192.168.10.143 |
| MINIMILL | 5052  | 192.168.10.143 |
| ST30     | 5052  | 192.168.10.144 |
| ST30L    | 5052  | 192.168.10.145 |

----------------------------------------------------------------

If you are only doing a handful of machines use:

```bash
mkdir /home/haas/st40
```

And repeat for each machine. If you used the Python script under [Scaling up](configuring_appliance.md/#scaling-up) with the `systemd-template.txt` it creates the 'mkdir' command along with the aliases.

**Open the `smb.conf` file**

```bash
sudo nano /etc/samba/smb.conf
```

Go to the bottom of the file and paste this code in:

```bash
# Share for Haas CNC Programs

[Haas]
    comment = Haas
    path = /home/haas/Haas_Data_collect
    read only = no
    browsable = yes
    writable = yes
    browsable = yes
    public = no
    valid users = @HaasGroup, haas # Ensure the user is valid
    force user = haas
    force group = HaasGroup
    create mask = 0664
    force create mode = 0664
    directory mask = 0775
    force directory mode = 0775
```

This is the root directory for the project. The share names will be appended to the end of `/home/haas/Haas_Data_collect/machines`. For example:

```bash linenums='1' hl_lines='1'
[ST40]
    comment = st40
    path = /home/haas/Haas_Data_collect/machines/st40
    read only = no
    browsable = yes
    writable = yes
    browsable = yes
    public = no
    valid users = @HaasGroup, haas # Ensure the user is valid
    force user = haas
    force group = HaasGroup
    create mask = 0664
    force create mode = 0664
    directory mask = 0775
    force directory mode = 0775
```

----------------------------------------------------------------

If you used the Python script with the `systemd-template.txt`, it creates all of the smb.conf share commands. Open each file and copy the code after `Create the share configuration`.

```bash hl_lines='13-27'
# Create the directory for the share
mkdir -p /home/haas/Haas_Data_collect/machines/st30

sudo cp haas-st30.service /etc/systemd/system/haas-st30.service
sudo systemctl daemon-reload
sudo systemctl enable st1.service
sudo systemctl start st1.service
sudo systemctl status st1.service


Create the share configuration

[st30]
    comment =
    path = /home/haas/Haas_Data_collect/machines/st30
    read only = no
    browsable = yes
    writable = yes
    browsable = yes
    public = no
    valid users = @HaasGroup, haas # Ensure the user is valid
    force user = haas
    force group = HaasGroup
    create mask = 0664
    force create mode = 0664
    directory mask = 0775
    force directory mode = 0775
```

----------------------------------------------------------------

The following options are needed so that files created from Windows, Mac, Linux with mapped drives get the correct permissions:

1. **force user = haas:** Ensures that all operations on this share are performed as the user haas, making them the owner of all new files.
1. **force group = HaasGroup:** Ensures that all new files and directories are assigned to the group HaasGroup.
1. **create mask = 0664 and force create mode = 0664:** These lines work together to ensure that the resulting file permissions are exactly rw-rw-r-- (664 octal).
1. **directory mask = 0775 and force directory mode = 0775:** These lines ensure that new directories are created with rwxrwxr-x permissions (775 octal), which includes the necessary execute bit for directory traversal.

----------------------------------------------------------------

After you add all the share configurations, save `/etc/samba/smb.conf` and exit nano using `ctrl_s` to save and `ctrl+x` to exit.

----------------------------------------------------------------

Ensure the underlying Linux directory permissions are correct:
On the server's filesystem, make sure the shared directory (/home/haas/Haas_Data_collect) in this example is owned by haas:HaasGroup.

```bash
sudo chown -R haas:HaasGroup /home/haas/Haas_Data_collect
sudo chmod -R 2775 /home/haas/Haas_Data_collect
```

The 2 in 2775 sets the setgid bit, which ensures that all locally created files also inherit the HaasGroup. Run the following to verify:

```bash
cd ~
ls -l
```

```unixconfig title='Command Output'
drwxrwxr-x 7 haas HaasGroup 4096 Feb 15 21:22 Haas_Data_collect
```

----------------------------------------------------------------

Based on the [table](Install_Samba.md/#create-the-shares) above this is what the share section will look like:

```bash linenums='1'
# Share for Haas CNC Programs

[Haas]
    comment = Haas Directory Share
    path = /home/haas/Haas_Data_collect
    browseable = yes
    writable = yes
    guest ok = no
    valid users = @HaasGroup, haas # Ensure the user is valid
    force user = haas
    force group = HaasGroup
    create mask = 0664
    force create mode = 0664
    directory mask = 0775
    force directory mode = 0775
[ST40]
    comment = ST40
    path = /home/haas/Haas_Data_collect/machines/st40
    read only = no
    browsable = yes
    public = no
    valid users = @HaasGroup, haas # Ensure the user is valid
    force user = haas
    force group = HaasGroup
    create mask = 0664
    force create mode = 0664
    directory mask = 0775
    force directory mode = 0775
[minimill]
    comment = minimill
    path = /home/haas/Haas_Data_collect/machines/minimill
    read only = no
    browsable = yes
    public = no
    valid users = @HaasGroup, haas # Ensure the user is valid
    force user = haas
    force group = HaasGroup
    create mask = 0664
    force create mode = 0664
    directory mask = 0775
    force directory mode = 0775
[VF2SS]
    comment = vf2ss
    path = /home/haas/Haas_Data_collect/machines/vf2ss
    valid users = @HaasGroup
    read only = no
    public = no
    valid users = @HaasGroup, haas # Ensure the user is valid
    force user = haas
    force group = HaasGroup
    create mask = 0664
    force create mode = 0664
    directory mask = 0775
    force directory mode = 0775
  [VF5SS]
    comment = vf5ss
    path = /home/haas/Haas_Data_collect/machines/vf5ss
    read only = no
    browsable = yes
    public = no
    valid users = @HaasGroup, haas # Ensure the user is valid
    force user = haas
    force group = HaasGroup
    create mask = 0664
    force create mode = 0664
    directory mask = 0775
    force directory mode = 0775
[ST30]
    comment = st30
    path = /home/haas/Haas_Data_collect/machines/st30
    read only = no
    browsable = yes
    public = no
    valid users = @HaasGroup, haas # Ensure the user is valid
    force user = haas
    force group = HaasGroup
    create mask = 0664
    force create mode = 0664
    directory mask = 0775
    force directory mode = 0775
[ST30L]
    comment = st30l
    path = /home/haas/Haas_Data_collect/machines/st30l
    read only = no
    browsable = yes
    public = no
    valid users = @HaasGroup, haas # Ensure the user is valid
    force user = haas
    force group = HaasGroup
    create mask = 0664
    force create mode = 0664
    directory mask = 0775
   force directory mode = 0775

```

----------------------------------------------------------------

## Restart the Samba Server

Now that the /etc/samba/smb.conf file has been updated you need to test for errors. Use the following:

```bash
testparm -s
```

If there are no errors reported, you will need to scroll to the top, restart the Samba Server service using:.

```bash
sudo systemctl restart smbd
```

There is no output from this command.

----------------------------------------------------------------

## View the status of the shares

This command outputs a lot of information.

```bash
sudo smbstatus shares
```

```bash title='Command Output'
Samba version 4.19.5-Ubuntu
PID     Username     Group        Machine                                   Protocol Version  Encryption           Signing
----------------------------------------------------------------------------------------------------------------------------------------
127044  haas     haas     192.168.10.143 (ipv4:192.168.10.143:51376) SMB3_11           -                    partial(AES-128-GMAC)
117495  mchavez      mchavez      192.168.10.120 (ipv4:192.168.10.120:55586) SMB3_11           -                    partial(AES-128-GMAC)
127455  rgoodwin     rgoodwin     192.168.10.104 (ipv4:192.168.10.104:52578) SMB3_11           -                    partial(AES-128-GMAC)
127051  haas     haas     192.168.10.143 (ipv4:192.168.10.143:48096) SMB3_11           -                    partial(AES-128-GMAC)

Service      pid     Machine       Connected at                     Encryption   Signing
---------------------------------------------------------------------------------------------
minimill     127455  192.168.10.104 Fri Jan  9 07:41:53 PM 2026 PST  -            -
Haas         127051  192.168.10.143 Fri Jan  9 06:27:16 PM 2026 PST  -            -
ST40         127044  192.168.10.143 Fri Jan  9 06:26:33 PM 2026 PST  -            -
ST30         117495  192.168.10.120 Thu Jan  8 11:45:23 AM 2026 PST  -            -


Locked files:
Pid          User(ID)   DenyMode   Access      R/W        Oplock           SharePath   Name   Time
--------------------------------------------------------------------------------------------------
127455       1002       DENY_NONE  0x100081    RDONLY     NONE             /home/haas/Haas_Data_collect/minimill   .   Fri Jan  9 19:49:03 2026
127455       1002       DENY_NONE  0x100081    RDONLY     NONE             /home/haas/Haas_Data_collect/minimill   .   Fri Jan  9 19:49:03 2026
127455       1002       DENY_NONE  0x100081    RDONLY     NONE             /home/haas/Haas_Data_collect/minimill   .   Fri Jan  9 19:49:03 2026
127455       1002       DENY_NONE  0x120089    RDONLY     LEASE(RWH)       /home/haas/Haas_Data_collect/minimill   O1000.txt   Fri Jan  9 19:57:32 2026
117495       1003       DENY_NONE  0x100081    RDONLY     NONE             /home/haas/Haas_Data_collect/st30   .   Thu Jan  8 11:45:51 2026
117495       1003       DENY_NONE  0x100081    RDONLY     NONE             /home/haas/Haas_Data_collect/st30   .   Thu Jan  8 11:45:51 2026

```

----------------------------------------------------------------

### What the output means

The first section list the username, group, IP address of the machine that mapped the drive. Then you can see that SMB3 is being used. Yes, no SMBv1 vulnerabilities on the appliance!

----------------------------------------------------------------

The second section lists the `systemd service file` that was used for each device, the IP address and the `pid`. In this case, there are the following devices connected:

- 192.168.10.104 - A Windows 11 laptop with a mapping to the `minimill` share
- 192.168.10.143 - An Ubuntu laptop with a mapping to the `Haas` share
- 192.168.10.143 - An Ubuntu laptop with a mapping to the `ST40` share
- 192.168.10.120 - An Apple Silicon MacBook with a mapping to the `ST30` share

----------------------------------------------------------------

The third section lists files that are locked. This can useful information if a user left a file open.

----------------------------------------------------------------

To force all new files and directories created via Samba to have a specific owner and permissions, you need to modify the share's configuration in your smb.conf file.

This configuration requires two main changes:

- Enforce the desired user and group ownership for all connections to that share.
- Set the default file and directory creation masks to match the desired permissions.

## Permission errors

If you have any problems with permissions after mapping a drive follow these steps to make sure new files get the correct permissions.

- Edit your Samba configuration file:
Use a text editor like nano to edit the smb.conf file. The path is typically /etc/samba/smb.conf.

```bash
sudo nano /etc/samba/smb.conf
```

Locate the relevant share definition (e.g., [Haas]) and add or modify the following lines within that specific share section:
ini

```bash
[HAAS]
  comment = Haas Data collector home
  path = /home/haas/Haas_Data_collect
  writable = yes
  browsable = yes
  public = no
  valid users = @HaasGroup, haas # Ensure the user is valid
  force user = haas
  force group = HaasGroup
  create mask = 0664
  force create mode = 0664
  directory mask = 0775
  force directory mode = 0775
```

### Definitions

- force user = haas: Ensures that all operations on this share are performed as the user haas, making them the owner of all new files.
- force group = HaasGroup: Ensures that all new files and directories are assigned to the group HaasGroup.
- create mask = 0664 and force create mode = 0664: These lines work together to ensure that the resulting file permissions are exactly rw-rw-r-- (664 octal).
- directory mask = 0775 and force directory mode = 0775: These lines ensure that new directories are created with rwxrwxr-x permissions (775 octal), which includes the necessary execute bit for directory traversal.

----------------------------------------------------------------

### Restart Samba

After any changes to the Samba configuration file you must test the configuration and restart the service.  Use the following:

```bash
testparm -s
```

If there are no errors reported, restart the Samba Server service using:.

```bash
sudo systemctl restart smbd
```

There is no output from this command.

----------------------------------------------------------------

Ensure the underlying Linux directory permissions are correct:
On the server's filesystem, make sure the shared directory (/home/haas/Haas_Data_collect) in this example) is owned by haas:HaasGroup.

```bash
sudo chown -R haas:HaasGroup /home/haas/Haas_Data_collect
sudo chmod -R 2775 /home/haas/Haas_Data_collect
```

The 2 in 2775 sets the setgid bit, which ensures that all locally created files also inherit the HaasGroup.
