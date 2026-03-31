# Troubleshooting flowchart

## Stage 1 - Port Reachability & Firewall Checks

```mermaid
flowchart TD

A([Start: SMB Issue Reported]) --> B{Port 445 Reachable?}

B -->|No| B1[Firewall or Network Path Issue]
B1 --> B1a[Confirm correct IP]
B1 --> B1b[Verify VLANs / Switches]
B1 --> B1c[Check appliance firewall]
B1 --> B1d[Check W/S firewall]
B1 --> Z([End])

B -->|Yes| C([Proceed to SMB Listing Checks])
```

----------------------------------------------------------------

- Port 445 reachable - use `nmap -p 22,445,9090 <appliance_ip>` to verify
- Confirm correct IP - Make sure you are using the correct IP address for the appliance.
- Verify VLANS/Switches - Use `ping <appliance_ip> to verify network connectivity to the appliance
- Check Appliance firewall - Use `sudo ufw status numbered | sort -k5` to list the appliance firewall rules
- Check W/S Firewall - This is a low probability. By default Windows, Mac, Linux allow outbound traffic

----------------------------------------------------------------

## Stage 2 — SMB Share Listing & Authentication

```mermaid
flowchart TD

A([Start: List SMB Shares]) --> B{List SMB shares}

B -->|No| C[Auth or DNS issue]
C --> D[Check credentials]
C --> E[Is domain WORKGROUP]
C --> F[Check DNS]
C --> G[Check time sync]
C --> H[Check Samba logs]
C --> Z([End])

B -->|Yes| I([Proceed])
```

----------------------------------------------------------------

- List SMB Shares - On the appliance, cd to `Haas_Data_collect` and run `./lshares.sh`
- Check Credentials - Run `manager_users.sh <username> --set-password` to reset the password
- Domain name - The domain name is `WORKGROUP` by default
- Check DNS - I you are using a FQDN instead of an ip use `dig` or `nslookup` to verify the appliance is registered in DNS
- Check Time Sync - On the appliance run `date` to see the current date/time on the appliance
- Check Samba logs on the appliance - Use `sudo tail -f /var/log/samba/log.smbd`. This keeps the logger running. Use `ctrl+c` to cancel it.

----------------------------------------------------------------

## Stage 3 — Anonymous Access & SMB Dialects

```mermaid
flowchart TD

D([Does anonymous access fail?]) -->|No| D1[Guest Access Enabled]

D1 --> D1a[Disable guest access]
D1 --> D1b[Set 'map to guest = never']
D1 --> D1c[Restart Samba]
D1 --> Z([End])

D -->|Yes| E([Modern SMB Dialects Detected?])

E -->|No| E1[Legacy SMB1 Detected]
E1 --> E1a[Disable SMB1]
E1 --> E1b[Set 'server min protocol = SMB2']
E1 --> E1c[Restart Samba]
E1 --> Z([End])

E -->|Yes| F([Proceed to Domain Authentication Checks])
```

----------------------------------------------------------------

## Stage 4 — Domain Authentication & Permissions

```mermaid
flowchart TD

F([Domain Authentication Working?]) -->|No| F1[Active Directory or Time Sync Issue]

F1 --> F1a[Verify AD join]
F1 --> F1b[Check DNS SRV records]
F1 --> F1c[Ensure time sync with DCs]
F1 --> F1d[Validate SPNs if needed]
F1 --> Z([End])

F -->|Yes| G([Can user access files?])

G -->|No| G1[Permissions or ACL Mismatch]
G1 --> G1a[Check filesystem permissions]
G1 --> G1b[Check Samba share ACLs]
G1 --> G1c[Validate group membership]
G1 --> G1d[Use smbstatus to inspect sessions]
G1 --> Z([End])

G -->|Yes| H([SMB Functioning Correctly])
H --> Z([End])
```

----------------------------------------------------------------

## End of the troubleshooting guide
