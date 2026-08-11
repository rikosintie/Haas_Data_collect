# Create Directories and Samba Shares

To share files between the CNC programmer and the machine control we have to create directories and shares for each machine control. The Python data collection scripts will place the `csv` files in a directory named `cnc_logs` under the machine tool directory

----------------------------------------------------------------

## The directory structure

We will need the [table](../build_the_appliance/directories_shares.md/#table-of-machines) we created earlier for reference. It's listed below for reference. The concept is a `[machines]` share on the `Haas_Data_collect/machines` directory, created automatically by `haas-install.sh`. This top level share will be able to see every machine's subdirectory when it's mapped to a Windows network drive. Operations personnel will map to this share so that they can pull spreadsheets from every machine.

You can also create a directory/share for each Haas machine tool individually, instead of (or alongside) the shared `[machines]` drive, if you want tighter segmentation — for example, tracking which users touched which machine, or limiting a given Samba account to only its own machine. Each per-machine share is used:

- By the CNC programmer to drop programs into
- By the machine operator to load programs from
- A subdirectory, `cnc_logs`, holds the data collected from DPRNT

This share is used when setting up the Ethernet on the CNC control. The format will be `\\<appliance_ip>\st30` for a share named st30.

The Haas data collection script creates the spreadsheets in the `cnc_logs` directory under the machine directory.

The final structure will look like this:

```bash
├── haas
     └── Haas_Data_collect
         ├── machines
             ├── st30
             │   └── cnc_logs
             ├── st30l
             │   └── cnc_logs
             └── st40
                 └── cnc_logs
```

!!! note "The repo root is not shared over Samba"
    Only `/home/haas/Haas_Data_collect/machines` (and any per-machine
    subdirectory under it) is exposed over Samba — the repo root itself
    (scripts, config, backups) is reachable only over SSH. Every Samba
    account, including one created for a single machine tool, is a member
    of `HaasGroup`, so sharing the repo root would expose it to every
    account, not just admins.

----------------------------------------------------------------

### Table of machines

We can refer to our table for the names:

----------------------------------------------------------------

| Machine  | Port# |   IP Address   |
|----------|-------|:--------------:|
| ST40     | 5052  | 192.168.10.141 |
| VF2SS    | 5052  | 192.168.10.142 |
| VF5SS    | 5052  | 192.168.10.143 |
| MINIMILL | 5052  | 192.168.10.143 |
| ST30     | 5052  | 192.168.10.144 |
| ST30L    | 5052  | 192.168.10.145 |

----------------------------------------------------------------

### The tree command

The installation script installs the Linux `tree` command. It's very useful to verify files and directories on linux system.

#### View directories and files

```bash linenums='1' hl_lines='1'
cd /home/haas/Haas_Data_collect/machines
tree
```

```bash title='Command Output'
.
├── minimill
├── st30
│   └── cnc_logs
│       └── st30_265-4183.csv
├── st30l
│   └── cnc_logs
│       └── st30l_265-4183.csv
└── st40
    └── cnc_logs
        └── st40_265-4183.csv
```

----------------------------------------------------------------

#### View directories and files with file size

```bash linenums='1' hl_lines='1'
cd /home/haas/Haas_Data_collect/machines
tree -h
```

```bash title='Command Output'
[4.0K]  .
├── [4.0K]  minimill
├── [4.0K]  st30
│   └── [4.0K]  cnc_logs
│       └── [ 232]  st30_265-4183.csv
├── [4.0K]  st30l
│   └── [4.0K]  cnc_logs
│       └── [ 233]  st30l_265-4183.csv
└── [4.0K]  st40
    └── [4.0K]  cnc_logs
        └── [ 232]  st40_265-4183.csv

```

----------------------------------------------------------------

#### View just directories

```bash linenums='1' hl_lines='1'
cd /home/haas/Haas_Data_collect/machines
tree -d
```

```bash title='Command Output'
.
├── minimill
├── st30
│   └── cnc_logs
├── st30l
│   └── cnc_logs
└── st40
    └── cnc_logs
```

----------------------------------------------------------------

## Create the shares

!!! tip "Use the Manage Samba extension instead of editing smb.conf by hand"
    Everything below this point used to be a manual `sudo nano
    /etc/samba/smb.conf` walkthrough. That's no longer the recommended
    path — the Cockpit **Manage Samba** extension's **Create Share**
    button does the same work (creates the machine directory if it
    doesn't exist, appends the share stanza, validates with `testparm`,
    and restarts `smbd`) in one confirmed click, with no risk of a typo
    breaking the rest of `smb.conf`. See
    [Create Share](../manage_the_appliance/samba.md#create-share) for the
    full walkthrough. `Machine Name` and `Comment` are the only two fields
    you fill in — the path (`/home/haas/Haas_Data_collect/machines/<name>`)
    and every permission/mask setting shown below are filled in
    automatically from a fixed template, matching what's described here.

For reference, here's what a per-machine share stanza looks like once created (this is what Create Share writes for you):

```bash linenums='1' hl_lines='1'
[st40]
    comment = st40
    path = /home/haas/Haas_Data_collect/machines/st40
    browseable = Yes
    writable = Yes
    public = No
    valid users = @HaasGroup, haas
    force user = haas
    force group = HaasGroup
    create mask = 0664
    force create mode = 0664
    directory mask = 0775
    force directory mode = 0775
```

----------------------------------------------------------------

If you have double or triple digits of machines to set up, doing them one at a time through Create Share gets tedious — see [Scaling up](configuring_appliance.md/#scaling-up) for the `conf-gen_xlsx_v1.py` script, which bulk-generates both the systemd service files and the matching `smb.conf` share stanzas from a spreadsheet.

----------------------------------------------------------------

The following options are needed so that files created from Windows, Mac, Linux with mapped drives get the correct permissions — Create Share fills these in for you, but they're explained here since they matter if you're troubleshooting a permissions issue (see [Permission errors](#permission-errors) below) or reviewing the share bulk-generation script's output:

1. **force user = haas:** Ensures that all operations on this share are performed as the user haas, making them the owner of all new files.
1. **force group = HaasGroup:** Ensures that all new files and directories are assigned to the group HaasGroup.
1. **create mask = 0664 and force create mode = 0664:** These lines work together to ensure that the resulting file permissions are exactly rw-rw-r-- (664 octal).
1. **directory mask = 0775 and force directory mode = 0775:** These lines ensure that new directories are created with rwxrwxr-x permissions (775 octal), which includes the necessary execute bit for directory traversal.

----------------------------------------------------------------

### Display the Samba Shares

The Manage Samba extension's **Display Shares** button lists every share and its path directly in the Cockpit UI — no need to write your own `~/.zshrc` function or run a script by hand. See [Display shares](../manage_the_appliance/samba.md#display-shares) for a walkthrough, or [Shares CSV](../manage_the_appliance/samba.md#shares-csv) if you want the same list in a spreadsheet-friendly format.

If you're working from the terminal instead, the repo also includes `lshares.sh` (installed to the repo root by `haas-install.sh`) for the same listing:

```bash linenums='1' hl_lines='1'
./lshares.sh
```

```bash title='Command Output'
machines     /home/haas/Haas_Data_collect/machines
st40         /home/haas/Haas_Data_collect/machines/st40
st30         /home/haas/Haas_Data_collect/machines/st30
st30l        /home/haas/Haas_Data_collect/machines/st30l
```

----------------------------------------------------------------

## View the status of the shares

This command outputs a lot of information.

```bash
sudo smbstatus shares
```

```bash title='Command Output'
Samba version 4.19.5-Ubuntu
PID     Username     Group        Machine                                   Protocol Version  Encryption           Signing
----------------------------------------------------------------------------------------------------------------------------------------
127044  haas     haas     192.168.10.143 (ipv4:192.168.10.143:51376) SMB3_11           -                    partial(AES-128-GMAC)
117495  mchavez      mchavez      192.168.10.120 (ipv4:192.168.10.120:55586) SMB3_11           -                    partial(AES-128-GMAC)
127455  rgoodwin     rgoodwin     192.168.10.104 (ipv4:192.168.10.104:52578) SMB3_11           -                    partial(AES-128-GMAC)
127051  haas     haas     192.168.10.143 (ipv4:192.168.10.143:48096) SMB3_11           -                    partial(AES-128-GMAC)

Service      pid     Machine       Connected at                     Encryption   Signing
---------------------------------------------------------------------------------------------
minimill     127455  192.168.10.104 Fri Jan  9 07:41:53 PM 2026 PST  -            -
machines     127051  192.168.10.143 Fri Jan  9 06:27:16 PM 2026 PST  -            -
ST40         127044  192.168.10.143 Fri Jan  9 06:26:33 PM 2026 PST  -            -
ST30         117495  192.168.10.120 Thu Jan  8 11:45:23 AM 2026 PST  -            -


Locked files:
Pid          User(ID)   DenyMode   Access      R/W        Oplock           SharePath   Name   Time
--------------------------------------------------------------------------------------------------
127455       1002       DENY_NONE  0x100081    RDONLY     NONE             /home/haas/Haas_Data_collect/machines/minimill   .   Fri Jan  9 19:49:03 2026
127455       1002       DENY_NONE  0x100081    RDONLY     NONE             /home/haas/Haas_Data_collect/machines/minimill   .   Fri Jan  9 19:49:03 2026
127455       1002       DENY_NONE  0x100081    RDONLY     NONE             /home/haas/Haas_Data_collect/machines/minimill   .   Fri Jan  9 19:49:03 2026
127455       1002       DENY_NONE  0x120089    RDONLY     LEASE(RWH)       /home/haas/Haas_Data_collect/machines/minimill   O1000.txt   Fri Jan  9 19:57:32 2026
117495       1003       DENY_NONE  0x100081    RDONLY     NONE             /home/haas/Haas_Data_collect/machines/st30   .   Thu Jan  8 11:45:51 2026
117495       1003       DENY_NONE  0x100081    RDONLY     NONE             /home/haas/Haas_Data_collect/machines/st30   .   Thu Jan  8 11:45:51 2026

```

----------------------------------------------------------------

### What the output means

The first section list the username, group, IP address of the machine that mapped the drive. Then you can see that SMB3 is being used. Yes, no SMBv1 vulnerabilities on the appliance!

----------------------------------------------------------------

The second section lists the `systemd service file` that was used for each device, the IP address and the `pid`. In this case, there are the following devices connected:

- 192.168.10.104 - A Windows 11 laptop with a mapping to the `minimill` share
- 192.168.10.143 - An Ubuntu laptop with a mapping to the `machines` share
- 192.168.10.143 - An Ubuntu laptop with a mapping to the `ST40` share
- 192.168.10.120 - An Apple Silicon MacBook with a mapping to the `ST30` share

----------------------------------------------------------------

The third section lists files that are locked. This can useful information if a user left a file open.

----------------------------------------------------------------

You can also check current sessions for one specific user without the rest of the `smbstatus shares` output — see [Shares by User](../manage_the_appliance/samba.md#shares-by-user).

## Permission errors

If you have any problems with permissions after mapping a drive, the fastest fix is usually to delete and recreate the share through the Manage Samba extension — [Delete Share](../manage_the_appliance/samba.md#delete-share) followed by [Create Share](../manage_the_appliance/samba.md#create-share) — since Create Share always writes the correct permission settings from its fixed template, described below. Use [Edit smb.conf](../manage_the_appliance/samba.md#edit-smbconf) instead if you only need to tweak one existing share rather than recreate it, or if you're troubleshooting a share that predates this appliance's Cockpit extensions.

### Definitions

- force user = haas: Ensures that all operations on this share are performed as the user haas, making them the owner of all new files.
- force group = HaasGroup: Ensures that all new files and directories are assigned to the group HaasGroup.
- create mask = 0664 and force create mode = 0664: These lines work together to ensure that the resulting file permissions are exactly rw-rw-r-- (664 octal).
- directory mask = 0775 and force directory mode = 0775: These lines ensure that new directories are created with rwxrwxr-x permissions (775 octal), which includes the necessary execute bit for directory traversal.

----------------------------------------------------------------

If the underlying Linux directory permissions themselves are wrong (not just the smb.conf settings), make sure the shared directory is owned by `haas:HaasGroup`:

```bash
sudo chown -R haas:HaasGroup /home/haas/Haas_Data_collect/machines
sudo chmod -R 2774 /home/haas/Haas_Data_collect/machines
```

The 2 in 2774 sets the setgid bit, which ensures that all locally created files also inherit the HaasGroup.
