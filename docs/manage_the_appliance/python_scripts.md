# Python Script Services

----------------------------------------------------------------

The `haas-install.sh` installer sets up a dedicated Cockpit extension for
managing the `haas-*.service` systemd units that run the per-machine CNC
data-collection scripts — separate from the general **Updates - Logs**
page, since creating, editing, and troubleshooting these services is a
day-to-day task that has nothing to do with OS updates. Log into Cockpit
at `https://<appliance-ip>:9090` and look for **Python Scripts** in the
sidebar.

The line under the page title shows this appliance's current IPv4/MAC
per active network interface — see
[Network info on every extension page](./manage_intro.md#network-info-on-every-extension-page)
for what it means and why more than one active interface is flagged.

----------------------------------------------------------------

## Logs

**Scripts** streams the CNC machine-logger output (`journalctl -t
python3`) into the output pane, with optional **Machine** / **IP** /
**Port** text filters. **Stop** ends the stream. Changing any filter
while the stream is running automatically restarts it with the new
filter applied — no need to stop and re-click.

**Machine** matches every line's `[MACHINE]` prefix (e.g. `ST44`), which
`haas_logger2.py` includes on *every* message for that machine — not just
the ones that happen to mention its IP/port. Because of that, **Machine
wins outright over IP/Port** rather than combining with them: only the
very first "Attempting to connect" lines actually repeat the port number,
so an AND-combination would hide everything else (cycle detection, file
writes, etc.) the moment both were filled in. Filling in Machine greys
out IP/Port to make clear they're not being applied — clear Machine to
use IP/Port filtering instead.

Matching is always case-insensitive regardless of how you type it, since
the machine name's actual case in the log line (`ST44` vs `st30`, etc.)
isn't consistent across every service — it depends on how `--name` was
set when that particular service was created.

In this screenshot I am filtering the Python log from my laptop at
192.168.10.143:

----------------------------------------------------------------

![screenshot](./img/script-logs.resized.png)

----------------------------------------------------------------

## Services

Manages the `haas-*.service` systemd units that run the per-machine CNC
data-collection scripts. Every button here takes over the shared output
panel, cleanly stopping the Scripts log first if it's running — same as
clicking **Stop**. If the Scripts log is actively streaming when you
click one of them, a confirmation asks first, so a stray click doesn't
silently end a live view you were watching.

----------------------------------------------------------------

### Service State

Click **Service State** for a one-shot `systemctl list-unit-files`
summary of every `haas-*` service and its current state, followed by:

- a reminder that the unit files live in `/etc/systemd/system`
- the same IP/port/name breakdown as the `haas-ports` terminal alias,
  sorted by port number, with any **duplicate ports flagged** — two
  services both pointing `-t <ip> --port <port>` at the same address
  means one of them is very likely connecting to the wrong machine,
  which is exactly the kind of thing that shows up as "this CNC just
  isn't writing a CSV" with no obvious error to explain why. (Each
  `ExecStart` line is parsed by flag name, not position, so this stays
  correctly sorted and consistently formatted regardless of how many
  flags — `-u` included — precede `-t`/`--port`/`--name` on any given
  line.)
