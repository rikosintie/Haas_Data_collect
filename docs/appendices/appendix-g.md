# Troubleshooting flowchart

## Stage 1 - Port Reachability & Firewall Checks

```mermaid
flowchart TD

A([Start: SMB Issue Reported]) --> B{Port 445 Reachable?}

B -->|No| B1[Firewall or Network Path Issue]
B1 --> B1a[Check workstation firewall]
B1 --> B1b[Check appliance firewall]
B1 --> B1c[Verify VLANs / switches]
B1 --> B1d[Confirm correct IP]
B1 --> Z([End])

B -->|Yes| C([Proceed to SMB Listing Checks])
```

----------------------------------------------------------------

## Stage 2 — SMB Share Listing & Authentication

```mermaid
flowchart TD

START([SMB Listing Checks]) --> C([Can workstation list SMB shares?])

C -->|Yes| D([Proceed to Anonymous Access Checks])

C -->|No| C1[Authentication or DNS Issue]

C1 --> C1a[Verify username/password]
C1a --> C1b[Verify domain]
C1b --> C1c[Check DNS resolution]
C1c --> C1d[Check time sync (AD)]
C1d --> C1e[Review Samba logs]
C1e --> Z([End])
```

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
