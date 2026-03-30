# Quick Reference

## SMB Verification Quick‑Reference

=== "Linux"

    **List Shares**
    ```
    smbclient -L //<appliance_ip> -U <user>
    ```

    **Test Anonymous Access (should fail)**
    ```
    smbclient -L //<appliance_ip> -N
    ```

    This will return a confusing message:

    ```
    Anonymous login successful
    tree connect failed: NT_STATUS_ACCESS_DENIED
    ```

    It appears that the login was successful, but the `tree connect failed: NT_STATUS_ACCESS_DENIED` means the connection was denied.

    **Check SMB Dialects**
    ```
    nmap -Pn -p 445 --script smb-protocols <appliance_ip>
    ```

    **Firewall Check Ports SSH (22), SMB (445), Cockpit (9090)**
    ```
    nmap -p 22,445,9090 <appliance_ip>
    ```

    **Check Permissions / Active Sessions**

    Run on the appliance, not the laptop!

    ```
    sudo smbstatus    # Report on current Samba connections
    Samba version 4.19.5-Ubuntu
    PID     Username     Group        Machine                                   Protocol Version  Encryption           Signing

    777360  haas         haas         192.168.10.104 (ipv4:192.168.10.104:18204) SMB3_11           -                    partial(AES-128-GMAC)
    777309  haas         haas         192.168.10.104 (ipv4:192.168.10.104:19467) SMB3_11           -                    partial(AES-128-GMAC)
    719778  mspadmin     mspadmin     192.168.10.113 (ipv4:192.168.10.113:57438) SMB3_11           -                    partial(AES-128-GMAC)
    776283  haas         haas         192.168.10.143 (ipv4:192.168.10.143:50632) SMB3_11           -                    partial(AES-128-GMAC)

    Service      pid     Machine       Connected at                     Encryption   Signing

    Haas         776283  192.168.10.143 Sun Mar 29 22:23:48 2026 PDT     -            -
    st40         719778  192.168.10.113 Sat Mar 28 17:21:15 2026 PDT     -            -
    Haas         777360  192.168.10.104 Sun Mar 29 22:53:44 2026 PDT     -            -
    Haas         777309  192.168.10.104 Sun Mar 29 22:47:32 2026 PDT     -            -

    Locked files:
    Pid          User(ID)   DenyMode   Access      R/W        Oplock           SharePath   Name   Time

    777360       1000       DENY_NONE  0x100081    RDONLY     NONE             /home/haas/Haas_Data_collect   .   Sun Mar 29 22:59:34 2026
    777360       1000       DENY_NONE  0x100081    RDONLY     NONE             /home/haas/Haas_Data_collect   .   Sun Mar 29 22:53:44 2026
    777360       1000       DENY_NONE  0x100081    RDONLY     NONE             /home/haas/Haas_Data_collect   .   Sun Mar 29 22:53:44 2026
    719778       1000       DENY_NONE  0x100081    RDONLY     NONE             /home/haas/Haas_Data_collect/machines/st40   .   Sat Mar 28 22:26:09 2026
    777360       1000       DENY_NONE  0x100081    RDONLY     NONE             /home/haas/Haas_Data_collect   cockpit   Sun Mar 29 22:59:40 2026
    777360       1000       DENY_NONE  0x100081    RDONLY     NONE             /home/haas/Haas_Data_collect   cockpit   Sun Mar 29 22:59:40 2026
    ```


    ```
    sudo smbstatus -L # List Locked files
    Locked files:
    Pid          User(ID)   DenyMode   Access      R/W        Oplock           SharePath   Name   Time

    777360       1000       DENY_NONE  0x100081    RDONLY     NONE             /home/haas/Haas_Data_collect   .   Sun Mar 29 22:59:34 2026
    777360       1000       DENY_NONE  0x100081    RDONLY     NONE             /home/haas/Haas_Data_collect   .   Sun Mar 29 22:53:44 2026
    777360       1000       DENY_NONE  0x100081    RDONLY     NONE             /home/haas/Haas_Data_collect   .   Sun Mar 29 22:53:44 2026
    719778       1000       DENY_NONE  0x100081    RDONLY     NONE             /home/haas/Haas_Data_collect/machines/st40   .   Sat Mar 28 22:26:09 2026
    777360       1000       DENY_NONE  0x100081    RDONLY     NONE             /home/haas/Haas_Data_collect   cockpit   Sun Mar 29 22:59:40 2026
    777360       1000       DENY_NONE  0x100081    RDONLY     NONE             /home/haas/Haas_Data_collect   cockpit   Sun Mar 29 22:59:40 2026
    ```


    ```
    sudo smbstatus -S # List shares with active connections
    Service      pid     Machine       Connected at                     Encryption   Signing

    Haas         776283  192.168.10.143 Sun Mar 29 22:23:48 2026 PDT     -            -
    st40         719778  192.168.10.113 Sat Mar 28 17:21:15 2026 PDT     -            -
    Haas         777360  192.168.10.104 Sun Mar 29 22:53:44 2026 PDT     -            -
    Haas         777309  192.168.10.104 Sun Mar 29 22:47:32 2026 PDT     -            -
    ```

