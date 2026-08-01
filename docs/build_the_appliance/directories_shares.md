# Create Directories and Samba Shares

To share files between the CNC programmer and the machine control we have to create directories and shares for each machine control. The Python data collection scripts will place the `csv` files in a directory named `cnc_logs` under the machine tool directory

----------------------------------------------------------------

## The directory structure

We will need the [table](../build_the_appliance/directories_shares.md/#table-of-machines) we created earlier for reference. It's listed below for reference. The concept is to create a share on the `Haas_Data_collect` directory named `Haas`. This top level share will be able so see the entire directory structure when it's mapped to a Windows network drive. Operations personnel will map to this share so that they can pull spreadsheets from every machine.

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

### Table of machines

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
mkdir /home/haas/Haas_Data_collect/st40
```

And repeat for each machine. If you used the Python script under [Scaling up](configuring_appliance.md/#scaling-up) with the `systemd-template.txt` it creates the 'mkdir' command along with the aliases.

### The tree command

The installation script installs the Linux `tree` command. It's very useful to verify files and directories on linux system.

#### View directories and files

```bash linenums='1' hl_lines='1'
cd /home/haas/Haas_Data_collect/machines
tree
```

```bash title='Command Output'
.
├── minimill
├── st30
│   └── cnc_logs
│       └── st30_265-4183.csv
├── st30l
│   └── cnc_logs
│       └── st30l_265-4183.csv
└── st40
    └── cnc_logs
        └── st40_265-4183.csv
```

----------------------------------------------------------------

#### View directories and files with file size

```bash linenums='1' hl_lines='1'
cd /home/haas/Haas_Data_collect/machines
tree -h
```

```bash title='Command Output'
[4.0K]  .
├── [4.0K]  minimill
├── [4.0K]  st30
│   └── [4.0K]  cnc_logs
│       └── [ 232]  st30_265-4183.csv
├── [4.0K]  st30l
│   └── [4.0K]  cnc_logs
│       └── [ 233]  st30l_265-4183.csv
└── [4.0K]  st40
    └── [4.0K]  cnc_logs
        └── [ 232]  st40_265-4183.csv

```

----------------------------------------------------------------

#### View just directories

```bash linenums='1' hl_lines='1'
cd /home/haas/Haas_Data_collect/machines
tree -d
```

```bash title='Command Output'
.
├── minimill
├── st30
│   └── cnc_logs
├── st30l
│   └── cnc_logs
└── st40
    └── cnc_logs
```

----------------------------------------------------------------

## Create the shares

Each share is created by updating the file `/etc/samba/smb.conf` with the information defining the share

### Update the smb.conf file

Open the file using:

```bash
sudo nano /etc/samba/smb.conf
```

Go to the bottom of the file and paste this code in (Note, the installation script creates this share):

```bash
# Share for Haas Data Collection files
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

After you add all the share configurations, save `/etc/samba/smb.conf` and exit nano using `ctrl+s` to save and `ctrl+x` to exit.

----------------------------------------------------------------

Run the following commands to set the permissions correctly.

```bash
sudo chown -R haas:HaasGroup /home/haas/Haas_Data_collect
sudo chmod -R 2774 /home/haas/Haas_Data_collect
```

The 2 in 2774 sets the setgid bit, which ensures that all locally created files also inherit the HaasGroup. Run the following to verify:

```bash
cd ~
ls -l
```

```unixconfig title='Command Output'
drwxrwsr-- 9 haas HaasGroup 4096 Mar 18 19:32 Haas_Data_collect
```

----------------------------------------------------------------

### The smb.conf Share section

Based on the [table](directories_shares.md/#table-of-machines) above this is what the share section will look like:

```bash linenums='1'
# Share for Haas Data Collection files

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

### Restart the Samba Server

Now that the `/etc/samba/smb.conf` file has been updated you need to test for errors. Use the following:

```bash
testparm -s
```

The entire `smb.conf` file will be displayed. You will need to scroll up to see any error messages since the conf file is longer than one screen. Restart the Samba Server service using:.

```bash
sudo systemctl restart smbd
```

**There is no output from this command.**

----------------------------------------------------------------

### Display the Samba Shares

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

```bash hl_lines='1'
smb-shares
```

```bash title='Command Output'
[Haas]        path = /home/haas/Haas_Data_collect
[st40]        path = /home/haas/Haas_Data_collect/machines/st40
[st30]        path = /home/haas/Haas_Data_collect/machines/st30
[st30l]        path = /home/haas/Haas_Data_collect/machines/st30l
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

Here is the output of the script:

```bash hl-lines='1'
smb-shares
```

```bash title='Command Output'
Haas         /home/haas/Haas_Data_collect
st40         /home/haas/Haas_Data_collect/machines/st40
st30         /home/haas/Haas_Data_collect/machines/st30
st30l        /home/haas/Haas_Data_collect/machines/st30l
```

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

**There is no output from this command.**

----------------------------------------------------------------

Ensure the underlying Linux directory permissions are correct:
On the server's filesystem, make sure the shared directory (/home/haas/Haas_Data_collect) in this example) is owned by haas:HaasGroup.

```bash
sudo chown -R haas:HaasGroup /home/haas/Haas_Data_collect
sudo chmod -R 2774 /home/haas/Haas_Data_collect
```

The 2 in 2774 sets the setgid bit, which ensures that all locally created files also inherit the HaasGroup.
