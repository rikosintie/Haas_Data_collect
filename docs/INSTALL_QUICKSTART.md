# Installation Quick Start

This is the short version. For the full walkthrough (partitioning, Ubuntu
install, networking, etc.) see the docs under `docs/build_the_appliance/`.

## 1. Prerequisites

- A Raspberry Pi 5, a Virtual Machine, or an Intel/AMD PC, with Ubuntu already installed and
  internet access.
- User `haas` with Root/sudo access.

## 2. Clone the repo

```bash
git clone https://github.com/rikosintie/Haas_Data_collect.git
cd Haas_Data_collect
```

## 3. Edit `users.csv` and `initial_users.csv` before running anything

- Use `nano users.csv` and `nano initial_users.csv` to edit the files
- The installer creates Linux/Samba accounts and firewall rules straight from
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
  `[machines]` share (one shared drive exposing every machine's
  subdirectory) with SMBv2/SMBv3-only, NetBIOS/printing disabled. The repo
  root itself is not shared over Samba — only reachable over SSH — so
  scripts and config aren't exposed to every Samba account. Per-machine
  shares (recommended if you want tighter segmentation than `[machines]`
  gives you) are created individually via Manage Samba's Create Share
  button.
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
- **Samba share:** To map a drive to the appliance:

### Windows

1. Open **Explorer**.
2. Click **This PC** in the sidebar, right-click **This PC**, and select **Map network drive...**
3. Choose an available drive letter.
4. In the **Folder** field, enter: `\\<appliance-ip>\machines` (or a
   specific per-machine share name if one was created via Create Share)
5. Check **Connect using different credentials** (and check **Reconnect at sign-in** if you want it persistent).
6. Click **Finish**, then enter your Samba username and password when prompted.
7. *Optional (Terminal):* To map it from the terminal to drive `Z:`, run:

    ```cmd
    net use Z: \\<appliance_IP>\machines /user:<username> <password> /persistent:yes
    ```

### Mac

1. Open **Finder**.
2. Press `Cmd + K` (or select **Go > Connect to Server...** in the menu bar).
3. In the **Server Address** field, enter: `smb://<appliance-ip>/machines`
4. Click **Connect**.
5. Select **Registered User**, enter your Samba username and password, then click **Connect**.

!!! info "Auto-connect on Boot"
    To make it auto-connect on boot, go to **System Settings > General > Login Items**, click the **+** button, and select the mounted `machines` volume from your desktop or Finder sidebar.

### Linux

1. Open your file manager (**Files** in Ubuntu).
2. Click **Network** in the left sidebar.
3. At the bottom of the window, locate the **Connect to Server** box.
4. Type in the SMB URL: `smb://<appliance-ip>/machines`
5. Click **Connect** and select **Registered User**.
6. Enter your credentials.
7. Select one of the password options:
    - `Forget password immediately`
    - `Remember password until you logout`
    - `Remember forever`
8. Choose **Forget password immediately** until you verify everything is working correctly.

### Haas CNC Control

The Haas NGC runs an embedded Linux stack under the hood and natively supports SMB/CIFS, so it connects cleanly to SMBv2/v3 shares.

1. **Open the Network Settings**
    - Press the **[SETTINGS]** button on the control panel.
    - Navigate to **Network** (Setting 133 / Network Setup).
    - Select the **Network Shared Location** (or Shares / Client) tab.

2. **Configure the Connection Parameters**
    - **Remote Server / IP:** The IP address of the appliance
    - **Share Name / Path:** The name of the SMB share (no leading slashes)
    - **Domain / Workgroup:** `WORKGROUP` (default on the appliance)
    - **User Name:** The `haas` user has access to all shares. The Samba user created for the machine only has access to that specific share. See your company security policy for guidance.
    - **Password:** The Samba password for the user

3. **Mount and Verify**
    - Once the fields are filled out, press **[F4]** (or the Connect / Mount softkey on screen).
    - Press the **[LIST PROGRAM]** button on the console.
    - Look in the left-hand directory tab tree. You should now see a **Net Share** (or Network) drive listed alongside `MEMORY` and `USB`.

---

!!! warning "Common Gotchas on Haas NGC"
    - **Case Sensitivity:** SMB share names can be picky depending on the NGC software release. Ensure the share name (e.g. `machines`) matches the exact capitalization defined in `smb.conf`.
    - **Path Traversal:** Do not add slashes to the share name (use `machines`, not `/machines` or `\\<appliance-ip>\machines`). The control appends the IP and slash automatically.
    - **Network Speed / Delays:** `haas-install.sh` sets `hostname lookups = No` in `smb.conf` by default, since machine tools are essentially never in DNS on a real shop network — without it, every connection triggers a reverse DNS lookup that times out and makes **[LIST PROGRAM]** noticeably slow. If you hand-edited `smb.conf` (or restored an older backup) and see this slowness again, verify that setting is still present under `[global]`.
---

- A full summary (paths, current UFW rules, zoxide entries) is printed at the very end. Save the onscreen summary before you close the SSH session, since the terminal output itself is gone once you disconnect. The `haas-install-summary.txt` file is saved to `repo_dir>/haas-install-summary.txt`. The  `haas-install-summary.txt` file is permanent.
- If the installer reports a reboot is required, reboot before relying on the firewall service using `sudo reboot now`.
- If the installer reports a reboot is required, reboot before relying on
  the firewall service using `sudo reboot now`.

---

## Troubleshooting

- Re-running `sudo ./haas-install.sh` is safe — it's idempotent for most
  steps (existing users/groups/packages are detected and skipped).
- Check firewall status any time with `sudo ufw status numbered | sort -k5` or use the Cockpit extension at `https://<appliance-ip>:9090`.
- For deeper troubleshooting, see `docs/build_the_appliance/` and
  `docs/appendices/`.
