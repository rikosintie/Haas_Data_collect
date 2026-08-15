# Let's build the appliance

----------------------------------------------------------------
![screenshot](img/Tux_sitting_at_workbench1.resized.png)

----------------------------------------------------------------

As you can imagine, there are a lot of steps required to build a functional appliance from scratch. But once you have completed it, you will have gained a lot of useful knowledge!

- Clone the repository - This is how you get the code from the repository to the appliance.
- Create the machine-logger services - One `haas-<machine>.service` per CNC machine, created via Cockpit's Create Service button so they start automatically on boot.
- Install Samba Server - Samba is used to create Windows compatible shares.
- Create the security group - Used to allow Windows users access to the directory shares on the appliance.
- Create the users - Multiple users are needed to deploy into production
- Add the users to the security group - Required for sharing
- Create the directories - A place to store files
- Create the Samba shares - Allows Windows users to map a network drive to the appliance

The next sections will cover all of these topics in detail.

----------------------------------------------------------------

## Clone the repository

!!! Note
    Linux uses a case sensitive file system. So `Haas` is different from `haas`. If you type a command, for example, `LS -l` instead of `ls -l` and it says
    ```bash hl_lines='1'
    LS -l
    zsh: command not found: LS
    ```

Make sure you have the case correct!

## Open a terminal on the Pi

If you are using ssh to connect, you are already at the terminal. If you are using the desktop version of Ubuntu, press `ctrl+alt+t` to open a terminal.

- Make sure you are in your home directory by running `cd ~`
- Verify using `pwd` which is `print working directory` in Linux. You should see:

```bash
pwd
/home/haas
```

!!! Note
    The examples in this document will have `/home/haas` and `/home/haas/Haas_Data_collect`. When you install Ubuntu on your Raspberry Pi 5 use `haas`, all lowercase, as the username. If you use a different name, remember to update the path after you paste a command into the terminal.

- Clone the repository using

```bash hl_lines="1"
git clone https://github.com/rikosintie/Haas_Data_collect.git
```

- Change to the `Haas_Data_collect` folder using

```bash hl_lines="1"
cd Haas_Data_collect
```

- List the files for reference using `ls -l`

----------------------------------------------------------------

## The installation script

The repository includes a script named: `haas-install.sh`. The script does a lot of the heavy lifting to get the appliance up and running.

- Writes the `/etc/haas-firewall.conf` file that allows you to add a custom subnet for the Haas CNCs if your network uses segmentation. Allows you to set a custom SSH port for the firewall rules if your security policy requires it.
- Installs the systemd firewall service + timer
- Installs Samba server and updates /etc/samba/smb.conf
- Sets up Samba security and creates the "[machines]" share — a single shared drive exposing every machine's subdirectory. The repo root itself is not shared over Samba, only reachable over SSH, to limit exposure of scripts and config to every Samba account. Per-machine shares are created individually afterward via Manage Samba's Create Share button.
- Creates Samba and Linux users from the `initial_users.csv` file
- Installs the Cockpit extension for managing/monitoring the firewall
- Installs the "micro" cli text editor
- Installs the "fresh" cli text editor
- Installs Python PIP
- Installs the Linux "tree" command for listing directories and files.
- Copies `issue.net` to `/etc/issue.net` (This is the Pre-logon banner)
- Copies csvlens binary to /usr/local/sbin - csvlens is a cli tool for viewing csv files. Example `csvlens users-a.csv`
- Creates the backup directory in the repo
- Triggers an initial firewall configuration via systemd using the `users-a.csv` file.

It does NOT modify or delete anything inside the repo.

The installation script does not create any machine-logger services — those are created afterward, one per machine, via Cockpit's Create Service button. See [Setting up the machine-logger services](#setting-up-the-machine-logger-services) below.

----------------------------------------------------------------

## Update text files

There are a three files in the `Haas_Data_collect` directory that need to be updated to fit your environment **before you run the install script**:

