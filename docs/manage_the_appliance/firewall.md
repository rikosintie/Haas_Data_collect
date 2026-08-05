# Firewall Control

----------------------------------------------------------------

The `haas-install.sh` installer sets up a Cockpit extension for managing the
appliance's firewall day to day, so you don't need SSH access for routine
firewall work. Log into Cockpit at `https://<appliance-ip>:9090` and look
for **Firewall Control** under **System** in the sidebar.

----------------------------------------------------------------

!!! Note "Unlock the page first"
    Cockpit opens most pages in **🔒 Limited access** mode. Click that badge
    at the top of the page (the gear icon on mobile) before any of the
    buttons below will work.

## Firewall Status Dashboard

----------------------------------------------------------------

![screenshot](./img/firewall-dash.png)

----------------------------------------------------------------

At the top of the page:

- A colored status indicator (green = enabled, red = disabled) plus your
  logged-in username, user ID, groups, and shell.
- An **Enable Firewall** / **Disable Firewall (for testing)** toggle button
  that reflects the current state. Both directions ask for confirmation
  first — disabling warns that all rules are removed and the appliance
  becomes vulnerable; enabling warns that you'll be disconnected if your
  current IP isn't already covered by a rule in `users.csv`.
- **Active Firewall Rules** — the live output of `ufw status numbered`,
  refreshed automatically. Rules are sorted by the **From** IP address
  numerically (`192.168.10.9` before `192.168.10.10`, not the reverse a
  plain text sort would produce), not by the order they happened to be
  added in — the `[N]` rule numbers themselves are untouched, so they're
  still what you'd pass to `ufw delete N` if you ever needed to, they just
  won't run 1, 2, 3... top to bottom on screen anymore. Subnet/CIDR rules
  sort by their network address; non-IPv4 entries (`Anywhere`, IPv6) sort
  last.
- **Show Network Neighbor** — runs `lldpcli show neighbors` and prints the
  result in the output pane below: which switch and port this appliance
  is physically plugged into, straight from the page — no SSH needed.
  Since this button sits up here but its result appears in the output
  pane further down the page, clicking it automatically scrolls that
  pane into view — no need to know to scroll down and look for it.
  See [Network Visibility (LLDP)](./lldp.md) for what the output means
  and why it matters.

## Firewall Log

----------------------------------------------------------------

![screenshot](./img/firewall-logs.png)

----------------------------------------------------------------

Click **Firewall Log** to stream the live UFW log (`journalctl -f`) into the
rules pane, with radio filters for **All**, **BLOCK**, **ALLOW**, or
**Audit** entries. Click **Stop** to end the stream and go back to showing
the static rule list.

## Simulate / Compare

These buttons never make persistent changes — safe to use any time to
check what *would* happen:

| Button | What it does |
|---|---|
| Simulate Firewall Update (Dry-Run) | Runs `configure_ufw_from_csv.sh --dry-run` against the current `users.csv` |
| Show Current UFW Rules | Runs `configure_ufw_from_csv.sh --show-rules` |
| Edit users.csv | Opens `~/Haas_Data_collect/users.csv` in an inline editor (see below) |
| Edit Custom CSV | Opens whatever path is currently typed in the **Compare Current vs Planned Rules** box (below) in the same inline editor |
| Edit conf file | Opens `/etc/haas-firewall.conf` in an inline editor |
| Compare Current vs Planned Rules | Runs `configure_ufw_from_csv.sh --compare <path>` against whatever CSV path you enter — defaults to `users1.csv`, the usual convention for a planned/alternate file, since comparing against `users.csv` (the file already active) wouldn't show anything interesting |

!!! note "What users1.csv is actually for"
    `users1.csv` isn't just a scratch file for testing changes — the
    convention on this appliance is to use it for **contractors and
    temporary employees** (contract CNC programmers, temp Ops staff,
    etc.) who need access for a limited time. When one needs access,
    add them to `users1.csv` — via **Edit Custom CSV** — check **Use
    custom CSV file**, and run **Apply Firewall Changes**. When their
    contract ends, run **Apply Firewall Changes** again against plain
    `users.csv` (uncheck **Use custom CSV file**, or just click
    **Apply Firewall Changes** without checking it) to drop their
    access — no need to hand-edit `users1.csv` back out or remember
    which rows were theirs.

The **Edit users.csv** / **Edit Custom CSV** / **Edit conf file** buttons
load the file into a text box in place of the output pane, with **Save
Changes** and **Cancel** buttons. Saving writes the file directly — it does
not apply firewall changes by itself; use **Apply Firewall Changes** below
for that. **Edit Custom CSV** reads the path field fresh each time you
click it, so it always edits whatever file is currently typed in
**Compare Current vs Planned Rules** — change that field first if you want
to edit a different file.

