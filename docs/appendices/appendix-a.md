# How is the appliance hardened?

The appliance is built on Ubuntu 24.04 which is a Long Term Support (LTS) version of Ubuntu. Ubuntu 24.04 is well tested in enterprises and the Ubuntu team releases security patches on a regular schedule.

Since the appliance has a very limited role it can be hardened against typical attacks. The follow steps are completed by the installation script:

1. Minimal Attack Surface
    1. The system runs Ubuntu 24.04.3 LTS, a long‑term‑support OS with a stable security update cadence.
    1. Only essential services are installed:
        1. SSH for administrative access
        1. Cockpit for web‑based monitoring
        1. Samba for Windows compatible drive mapping

1. Strict Network Access Control
    1. UFW is enabled and default‑deny for all inbound traffic.
    1. Only explicitly authorized devices (by IP or subnet) are allowed to reach:
        1. TCP 22 (SSH)
        1. TCP 445 (SMB)
        1. TCP 9090 (Cockpit)
    1. No outbound restrictions are required; the appliance only initiates connections to the Haas controls.
    1. No outbound control signals, no CNC commands, no remote execution.
1. SSH Hardening
    1. OpenSSH 9.9p1 with modern cryptography only.
    1. **Legacy algorithms removed** (e.g., DSA host keys).
    1. Only strong key‑exchange, host‑key, and cipher suites remain enabled by default.
    1. A login banner warn users that access is restricted BEFORE logging in.
    1. Root login disabled.
    1. See [MSP/MSSP Guidance for SSH](#mspmssp-guidance-for-ssh) for even stronger ssh hardening guidance.

1. Samba Hardening
    1. Minimum of SMBv2 enforced.
    2. Printer sharing disabled.
    3. Shares are exposed to authorized IP addresses with only R/W permissions.
    4. Samba users are Linux system users; no guest access.
    5. No NetBIOS name service or legacy SMB1 traffic.

1. Cockpit Hardening
    1. Cockpit is only reachable from authorized IPs.
    2. HTTPS enforced (self‑signed or appliance‑generated certificate).
    3. No optional Cockpit modules installed beyond what the appliance requires.

1. Filesystem & Permissions
    1. Application code and Cockpit extensions installed under /usr/share/cockpit/ with root‑owned, read‑only permissions.
    2. Scripts under /usr/local/sbin are root‑owned and non‑writable by users.
    3. No world‑writable directories except system‑required ones (/tmp, /var/tmp).
    4. Logs stored under /var/log with standard Linux permissions.

1. Automatic Security Updates (requires optional Ubuntu Pro registration)
    1. unattended-upgrades enabled for:
        1. Ubuntu security patches
        2. Kernel updates
        3. OpenSSH/Samba/Cockpit updates
    2. Reboots are not automatic; the appliance notifies the operator when a reboot is required.

1. No External Dependencies
    1. The appliance does not rely on cloud services, APIs, or external authentication.
    2. All functionality is local and self‑contained.
    3. No telemetry, analytics, or remote‑management agents installed.

1. Physical Security Assumptions
    1. The appliance is intended to be installed inside a machine shop’s secure network closet or control cabinet.
    2. No USB devices are required for operation.
    3. The system auto‑locks the console and requires a password for local login.

1. Operational Safety
    1. The appliance does not modify machine‑tool configurations.
    2. The appliance reads machine‑generated data via Telnet and saves it to directories that are exposed by SMB (port 445 Microsoft file sharing).

1. IPv6 Link‑Local Provisioning
    1. The appliance supports standards‑based IPv6 link‑local provisioning, identical to how network switches are configured out‑of‑box.
    2. Windows/Mac/Linux clients can SSH into the appliance using IPv6 EUI‑64 addressing if the segmented network doesn't support DHCP address management.
    3. Windows Wi‑Fi does not support IPv6 link‑local provisioning; this is a Windows limitation, not an appliance limitation.
    4. Clear instructions are provided for MSPs on how to connect using a wired interface.

1. IPv6 Machine tool network
    1. The `/etc/haas-firewall.conf` file supports a segmented IPv6 vlan for the machine tools.
    2. Edit the entry `HAAS_MACHINES_SUBNET_V6=""` to add your IPv6 subnet.

----------------------------------------------------------------

!!! Note
        The IPv6 capability is for future proofing. I don't believe that the Haas CNC control currently supports IPv6

----------------------------------------------------------------

## MSP/MSSP Guidance for SSH

Out of the box, the appliance supports username/password login for SSH. The following non-default settings are configured:

- Root login is disabled (PermitRootLogin no)
- Empty Passwords are not permitted (PermitEmptyPasswords no)
- Pre-login banner is configured (Banner /etc/issue.net)

If the environment uses SSH keys for logins, the following additional steps can be taken to lock the appliance down using SSH Keys. Do not run this unless you are sure that you have configured ssh keys on your laptop and copied the public key to the appliance!

### Drop-In Config File

Ubuntu 24.04 supports modular SSH configuration using the Include directive in the primary sshd_config file. Drop-in files located in /etc/ssh/sshd_config.d/ are automatically loaded

You can create:

`/etc/ssh/sshd_config.d/99-haas-hardening.conf`

to keep custom security controls in an OpenSSH drop-in configuration file.

This approach ensures:

- Clear separation from operating system defaults
- Improved audit transparency
- Clean survivability across package updates
- Simple identification of appliance-specific security controls

----------------------------------------------------------------

### Security Rationale

- **PermitRootLogin no**
Prevents direct root authentication, enforcing user accountability and privilege escalation via sudo.
- **PasswordAuthentication no**
Eliminates exposure to password brute-force attempts. SSH access requires key-based authentication.
- **PubkeyAuthentication yes**
Ensures modern cryptographic authentication is enabled.
- **ChallengeResponseAuthentication no**
Disables legacy interactive authentication mechanisms not required for appliance operation.
- **PermitEmptyPasswords no**
Prevents authentication with blank credentials.

These controls align with common MSP/MSSP baseline requirements and typical CIS Level 1 guidance.

----------------------------------------------------------------

### Implementation

You can create the drop-in file using the following commands:

```bash hl_lines='1'
sudo tee /etc/ssh/sshd_config.d/99-haas-hardening.conf > /dev/null << 'EOF'
PermitRootLogin no
PasswordAuthentication no
PubkeyAuthentication yes
ChallengeResponseAuthentication no
PermitEmptyPasswords no
X11Forwarding no
EOF

sudo systemctl restart ssh
```

!!! Warning
    Make sure that you have created the SSH keys on your laptop and copied the public key to the appliance before running this code. Otherwise you will be locked out and have to use a monitor/keyboard or serial cable to recover.

I have detailed instructions on setting up SSH for network devices that covers creating ssh keys here: [Creating SSH Keys](https://rikosintie.github.io/Ubuntu4NetworkEngineers/SSH/#creating-ssh-keys).

----------------------------------------------------------------

### Verification

To confirm effective configuration, run:

```bash linenums='1' hl_lines='1'
sudo sshd -T | grep -E 'permitrootlogin|passwordauthentication|pubkeyauthentication|challengeresponseauthentication|permitemptypasswords|^banner|x11f'
```

```bash title='Command Output'
permitrootlogin no
pubkeyauthentication yes
passwordauthentication yes
x11forwarding no
permitemptypasswords no
banner /etc/issue.net
```

The output should reflect the enforced values.

----------------------------------------------------------------

Run this command to verify the port that ssh is actually listening on:

```bash hl_lines='1'
sudo ss -tulpn | grep ssh
```

```bash title='Command Output'
tcp   LISTEN 0      4096                             0.0.0.0:3333       0.0.0.0:*    users:(("sshd",pid=46557,fd=3),("systemd",pid=1,fd=66))
tcp   LISTEN 0      4096                                [::]:3333          [::]:*    users:(("sshd",pid=46557,fd=4),("systemd",pid=1,fd=67))
```

----------------------------------------------------------------

**Operational Considerations**
Before disabling password authentication:

- Confirm SSH key-based access is functional.
- Verify correct permissions:
    1. ~/.ssh → 700
    1. authorized_keys → 600

Failure to validate key access before disabling passwords may result in administrative lockout.

----------------------------------------------------------------

## Custom SSH port

If your company's security policy requires a custom SSH port, you can use the `ssh_port.sh` script in the root of the `Haas_Data_collect` directory. The script prompts for a port number, then:

- Updates /etc/ssh/sshd_config
- Updates /etc/haas-firewall.conf
- restarts the ssh daemon

You can run the script as often as you want. It updates both files each time.

If you are concerned about SSH security, I recommend switching to SSH keys after changing the port. It is nearly impossible to brute-force a certificate.

### The ssh_port script

The script must be run with `sudo` since it modifies `/ect/haas-firewall.conf` and /etc/ssh/sshd_config`. Use the following to run the script:

```bash linenums='1' hl_lines='1'
sudo ./ssh_port.sh
```

```bash title='Command Output'
#############################################
#                                           #
#      Configure a custom port for SSH      #
#  Use port 22 or a port between 1024-65535 #
#                                           #
#############################################


Enter the SSH port number (22, 1024-65535): 3333

SSH_PORT set to 3333
Updating /etc/ssh/sshd_config...
Updating /etc/haas-firewall.conf...

Restarting SSH Service...


Feb 19 14:31:38 haas sshd[47452]: Server listening on 0.0.0.0 port 3333.
Feb 19 14:31:38 haas sshd[47452]: Server listening on :: port 3333.


##########################################################

           Script is now complete!
  The SSH service is configured for port 3333
  /etc/haas-firewall.conf is updated with SSH_PORT=3333
        Use Cockpit to update the Firewall

##########################################################
```

### Update the firewall

The firewall by default is configured to use port 22 for ssh. If you change the port using `sudo ssh_port` then you must run the firewall configuration script to update the port:

```bash linenums='1' hl_lines='1'
sudo /usr/local/sbin/configure_ufw_from_csv.sh
```

```bash title='Command Output'
[INFO] Using CSV file: /home/haas/Haas_Data_collect/users.csv
[INFO] Using backup directory: /home/haas/Haas_Data_collect/backups
2026-02-19 14:36:12 [INFO] Starting UFW configuration from CSV.
2026-02-19 14:36:12 [INFO] Using CSV file: /home/haas/Haas_Data_collect/users.csv
2026-02-19 14:36:12 [INFO] Validating CSV...
[*] Validating CSV: /home/haas/Haas_Data_collect/users.csv
[*] CSV validation PASSED successfully.
2026-02-19 14:36:12 [INFO] CSV validation passed.
2026-02-19 14:36:12 [INFO] CSV backup created at: /home/haas/Haas_Data_collect/backups/users_2026-02-19_14-36-12.csv
2026-02-19 14:36:12 [INFO] Applying Haas subnet rule: ALLOW 445/tcp FROM 10.10.10.0/24
Skipping adding existing rule
2026-02-19 14:36:12 [INFO] ADMIN: haas@192.168.10.143 → 3333, 445, 9090
Skipping adding existing rule
Skipping adding existing rule
Skipping adding existing rule
2026-02-19 14:36:12 [INFO] USER: toolroom@192.168.10.104 → 445
Skipping adding existing rule
2026-02-19 14:36:12 [INFO] ADMIN: msp_admin@192.168.10.113 → 3333, 445, 9090
Skipping adding existing rule
Skipping adding existing rule
Skipping adding existing rule
2026-02-19 14:36:13 [INFO] USER: thubbard@192.168.10.100 → 445
Skipping adding existing rule
2026-02-19 14:36:13 [INFO] Firewall rule application complete.
```

!!! Note
        I have run this while connected to the appliance over ssh/port 22 and didn't get disconnected. But, it is possible that you will lose connectivity. If that happens reconnect using `ss -p 3333 haas@<ip_address>

----------------------------------------------------------------

## SSH Access Lost After Hardening Changes

After applying SSH hardening settings, administrators may be unable to reconnect to the appliance. This is typically caused by firewall rules, authentication changes, or service configuration order rather than a system failure.

This section provides a structured troubleshooting process to safely restore access.

### Common Causes

Loss of SSH access most commonly occurs when:

- The SSH listening port was changed but the firewall was not updated
- Password authentication was disabled before SSH keys were verified
- Root login was disabled without confirming a sudo-capable user
- SSH service configuration was modified but not restarted
- Incorrect permissions exist on SSH key files

----------------------------------------------------------------

### Troubleshooting Procedure

Perform the following checks from the appliance console or hypervisor access if using a Virtual Appliance.

#### 1. Verify SSH Service Status

```bash hl_lines='1'
sudo systemctl status ssh
```

**Expected Result**: `Active: active (running) since Thu 2026-02-19 14:31:38 PST; 17min ago`

**If not running**:

```bash linenums='1' hl_lines='1'
sudo systemctl restart ssh
```

#### 2. Confirm Listening Port

Verify which port SSH is actually listening on:

```bash lhl_lines='1'
sudo ss -tulpn | grep ssh
```

```bash title='Command Output'
tcp   LISTEN 0      4096                             0.0.0.0:3333       0.0.0.0:*    users:(("sshd",pid=47452,fd=3),("systemd",pid=1,fd=197))
tcp   LISTEN 0      4096                                [::]:3333          [::]:*    users:(("sshd",pid=47452,fd=4),("systemd",pid=1,fd=198))
```

If the expected port is not shown, review:

- /etc/ssh/sshd_config
- /etc/ssh/sshd_config.d/99-haas-hardening.conf

Using

```bash linenums='1' hl_lines='1'
sudo nano /etc/ssh/sshd_config
sudo nano /etc/ssh/sshd_config.d/99-haas-hardening.conf
```

Then test configuration validity:

```bash hl_lines='1'
sudo sshd -T | grep -E 'permitrootlogin|passwordauthentication|pubkeyauthentication|challengeresponseauthentication|permitemptypasswords|^banner|x11f|port\ '
```

```bash title='Command Output'
port 3333
permitrootlogin no
pubkeyauthentication yes
passwordauthentication yes
x11forwarding no
permitemptypasswords no
banner /etc/issue.net
```

#### 3. Check Firewall Rules

A firewall blocking the new SSH port will result in connection timeouts.

Check firewall status:

```bash hl_lines='1'
 sudo ufw status numbered | sort -k5
```

```bash title='Command Output'
     --                         ------      ----
     To                         Action      From
Status: active
[11] 3333                       ALLOW IN    192.168.10.113             # msp_admin-admin-ssh
[10] 3333                       ALLOW IN    192.168.10.143             # haas-admin-ssh
[ 1] 445                        ALLOW IN    10.10.10.0/24              # haas-smb
[ 9] 445                        ALLOW IN    192.168.10.100             # thubbard-user-smb
[ 5] 445                        ALLOW IN    192.168.10.104             # toolroom-user-smb
[ 8] 9090                       ALLOW IN    192.168.10.113             # msp_admin-admin-cockpit
[ 7] 445                        ALLOW IN    192.168.10.113             # msp_admin-admin-smb
[ 6] 22                         ALLOW IN    192.168.10.113             # msp_admin-admin-ssh
[ 4] 9090                       ALLOW IN    192.168.10.143             # haas-admin-cockpit
[ 3] 445                        ALLOW IN    192.168.10.143             # haas-admin-smb
[ 2] 22                         ALLOW IN    192.168.10.143             # haas-admin-ssh

```

#### 4. Validate Authentication Method

If password authentication was disabled, confirm SSH key access:

```bash hl_lines='1'
ls -ld ~/.ssh
ls -l ~/.ssh/authorized_keys
```

```bash title='Command Output'
drwx------ 2 haas haas 4096 Feb 19 14:19 /home/haas/.ssh
-rw------- 1 haas haas 86 Feb 19 14:45 /home/haas/.ssh/authorized_keys
```

The `drwx------` on /home/haas/.ssh means the permission is read/write/execute (700) for owner. No permission for the group or other users.
The `-rw-------` on /home/haas/.ssh/authorized_keys means rw for owner, No permission for the group or other users.

Fix if necessary:

```bash hl_lines='1'
chmod 700 ~/.ssh
chmod 600 ~/.ssh/authorized_keys
```

The ~/.ssh directory must be restricted to the account owner (700). OpenSSH will reject key-based authentication if directory permissions allow write access by group or other users.

----------------------------------------------------------------

#### 5. Test from a Remote System

Use verbose SSH output to identify failures:

```bash hl_lines="1"
ssh -vvv -p [custom port] haas@[appliance-ip]
```

This will indicate whether the failure is due to:

- Network filtering
- Authentication rejection
- Key negotiation issues

### Nmap Diagnostic Reference

From another host:

```bash hl_lines="1"
nmap -p [custom port] appliance-ip
```

```bash title='Command Output'
Starting Nmap 7.95 ( https://nmap.org ) at 2026-02-19 15:08 PST
Nmap scan report for haas.pu.pri (192.168.10.136)
Host is up (0.0068s latency).

PORT     STATE SERVICE VERSION
3333/tcp open  ssh     OpenSSH 9.6p1 Ubuntu 3ubuntu13.13 (Ubuntu Linux; protocol 2.0)
MAC Address: 88:A2:9E:43:4D:DE (Unknown)
Service Info: OS: Linux; CPE: cpe:/o:linux:linux_kernel

Service detection performed. Please report any incorrect results at https://nmap.org/submit/ .
Nmap done: 1 IP address (1 host up) scanned in 0.34 seconds
```

### Recovery Recommendation

When changing SSH ports or authentication settings, always apply changes in this order:

1. Log into a second session before starting the change
2. Update the ssh configuration files (run `./ssh_port.sh`)
3. update the firewall rules (`sudo /usr/local/sbin/configure_ufw_from_csv.sh` )
4. Verify new access from a another session

This staged approach prevents administrative lockout.

### Design Note

The Haas Data Collection Appliance applies SSH hardening using configuration drop-in files located in:

`/etc/ssh/sshd_config.d/99-haas-hardening.conf`

This provides protection during Operating System upgrades because the updater will now try to overwrite the files in cat /etc/ssh/sshd_config.d/`

----------------------------------------------------------------

## Securing Samba

The appliance has Microsoft `SMBv1` removed and supports `SMBv2/SMBv3`, the Haas CNC controls support `SMBv2` and the Windows desktops that will access the shares should support `SMBv2` since it has been built into Windows since Vista in 2006!

----------------------------------------------------------------

!!! Note
        SMB 2.0: Released in 2006 with Windows Vista. It was a major
        redesign to reduce protocol “chattiness” and improve performance over high-latency links.

----------------------------------------------------------------

We will also disable the Printer shares on the appliance since printing isn't needed. And we will disable the ANCIENT NetBios protocol known as `WINS` in the networking dialog on Windows. According to Microsoft CoPilot:

----------------------------------------------------------------

NetBIOS (Network Basic Input/Output System) was originally developed by IBM in 1983 for early PC networking. Microsoft adopted it in the mid-1980s, integrating it into MS-NET and later LAN Manager, and it became a foundational part of Windows networking in the Windows for Workgroups and Windows NT era.

🧯 Is NetBIOS Still Supported in Windows?
Yes, but it's being deprecated. NetBIOS name resolution (via WINS, the Windows Internet Name Service) is still technically supported in Windows Server 2025, but Microsoft has announced that:

WINS will be removed in future Windows Server releases after 2025.

Support for WINS (and by extension, NetBIOS name resolution) will continue only through the Windows Server 2025 lifecycle, which ends in November 2034.

🔒 Why It’s Being Phased Out
Security risks: NetBIOS and WINS are considered legacy protocols with known vulnerabilities.

----------------------------------------------------------------

### The smb.conf file

The following settings are added the Samba Server configuration file by the installation script:

[global]

```bash hl_lines='1'
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
```

`[print$]`

```bash
[print$]
    available = No
```

----------------------------------------------------------------

Run the following command to make sure the smb.conf file doesn't have any errors:

```bash hl_lines='1'
testparm -s
```

If there are any errors reopen the smb.conf file and correct them.

----------------------------------------------------------------

### Restart Samba service

Run the following to restart Samba and check the status:

```bash
sudo systemctl restart smbd
sudo systemctl status smbd
```

!!! Note
        `SMBv1` was permanently removed from Samba Server version 4.1 and above. Disabling `NetBios`, the `spoolss` service and the `printer$` share harden the appliance beyond just disabling `SMBv1`

----------------------------------------------------------------

## The UFW firewall

The Linux UFW firewall is used to prevent attacks against the appliance. During the initial setup the installation script enable the UFW firewall and configures it based on the file `users.csv`. This file contains:

- username
- ip address
- role

for all users that need access.

Based on this `users.csv` file:

```bash linenums='1' hl_lines='1'
cat users.csv
username,ip_address,role
haas,192.168.10.143,Administrator
msp_admin,192.168.10.113,Administrator
thubbard,192.168.10.100,user
toolroom,192.168.10.104,user
```

The installation script will create the following rules:

```bash linenums='1' hl_lines='1'
sudo ufw status numbered | sort -k5
```

```bash title='Command Output'
     --                         ------      ----
     To                         Action      From
Status: active
[ 1] 445                        ALLOW IN    10.10.10.0/24              # haas-smb
[ 9] 445                        ALLOW IN    192.168.10.100             # thubbard-user-smb
[ 5] 445                        ALLOW IN    192.168.10.104             # toolroom-user-smb
[ 8] 9090                       ALLOW IN    192.168.10.113             # msp_admin-admin-cockpit
[ 7] 445                        ALLOW IN    192.168.10.113             # msp_admin-admin-smb
[ 6] 22                         ALLOW IN    192.168.10.113             # msp_admin-admin-ssh
[ 4] 9090                       ALLOW IN    192.168.10.143             # haas-admin-cockpit
[ 3] 445                        ALLOW IN    192.168.10.143             # haas-admin-smb
[ 2] 22                         ALLOW IN    192.168.10.143             # haas-admin-ssh
```

### The Haas machines

In this example, the Haas machines are on a dedicated vlan of `10.10.10.0/24` as seen in the first line of the output. They only get access to the SMB share so that they can upload/download CNC programs to the appliance.

### The user role

- thubbard - CNC Programmer
- toolroom - A toolroom mill that isn't on the dedicated vlan

Received only access to the SMB shares.

### The Administrator Role

- haas - the administrator account for the appliance
- msp_admin - a user delegated to the MSP manage the appliance

Receive ssh, smb and cockpit access through the firewall.

All other IP addresses will only be able to ping the appliance.

----------------------------------------------------------------
