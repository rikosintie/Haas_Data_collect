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

## MSP/MSSP Guidance for SSH

Out to the box, the appliance supports username/password login for SSH. The following non-default settings are configured:

- Root login is disabled (PermitRootLogin no)
- Empty Passwords are not permitted (PermitEmptyPasswords no)
- Pre-login banner is configured (Banner /etc/issue.net)

If the environment uses SSH keys for logins, the following additional steps can be taken to lock the appliance down using SSH Keys. Do not run this unless you are sure that you have configured ssh keys on your laptop and copied the public key to the appliance!

### SSH Hardening Using a Drop-In Configuration File

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
sudo sshd -T | grep -E 'permitrootlogin|passwordauthentication|pubkeyauthentication|challengeresponseauthentication|permitemptypasswords'
```

```bash title='Command Output'
permitrootlogin no
pubkeyauthentication yes
passwordauthentication yes
permitemptypasswords no
```

The output should reflect the enforced values.

----------------------------------------------------------------

- The Ubuntu UFW firewall is automatically configured and enabled based on the users and roles in the `users.csv` file. It can be updated at any time to add/remove users.
- Ubuntu 24.04 uses OpenSSH_9.9p1, and OpenSSL 3.4.1 11 Feb 2025 which have dropped several legacy ciphers:
  - 1. DSA (ssh-dss) — fully removed
  - 1. SHA‑1 Key Exchange
- If the Haas machines are on a dedicated LAN segment, the firewall can be configured with one change to the configuration file reducing the chance of an error being made.
- Samba Version 4.19.5-Ubuntu is installed.
- Samba removed SMBv1 in version 4.1+.
- NetBIOS is disabled by the installation script.
- The Samba print spooler and printer share are disabled by the installation script.
- The [RedHat Cockpit management suite](https://www.redhat.com/en/blog/intro-cockpit) is installed by the installation script to provide a modern-looking and user-friendly interface to manage and administer the appliance.
- A custom Cockpit extension is installed to manage the firewall using a web interface.
- An [Ubuntu Pro subscription](https://ubuntu.com/pricing/pro) can be purchased to provide automatic updates and enterprise level support.

If you build the appliance with the `haas_firewall_install.sh` script then these steps are already taken care of. If you build from scratch, follow the instructions in the [Installing Samba chapter](../build_pi_5_appliance/Install_Samba.md).

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

## Updates to the smb.conf file

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

## Restart Samba service

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
