# Haas Appliance Firewall System

The Haas Appliance uses a strict, predictable firewall configuration based on a CSV file that defines all authorized users and administrators.

The project includes a script you can drop into your appliance build and maintain over time. The design concept is:

- Reads a CSV with header: username,desktop_ip_address,role
- Supports roles:
     1. user → Samba (445) only
     1. Administrator → Samba (445), SSH (22), Cockpit (9090)
- Adds UFW rules for IPv4 and IPv6 (UFW handles both automatically when IPv6 is enabled)
- Adds extra firewall hardening that you may want in a manufacturing environment
- Allows the Haas machines to be on a separate segmented subnet

You can tune comments/variables to fit your environment.

The concept is explained below, then we'll get into how to build it.

----------------------------------------------------------------

## The CSV file format

The project includes a `bash` script that reads a `csv` file and then creates the firewall rules.

```text
username,desktop_ip_address,role
mhubbard,192.168.10.143,Administrator
haassvc,192.168.10.104,user
haassvc2,192.168.10.120,Administrator
rgoodwin,192.168.10.120,Administrator
mchavez,192.168.10.120,Administrator
```

## Roles

### User

- Access to Samba shares (port 445)

### Administrator

- Samba (445)
- SSH (22)
- Cockpit (9090)

### Haas Machine Tools

All Haas CNC machines authenticate using the `haassvc` account. The script can create rules to allow the CNC controls access to Samba from a dedicated  subnet if your security policy requires segmentation.

Haas machines (haassvc)

- Allowed from HAAS_MACHINES_SUBNET_V4 (and optionally v6) to 445/tcp
- You can narrow or expand that subnet as your manufacturing network dictates.

In this example, the CNC machines are on `192.168.0.0/24`:

```text
192.168.1.0/24 → port 445
```

----------------------------------------------------------------

## NetBIOS is blocked

- Explicitly denies 137/udp, 138/udp, 139/tcp so nothing revives that old stack by accident.

## SSH hardening

- Uses `ufw limit 22/tcp` to rate‑limit repeated connection attempts.

# Safe defaults

- deny incoming, allow outgoing
- Loopback allowed

----------------------------------------------------------------

## Script Options

Enabling a firewall while you are connected over `ssh` can lead to tears, especially if you are not on site! That's because the firewall will read the rules and execute them immediately. If you block `ssh` from the IP address of your management station you will lose connection. The `dry-run` mode previews the rules instead of applying them. Review the rules carefully!

If you applied the rules and just want to start over use reset mode to remove all rules at one time.

Dry Run Mode

Use `--dry-run` to preview all firewall changes without applying them.

Reset Mode

Use `--reset` to wipe all UFW rules and rebuild from the CSV.

----------------------------------------------------------------

## Systemd Integration

The firewall is automatically applied at boot via:

```text
haas-firewall.service
```

A daily sync is handled by:

```bash
haas-firewall.timer
```

----------------------------------------------------------------

## Logs

All firewall actions are logged to:

```bash
/var/log/haas-firewall.log
```

Log rotation is configured to keep logs manageable.

----------------------------------------------------------------

## Let's build the firewall

There are several files needed. Below is where they are placed in the appliance:

```bash hl_lines='1 4 7 11'
/home/mhubbard/Haas_Data_collect/
  configure_ufw_from_csv.sh

/home/mhubbard/Haas_Data_collect/
  users.csv

/etc/systemd/system/
  haas-firewall.service
  haas-firewall.timer

/etc/logrotate.d/
  haas-firewall
```