- a check for any CNC logger service (a `haas-*.service` whose
  `ExecStart` actually invokes `python3` — this deliberately excludes
  non-CNC units like `haas-firewall.service`, which isn't Python and
  isn't something helpdesk should be nudged to go touch) whose
  `ExecStart` is missing `python3 -u`, flagged as `[MISSING -u]`.
  Without `-u`, Python fully block-buffers stdout under systemd, so the
  script's own log lines can sit unflushed and never reach journald in
  real time — even though the service is running and writing data
  correctly (visible via **Data Freshness**, but invisible in the
  **Scripts** log). This is exactly the bug that makes a
  working-but-silent service so confusing to diagnose; this check turns
  it into an instant flag instead. **Create Service** already includes
  `-u` in every new unit — this catches services created before that,
  or by hand.
- a check for any CNC logger service missing `Restart=on-failure` (or
  `Restart=always`), flagged as `[MISSING Restart=on-failure]`. Without
  it, if `haas_logger2.py` crashes on an unhandled exception, the
  service just dies and stays dead — no automatic recovery — until
  someone happens to notice and restarts it by hand. Queried live via
  `systemctl show`, so it reflects the actually-loaded config rather
  than depending on the unit file spelling the directive one specific
  way.
- a check for any CNC logger service currently stuck in systemd's
  `start-limit-hit` state, flagged as `[CRASH LOOP]`. Even with
  `Restart=on-failure` set, a service that crashes repeatedly in a tight
  loop (e.g. instant connection-refused) can exceed systemd's default
  restart-rate limit and stop retrying entirely — it looks like "just
  broken" rather than a crash loop unless you know to check for this
  specific state, and `Restart=` alone won't bring it back; it needs an
  explicit `sudo systemctl reset-failed <service>` (shown in the flagged
  output) before it will start again.
- a one-shot TCP reachability check (`nc -z`, 2s timeout) against each
  service's `-t <ip> --port <port>` — skipped for any machine that
  already has an established connection from its `python3` process, so a
  machine that's already connected and streaming is never touched a
  second time

The whole button is disabled for the duration of the run (including the
connectivity sweep, which can take a couple seconds per machine) so a
second click can't stack an overlapping sweep against the same targets.

Each of the six sections above is separated by a divider line, with its
`--- ... ---` header colored blue. Within each section, the all-clear
summary line (`No duplicate ports found.`, `All services use python3
-u.`, and so on) is green; anything flagged (`[DUPLICATE PORT]`,
`[MISSING -u]`, `[MISSING Restart=on-failure]`) is amber; `[CRASH LOOP]`
is red, since a service stuck there has already stopped retrying
entirely rather than just having a configuration smell. In the
connectivity check, `reachable` and `already connected` are green, and
`not reachable` is blue rather than red or amber — matching the note
above that it isn't necessarily a problem.

!!! note "\"Not reachable\" isn't always a problem"
    This check is deliberately only run here, on demand, and not
    automatically right after Create Service. During initial deployment
    it's common for services to be created before the machine shop has
    configured the actual CNC to connect on that port — in that window,
    every machine will correctly show "not reachable," and that's normal,
    not an error. Run **Service State** once you expect the machines to
    actually be talking; a machine that stays unreachable at that point is
    worth investigating (wrong IP/port, firewall, machine powered off,
    network issue) — one that was never expected to be connected yet
    isn't.

!!! warning "Why the connectivity check skips already-connected machines"
    Some CNC control network stacks are minimal enough to only accept one
    connection at a time. Probing a machine that already has an active,
    established connection from `haas_logger2.py` risks contending with —
    or on a sufficiently limited stack, even displacing — that real
    connection, purely because of the diagnostic check itself. Skipping
    already-connected machines avoids that risk entirely; only machines
    that aren't currently connected get probed.

----------------------------------------------------------------

### Edit Services

1. Click **Edit Services**, then pick a unit file from the dropdown that
   appears. Entries are listed by machine name only (`st30`, not
   `haas-st30.service`) — the `haas-` prefix and `.service` suffix are
   dropped from the label (not the underlying file, just what's shown),
   so with a lot of machines, typing e.g. `s` jumps straight to `st10y`/
   `st30`/`st40`/etc. using the browser's own type-ahead, instead of
   every option starting with the same "haas-" text.
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
    - Port must be an integer between 5001 and 5099 (Haas's recommended TCP/IP port range)
- Once validated, it writes `/etc/systemd/system/haas-<machine>.service`,
  creates the machine's working directory under
  `/home/haas/Haas_Data_collect/machines/<machine>`, then runs
  `daemon-reload`, `enable`, and `start` for the new service — the output
  pane shows each step, ending with `systemctl status` for the new
  service, followed by the same IP/port/name breakdown (with duplicate
  ports flagged) shown by **Service State** — a quick way to catch a
  copy-pasted port before it causes a silent connection mix-up.

!!! note "Why the template uses `python3 -u`"
    The `-u` flag forces unbuffered stdout. Without it, Python fully
    block-buffers output whenever stdout isn't a real terminal — which is
    exactly the case under systemd, where stdout goes to journald through
    a pipe. That means `haas_logger2.py`'s own log lines (`End of cycle
    detected!`, `Data appended to: ...`, etc.) can sit invisible in the
    buffer well after the corresponding CSV write has actually completed
    on disk — a one-off message has nothing to push it over the flush
    threshold, so it may never show up in the **Scripts** log at all,
    even though the data was received and saved correctly (visible via
    **Data Freshness**). `-u` isn't a logging feature you have to add;
    the log lines already exist in the script — it just makes sure they
    reach journald promptly instead of sitting buffered.

    `-u` only changes *when* each `print()` is flushed (immediately,
    instead of batched until the buffer fills) — not how much work is
    done. It costs one extra `write()` syscall per log line instead of
    amortizing several into one, which is negligible next to the network
    and file I/O each logger is already doing per cycle. Verified on a
    Raspberry Pi 5 running all 11 machines simultaneously with `-u`
    everywhere: load average 0.13, well under 2% CPU total.

!!! note "Why the template uses `Restart=on-failure` and `RestartSec=5`"
    Without `Restart=on-failure`, a service that crashes on an unhandled
    exception just dies and stays dead — no automatic recovery — until
    someone happens to notice and restarts it by hand. This is exactly
    what **Service State**'s `[MISSING Restart=on-failure]` check flags.
    `RestartSec=5` adds a 5-second pause before each restart attempt,
    rather than retrying instantly — for a persistent failure (e.g. a
    permanently wrong IP) that gives a little more breathing room before
    systemd's default restart-rate limit trips into `start-limit-hit`
    (flagged separately by Service State's `[CRASH LOOP]` check), though
    a truly persistent failure will still hit it eventually — that's
    the point of the check, not a bug in this setting.

----------------------------------------------------------------

### Delete Service

Pick a unit file from the dropdown after clicking **Delete Service**.
Confirms first (**"This cannot be undone"**, and calls out that the
machine's data directory under
`/home/haas/Haas_Data_collect/machines/` will **not** be deleted), then
stops, disables, and removes the unit file, followed by `systemctl
daemon-reload`.

----------------------------------------------------------------

### Data Freshness

Click **Data Freshness** for a one-shot list of when each machine under
`/home/haas/Haas_Data_collect/machines/` last wrote a CSV file — the
newest file in that machine's `cnc_logs/` directory, however logging was
set up (append mode or per-cycle files, it just checks modification
time).

The list is sorted **oldest first**, so a machine that's silently stopped
producing data floats straight to the top instead of only being noticed
whenever someone happens to go looking for it. A machine directory with
no `cnc_logs/` yet (e.g. a service that's never completed a cycle) or an
empty one is called out the same way, right alongside the rest.

This doesn't tell you *why* a machine stopped writing — pair it with
**Service State**'s IP/port/duplicate check and the **Scripts** log
above to see whether it's a connection problem, a wrong/duplicate port,
or something else. Or just click **Machine Health** below, which answers
all of that in one table.

----------------------------------------------------------------

### Machine Health

Click **Machine Health** for a single table — one row per machine —
combining everything the other buttons above report separately:

| Column | Source |
|---|---|
| Machine | unit filename / working directory name |
| Port | from `ExecStart`, sorted ascending |
| Dup | `DUP` if another machine shares this port |
| `-u` | `OK` / `MISSING` |
| Connectivity | reachable / not reachable / already connected |
| Data Age | newest file in `cnc_logs/`, or "no data files found" |

It's built by running the exact same four checks **Service State** and
**Data Freshness** already run — nothing new is computed, this just
joins their output into one table instead of leaving you to
cross-reference three separate blocks of text by machine name yourself.
Matching machines across the four is case-insensitive, since a unit's
`--name` can be any case (`ST44`) while its working directory is always
lowercase (`st44`) — both refer to the same machine.

Since it includes the same connectivity sweep Service State runs, it
takes the same several seconds and locks the page the same way, for the
same reason (no overlapping probes against the same targets). This is
meant for an occasional full check, not something to click repeatedly —
Data Freshness alone is instant if all you need is "did data arrive
recently."

Here is what Machine Health looks like:

----------------------------------------------------------------

![screenshot](./img/machine-health.png)

----------------------------------------------------------------

In this example there is:
- Machine v2fss appears to be turned off
- Seven machines are online and have received data in the last few minutes
- Machine 01_test has a `cnc_log` directory so it has connected, but no csv files have been created.
- Machine st40l has not connect to a machine yet. No cnc_logs directory has been created.
