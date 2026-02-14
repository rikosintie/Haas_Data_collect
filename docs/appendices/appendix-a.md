# Secure Samba

The appliance can have Microsoft SMBv1 disabled because the Haas CNC controls support `SMBv2` and the Windows desktops that will access the shares should support `SMBv2` since it has been built into Windows since Vista in 2006!

If you build the appliance with the `haas_firewall_install.sh` script then these step are already taken care of.

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
        Since `SMBv1` was permanently removed for Samba Server version 4.16, this step is not strictly needed, but disabling `NetBios`, the `spoolss` and the `pinter$` harden the appliance beyond just disabling `SMBv1`

sudo sh -c 'cd /var/lib/samba/usershares && ls -l'
