# Updates - Logs

----------------------------------------------------------------

The `haas-install.sh` installer sets up a Cockpit extension for OS
updates, syncing the appliance's CLI tools, and tailing system logs — all
without needing SSH access. Log into Cockpit at
`https://<appliance-ip>:9090` and look for **Updates - Logs** in the
sidebar.

Managing the `haas-*.service` CNC machine-logger services themselves
(Service State, Edit/Create/Delete Service, Data Freshness, and the
Scripts log) has its own dedicated extension — see
[Python Script Services](python_scripts.md).

The line under the page title shows this appliance's current IPv4/MAC
per active network interface — see
[Network info on every extension page](./manage_intro.md#network-info-on-every-extension-page)
for what it means and why more than one active interface is flagged.

----------------------------------------------------------------

![screenshot](./img/cockpit-updates-overview.resized.png)

----------------------------------------------------------------

## System Updates

A status banner at the top shows the current state (up to date, updates
available, or reboot required) and the last time updates were installed
from this page (persisted across page reloads).

| Button | What it does |
|---|---|
| Check | Runs `/usr/local/sbin/update-check.sh` and refreshes the status banner and package table |
| Install | Runs `/usr/local/sbin/update-system.sh` to install available Ubuntu updates, then automatically re-checks status afterward |
| Reboot | Reboots the appliance immediately — asks for confirmation first |
| Sync Tools | Runs `/usr/local/sbin/install-tools.sh` to install/update the CLI tools listed in `/usr/local/sbin/tools.yaml` (csvlens, tspin, bat, fresh, superfile, zoxide, ...) |
| Edit Sync Tools | Edits `/usr/local/sbin/tools.yaml` itself, to add/remove/change which tools Sync Tools installs — see below |

----------------------------------------------------------------

### If a reboot is required

A message will be displayed in the panel. If you are ready to reboot the appliance, click the `Reboot` button.

----------------------------------------------------------------

![screenshot](./img/cockpit-update-reboot-required.resized.png)

----------------------------------------------------------------

### Sync Tools

Click `Sync Tools` after you run the `Check` to keep the installed third party tools up to date.

Each tool gets a divider and a colored `[ITEM N/M] repo (binary)` header
as its own section. Within a section: `[SKIP] Already up to date`,
`[INSTALL]`, and `[DONE]` are green; `[DOWNLOAD]`/`[INFO]`/`[BOOTSTRAP]`
are blue; a failed tool's `ERROR:` line is red and its `[WARN] Failed:
...` line right below it is amber. The final summary line follows the
same rule — `[COMPLETE] All tools installed successfully` is green,
`[COMPLETE] Finished with N failure(s)` is amber — so you can tell at a
glance whether a sync needs a second look without reading the whole log.

----------------------------------------------------------------

![screenshot](./img/sync-tools.resized.png)

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

![screenshot](./img/edit-sync-tools.resized.png)

----------------------------------------------------------------

## Logs

Five buttons stream a live log into the output pane; **Stop** ends
whichever one is running. Only one log streams at a time — starting a
new one automatically stops the previous stream.

| Button | Source |
|---|---|
| Cockpit | `journalctl -u cockpit` |
| SSH | `journalctl -u ssh` |
| Samba | `journalctl -u smbd` |
| Auth | `/var/log/auth.log` |
| Firewall | Live UFW log via `journalctl`, with **All / BLOCK / ALLOW / Audit** radio filters |

For the **Firewall** log, changing the filter while the stream is running
automatically restarts it with the new filter applied — no need to stop
and re-click.

The CNC machine-logger **Scripts** log moved to
[Python Script Services](python_scripts.md) along with the rest of the
service-management tools.