Saving from **Edit users.csv** or **Edit Custom CSV** doesn't touch the
live firewall by itself — you still need **Apply Firewall Changes**
below, and each save button sets up the Apply section for exactly the
file you just saved, so there's nothing to retype and no stale state left
over from an earlier edit:

- **Edit users.csv** — saving unchecks **Use custom CSV file** (in case
  it was left checked from an earlier custom-CSV edit), then pops up a
  reminder to click **Apply Firewall Changes**.
- **Edit Custom CSV** — saving checks **Use custom CSV file** and fills
  its path field with the exact file just saved, then pops up a reminder
  naming that path, so **Apply Firewall Changes** is one click away with
  no manual checkbox/path matching required.
- **Apply Firewall Changes** itself clears **Use custom CSV file** again
  once it succeeds, so that state doesn't carry over to the next apply —
  the next Edit users.csv/Edit Custom CSV save is what sets it correctly
  for whichever file you edit next.

**Edit conf file** doesn't do any of this, since
`/etc/haas-firewall.conf` isn't a rules file `configure_ufw_from_csv.sh`
reads.

!!! note "Save Changes validates the CSV first"
    **Edit users.csv** and **Edit Custom CSV** both check every row before
    writing anything, mirroring exactly what `configure_ufw_from_csv.sh`
    itself parses — the header line is always skipped, and each remaining
    non-blank row must be `name,ip_address,role`:

    - **name** — letters, numbers, underscore, and hyphen only
    - **ip_address** — a valid IPv4 dotted-quad (each octet 0–255)
    - **role** — `Administrator` or `user` (case-insensitive, matching how
      the script itself compares it — any other value becomes an
      `UNKNOWN ROLE` line that's silently skipped when rules are applied)

    If any row fails, nothing is written — a popup names exactly which line
    and why, and the editor box stays open with your edits intact so you
    can fix it and click **Save Changes** again. **Edit conf file** has no
    such check, since `/etc/haas-firewall.conf` isn't row-structured data.

    Whitespace around a field (e.g. `mike, 192.168.10.20,user`) is stripped
    from what's actually saved, not just ignored during the check —
    `configure_ufw_from_csv.sh` itself does no trimming of its own, so a
    stray space that merely *passed* validation would otherwise still
    reach it verbatim and fail there instead.

## Output pane

Every command's output streams into the box below **Simulate / Compare**.
Click **Clear Output** at any time to reset it. It sits directly under
the read-only Simulate/Compare buttons on purpose, so results are visible
without scrolling past the less-frequently-used **Rollback** section —
Rollback lives at the very bottom of the page for that reason.

## Apply Firewall Changes

!!! warning "Makes persistent changes"
    Everything above this section is read-only. This section actually
    rewrites the firewall.

- **Reset Firewall Only** — runs `ufw reset`, deleting all custom rules.
  Asks for confirmation first.
- **Apply Firewall Changes** — runs `configure_ufw_from_csv.sh` against
  `users.csv` (or a custom CSV path, if you check **Use custom CSV file**
  and provide one). Checking that box pre-fills the path field with
  `/home/haas/Haas_Data_collect/users1.csv` as a starting point — the
  usual convention alongside the default `users.csv` — as long as the
  field is still empty; it won't overwrite a path you've already typed.
  Asks for confirmation, **naming exactly which CSV file it's about to
  use** (`users.csv`, or your custom path) so you're not confirming
  blind — then checks that file actually exists before touching
  anything; if it doesn't, the firewall is left untouched and you get an
  error instead.

Both buttons refresh **Active Firewall Rules** immediately once the
command actually finishes, rather than waiting on the dashboard's normal
2-second polling — since these are exactly the two actions that change
what rules exist, they shouldn't leave the dashboard above showing stale
state even briefly.

## Rollback Firewall Rules from a Backup

Every time the firewall config is applied, a timestamped copy of the CSV is
saved to the `BACKUP_DIR` configured in `/etc/haas-firewall.conf`. This
section is deliberately last on the page — it's a recovery tool you'll
reach for far less often than Simulate/Compare or Apply Firewall Changes.

1. Click **List Backups** to populate the dropdown from that directory.
2. Selecting a backup previews its contents in the output pane and fills
   in the filename field.
3. Click **Rollback CSV** to run `rollback_csv.sh` against that backup.

**Rollback CSV** only restores the file — like the CSV editors above, it
doesn't touch the live firewall by itself. Since `rollback_csv.sh` always
restores into the same fixed CSV path (never a custom one), a successful
rollback unchecks **Use custom CSV file** and pops up a reminder to click
**Apply Firewall Changes**, exactly like saving from **Edit users.csv**.
