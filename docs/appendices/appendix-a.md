#

![screenshot](../appendices/img/tux-harden-appliance.png)

----------------------------------------------------------------

## How is the appliance hardened

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
    1. No outbound restrictions are required; the appliance only initiates connections to the Haas controls on user defined ports.
    1. No outbound control signals, no CNC commands, no remote execution.
1. SSH Hardening
    1. OpenSSH 9.9p1 with modern cryptography only.
    1. **Legacy algorithms removed** (e.g., DSA host keys).
    1. Only strong key‑exchange, host‑key, and cipher suites remain enabled by default.
    1. A login banner warn users that access is restricted BEFORE logging in.
    1. Root login disabled.
    1. See [MSP/MSSP Guidance for SSH](#mspmssp-guidance-for-ssh) for even stronger ssh hardening guidance.

1. Samba Hardening
    1. Samba Version 4.19.5-Ubuntu, SMBv1 has removed and cannot be enabled by mistake.
    2. Minimum of SMBv2 enforced.
    3. Printer sharing disabled.
    4. Shares are exposed to authorized IP addresses with only R/W permissions.
    5. Samba users are Linux system users; no guest access.
    6. No NetBIOS name service or legacy SMB1 traffic.

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
    2. Reboots are not automatic; the appliance notifies the operator at login when a reboot is required.

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

The installation script creates:

`/etc/ssh/sshd_config.d/99-haas-hardening.conf`

to keep custom security controls in an OpenSSH drop-in configuration file.

This approach ensures:

- Clear separation from operating system defaults
- Improved audit transparency
- Clean survivability across package updates
- Simple identification of appliance-specific security controls

See [Appendix E - SSH Hardening Profile](../appendices/appendix-e.md) for the ssh hardening details of the appliance.

----------------------------------------------------------------

!!! Note
    The loglevel verbose setting will increase the disk space used for the log. But the appliance shouldn't have users logging in over SSH very often. Here is an example message, The value of `verbose` is obvious:
    ```bash
    Accepted publickey for haas from 192.168.10.143 port 46604 ssh2: ED25519 SHA256:OzzMu5XQjcXeG5Rks2hV2tSZ/jFq8QoPeTJy/w9QkgI
    ```

These controls align with common MSP/MSSP baseline requirements and typical CIS Level 1 guidance.

----------------------------------------------------------------

### Implementation

If you decide to use only ssh keys, you can update the drop-in file using the following commands:

```bash hl_lines='1'
sudo nano /etc/ssh/sshd_config.d/99-haas-hardening.conf
```

Change `PasswordAuthentication` to no

Restart the ssh service

```bash
sudo systemctl restart ssh
```

!!! Warning
    Create the SSH keys on your laptop, copy the public key to the appliance, and verify the key works before running this code. Otherwise you will be locked out and have to use a monitor/keyboard or serial cable to recover. Run `t-ssh` and look for `Accepted publickey for haas from`.

I have detailed instructions on setting up SSH for network devices that covers creating ssh keys here: [Creating SSH Keys](https://rikosintie.github.io/Ubuntu4NetworkEngineers/SSH/#creating-ssh-keys).

----------------------------------------------------------------

### Verification

To confirm effective configuration, run:

```bash linenums='1' hl_lines='1'
sudo sshd -T | grep -E 'permitrootlogin|passwordauthentication|pubkeyauthentication|challengeresponseauthentication|permitemptypasswords|^banner|x11f|macs|^kexalgorithms|hostkey|pubbkeyauth|^port|^maxa|^maxse|grace|allowt|allowa|lastlog|strictm'
```

```bash title='Command Output'
port 22
logingracetime 30
maxauthtries 3
maxsessions 2
permitrootlogin no
pubkeyauthentication yes
passwordauthentication yes
printlastlog yes
x11forwarding no
strictmodes yes
permitemptypasswords no
allowtcpforwarding no
allowagentforwarding no
macs hmac-sha2-256-etm@openssh.com,hmac-sha2-512-etm@openssh.com,umac-128-etm@openssh.com
banner /etc/issue.net
hostkeyagent none
kexalgorithms curve25519-sha256,curve25519-sha256@libssh.org
hostkeyalgorithms ssh-ed25519,ssh-ed25519-cert-v01@openssh.com
hostkey /etc/ssh/ssh_host_rsa_key
hostkey /etc/ssh/ssh_host_ecdsa_key
hostkey /etc/ssh/ssh_host_ed25519_key
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

The script must be run with `sudo` since it modifies `/ect/haas-firewall.conf` and /etc/ssh/sshd_config.d/99-haas-hardening.conf`. Use the following to run the script and set ssh to use port 3333:

```bash linenums='1' hl_lines='1'
sudo ./ssh_port.sh
```

```bash title='Script Output'
#############################################
#                                           #
#      Configure a custom port for SSH      #
#  Use port 22 or a port between 1024-65535 #
#                                           #
#############################################


Enter the SSH port number (22, 1024-65535): 3333
```

```bash title='Script Output'
SSH_PORT set to 3333

Updating /etc/haas-firewall.conf...

Updating /etc/ssh/sshd_config.d/99-haas-hardening.conf

Restarting SSH Service...

Apr 22 16:40:06 haas sshd[250180]: Server listening on 0.0.0.0 port 3333.
Apr 22 16:40:06 haas sshd[250180]: Server listening on :: port 3333.


##########################################################

             Port Update is complete!
  The SSH service is configured for port 3333
  /etc/haas-firewall.conf is updated with SSH_PORT=3333
         Firewall will be updated next

##########################################################
```

----------------------------------------------------------------

#### Update Firewall rules

```bash title='Script Output'
#############################################################
#                                                           #
#     Preparing to run configure_ufw_from_csv.sh            #
#     Enter the users file to use (users.csv for ex.)       #
#                                                           #
#############################################################


Enter the CSV filename to use: users.csv
[*] Validating CSV: users.csv
[*] CSV validation PASSED successfully.

[INFO] Using CSV file: /home/haas/Haas_Data_collect/users.csv
[INFO] Using backup directory: /home/haas/Haas_Data_collect/backups
```

----------------------------------------------------------------

#### Updated Firewall rules

```bash title='Script Output'
#############################################################
#                                                           #
#                  Updated firewall rules                   #
#                                                           #
#############################################################

     --                         ------      ----
     To                         Action      From
Status: active
[13] 445                        ALLOW IN    192.168.10.141             # st40-user-smb
[12] 9090                       ALLOW IN    192.168.10.143             # haas-admin-cockpit
[11] 445                        ALLOW IN    192.168.10.143             # haas-admin-smb
[10] 3333                       ALLOW IN    192.168.10.143             # haas-admin-ssh
[15] 445                        ALLOW IN    192.168.10.145             # st30l-user-smb
[14] 445                        ALLOW IN    192.168.10.147             # st30-user-smb
[ 3] 9090                       ALLOW IN    192.168.1.100              # test-admin-cockpit
[ 2] 445                        ALLOW IN    192.168.1.100              # test-admin-smb
[ 1] 3333                       ALLOW IN    192.168.1.100              # test-admin-ssh
[ 6] 9090                       ALLOW IN    192.168.10.104             # vf2ss-admin-cockpit
[ 5] 445                        ALLOW IN    192.168.10.104             # vf2ss-admin-smb
[ 4] 3333                       ALLOW IN    192.168.10.104             # vf2ss-admin-ssh
[ 9] 9090                       ALLOW IN    192.168.10.113             # msp_admin-admin-cockpit
[ 8] 445                        ALLOW IN    192.168.10.113             # msp_admin-admin-smb
[ 7] 3333                       ALLOW IN    192.168.10.113             # msp_admin-admin-ssh
```

----------------------------------------------------------------

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

If password authentication was disabled, confirm SSH key access permissions on the appliance:

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

![screenshot](../appendices/img/tux-Samba.png)

----------------------------------------------------------------

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

## Securing the Custom Cockpit Extensions

The appliance ships three custom Cockpit extensions beyond the stock Cockpit modules: **Manage Samba**, **Updates - Logs**, and **Firewall Control**. Since these are authenticated web pages a logged-in user interacts with, they were reviewed for the same class of risk a web-application penetration test would target: can input reach a shell command unsafely, or read/write files outside the intended location?

### Why `cockpit.spawn()`'s array form matters

`cockpit.spawn()` accepts a command either as an argument array or as a shell string passed to `bash -c`. These behave very differently for untrusted input:

```js
// Safe: executes the binary directly, no shell involved.
// Even if userValue contains ; ` $() |, it's just literal
// argv content -- there's no shell to reinterpret it.
cockpit.spawn(["smbstatus", "--user=" + userValue]);

// Risky: bash -c parses the whole string as shell syntax.
// If userValue is concatenated directly into it, shell
// metacharacters in userValue become part of the command.
cockpit.spawn(["bash", "-c", "some command " + userValue]);
```

Every custom extension in this repo uses the array form for user-supplied values. The handful of places that do use `bash -c` with dynamic content pass that value as a separate script argument instead of concatenating it into the script text:

```js
cockpit.spawn(["bash", "-c", SCRIPT, "bash", tmpPath], ...);
// tmpPath arrives inside SCRIPT as $1 -- never string-concatenated
// into the script source, so it can't alter the script's syntax.
```

This means a field with no character restrictions still can't be used to run additional *shell commands* — but that's a narrow, specific claim about how the value reaches the OS, not a general "unrestricted fields are safe" statement. It says nothing about other risk categories, such as path traversal, which this pattern does nothing to prevent on its own — see the `rollback_csv.sh` case study below, found in a field with exactly this same "no restrictions, but injection-safe" starting point.

As of this review, four fields have no client-side restriction at all:

| Field | Extension | Why it's still injection-safe |
|---|---|---|
| Shares by User username | Manage Samba | `cockpit.spawn(["smbstatus", "--user=" + username])` — array form; the value has no path or file semantics, it's just a filter string `smbstatus` either accepts or rejects |
| Compare CSV path | Firewall Control | Array-form arg into `configure_ufw_from_csv.sh`, which quotes `"$1"` throughout with no second shell layer; accepting an arbitrary path is the intended feature (compare against any CSV), and doing so already requires the same root-level Cockpit session as the file being pointed at |
| Custom CSV path | Firewall Control | Same as above, for **Apply Firewall Changes** |
| Service Port | Updates - Logs | Not actually validation-free — Save requires `/^\d+$/.test(port)` plus a 5001-5099 range check before the value is used anywhere; it's gated at submit time rather than filtered as-you-type |

Every other text input either restricts its character set as the user types (IP addresses, ports, machine/share names, backup filenames) or is bounded by `maxlength`, or both — reviewed individually, not assumed safe as a category.

### Case study: path traversal in `rollback_csv.sh`

Review found one real issue: the Firewall Control page's **Rollback CSV** feature takes a backup filename from a plain, unrestricted text box and passes it straight to `rollback_csv.sh`:

```bash
BACKUP_FILENAME="$1"
BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILENAME"

if [[ ! -f "$BACKUP_FILE" ]]; then exit 1; fi
cp "$BACKUP_FILE" "$TARGET_CSV"
```

No shell-metacharacter injection was possible here (the variables are properly quoted throughout) — but nothing stopped `$BACKUP_FILENAME` from containing `../` sequences. Typing a traversal payload into that box and clicking Rollback — no special tooling required — would pass the `-f` check and `cp` an arbitrary root-readable file over the **live firewall CSV**:

```bash title='Reproduced against the exact script logic, sandboxed'
BACKUP_FILENAME="../../../../../../etc/hostname"
BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILENAME"
# BACKUP_FILE resolves to /etc/hostname
```

```bash title='Result before the fix'
[validation PASSES]
--- CSV_PATH content after 'rollback': ---
1S1K-G5          # <- contents of /etc/hostname, not a backup CSV
```

Since **Edit users.csv** then displays `$CSV_PATH`'s content in a textarea, this chained into arbitrary-file-read-as-root through the UI (e.g. `/etc/shadow`, SSH host keys), on top of corrupting the live firewall configuration.

**Fix:** reject any filename containing a path separator or a leading dot outright, then independently confirm with `realpath` that the resolved file is still inside `BACKUP_DIR` — the second check also catches a symlink planted inside `BACKUP_DIR` pointing outside it, which the filename-shape check alone would miss:

```bash
if [[ "$BACKUP_FILENAME" == */* || "$BACKUP_FILENAME" == .* ]]; then
    echo "[ERROR] Invalid backup filename: $BACKUP_FILENAME"
    exit 1
fi

BACKUP_FILE="$BACKUP_DIR/$BACKUP_FILENAME"
...
RESOLVED_BACKUP_DIR="$(realpath -e "$BACKUP_DIR")"
RESOLVED_BACKUP_FILE="$(realpath -e "$BACKUP_FILE")"

if [[ "$RESOLVED_BACKUP_FILE" != "$RESOLVED_BACKUP_DIR"/* ]]; then
    echo "[ERROR] Backup file resolves outside BACKUP_DIR -- refusing to proceed."
    exit 1
fi
```

```bash title='Result after the fix -- same payload'
[ERROR] Invalid backup filename: ../../../../../../etc/hostname
        Must be a plain filename with no path components.
```

A legitimate backup filename (`users_2026-01-01_00-00-00.csv`) still restores correctly — the fix only rejects filenames that were never valid in the first place.

### Client-side input filtering

Fields whose values represent a known format (IP addresses, ports, machine/share names) are also restricted client-side to their expected character set as the user types or pastes. This is a usability nicety and a defense-in-depth layer, **not** the actual security boundary — client-side JavaScript filtering has no effect on a tool that talks to `cockpit-bridge` directly (e.g. by replaying the page's WebSocket traffic in Burp Suite), which is exactly why the array-form `cockpit.spawn()` pattern above is what actually matters.

----------------------------------------------------------------
