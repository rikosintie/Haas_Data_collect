# Troubleshooting the Appliance

----------------------------------------------------------------

![screenshot](../build_the_appliance/img/cockpit-ts.png)

## The firewall

----------------------------------------------------------------

![screenshot](../appendices/img/tux-firewall-dash.png)

----------------------------------------------------------------

The extension `Privacy Badger` will cause the:

- Accounts
- Services

Pages to flash constantly. If this occurs, click on the `Privacy Badger` and then click "Disable for this site"

The web console in `Developer tools` is useful for troubleshooting Cockpit. While the cockpit homepage is displayed (`https://localhost:9090` or `https://<appliance-ip>:9090`) press F12 to view the developer tools. Then click on `console` to view real time messages.

So we can now eliminate:

- permissions
- directory visibility
- manifest structure
- manifest encoding
- missing files
- browser cache
- stale routing
- wrong URL
- wrong HTML structure

----------------------------------------------------------------

```bash hl_lines='1'
┌─[haas@haas] - [/usr/share/cockpit/haas-firewall] - [2873]
└─[$] ls -ld /usr/share/cockpit
drwxr-xr-x 15 root root 4096 Jan 15 14:59 /usr/share/cockpit
```

----------------------------------------------------------------

Use the `namei - follow a pathname until a terminal point is found` tool to view all the permissions. One advantage of `namei` is that it shows you the entire path.

```bash hl_lines='1'
/usr/share/cockpit/haas-firewall ⌚ 18:34:28
$ namei -l /usr/share/cockpit/haas-firewall
f: /usr/share/cockpit/haas-firewall
drwxr-xr-x root root /
drwxr-xr-x root root usr
drwxr-xr-x root root share
drwxr-xr-x root root cockpit
drwxr-xr-x root root haas-firewall
```

----------------------------------------------------------------

``` bash
┌─[haas@haas] - [/usr/share/cockpit/haas-firewall] - [2875]
└─[$] cat -p manifest.json
```

```bash title='Command Output'
{
    "version": 2,
    "name": "haas-firewall",
    "label": "Haas Firewall",
    "requires": {
        "cockpit": "*"
    },
    "translation": false,
    "entry": "index",
    "menu": {
        "index": {
            "label": "Firewall Control",
            "order": 10,
            "category": "system"
        }
    }
}
```

----------------------------------------------------------------

## The "Software Updates" page doesn't work

