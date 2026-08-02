# Installation Quick Start

This is the short version. For the full walkthrough (partitioning, Ubuntu
install, networking, etc.) see the docs under `docs/build_the_appliance/`.

## 1. Prerequisites

- A Raspberry Pi 5, a Virtual Machine, or an Intel/AMD PC, with Ubuntu already installed and
  internet access.
- Root/sudo access.

## 2. Clone the repo

```bash
git clone https://github.com/rikosintie/Haas_Data_collect.git
cd Haas_Data_collect
```

## 3. Edit these two files before running anything

The installer creates Linux/Samba accounts and firewall rules straight from
these — get them right first:

- **`users.csv`** — one row per machine/admin that needs firewall access:
  `username,ip_address,role`
- **`initial_users.csv`** — Samba accounts to create automatically:
  `username, password`

The installer itself will pause on a banner and remind you to check these
before it touches anything — Ctrl+C there is safe if you need to go edit
them first.

## 4. Run the installer

```bash
sudo ./haas-install.sh
```

Run it from the repo root — it detects its own location, so the checkout
can live anywhere.

## 5. What it actually does

- Writes `/etc/haas-firewall.conf` (CSV paths, optional CNC machine
  subnets, SSH port).
- Installs the firewall scripts into `/usr/local/sbin/` and the
  `haas-firewall` systemd service + timer, which apply firewall rules from
  `users.csv` on a schedule.
- Hardens SSH (`/etc/ssh/sshd_config.d/99-haas-hardening.conf`) and installs
  the pre-login banner.
- Installs Samba, creates the `haas` user and `HaasGroup`, and sets up the
  `[Haas]` share with SMBv2/SMBv3-only, NetBIOS/printing disabled.
- Creates any additional Samba accounts listed in `initial_users.csv`.
- Installs Cockpit (web UI, port 9090) plus three custom extensions:
  - `haas-firewall` — firewall control
  - `haas-samba` — manage Samba shares/users
  - `haas-update-appliance` — view/trigger CLI tool updates
- Installs CLI tools listed in `tools.yaml` (via `install-tools.sh` /
  `gh-updater.lib.sh`) — currently `csvlens`, `tspin`, `bat`, `fresh`,
  `superfile`, `zoxide` — and sets up zsh + Oh My Zsh for the `haas` user.
- Removes the Ubuntu ESM/Livepatch boot-menu noise.

## 6. After it finishes

- **Cockpit UI:** `https://<appliance-ip>:9090`
- **Samba share:** to map a drive to the appliance open Explorer, Finder or Files:
  - Windows
    - Open Explorer
    - Click This PC in the sidebar, right-click This PC, and select Map network drive...
    - Choose an available Drive letter
    - In the Folder field, enter: `\\<appliance-ip>\Haas`
    - Check Connect using different credentials (and check Reconnect at sign-in if you want it persistent).
  - Mac - In `Finder` click on
  - Linux - Open Files, click `Network` on the left, on the bottom left enter `smb://<appliance-ip>/Haas` and click `connect.
- A full summary (paths, current UFW rules, zoxide entries) is printed at
  the very end and also saved to
  `<repo_dir>/haas-firewall-install-summary.txt` — save this before you
  close the SSH session, since the terminal output itself is gone once you
  disconnect.
- If the installer reports a reboot is required, reboot before relying on
  the firewall service.

## Troubleshooting

- Re-running `sudo ./haas-install.sh` is safe — it's idempotent for most
  steps (existing users/groups/packages are detected and skipped).
- Check firewall status any time with `sudo ufw status numbered`.
- For deeper troubleshooting, see `docs/build_the_appliance/` and
  `docs/appendices/`.