=== "macOS"

    **List Shares**
    ```
    smbutil view //<user>@<appliance_ip>
    ```

    **Test Anonymous Access (should fail)**

    Macos may keep the password cached if you have mapped a drive before and return the shares even without the user in the command.

    ```
    smbutil view //<appliance_ip>
    ```

    **Check SMB Dialects**
    ```
    nmap -Pn -p 445 --script smb-protocols <appliance_ip>
    ```

    **Active Directory Verification**

    Only if appliance is Active Directory integrated

    **Kerberos Ticket Status**


    ```
    klist
    ```

    **Check Active Directory Binding**
    ```
    dsconfigad -show
    ```

    **Firewall Check Ports SSH (22), SMB (445), Cockpit (9090)**
    ```
    nmap -p 22,445,9090 <appliance_ip>
    ```

=== "Windows"

    **Test Authenticated Access**
    ```
    net use \\<appliance_ip> \<share> <password> /user:<DOMAIN>\<user>
    The default DOMAIN is WORKGROUP
    ```

    **Test Anonymous Access (should fail)**
    ```
    net use \\<appliance_ip> \<share> "" /user:""
    ```

    **Test Network Path**
    ```
    Test-Path \\<appliance_ip>\Haas
    should return `true`
    ```

    **Firewall Check Ports SSH (22), SMB (445), Cockpit (9090)**
    ```
    Test-NetConnection -ComputerName <appliance_ip> -Port 22
    Test-NetConnection -ComputerName <appliance_ip> -Port 445
    Test-NetConnection -ComputerName <appliance_ip> -Port 9090
    ```

    This is a nice command because it returns the Interface and IP of the testing machine. Here is an example:

    ```
    Test-netConnection -ComputerName 192.168.10.127 -Port 445
    ComputerName     : 192.168.10.127
    RemoteAddress    : 192.168.10.127
    RemotePort       : 445
    InterfaceAlias   : Wi-Fi
    SourceAddress    : 192.168.10.104
    TcpTestSucceeded : True
    ```


    **Active Directory Verification**

    Only if appliance is Active Directory integrated

    **Kerberos Ticket Status**
    ```
    klist
    ```

---

## Common Failure Causes

??? info "Common Issues and Fixes"

    - Incorrect credentials or domain  ( The domain is WORKGROUP)
    - Port 445 blocked by firewall
    - DNS misconfiguration
    - Time skew between the appliance and Active Directory  (if Active Directory integrated)
    - Incorrect share‑level permissions

---

## When to Use Linux

??? tip "Linux Recommended for Protocol‑Level Testing"

    Linux provides the most complete SMB diagnostic tooling.
    Use Linux when you need:

    - SMB dialect enumeration
    - Detailed protocol verification
    - Full Samba diagnostics

    Windows and macOS cannot enumerate SMB dialects reliably.

---

## Expected Behavior for Authorized IP addresses

??? success "Healthy SMB Environment Should Show"

    - Anonymous access fails
    - Authenticated access succeeds
    - SMB2/SMB3 dialects detected
    - Port 445 SMB open for users
    - Ports 22 SSH, 445 SMB, 9090 Cockpit for Admins
    - Kerberos works when Active Directory is configured

---

## Expected Behavior for Unauthorized IP addresses

??? success "Unauthorized IP addresses should see no open ports or SMB messages"

    - Anonymous access fails
    - Authenticated access fails
    - No SMB Dialects detected
    - Ports 22, 445, 9090 closed
