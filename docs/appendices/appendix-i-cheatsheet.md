# Haas Appliance — Shell Cheat sheet

----------------------------------------------------------------

Aliases and functions live in `/home/haas/.oh-my-zsh/custom/haas-aliases.zsh`.
Edit with `ec1` at the terminal prompt, or via the Cockpit terminal at `https://<appliance_ip>:9090`.

Type `haas` then press `Tab` to list all haas aliases.

---

## Directory Aliases

| Alias | Destination |
|---|---|
| `haas-bin` | `/usr/local/sbin` |
| `haas-firewall` | `/usr/share/cockpit/haas-firewall` |
| `haas-log` | `/var/log` |
| `haas-repo` | `/home/haas/Haas_Data_collect` |
| `haas-samba` | `/usr/share/cockpit/haas-samba` |
| `haas-ssh` | `/etc/ssh/sshd_config.d` |
| `haas-systemd` | `/etc/systemd/system` |
| `haas-updates` | `/usr/share/cockpit/haas-update-appliance` |

---

## Command Aliases

| Alias | Command | Purpose |
|---|---|---|
| `haasserv` | `systemctl list-unit-files --type=service \| grep haas` | List all haas service states |
| `haas-fw-conf` | `sudo fresh /etc/haas-firewall.conf` | Edit firewall config |
| `haas-sshd` | `sudo fresh /etc/ssh/sshd_config.d/99-haas-hardening.conf` | Edit SSH hardening config |
| `haas-sshc` | `sudo sshd -T \| grep -E '...'` | Show custom SSH settings only |
| `t-python3` | `journalctl -f --no-pager \| grep --line-buffered -E 'python3' \| tspin \| spacer` | Tail CNC script logs |

---

## Functions

### `haas-systemd` — list haas service files

Changes to `/etc/systemd/system/` and lists all `haas-*` files.

```bash
haas-systemd() {
    cd /etc/systemd/system
    ls -l haas-*
}
```

### `path` — show PATH, one entry per line

```bash
path          # list all PATH entries
path sbin     # grep PATH entries for "sbin"
```

### `mkd` — make directory and cd into it

```bash
mkd machines/vf2ss/cnc_logs    # creates full path and switches to it
```

---

## Important Directories

| Path | Purpose |
|---|---|
| `/home/haas/Haas_Data_collect/machines` | CNC machine data directories |
| `/etc/systemd/system` | haas-*.service and haas-*.timer files |
| `/usr/local/sbin` | All appliance scripts |
| `/etc/samba/smb.conf` | Samba configuration |
| `/var/log/samba` | Samba log files (one per connected machine) |
| `/etc/haas-firewall.conf` | Firewall configuration |
| `/etc/ssh/sshd_config.d/99-haas-hardening.conf` | SSH hardening config |
| `/etc/issue.net` | Pre-login banner |
| `/usr/share/cockpit/haas-firewall` | Cockpit Firewall extension |
| `/usr/share/cockpit/haas-update-appliance` | Cockpit System Updates extension |
| `/usr/share/cockpit/haas-samba` | Cockpit Samba extension |

---

## Scripts (`/usr/local/sbin/`)

| Script | Purpose |
|---|---|
| `configure_ufw_from_csv.sh` | Apply / simulate UFW rules from `users-a.csv` (or `users-b.csv`/a custom path) |
| `rollback_csv.sh` | Restore a CSV backup |
| `manage_users.sh` (stays in the repo, not `/usr/local/sbin`) | Create/delete Linux + Samba accounts, change passwords — also available via Cockpit's Manage Samba page (Create/Delete User, Change Password) |
| `validate_users_csv.sh` | Validate a users CSV before applying |
| `update-check.sh` | Check for Ubuntu package updates |
| `update-system.sh` | Install Ubuntu updates |
| `install-tools.sh` | Sync 3rd-party tools from GitHub |
| `smb_verify.sh` | Verify Samba share configuration |
| `ssh_port.sh` | Show current SSH port |
| `ssh_validate.sh` | Validate SSH configuration |
| `lshares.sh` | List Samba shares |
| `haas-install.sh` | Install the Haas appliance stack |
| `gh-updater.lib.sh` | GitHub release update library |

---

## Quick Reference — CNC Log Viewing

**Terminal:**
```bash
t-python3                                                         # all CNC script logs
journalctl -t python3 -f --no-pager                              # same, using syslog identifier
journalctl -t python3 -f --no-pager --grep="192.168.10.141:5053" # filter by IP:port
```

**Cockpit:** System Updates page → **Scripts** button (supports IP and port filters)

---

## After Editing a Service File

```bash
sudo systemctl daemon-reload
sudo systemctl restart haas-<machinename>.service
systemctl status haas-<machinename>.service
```

Or use the Cockpit System Updates page → **Edit Services** button (daemon-reload runs automatically on save).

---

## After Editing the SSH Config

```bash
sudo systemctl restart ssh
systemctl status ssh
```