Cockpit ships a built-in **Software Updates** page (separate from this
appliance's own custom **Updates - Logs** extension). On Ubuntu Server,
clicking it typically fails with an error like *"cannot refresh cache
whilst offline"* — even though the appliance is definitely online.

This isn't specific to this appliance; it's a known upstream interaction:
Cockpit's Software Updates page uses PackageKit, and PackageKit checks
**NetworkManager** to decide whether the system is online before it will
refresh the package cache. Ubuntu Server's default netplan renderer is
**`networkd`**, not NetworkManager — so PackageKit sees no
NetworkManager-managed connection and reports the system as offline,
regardless of actual connectivity. (Ubuntu *Desktop* defaults to
NetworkManager, which is why the same Cockpit page works fine there.)
See [cockpit-project/cockpit#22982](https://github.com/cockpit-project/cockpit/issues/22982).

**Don't use Cockpit's built-in Software Updates page on this appliance.**
Use **Updates - Logs** in the sidebar instead — it runs `apt`/`nala`
directly and doesn't depend on PackageKit or NetworkManager at all, so
this renderer mismatch never applies to it.

----------------------------------------------------------------

## A Cockpit extension change doesn't take effect

Every custom extension (`haas-firewall`, `haas-samba`,
`haas-update-appliance`, `haas-python`) lives in the repo as a
`cockpit_X/` source folder, but Cockpit never runs that folder directly —
it only serves whatever was copied to `/usr/share/cockpit/haas-X/` by
`haas-install.sh` at install time. Editing the repo (even `git pull`ing a
fix) changes nothing until that copy is redeployed by hand. This one
underlying gap shows up as several different-looking symptoms:

**1. Wrong deploy target.** Not every file in a `cockpit_X/` folder
deploys to the same place. For example, `cockpit_samba/list_shares.sh`
stays alongside `samba.js`/`samba.css`/`index.html` in the repo, but
`haas-install.sh` copies it separately to `/usr/local/sbin/`, not to
`/usr/share/cockpit/haas-samba/`. A fix to a file like that appears to do
nothing if you redeploy "the rest of the folder" and assume it went with
them. Check `haas-install.sh` for the file's actual `cp` destination
before assuming a redeploy covered it.

**2. Partial copy.** Redeploying only the file you remember changing
(e.g. just `.css`) instead of the full set (`.js`, `.css`, `index.html`,
`manifest.json`) leaves the others stale. A JS fix paired with an HTML
change — a new button, a renamed element ID — needs `index.html` copied
too, or the new JS will crash trying to attach a listener to an element
that doesn't exist yet: `Uncaught TypeError: Cannot read properties of
null (reading 'addEventListener')` in the browser console is the
signature of this one.

**3. `git pull` alone isn't enough.** This is the mirror image of #2 —
`git pull` updates the repo checkout (so `ls -la` on the repo folder
shows fresh timestamps and looks fully up to date) but does nothing to
the deployed copy under `/usr/share/cockpit/`. The `cp` step below still
has to be run by hand every time, even right after a clean pull.

**4. A prior click "locks in" old behavior.** If a fix changes what a
button does when clicked (for example, persisting a value to a config
file for a systemd timer to read later), redeploying the JS only changes
what happens on the *next* click. A click from before the redeploy still
ran the old code and produced its old, incomplete result — nothing
retroactively fixes that until the button is clicked again after the
redeploy.

**Diagnosing which one you're looking at:** compare the deployed file
against the repo copy directly, rather than guessing from symptoms alone:

```bash
grep -c "<new element id or code string>" /usr/share/cockpit/haas-X/index.html
ls -la cockpit_X/ /usr/share/cockpit/haas-X/
```

A `0` from `grep`, or an older timestamp on the deployed side than the
repo side, confirms the deploy is stale. Redeploy the full set and
restart Cockpit:

```bash
sudo cp cockpit_X/{index.html,haas-X.js,haas-X.css,manifest.json} /usr/share/cockpit/haas-X/
sudo systemctl restart cockpit
```

Then re-run whatever action you clicked before the fix, if it's the kind
that persists state (case #4 above) — the redeploy alone doesn't replay
it for you.

----------------------------------------------------------------

## `git pull` fails with "local changes would be overwritten"

Running `git pull` in the repo directory (`/home/haas/Haas_Data_collect`)
is how an appliance picks up software/documentation updates. It's a
normal, supported thing to do any time — not just during initial setup.

If it fails with something like:

```text
error: Your local changes to the following files would be overwritten by merge:
        users-a.csv
Please commit your changes or stash them before you merge.
```

the cause is that `users-a.csv`, `users-b.csv`, and `initial_users.csv`
ship as tracked starter templates, but every real appliance immediately
customizes them with its own usernames, IPs, and passwords — and git
sees that customization as a conflict with whatever the update changed
elsewhere in the repo.

**Appliances installed (or reinstalled) after this note was added don't
hit this** — `haas-install.sh` runs `git update-index --skip-worktree`
on all three files right after the pre-flight review step, which tells
git to stop comparing their working-tree contents against upstream
entirely. Your edits stay exactly as you made them, and `git pull` no
longer looks at those three paths at all.

If you're on an appliance that was set up before this fix, run it once
by hand from the repo directory:

```bash
git update-index --skip-worktree users-a.csv users-b.csv initial_users.csv
```

(Run this as the `haas` user, not root/sudo — running it as root would
leave `.git/index` root-owned and break ordinary `git` commands for the
`haas` user afterward.)

----------------------------------------------------------------

## A new machine connects and logs "End of cycle detected" but no CSV appears

If `journalctl` for a `haas-<machine>.service` shows a normal-looking
sequence — connected, part number detected, end of cycle detected — but
no CSV ever shows up in that machine's `cnc_logs/`, look for this
immediately after "End of cycle detected!":

```text
Error processing data from ('<ip>', <port>): [Errno 13] Permission denied: ...
```

The service runs as `User=haas`, and Create Service's `mkdir` for a new
machine's working directory runs as root (`superuser: "require"` in
Cockpit). Without an explicit fix afterward, that directory comes out
`root:HaasGroup` with root's default umask — readable, but not writable
by `haas` — so the connection, the parsing, and the "end of cycle"
detection all work fine, and only the actual file write silently fails.
It's easy to miss because nothing about the connection itself looks
broken.

**Confirm it directly:**

```bash
stat -c '%U:%G %A %n' /home/haas/Haas_Data_collect/machines/*
```

Every working directory should read `haas:HaasGroup` with mode
`drwxrwsr--`. Anything showing `root:HaasGroup`/`drwxr-sr-x` instead has
this exact problem.

**Fix it:**

```bash
sudo chown haas:HaasGroup /home/haas/Haas_Data_collect/machines/<machine>
sudo chmod 2774 /home/haas/Haas_Data_collect/machines/<machine>
sudo systemctl restart haas-<machine>.service
```

Create Service now runs this chown/chmod automatically right after
creating the directory, so this only affects machines created before
that fix — and the **Machine Health** button (`haas-python` extension)
has a **Dir Perms** column that flags any mismatch on sight, so it's no
longer necessary to dig through logs or run `stat` by hand to catch it.

----------------------------------------------------------------

## LLDP

Link Layer Discovery Protocol (LLDP) is an IEEE standard that comes installed on a majority of networking appliances. This appliance uses the [lldpd: implementation of IEEE 802.1ab (LLDP)](https://github.com/lldpd/lldpd) from GitHub. The tool is useful when you are connecting the appliance to a network and want to know what it is connected to over Ethernet or WiFI.

!!! Note
    lldpd also implements CDP (Cisco Discovery Protocol), FDP (Foundry Discovery Protocol), SONMP (Nortel Discovery Protocol) and EDP (Extreme Discovery Protocol). However, recent versions of IOS should support LLDP and most Extreme stuff support LLDP. When an EDP, CDP or SONMP frame is received on a given interface, lldpd starts sending EDP, CDP, FDP or SONMP frame on this interface. Information collected through EDP/CDP/FDP/SONMP are integrated with other information and can be queried with lldpcli or through SNMP.

The `lldp` daemon has a lot of capabilities beyond just showing what the appliance is directly connected to. We are only going to use:

- show neighbor - if the device the appliance is connected to supports lldp, you will see a lot of information. LLDP is a layer 2 tool so only directly connected devices will be shown.
- show interface - shows the interfaces on the appliance.
- show chassis - lists information about the Operating System, and capabilities

Start the user interface by running `lldpcli`. You can then type `help` to see the category of commands available. Once you enter a category you can type a question mark `?` to get more help.

```bash title='Command Output'
[lldpcli] $ help

-- Help
      show  Show running system information
     watch  Monitor neighbor changes
      help  Get help on a possible command
     pause  Pause lldpd operations
    resume  Resume lldpd operations
      exit  Exit interpreter
```

----------------------------------------------------------------

### Show commands

Start the user interface by running `lldpcli`

```bash hl_lines='2 3'
┌─[haas@haas] - [/usr/local/sbin] - [2868]
└─[$] lldpcli
[lldpcli] $ show ?
```

```bash title='Command Output'
-- Show running system information
            neighbors  Show neighbors data
           interfaces  Show interfaces data
              chassis  Show local chassis data
           statistics  Show statistics
        configuration  Show running configuration
running-configuration  Show running configuration
```

----------------------------------------------------------------

### Show Neighbors

```bash hl_lines='2 3'
┌─[haas@haas] - [/usr/local/sbin] - [2868]
└─[$] lldpcli
[lldpcli] $ show neighbor
-------------------------------------------------------------------------------
LLDP neighbors:
-------------------------------------------------------------------------------
Interface:    eth0, via: LLDP, RID: 1, Time: 0 day, 00:24:38
  Chassis:
    ChassisID:    mac f8:7b:20:34:a3:80
    SysName:      LAB_3850.pu.pri
    SysDescr:     Cisco IOS Software [Gibraltar], Catalyst L3 Switch Software (CAT3K_CAA-UNIVERSALK9-M), Version 16.12.3a, RELEASE SOFTWARE (fc1)
                  Technical Support: http://www.cisco.com/techsupport
                  Copyright (c) 1986-2020 by Cisco Systems, Inc.
                  Compiled Tue 28-Apr-20 09:25
    MgmtIP:       192.168.10.253
    MgmtIP:       fd24:42b2:12ce::3
    Capability:   Bridge, on
    Capability:   Router, on
  Port:
    PortID:       ifname Gi1/0/8
    PortDescr:    < RPi-appliance >
    TTL:          120
  Unknown TLVs:
    TLV:          OUI: 00,01,42, SubType: 1, Len: 1 01
-------------------------------------------------------------------------------
```

### show interfaces

```bash hl_lines='1'
[lldpcli] $ show interfaces
```

```bash title='Command Output'
-------------------------------------------------------------------------------
LLDP interfaces:
-------------------------------------------------------------------------------
Interface:    eth0
  Administrative status: RX and TX
  Chassis:
    ChassisID:    mac 88:a2:9e:43:4d:de
    SysName:      haas
    SysDescr:     Ubuntu 24.04.4 LTS Linux 6.8.0-1052-raspi #56-Ubuntu SMP PREEMPT_DYNAMIC Fri Mar 27 03:58:47 UTC 2026 aarch64
    MgmtIP:       192.168.10.132
    MgmtIface:    2
    MgmtIP:       fd24:42b2:12ce:0:8aa2:9eff:fe43:4dde
    MgmtIface:    2
    Capability:   Bridge, off
    Capability:   Router, off
    Capability:   Wlan, on
    Capability:   Station, off
  Port:
    PortID:       mac 88:a2:9e:43:4d:de
    PortDescr:    eth0
  TTL:          120
-------------------------------------------------------------------------------
Interface:    wlan0
  Administrative status: RX and TX
  Chassis:
    ChassisID:    mac 88:a2:9e:43:4d:de
    SysName:      haas
    SysDescr:     Ubuntu 24.04.4 LTS Linux 6.8.0-1052-raspi #56-Ubuntu SMP PREEMPT_DYNAMIC Fri Mar 27 03:58:47 UTC 2026 aarch64
    MgmtIP:       192.168.10.132
    MgmtIface:    2
    MgmtIP:       fd24:42b2:12ce:0:8aa2:9eff:fe43:4dde
    MgmtIface:    2
    Capability:   Bridge, off
    Capability:   Router, off
    Capability:   Wlan, on
    Capability:   Station, off
  Port:
    PortID:       mac 88:a2:9e:43:4d:df
    PortDescr:    wlan0
  TTL:          120
-------------------------------------------------------------------------------
```

----------------------------------------------------------------

### show chassis

```bash hl_lines='1'
[lldpcli] $ show chassis
```

```bash title='Command Output'
-------------------------------------------------------------------------------
Local chassis:
-------------------------------------------------------------------------------
Chassis:
  ChassisID:    mac 88:a2:9e:43:4d:de
  SysName:      haas
  SysDescr:     Ubuntu 24.04.4 LTS Linux 6.8.0-1052-raspi #56-Ubuntu SMP PREEMPT_DYNAMIC Fri Mar 27 03:58:47 UTC 2026 aarch64
  MgmtIP:       192.168.10.132
  MgmtIface:    2
  MgmtIP:       fd24:42b2:12ce:0:8aa2:9eff:fe43:4dde
  MgmtIface:    2
  Capability:   Bridge, off
  Capability:   Router, off
  Capability:   Wlan, on
  Capability:   Station, off
-------------------------------------------------------------------------------
```
