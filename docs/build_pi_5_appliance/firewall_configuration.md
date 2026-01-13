# Haas Appliance Firewall

----------------------------------------------------------------

![screenshot](img/Tux_firewall1.resized.png)

----------------------------------------------------------------

The appliance is running on Ubuntu 24.04, one of the most secure operating systems. The Raspberry Pi 5 appliance has limited functionality:

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

----------------------------------------------------------------

If you chose the desktop version of Ubuntu, it's not an issue because you are using a Keyboard, Monitor, and Mouse, but if you chose the server version you are dependant on `ssh` to access the appliance.

The firewall provides a strict, predictable configuration based on a CSV file that defines all authorized users and administrators.

The project includes a script, `configure_ufw_from_csv.sh` to build and maintain over the firewall configuration over time. Onc the firewall is enabled you should be able to pass a penetration test because:

- The Samba shares are only exposed to the devices in the `csv` file
- Ubuntu includes the latest version of `Openssh`
- ssh access attempts are rate limited with  `ufw limit 22/tcp`
- The `Cockpit` management application is only exposed to the devices in the `csv` file with the `management` role

At the end of this section there is a PowerShell script that you can use to test the security of the appliance.

----------------------------------------------------------------

The design concept of the script is:

- Automated script reads a CSV file to build the firewall rules
- Supports roles:
     1. user → Samba (445) only
     2. Administrator → Samba (445), SSH (22), Cockpit (9090)
- Adds UFW rules for IPv4 and IPv6 (UFW handles both automatically when IPv6 is enabled)
- Adds extra firewall hardening that you may want in a manufacturing environment
- Allows the Haas machines to be on a separate segmented subnet
- Creates a log of the UFW changes

🟦 Why this design is good

- Automatic appliance behavior via systemd
- Developer‑friendly manual testing via CLI
- No conflicts between the two methods - automatic/manual testing
- No need to stop services to test

This is exactly how professional appliances behave.

----------------------------------------------------------------

## The CSV file format

The project includes a script, `configure_ufw_firewall.sh` that reads a `csv` file and creates the firewall rules. The `csv` file format is shown below:

```text
username,desktop_ip_address,role
mhubbard,192.168.10.143,Administrator
haassvc,192.168.10.104,user
haassvc2,192.168.10.120,Administrator
rgoodwin,192.168.10.120,Administrator
mchavez,192.168.10.133,Administrator
```

The `csv` file lives in the root of the `Haas_Data_collect` directory. This directory was shared as `Haas`. Once you map a drive, you can edit the file in Excel. Just remember to save it as a `csv` file, not an `Excel` file.

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

In this example, the CNC machines are on `192.168.50.0/24`:

```text
192.168.1.50/24 → port 445
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

!!! Note
    If you make a change to to the `csv` file and don't want to reboot or wait until the timer goes off you can run:

    `sudo systemctl start haas-firewall.service`

----------------------------------------------------------------

## Logs

All firewall actions are logged to:

```bash
/var/log/haas-firewall.log
```

Log rotation is configured to keep logs manageable.

----------------------------------------------------------------

## Let's build the firewall system

Several files are needed to build the rules, run a timer to make sure the firewall is reapplied if disabled, and log the output. Below is where they are placed in the appliance:

```bash hl_lines='1 4 7 11'
/usr/local/sbin/
  configure_ufw_from_csv.sh

/home/mhubbard/Haas_Data_collect/
  users.csv

/etc/systemd/system/
  haas-firewall.service
  haas-firewall.timer

/etc/logrotate.d/
  haas-firewall
