# Network Visibility (LLDP)

----------------------------------------------------------------

This page is for anyone who isn't a network engineer — MSP staff, helpdesk,
or shopfloor personnel — who needs to know what LLDP is, why the
appliance uses it, and how to check it without needing to already know
networking.

----------------------------------------------------------------

## What is LLDP?

LLDP (Link Layer Discovery Protocol) is a standard that lets network
devices announce themselves to whatever they're plugged into. Every
device running it — the appliance included — sends out a short "hello,
this is me" message every so often: its name, what kind of device it is,
and which port it's connected on. It listens for the same kind of message
back from the switch it's plugged into.

Think of it like a name tag every device wears on the network, instead of
being an anonymous cable running into a wall.

The appliance runs `lldpd` (installed automatically by `haas-install.sh`),
which handles this in the background — nothing to configure, nothing to
turn on. It's already running.

----------------------------------------------------------------

## Why does the appliance do this?

Two reasons, and they matter for two different people:

**1. It makes troubleshooting a "why can't I reach the appliance"
problem faster.** Instead of physically tracing a cable through the
ceiling or asking IT to go check, the appliance can tell you exactly
which switch and which port it's plugged into — see the example below.
That's often enough to spot the problem immediately (wrong port, wrong
switch, cable plugged into the wrong device) without a site visit.

**2. It makes the appliance a known, accounted-for device instead of a
mystery one.** Because the appliance announces itself, it shows up by
name in the switch's own neighbor table — visible to IT/SOC from their
side, independent of anything on the appliance itself. That matters more
than it might sound like:

!!! note "A secure network is one where IT/SOC knows about every device on it"
    When IT or a security team (SOC) finds a device on the network they
    don't recognize, that's treated as suspicious by default — it's
    exactly the kind of thing a security audit or incident investigation
    flags first. A self-announcing appliance never becomes that mystery
    device. It shows up with a real hostname, a real description, and a
    real switch port attached to it, the same way any other properly
    managed device on the network would.

----------------------------------------------------------------

## Checking it yourself

**Easiest way — no SSH, no terminal:** open [Firewall Control](./firewall.md)
and click **Show Network Neighbor**, in the Firewall Status Dashboard. That
runs `lldpcli show neighbors` for you and prints the result right there on
the page.

**From the terminal** (SSH, or the Cockpit **Terminal**), the same
command is available as a shortcut:

```bash
haas-lldp-neighbors
```

See [Terminal Aliases](./terminal_aliases.md#lldp-network-neighbor-discovery)
for the other `haas-lldp-*` shortcuts (interfaces, chassis, statistics) —
those aren't in Cockpit, so the terminal is still the way to reach them.
Either way, real output looks like this:

```text
Interface:    eth0, via: LLDP, RID: 1, Time: 0 day, 00:24:38
  Chassis:
    ChassisID:    mac f8:7b:20:34:a3:80
    SysName:      LAB_3850.pu.pri
    SysDescr:     Cisco IOS Software [Gibraltar], Catalyst L3 Switch Software (CAT3K_CAA-UNIVERSALK9-M), Version 16.12.3a, RELEASE SOFTWARE (fc1)
    MgmtIP:       192.168.10.253
    Capability:   Bridge, on
    Capability:   Router, on
  Port:
    PortID:       ifname Gi1/0/8
    PortDescr:    < RPi-appliance >
    TTL:          120
```

You don't need to understand most of this. The two lines that matter:

| Line | What it tells you |
|---|---|
| `SysName:      LAB_3850.pu.pri` | The name of the switch the appliance is plugged into |
| `PortID:       ifname Gi1/0/8` | The exact port on that switch |

If the appliance seems unreachable, that's the information to hand to
IT/SOC: *"the appliance is plugged into LAB_3850, port Gi1/0/8"* — instead
of *"it's somewhere in the server closet, I think."* It turns a physical
scavenger hunt into a two-line message.

!!! note "Only shows the directly connected device"
    LLDP only sees one hop — whatever the appliance's cable plugs directly
    into. It won't show you the whole network, just that first switch.
    That's normal, not a limitation worth worrying about — it's exactly
    the piece of information a physical trace would have given you
    anyway, just without leaving your desk.

----------------------------------------------------------------

## Want more detail?

[Troubleshooting: LLDP](../build_the_appliance/TS_cockpit.md#lldp) covers
the full `lldpcli` interactive tool directly (`show interfaces`,
`show chassis`, `show statistics`) for anyone who wants to go deeper than
the `haas-lldp-*` shortcuts on this page.