- users-a.csv - This file contains usernames, ip addresses and roles for configuring the firewall. A second slot, users-b.csv, is also present alongside it for planned/alternate rule sets — see [Simulate / Compare](../manage_the_appliance/firewall.md#simulate-compare) for how the two are used day to day.
- initial_users.csv - Users who need access to the Windows shares on the appliance. The CNC controls will use the `haassvc` user account. Add CNC programmers, and operations personnel that need to copy files to/from the appliance.
- issue.net - This is the login banner. It gets copied to `/etc/issue.net` by the `haas-firewall-install.sh` script. This is a generic file. Update it per your company's security policy.

These files are used as input to the `haas-firewall-install.sh` script that is presented next.

There two user components to the appliance setup, which may be confusing at first! The appliance is protected by the Ubuntu firewall. The firewall is configured automatically by the data in the file `users-a.csv`.

There are also `users` created from data in the file `initial_users.csv`. These are users that need to have both Linux and Samba accounts to access the file shares. The installation scripts creates the user accounts.

----------------------------------------------------------------

### users-a.csv

This is a comma-separated value (csv) file that contains the users, ip addresses and roles of any users that need to access the Raspberry Pi 5 appliance. Every Haas CNC machine will need to be in this file, otherwise the firewall will block access. If your machines are on a dedicated IP subnet, a best practice, you can edit the `/etc/haas-firewall.conf` file and enter the subnet. There is a script that will read the `haas-firewall.conf` file and update the firewall. That is explained in the `Cockpit management` section.

The format for `users-a.csv` is:

```bash hl_lines='1'
username,ip_address,role
haas,192.168.10.143,Administrator
haassvc,192.168.10.104,user
mchavez,192.168.10.133,user
thubbard,192.168.10.100,user
st30,192.168.10.110,user
st30l,192.168.10.111,user
st40,192.168.10.112,user
vf2ss,192.168.10.113,user
vf5ss,192.168.10.114,user
minimill,192.168.10.115,user
```

- username - The username of a person or machine that will access the appliance.
- ip _address - This is the IP address of devices that need to access the appliance.
- roles:
    1. Administrator - Users that can manage the appliance. They can access ssh, smb shares, Cockpit.
    1. User - This role is configured on the Haas CNC and any users that only needs to map drives. Only file share access through the firewall

----------------------------------------------------------------

!!! Note
    The `username` is used as a label in the firewall. Most users will map drives using the `haassvc` account. Below is an example of the firewall rules.

----------------------------------------------------------------

```unixconfig hl_lines='1'
sudo ufw status numbered | sort -k5

     --                         ------      ----
     To                         Action      From
Status: active
[10] 445                        ALLOW IN    192.168.10.100             # thubbard-user-smb
[13] 9090                       ALLOW IN    192.168.10.223             # rgoodwin-admin-cockpit
[12] 445                        ALLOW IN    192.168.10.223             # rgoodwin-admin-smb
[11] 22                         ALLOW IN    192.168.10.223             # rgoodwin-admin-ssh
[ 6] 9090                       ALLOW IN    192.168.10.104             # toolroom-admin-cockpit
[ 5] 445                        ALLOW IN    192.168.10.104             # toolroom-admin-smb
[ 4] 22                         ALLOW IN    192.168.10.104             # toolroom-admin-ssh
[ 9] 9090                       ALLOW IN    192.168.10.113             # msp_admin-admin-cockpit
[ 8] 445                        ALLOW IN    192.168.10.113             # msp_admin-admin-smb
[ 7] 22                         ALLOW IN    192.168.10.113             # msp_admin-admin-ssh
[ 3] 9090                       ALLOW IN    192.168.10.143             # haas-admin-cockpit
[ 2] 445                        ALLOW IN    192.168.10.143             # haas-admin-smb
[ 1] 22                         ALLOW IN    192.168.10.143             # haas-admin-ssh
```

----------------------------------------------------------------

The `users-a.csv` file will remain in the `Haas_Data_collection` folder after the appliance is in production. Anytime the firewall needs to be modified you will update the `users-a.csv` file.

Use the following to edit the file if you are connected over ssh:

```bash
cd ~/haas/Haas_Data_collect
nano users-a.csv
```

When you are finished use the following to `save` and `close` the file:

```bash
ctrl+s
ctrl+x
```

----------------------------------------------------------------

Or use the `micro text editor`:

```bash linenums='1' hl_lines='1'
cd ~/haas/Haas_Data_collect
micro users-a.csv
```

When you are finished use the following to `save` and `close` the file:

```bash
ctrl+s
ctrl+q
```

----------------------------------------------------------------

If you are in the Desktop version of Ubuntu you can open the `Files` application and double click on `users-a.csv`. That will open the file in LibreOffice Calc. Make sure you save the file as a `csv` file and not an `odf` or `excel` format.

----------------------------------------------------------------

### The initial_users.csv file

This is a comma-separated value (csv) file that contains usernames and passwords. These are users authorized to map drives to the appliance. Every user who needs to work with the appliance should be listed in this file. The installation script will create a Linux user account and Samba account for each user in `initial_users.csv`.

To create administrative users, say an admin for an MSP, use the [Manage users by script](../build_the_appliance/create-groups.md/#manage-users-by-script){target="_blank"} to create the user. Once the appliance is up and Cockpit is reachable, this (and ordinary user creation, deletion, and password changes) can also be done from Cockpit's Manage Samba page — see [Create User](../manage_the_appliance/samba.md#create-user) — without SSH access.

User with only drive mapping permissions would include:

- **Haas CNC controls** - Use `haassvc` on all machine tools when enabling file sharing. Their role in `users-a.csv` would be `user`.
- **CNC Programmers** - You can map a drive using a Windows user name or use `haassvc` since the programmers only need to access the shares. Their role in `users-a.csv` would be `user`.
- **Operations employees** - These are users that will be copying log files for data analysis. You can map a drive using a Windows user name or use `haassvc` since the programmers only need to access the shares. Their role in `users-a.csv` would be `user`.

#### There are two trains of thoughts on usernames

1. Use `haassvc` for all CNC controls, programmers, and operations people. They only get r/w access to shares. They cannot manage the appliance.
2. Use `haassvc` for all CNC controls, use the Windows username for all other users. They only get r/w access to shares. They cannot manage the appliance.

The first method is easier to deploy and maintain, but you lose the ability to track who has been logging in. The first method fits what Microsoft calls [Tiered Administration](https://learn.microsoft.com/en-us/security/privileged-access-workstations/privileged-access-access-model).

**How the Tier Model Segregates Accounts and Devices:**

- **Tier 0** (Control Plane): This tier contains "crown jewel" assets like Domain Controllers and Identity Management Systems. Administrators must use a dedicated Tier 0 account and a hardened Privileged Access Workstation (PAW) to manage these systems.
- **Tier 1** (Management Plane): This tier consists of enterprise servers (e.g., SQL, Exchange, file servers). Admins use a separate Tier 1 account to manage these servers; this account is explicitly denied the right to log on to Tier 2 workstations.
- **Tier 2** (User Plane): This is the lowest tier, encompassing end-user workstations and ***devices***. Users and Tier 2 admins use standard accounts here, which have no administrative rights on Tier 1 or Tier 0 systems.

The appliance can be considered a `device`, if you only use local Linux accounts like `haas`, `haassvc`, `mspadmin` even if the appliance was compromised, the attacker couldn't use the accounts to move laterally in Active Directory.

----------------------------------------------------------------

Key Principles

1. **Privilege Isolation:** High-privileged credentials are never exposed to lower-tier systems, preventing attackers from moving laterally from Tier 2 to Tier 0.

2. **Clean Source Principle:** All security dependencies must be as trustworthy as the object being secured, ensuring that administrative accounts are only used in appropriate contexts.

3. **Logon Restrictions:** Interactive logons are restricted to the tier of the system being managed. For example, a Tier 0 admin should never log in interactively to a Tier 2 workstation.

----------------------------------------------------------------

By default, the only user who can run Linux commands with superuser rights is `haas`, the user who installed Ubuntu. Verify your company's security policy before deciding on a method to use.

----------------------------------------------------------------

I used `xxxxxxxxx` for the password in the `initial_users` file. This is because GitHub is scanned thousands of times per day by attackers looking for secrets. If I used anything resembling a password, attackers would be publishing my repository all over the dark web. I attended a `Crowdstrike` conference in Las Vegas in 2024. In one of the classes I got to enter `rikosintie` into their `Dark Web` tool. I was stunned that my repositories were listed as having `ssh keys` and passwords in the clear. None of the `ssh keys` or passwords were valid, I had changed several characters in the keys and the passwords were nonsense, but the Dark Web as very excited about them!

Here is the included sample file. Modify it to fit your environment:

```text
username, password
haassvc, xxxxxxxxx
```

I know it's odd that there are `users-a.csv` and `initial_users.csv` but there is no secure way to leave passwords lying around in plain text files.

!!! Warning
    This file contains usernames/passwords that the installation script will use to create the Samba shares. You should delete this file as soon as the script finishes the installation.

----------------------------------------------------------------

Use the following to edit the file if you are connected over ssh:

```bash
cd ~/haas/Haas_Data_collect
nano initial_users.csv
```

When you are finished use the following to `save` and `close` the file:

```bash
ctrl+s
ctrl+x
```

----------------------------------------------------------------

Or use the `micro text editor`:

```bash linenums='1' hl_lines='1'
cd ~/haas/Haas_Data_collect
micro initial_users.csv
```

When you are finished use the following to `save` and `close` the file:

```bash
ctrl+s
ctrl+q
```

----------------------------------------------------------------

If you are in the Desktop version of Ubuntu you can open the `Files` application and double click on `users-a.csv`. That will open the file in LibreOffice Calc. Make sure you save the file as a `csv` file and not an `odf` or `excel` format.

----------------------------------------------------------------

### The login banner - issue.net

![screenshot](img/tux-authorized2.resized.jpeg)

----------------------------------------------------------------

This is a text file that is displayed ***before*** a user logs in over ssh. The included file is a basic "You need Authorization" banner. Modify it to match your organization's security policy before running the installation script. If you need to update it later, use `sudo nano /etc/issue.net` to open the file. ASCII art is a method of making banners using ASCII characters. I used the [ASCII Art Archive](https://www.asciiart.eu/text-to-ascii-art) to create this banner. You can get much fancier if you want to spend the time! If you are also responsible for network equipment, you can use the approved banner from a switch or router.

----------------------------------------------------------------

```text


                 Haas Data Collection Server

╔═════════════════════════════════════════════════════════════════╗
║                                                                 ║
║ UNAUTHORIZED ACCESS TO THIS NETWORK DEVICE IS PROHIBITED.       ║
║ You must have explicit permission to access or configure this   ║
║ device.  All activities performed on this device are logged and ║
║ violations of this policy may result in disciplinary action.    ║
║                                                                 ║
╚═════════════════════════════════════════════════════════════════╝



```

Use the following to edit the file if you are connected over ssh:

```bash
cd ~/haas/Haas_Data_collect
nano issue.net
```

When you are finished use the following to `save` and `close` the file:

```bash
ctrl+s
ctrl+x
```

**If you are in the Desktop version of Ubuntu**
Open the `Files` application and right click on `issue.net` and select `Open with text Editor`. That will open the file in `Gnome Text Editor`.

----------------------------------------------------------------

Use the following to edit the file if you are connected over ssh:

```bash
cd ~/haas/Haas_Data_collect
sudo initial_users.csv
```

When you are finished use the following to `save` and `close` the file:

```bash
ctrl+s
ctrl+x
```

If you are in the Desktop version of Ubuntu you can open the `Files` application and double click on `users-a.csv`. That will open the file in LibreOffice Calc. Make sure you save the file as a `csv` file and not an `odf` or excel format.

----------------------------------------------------------------

## The install script details

The installation script `haas-install.sh` is written in `bash`, the native Linux language for system administration tasks. I have included comments for every section. You should review the script before running it so that you have an idea what it does.

Use the following to view the file if you are connected over ssh:

```bash
cd ~/haas/Haas_Data_collect
cat initial_users.csv
```

**If you are in the Desktop version of Ubuntu**
Open the `Files` application and right click on `haas-install.sh` and select `Open with text Editor`. That will open the file in `Gnome Text Editor`.

### Run the installation script

In Linux, scripts have to be marked `eXecutable` before you can run them. The files should already have the execute bit set but check with:

```bash
cd ~/haas/Haas_Data_collect
ls -l haas-install.sh
```

```bash title='Command Output'
ls -l haas-install.sh
-rwxrwxr-x 1 mhubbard mhubbard 14347 Feb  5 15:12 haas-install.sh
```

If you don't see the `x` in the output, run the following:

```bash hl_lines='1'
chmod +x haas-install.sh
```

Execute the script using:

```bash
cd ~/Haas_Data_collect
./haas-install.sh
```

There will be a lot of output as the script does it's job! Once it completes, review the output for any error messages. I don't expect any failures, the script has been tested on a Raspberry Pi 5 with an NVME drive, an Intel NUC running Ubuntu Desktop, a virtual machine running ubuntu Desktop.

If there were no errors we can move on to creating the `systemd service files` that will automatically start the scripts when the Raspberry Pi 5 is booted.

----------------------------------------------------------------

## Setting up the machine-logger services

Each CNC machine tool needs a `haas-<machine>.service` systemd unit that
runs `haas_logger2.py` for it, so data collection starts automatically on
boot and the service restarts itself if it ever crashes.

**Use Cockpit's Create Service button for this** — log into Cockpit,
open **Python Scripts** in the sidebar, and click **Create Service**.
Fill in a description, machine name, IP address, and port (leave
**Append mode** checked unless this specific machine needs one file per
cycle instead of one file per part number), and it writes a
correctly-formed unit file, creates the machine's working directory with
the right ownership, and enables/starts the service — all in one step,
with no chance of the kind of typo that used to make a hand-edited unit
file silently fail. See
[Python Script Services](../manage_the_appliance/python_scripts.md#create-service)
for the full walkthrough, including **Service State** and **Machine
Health**, which cover the troubleshooting this section used to explain
manually — duplicate ports, a missing `-u` flag, crash loops,
connectivity, and directory permissions.

For terminal shortcuts (`haas-cat`, `haas-script`, etc.) instead of
typing full `systemctl` commands by hand, see
[Terminal Aliases](../manage_the_appliance/terminal_aliases.md).

----------------------------------------------------------------

## Samba installation

Key changes:

- Overwrites /etc/samba/smb.conf entirely with tee (without -a)
- Backs up the original to smb.conf.backup first
- Includes all the security settings in the [global] section
- Disables the printer share
- Adds `testparm -s` to validate the configuration before restarting

```text hl_lines='1 8  17 23 27 32'
[global]
    workgroup = WORKGROUP
    server string = %h server (Samba, Ubuntu)
    log file = /var/log/samba/log.%m
    max log size = 10000
    logging = file
    panic action = /usr/share/samba/panic-action %d

    # Authentication
    server role = standalone server
    obey pam restrictions = Yes
    unix password sync = Yes
    passwd program = /usr/bin/passwd %u
    passwd chat = *Enter\snew\s*\spassword:* %n\n *Retype\snew\s*\spassword:* %n\n *password\supdated\ssuccessfully* .
    pam password change = Yes
    map to guest = Bad User

    # Protocol Security - Force SMB2/SMB3 only
    client min protocol = SMB2
    client max protocol = SMB3
    server min protocol = SMB2
    server max protocol = SMB3

    # Disable legacy protocols and services
    disable netbios = Yes
    disable spoolss = Yes

    # Disable printing
    load printers = No
    printing = bsd
    printcap name = /dev/null

    [printers]
    available = No
    browseable = No
    printable = Yes

[print$]
    available = No

    # Performance
    socket options = TCP_NODELAY IPTOS_LOWDELAY
    hostname lookups = No

[machines]
    comment = File Share for all machines
    create mask = 0664
    directory mask = 0775
    force create mode = 0664
    force directory mode = 0775
    force user = haas
    force group = HaasGroup
    path = /home/haas/Haas_Data_collect/machines
    read only = No
    valid users = @HaasGroup haas
    browseable = yes
```

The repo root (`/home/haas/Haas_Data_collect` itself) is deliberately **not**
shared over Samba — only `/home/haas/Haas_Data_collect/machines` is, via the
`[machines]` share above. Every Samba account (including one created for a
single machine tool) is a member of `HaasGroup`, so sharing the repo root
itself would expose scripts and config to every account, not just admins.
Anyone who needs repo-root access already has it over SSH.

Security improvements in this config:

Forces SMB2 minimum (blocks SMB1 which has security vulnerabilities)
Disables NetBIOS completely
Disables printing services
Only allows authenticated users (@HaasGroup)

This approach is cleaner and ensures no duplicate entries!