```

!!! Note
    The script is stored in `/usr/local/sbin` which is a system level directory. The script should not need to be edited and to edit a file in `/usr/local/sbin` you need `root` privileges. You can use `sudo nano /usr/local/sbin/configure_uft_from_csv.sh` if you need to edit it.

----------------------------------------------------------------

### The systemd files

In the root of the repository are the files needed to configure `systemd`. The is an installation script `install_haas_firewall.sh` that runs all of the commands below. If you want to fully understand how the firewall service works run the individual commands.

#### Automated installation of the `Firewall Service`

In the `Haas_Data_Collect` folder run the following:

```bash
sudo ./haas_firewall_install.sh
```

⭐ What this installer guarantees

- No partial installs — it aborts safely if anything is missing
- Script and validator are protected in /usr/local/sbin/
- Systemd is configured correctly
- Firewall rules apply at boot
- Daily timer provides self‑healing
- Customer directory stays clean (only users.csv remains)

#### If you want to uninstall the `Firewall Service`

🟦 Uninstaller Script (uninstall_haas_firewall.sh)
This script safely removes:

- The systemd service
- The systemd timer
- The installed scripts in /usr/local/sbin/
- Reloads systemd

Leaves the CSV untouched

It also checks for file existence before removing anything.

----------------------------------------------------------------

#### Manual Installation

Copy the files to the correct location using

```bash linenums='1' hl_lines='1'
sudo cp haas-firewall.service /etc/systemd/system/
sudo cp haas-firewall.timer /etc/systemd/system/
sudo cp configure_ufw_from_csv.sh /usr/local/sbin/
sudo chmod +x /usr/local/sbin/configure_ufw_from_csv.sh
```

There is no output from these command.

----------------------------------------------------------------

#### Delete the script after copying

Once the `configure_ufw_from_csv.sh` file is copied to `/usr/local/sbin` we will delete it from the project directory. This is to prevent accidental changes being made.

```bash linenums='1' hl_lines='1'
ls -l /usr/local/sbin/configure_ufw_from_csv.sh
```

If the file exits in `/usr/local/sbin`, then delete the copy in the `Haas_Data_collect` directory:

```bash linenums='1' hl_lines='1'
rm /home/mhubbard/Haas_Data_collect/configure_ufw_from_csv.sh
```

There is no output from this command.

----------------------------------------------------------------

#### Reload the daemons to incorporate the changes

```bash
sudo systemctl daemon-reload
```

There is no output from this command.

----------------------------------------------------------------

#### Enable and start the `firewall Service`

```bash
sudo systemctl enable haas-firewall.service
sudo systemctl start haas-firewall.service
systemctl status haas-firewall.service
```

----------------------------------------------------------------

### Enable the timer

```bash linenums='1' hl_lines='1'
sudo systemctl enable --now haas-firewall.timer
```

There is no output from this command.

----------------------------------------------------------------

Verify the timer service:

```bash linenums='1' hl_lines='1'
systemctl list-timers | grep haas-firewall
```

```bash title='Command Output'
Need output
```

----------------------------------------------------------------

### The bash script that creates the rules

In the root of `Haas_Data_Collect` is a script named `configure_ufw_from_csv.sh` and a `csv` file named users.csv. The script read the data in a `csv` file and creates the `Uncomplicated Firewall (UFW)` rules.

**make script executable. Run the following:**

```bash
cd /home/mhubbard/Haas_Data_collect/
chmod +x configure_ufw_from_csv.sh
ls -l configure*
```

```bash title='Command Output'
.rwxrwxr-x 4.8k mhubbard 11 Jan 19:54  configure_ufw_from_csv.sh
```

### The Dry-Run script option

The script lives in `/usr/local/sbin/` so it requires root access to run it manually. During deployment is it possible to run it manually with the dry-run option using the following:

```bash linenums='1' hl_lines='1'
sudo /usr/local/sbin/configure_ufw_from_csv.sh --dry-run
```

Dry run mode reads the users.csv file, processes it and then displays what would be configured for `UFW`.

🟧 Why is there a `dry-run` mode?
This is extremely helpful when:

- testing new CSV formats
- debugging customer issues
- validating rule logic
- verifying backups and validation

----------------------------------------------------------------

Here is what the output of the `dry-run` option looks like:

```bash title='Command Output'
[*] Setting UFW base policy...
[DRY-RUN] Would set IPV6=yes in /etc/default/ufw
[DRY-RUN] ufw default deny incoming
[DRY-RUN] ufw default allow outgoing
[DRY-RUN] ufw allow in on lo
[DRY-RUN] ufw allow out on lo
[DRY-RUN] ufw limit 22/tcp
[DRY-RUN] ufw deny 137/udp
[DRY-RUN] ufw deny 138/udp
[DRY-RUN] ufw deny 139/tcp
[*] Creating rules for Haas machines (haassvc)...
[DRY-RUN] ufw allow from 192.168.50.0/24 to any port 445 proto tcp comment 'Haas machines IPv4 -> Samba'
[*] Processing CSV: users.csv
[*] Adding ADMIN 'mhubbard' from 192.168.10.143
[DRY-RUN] ufw allow from 192.168.10.143 to any port 445 proto tcp comment 'Admin mhubbard -> Samba'
[DRY-RUN] ufw allow from 192.168.10.143 to any port 22 proto tcp comment 'Admin mhubbard -> SSH'
[DRY-RUN] ufw allow from 192.168.10.143 to any port 9090 proto tcp comment 'Admin mhubbard -> Cockpit'
[*] Adding USER 'haassvc' from 192.168.10.104
[DRY-RUN] ufw allow from 192.168.10.104 to any port 445 proto tcp comment 'User haassvc -> Samba'
[*] Adding ADMIN 'haassvc2' from 192.168.10.120
[DRY-RUN] ufw allow from 192.168.10.120 to any port 445 proto tcp comment 'Admin haassvc2 -> Samba'
[DRY-RUN] ufw allow from 192.168.10.120 to any port 22 proto tcp comment 'Admin haassvc2 -> SSH'
[DRY-RUN] ufw allow from 192.168.10.120 to any port 9090 proto tcp comment 'Admin haassvc2 -> Cockpit'
[*] Adding ADMIN 'rgoodwin' from 192.168.10.120
[DRY-RUN] ufw allow from 192.168.10.120 to any port 445 proto tcp comment 'Admin rgoodwin -> Samba'
[DRY-RUN] ufw allow from 192.168.10.120 to any port 22 proto tcp comment 'Admin rgoodwin -> SSH'
[DRY-RUN] ufw allow from 192.168.10.120 to any port 9090 proto tcp comment 'Admin rgoodwin -> Cockpit'
[*] Adding ADMIN 'mchavez' from 192.168.10.223
[DRY-RUN] ufw allow from 192.168.10.223 to any port 445 proto tcp comment 'Admin mchavez -> Samba'
[DRY-RUN] ufw allow from 192.168.10.223 to any port 22 proto tcp comment 'Admin mchavez -> SSH'
[DRY-RUN] ufw allow from 192.168.10.223 to any port 9090 proto tcp comment 'Admin mchavez -> Cockpit'
[DRY-RUN] Would enable UFW
[DRY-RUN] Would show UFW status
[*] Done.
```

----------------------------------------------------------------

### Custom `csv` file option

The default file name is users.csv. For testing, you can run  a different `csv` file using the following:

```bash
sudo /usr/local/sbin/configure_ufw_from_csv.sh /path/to/test.csv
```

----------------------------------------------------------------

## Cockpit Integration

Add an icon

create the service directory:

```bash linenums='1' hl_lines='1'
sudo mkdir /usr/share/cockpit/haas-firewall/
```

**Copy the icon over:**

```bash linenums='1' hl_lines='1'
sudo cp /home/mhubbard/Haas_Data_collect/icon.png /usr/share/cockpit/haas-firewall/icon.png
```

Cockpit will pick it up automatically after the restart.

Restart Cockpit

```bash linenums='1' hl_lines='1'
sudo systemctl restart cockpit
```

Your new button will appear instantly.
