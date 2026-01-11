# Haas Appliance Firewall System

----------------------------------------------------------------

![screenshot](img/Tux_firewall1.resized.png)

----------------------------------------------------------------

The appliance is running on Ubuntu 24.04 which has many security features that Canonical has learned from being a very popular Internet Web server OS. The the Raspberry Pi 5 appliance has limited functionality:

- transfer files to/from the Haas CNC control
- Accept files from the CNC programmers
- Connect to the Haas CNC controls using a predefined port and IP address to collect data

So we can lock it down using:

- Local user accounts
- Linux file permissions
- Samba Server share permissions
- The Ubuntu Uncomplicated Firewall (UFW).

In addition to the Haas CNC ports we define, the Raspberry Pi 5 appliance needs to have SSH exposed to the customer user that is responsible for management of the appliance. Ubuntu 24.04 ships with OpenSSH 9.6 which has removed ssh-dss and made many other legacy protocols optional.You can verify the version using:

```bash  hl_lines='1'
ssh -V
```

```bash title='Command Output'
OpenSSH_9.6p1 Ubuntu-3ubuntu13.14, OpenSSL 3.0.13 30 Jan 2024
```

----------------------------------------------------------------

!!! Note Enabling the firewall is optional
    If you are new to Linux and building the appliance has been challenging, you should wait to enable the firewall. The instructions will walk you through step by step but if you make a mistake you could lock yourself out.

If you chose the desktop version of Ubuntu, it's not an issue because you are using a Keyboard, Monitor, and Mouse, but if you chose the server version you are dependant on `ssh` to access the appliance.

The firewall provides a strict, predictable configuration based on a CSV file that defines all authorized users and administrators.

The project includes a script, `configure_ufw_from_csv.sh` to build and maintain over the firewall configuration over time. Onc the firewall is enabled you should be able to pass a penetration test because:

- The Samba shares are only exposed to the devices in the `csv` file
- Ubuntu includes the latest version of `Openssh`
- ssh access attempts are rate lilmited with  `ufw limit 22/tcp`
- The `Cockpit` management application is only exposed to the devices in the `csv` file with the `management` role

At the end of this section there is a PowerShell script that you can use to test the secirity of the appliance.

----------------------------------------------------------------

The design concept is:

- Reads a CSV file with the header: username,desktop_ip_address,role
- Supports roles:
     1. user → Samba (445) only
     2. Administrator → Samba (445), SSH (22), Cockpit (9090)
- Adds UFW rules for IPv4 and IPv6 (UFW handles both automatically when IPv6 is enabled)
- Adds extra firewall hardening that you may want in a manufacturing environment
- Allows the Haas machines to be on a separate segmented subnet

You can tune comments/variables to fit your environment.

The concept is explained below, then we'll get into how to build it.

----------------------------------------------------------------

## The CSV file format

The project includes a `bash` script that reads a `csv` file and then creates the firewall rules. The `csv` file format is shown below:

```text
username,desktop_ip_address,role
mhubbard,192.168.10.143,Administrator
haassvc,192.168.10.104,user
haassvc2,192.168.10.120,Administrator
rgoodwin,192.168.10.120,Administrator
mchavez,192.168.10.120,Administrator
```

----------------------------------------------------------------

## Roles

### User

- Access to Samba shares (port 445) only

### Administrator

- Access to Samba shares (port 445)
- SSH (22) access to manage the appliance
- Cockpit (9090) access for web management

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

## Additional security features

The script includes the following features in addition to the firewall `allow/deny` rules

### NetBIOS is blocked

- Explicitly denies 137/udp, 138/udp, 139/tcp so **nothing revives that old stack by accident**.

### SSH hardening

- Uses `ufw limit 22/tcp` to rate‑limit repeated connection attempts.

### Safe defaults

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
