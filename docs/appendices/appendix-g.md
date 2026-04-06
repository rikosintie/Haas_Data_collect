# Appliance Troubleshooting flowchart

The following flowchart will assist you in troubleshooting:

- You can't ping the device
- You can't map a drive to the appliance
- You can't save a CNC program to the appliance

The flowchart has the following three stages:

----------------------------------------------------------------

![screenshot](../appendices/img/minimap1.png)

----------------------------------------------------------------

## ⭐ Stage 1 — Port Reachability & Firewall Checks

![screenshot](../appendices/img/stage1.png)

----------------------------------------------------------------

- Confirm correct IP - Make sure you are using the correct IP address for the appliance
- Verify VLANS/Switches - Use `ping <appliance_ip>` to verify network connectivity to the appliance
- Port 445 reachable
  - use `nmap -Pn -p 22,445,9090 <appliance_ip>` to verify
  - use `Test-NetConnection <appliance_ip> -Port 445` on Windows
  - use `telnet 192.168.10.133 445`. Use `ctrl+]` to close the connection and `quit` to exit.
- Check Appliance firewall - Use `sudo ufw status numbered | sort -k5` on the appliance to list the appliance firewall rules
  - Use `Cockpit` to manage the firewall from a browser `https://<appliance_ip>:9090`
  - Or the `configure_ufw_from_csv.sh` script from the terminal - `sudo /usr/local/sbin/configure_ufw_from_csv.sh --show-rules`
  - See [The script options](../build_pi_5_appliance/firewall_configuration.md/#the-script-options){target="_blank"} for more information
- Check W/S Firewall - This is a low probability. By default Windows, Mac, Linux allow outbound traffic

----------------------------------------------------------------

### Reachability Commands

??? info "Common Issues and Fixes"

    ```bash hl_lines='1 6'
    ping 192.168.10.127
    PING 192.168.10.127 (192.168.10.127) from 192.168.10.143 wlp61s0: 56(84) bytes of data.
    64 bytes from 192.168.10.127: icmp_seq=1 ttl=64 time=86.9 ms
    64 bytes from 192.168.10.127: icmp_seq=2 ttl=64 time=7.80 ms
    64 bytes from 192.168.10.127: icmp_seq=3 ttl=64 time=6.28 ms
    nmap -Pn -p 22,445,9090 192.168.10.127
    Starting Nmap 7.95 ( https://nmap.org ) at 2026-04-02 12:27 PDT
    Nmap scan report for haas.pu.pri (192.168.10.127)
    Host is up (0.0061s latency).

    PORT     STATE SERVICE
    22/tcp   open  ssh
    445/tcp  open  microsoft-ds
    9090/tcp open  zeus-admin
    ```

----------------------------------------------------------------

## ⭐ Stage 2 — SMB Share Listing & Authentication

![screenshot](../appendices/img/stage2.png)

----------------------------------------------------------------

- List SMB Shares - On the appliance, cd to `Haas_Data_collect` and run `./lshares.sh`
- Check Credentials - Run `manager_users.sh <username> --set-password` to reset the password
- Domain name - The domain name is `WORKGROUP` by default
- Check DNS - I you are using a FQDN instead of an ip use `dig` or `nslookup` to verify the appliance is registered in DNS
- Check Time Sync - On the appliance run `date` to see the current date/time on the appliance
- Check Samba logs on the appliance - Use `sudo tail -f /var/log/samba/log.smbd`. This keeps the logger running. Use `ctrl+c` to cancel it.

----------------------------------------------------------------

### SMB Commands

??? info "Common Issues and Fixes"

    ```bash linenums='1' hl_lines='1 3 10-11 14-17 21-24 33 35 38 40'
    cd Haas_Data_collect
    ┌─[haas@haas] - [~/Haas_Data_collect] - [2358]
    └─[$] ./lshares.sh
    Haas         /home/haas/Haas_Data_collect
    minimill     /home/haas/Haas_Data_collect/machines/minimill
    st40         /home/haas/Haas_Data_collect/machines/st40
    st30         /home/haas/Haas_Data_collect/machines/st30
    st30l        /home/haas/Haas_Data_collect/machines/st30l

    sudo ./manage_users.sh mspadmin
    [sudo] password for haas:
    ==== Thu Apr  2 12:44:43 PDT 2026 ====
    Log file: /var/log/user_mgmt_20260402_124443.log
    Processing user: mspadmin
    User exists
    Update passwords? (y/N): y
    Updating system password
    New password:
    Retype new password:
    passwd: password updated successfully
    Samba user exists
    Updating Samba password
    New SMB password:
    Retype new SMB password:Forcing Primary Group to 'Domain Users' for mspadmin

    Forcing Primary Group to 'Domain Users' for mspadmin
    Forcing Primary Group to 'Domain Users' for mspadmin
    Enabled user mspadmin.
    Final user info:
    uid=1007(mspadmin) gid=1011(mspadmin) groups=1011(mspadmin),27(sudo),1004(HaasGroup)
    Done.

    Appliance
    ┌─[haas@haas] - [~/Haas_Data_collect] - [2361]
    └─[$] date
    Thu Apr  2 12:47:58 PDT 2026

    Laptop
    ┌─[mhubbard@1S1K-G5] - [~/Insync/GD/04_Tools/Haas/Haas_Data_collect] - [9005]
    └─[$] date
    Thu Apr  2 12:48:43 PM PDT 2026
    ```

----------------------------------------------------------------

## ⭐ Stage 3 — User Authentication & Permissions

----------------------------------------------------------------

![screenshot](../appendices/img/stage3.png)

----------------------------------------------------------------

🖥️ Common Workstation Issues

!!! info "Common Workstation Issues"
    SMB failures often originate on the workstation rather than the appliance.
    The following issues are frequently encountered during testing and real-world deployments:

    **1. Cached Credentials**
    - Workstations (Ubuntu, macOS, Windows) may silently reuse old credentials.
    - Symptoms: drive mapping fails, NTLM handshake errors, wrong user shown in `smbstatus`.
    - Fix: clear credential cache or reboot the workstation.

    **2. GVFS / Nautilus SMB Caching (Ubuntu)**
    - GNOME’s GVFS layer caches SMB sessions aggressively.
    - Symptoms: incorrect permissions, stale directory listings, “permission denied” after config changes.
    - Fix: kill GVFS processes or reboot; avoid mixing Nautilus and `mount.cifs`.

    **3. Multiple SMB Clients on the Same System**
    - Linux systems may mix:
        - `gio mount`
        - `nautilus`
        - `mount.cifs`
        - `smbclient`
    - Each uses different credential paths and caching behavior.
    - Fix: use one method consistently during troubleshooting.

    **4. Time Skew**
    - Even small time differences break NTLMv2 authentication.
    - Symptoms: authentication failures despite correct credentials.
    - Fix: ensure workstation and appliance sync to the same NTP source.

    **5. DNS Resolution Issues**
    - Workstations may resolve the appliance hostname incorrectly.
    - Symptoms: intermittent failures, wrong IP in logs, slow connections.
    - Fix: verify `/etc/resolv.conf`, DNS search domains, and `dig` results.

    **6. SMB Client Minimum Protocol Settings**
    - The appliance only supports SMB2/3.
    - Symptoms: connection refused if the workstation doesn't support SMB2/3.
    - Fix: ensure the workstation supports SMB2/3 (default on modern systems).

    **7. Firewall or Local Security Policies**
    - Local workstation firewalls may block outbound SMB.
    - Symptoms: cannot reach port 445 despite correct server configuration.
    - Fix: check UFW, firewalld, Windows Defender Firewall, or corporate policies. This is low probability unless on a highly locked down network. In such an environment, AD policies will block port 445 to unauthorized ip addresses.

    **8. Credential Manager / Keychain Conflicts**
    - Windows Credential Manager, macOS/Linux Keychain may store stale SMB passwords.
    - Symptoms: repeated authentication failures with correct credentials.
    - Fix: remove stored SMB entries and reconnect.

----------------------------------------------------------------

🧩 Troubleshooting Quick‑Reference Table

| Symptom / Observation | Likely Cause | Quick Checks / Next Steps |
|----------------------|--------------|----------------------------|
| <span style="color:#1e88e5;">🛜 Cannot reach server on port 445</span> | <span style="color:#1e88e5;">Stage 1 — Firewall or network path issue</span> | [1.1.1 Confirm correct IP](#-stage-1--port-reachability--firewall-checks) • [1.1.2 Verify VLANs/switches](#stage-1-port-reachability--firewall) • [1.1.3 Appliance firewall](#stage-1-port-reachability--firewall) |
| <span style="color:#43a047;">📁 Shares not listed</span> | <span style="color:#43a047;">Stage 2 — Authentication or DNS issue</span> | [2.1.1 Check credentials](#stage-2-smb-listing--authentication) • [2.1.3 DNS resolution](#stage-2-smb-listing--authentication) • [2.1.4 Time sync](#stage-2-smb-listing--authentication) |
| <span style="color:#43a047;">👤 Wrong username appears in logs</span> | <span style="color:#43a047;">Stage 2 — Cached credentials</span> | [2.1.1 Verify credentials](#stage-2-smb-listing--authentication) • Clear credential cache • Reboot workstation |
| <span style="color:#d81b60;">🔐 Drive mapping fails</span> | <span style="color:#d81b60;">Stage 3 — Authentication failure</span> | [3.1.1 Verify username/password](#stage-3-user-authentication--permissions) • [3.1.2 Clear cached credentials](#stage-3-user-authentication--permissions) • [3.1.3 Check NTLMv2 handshake](#stage-3-user-authentication--permissions) |
| <span style="color:#d81b60;">🚫 Access denied after mapping</span> | <span style="color:#d81b60;">Stage 3 — Permissions issue</span> | [3.2.1 Filesystem permissions](#stage-3-user-authentication--permissions) • [3.2.2 Samba share ACLs](#stage-3-user-authentication--permissions) • [3.2.3 Group membership](#stage-3-user-authentication--permissions) |
| <span style="color:#43a047;">⏱️ Intermittent failures</span> | <span style="color:#43a047;">Stage 2 — DNS or time skew</span> | [2.1.3 DNS resolution](#stage-2-smb-listing--authentication) • [2.1.4 Time sync](#stage-2-smb-listing--authentication) |
| <span style="color:#d81b60;">🔄 Behavior inconsistent across attempts</span> | <span style="color:#d81b60;">Stage 3 — Stale Samba session</span> | [3.2.4 Use smbstatus](#stage-3-user-authentication--permissions) • Kill stale session • Reconnect |
| <span style="color:#43a047;">🧩 Works on one device but not another</span> | <span style="color:#43a047;">Stage 2 — Local firewall or endpoint policy</span> | Check UFW/Windows Firewall • Corporate endpoint policies |
| <span style="color:#43a047;">🐌 Slow browsing or delayed auth</span> | <span style="color:#43a047;">Stage 2 — DNS search domain issues</span> | Verify `/etc/resolv.conf` • Ensure correct search domain |
| <span style="color:#d81b60;">📂 User appears logged in but cannot access files</span> | <span style="color:#d81b60;">Stage 3 — Stale or conflicting session</span> | [3.2.4 smbstatus](#stage-3-user-authentication--permissions) • Kill session • Reconnect |

----------------------------------------------------------------

## End of the troubleshooting guide

[test](../appendices/appendix-g.md/#-stage-1--port-reachability--firewall-checks)

[test](../appendices/appendix-g.md/#-stage-1--port-reachability--firewall-checks)
