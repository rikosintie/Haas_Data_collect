# Updates - Logs

----------------------------------------------------------------

The `haas-install.sh` installer sets up a Cockpit extension for OS
updates, syncing the appliance's CLI tools, tailing system logs, and
managing the CNC machine-logger services — all without needing SSH
access. Log into Cockpit at `https://<appliance-ip>:9090` and look for
**Updates - Logs** in the sidebar.

----------------------------------------------------------------

## System Updates

A status banner at the top shows the current state (up to date, updates
available, or reboot required) and the last time updates were installed
from this page (persisted across page reloads).

| Button | What it does |
|---|---|
| Check | Runs `update-check.sh` and refreshes the status banner and package table |
| Install | Runs `update-system.sh` to install available Ubuntu updates, then automatically re-checks status afterward |
| Reboot | Reboots the appliance immediately — asks for confirmation first |
| Sync Tools | Runs `install-tools.sh` to install/update the CLI tools listed in `/usr/local/sbin/tools.yaml` (csvlens, tspin, bat, fresh, superfile, zoxide, ...) |
| Edit Sync Tools | Edits `/usr/local/sbin/tools.yaml` itself, to add/remove/change which tools Sync Tools installs — see below |

----------------------------------------------------------------

### If a reboot is required

A message will be displayed in the panel. If you are ready to reboot the appliance, click the `Reboot` button.

----------------------------------------------------------------

![screenshot](./img/cockpit-update-reboot-required.resized.png)

----------------------------------------------------------------

### Edit Sync Tools

Click **Edit Sync Tools** to load `/usr/local/sbin/tools.yaml` — the
inventory **Sync Tools** installs from — into an editor. Every other
button is locked while editing except **Save & Sync** and **Cancel**.

Each entry needs a `repo:` (the GitHub `owner/name`) and a `binary:` (the
name Sync Tools installs it as). To add a tool, find its GitHub page,
confirm it publishes **Releases** (usually a link on the right side of
the repo's home page), then add an entry in that form.

**Save & Sync** validates the whole file before touching anything real —
nothing is written and Sync Tools does not run unless every check passes:

1. **YAML syntax** — the file must parse. If `yq` itself isn't installed
   yet (a brand-new appliance that has never run Sync Tools), you're told
   to run **Sync Tools** once first, since that's what installs `yq`.
2. **Structure** — the top-level `tools:` key must be a list, and every
   entry must have both `repo` and `binary`.
3. **Each repo actually exists** — every `repo:` is checked against
   `https://api.github.com/repos/<repo>/releases/latest`, the same
   endpoint Sync Tools itself uses to find the latest release. A typo'd
   or renamed repository, or one with no published releases, is caught
   here instead of failing partway through an actual sync.

Progress streams live above the editor as each repo is checked, so a slow
GitHub response doesn't look like the page has hung. If anything fails,
the file is left untouched, the specific problem(s) are listed, and your
edits stay in the editor to fix and retry — nothing is lost. If every
check passes, the file is saved and **Sync Tools** runs automatically.

----------------------------------------------------------------

## Logs

Six buttons stream a live log into the output pane; **Stop** ends
whichever one is running. Only one log streams at a time — starting a
new one automatically stops the previous stream.

| Button | Source |
|---|---|
| Cockpit | `journalctl -u cockpit` |
| SSH | `journalctl -u ssh` |
| Samba | `journalctl -u smbd` |
| Auth | `/var/log/auth.log` |
| Firewall | Live UFW log via `journalctl`, with **All / BLOCK / ALLOW / Audit** radio filters |
| Scripts | CNC machine-logger output (`journalctl -t python3`), with optional **IP** / **Port** text filters |

For the **Firewall** and **Scripts** logs, changing the filter while the
stream is running automatically restarts it with the new filter applied
— no need to stop and re-click.

----------------------------------------------------------------

## Services

Manages the `haas-*.service` systemd units that run the per-machine CNC
data-collection scripts.

----------------------------------------------------------------

### Service State

Click **Service State** for a one-shot `systemctl list-unit-files`
summary of every `haas-*` service and its current state.

----------------------------------------------------------------

### Edit Services

1. Click **Edit Services**, then pick a unit file from the dropdown that
   appears.
2. The file loads into an editor. Every other button is locked while
   editing except **Save & Restart** and **Cancel**.
3. **Save & Restart** asks for confirmation, then writes the file, runs
   `systemctl daemon-reload`, restarts the service, and finishes with
   `systemctl status <service>` so you can confirm it came back up
   cleanly.
4. **Cancel** discards your changes and returns to the log/output view.

----------------------------------------------------------------

### Create Service

Click **Create Service** to open a form (Description, Machine Name, IP
Address, Port) instead of a raw editor — this generates a new
`haas-<machine>.service` unit from a template, so you don't need to hand
-write systemd files for each new CNC machine.

- Typing in **Machine Name**, **Description**, and **IP Address** filters
  out invalid characters as you type (IP Address only accepts digits and
  dots, for example).
- **Save & Reload** validates before writing anything:
    - all four fields are required
    - IP Address must be a valid IPv4 address
    - Port must be an integer between 5001 and 5999
- Once validated, it writes `/etc/systemd/system/haas-<machine>.service`,
  creates the machine's working directory under
  `/home/haas/Haas_Data_collect/machines/<machine>`, then runs
  `daemon-reload`, `enable`, and `start` for the new service — the output
  pane shows each step, ending with `systemctl status` for the new
  service.

----------------------------------------------------------------

### Delete Service

Pick a unit file from the dropdown after clicking **Delete Service**.
Confirms first (**"This cannot be undone"**), then stops, disables, and
removes the unit file, followed by `systemctl daemon-reload`.
