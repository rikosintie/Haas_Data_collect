# How is the appliance hardened?

The appliance is built on Ubuntu 24.04 which is a Long Term Support (LTS) version of Ubuntu. Ubuntu 24.04 is well tested in enterprises the Ubuntu team releases security patches on a regular schedule.

Since the appliance has a very limited role it can be hardened against typical attacks. The follow steps are completed with the installation script:

- The Linux UFW firewall is automatically configured and enabled based on the users and roles in the `users.csv` file. It can be updated at any time to add/remove users.
- If the Haas machines are on a dedicated LAN segment, the firewall can be configured with one change to the configuration file reducing the chance of an error being made.
- Samba Version 4.19.5-Ubuntu is installed.
- Samba removed SMBv1 in version 4.1+.
- NetBIOS is disabled by the installation script.
- The [RedHat Cockpit management suite](https://www.redhat.com/en/blog/intro-cockpit) is installed by the installation script to provide a modern-looking and user-friendly interface to manage and administer the appliance.
- An [Ubuntu Pro subscription](https://ubuntu.com/pricing/pro) can be purchased to provide automatic updates and enterprise level support.

----------------------------------------------------------------

## Securing Samba

The appliance has Microsoft `SMBv1` disabled because the Haas CNC controls support `SMBv2` and the Windows desktops that will access the shares should support `SMBv2` since it has been built into Windows since Vista in 2006!

If you build the appliance with the `haas_firewall_install.sh` script then these steps are already taken care of.

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

## Update the smb.conf file

Run the following command to open the Samba Server configuration file:

```bash hl_lines='1'
sudo nano /etc/samba/smb.conf
```

Find the [global] section and append the following:

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

Find the `[print$]` section and change available to `no`.

```bash
[print$]
    available = No
```

Save and close the file using `ctrl+s`, `ctrl+x` if you were using nano.

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
        `SMBv1` was permanently removed from Samba Server version 4.1 and above. Disabling `NetBios`, the `spoolss` service and the `printer$` share  harden the appliance beyond just disabling `SMBv1`

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
toolroom,192.168.10.104,user
mchavez,192.168.10.113,Administrator
thubbard,192.168.10.100,user
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
