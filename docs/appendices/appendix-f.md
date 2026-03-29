# Quick Reference

## SMB Verification Quick‑Reference

=== "Linux"

    **List Shares**
    ```
    smbclient -L //<appliance> -U <user>
    ```

    **Test Anonymous Access (should fail)**
    ```
    smbclient -L //<appliance> -N
    ```

    **Check SMB Dialects**
    ```
    nmap -Pn -p 445 --script smb-protocols <appliance>
    ```

    **Firewall Check**
    ```
    nmap -p 445 <appliance>
    ```

    **Check Permissions / Active Sessions**
    ```
    smbstatus
    ```

=== "macOS"

    **List Shares**
    ```
    smbutil view //<user>@<appliance>
    ```

    **Test Anonymous Access (should fail)**
    ```
    smbutil view //<appliance>
    ```

    **Check SMB Dialects**
    ```
    nmap -Pn -p 445 --script smb-protocols <appliance>
    ```

    **Firewall Check**
    ```
    nmap -p 445 <appliance>
    ```

=== "Windows"

    **Test Authenticated Access**
    ```
    net use \\<appliance>\<share> <password> /user:<DOMAIN>\<user>
    ```

    **Test Anonymous Access (should fail)**
    ```
    net use \\<appliance>\<share> "" /user:""
    ```

    **List Active SMB Connections**
    ```
    Get-SmbConnection
    ```

    **Firewall Check**
    ```
    Test-NetConnection -ComputerName <appliance> -Port 445
    ```

    **Kerberos Status**
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
