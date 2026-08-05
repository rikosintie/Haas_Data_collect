# Network Deployment: DHCP, DNS, and a Stable Network Identity

----------------------------------------------------------------

This page covers the network-side setup that should happen alongside — or
just before — deploying the appliance: a DHCP reservation, a DNS entry,
and (if you're on Ubuntu Server) locking the appliance down to a single,
static network interface. None of this is required for the appliance to
function, but it's cheap to do at deployment time and expensive to
retrofit later once the appliance is in production and machines are
depending on its IP.

----------------------------------------------------------------

## Why register the appliance in DNS

Every device on a network should be identifiable *as* something, not just
as an IP address in a log. This isn't specific to the appliance — it's
worth doing for every non-server device (workstations, printers, access
points, PLCs, this appliance) for the same reason: **a secure network is
one where IT/SOC knows about every device on it.** A device with a real
DNS name and a documented DHCP reservation is a known, expected asset. An
address with no name, no reservation, and no record of why it's there is
exactly what a security audit or incident investigation flags as
suspicious first — see [Network Visibility (LLDP)](../manage_the_appliance/lldp.md)
for the same principle applied to LLDP.

It also matters for **Network Access Control (NAC)** systems — Aruba
ClearPass, Cisco ISE, PacketFence, and similar — which try to profile and
classify every device that shows up on the network. A DHCP reservation
with a real name, and a matching DNS entry, gives these systems (and any
human reading their logs) something concrete to match the appliance
against, instead of an anonymous MAC address that has to be manually
investigated every time it reappears in a report.

**Do this at initial deployment**, alongside creating the DHCP
reservation: a DNS entry using the appliance's actual hostname (`haas`,
or whatever you set it to in [Installation](./installing_ubuntu.md#installation)),
so `ssh haas.yourdomain.local` or `https://haas.yourdomain.local:9090`
works the same way `haas.pu.pri` does in the screenshots throughout this
documentation — instead of everyone who manages the appliance needing to
remember a bare IP address.

----------------------------------------------------------------

## Creating a DHCP reservation (Windows DHCP Server)

1. Open the **DHCP** console (`dhcpmgmt.msc`), expand the scope the
   appliance's IP falls in, and find the appliance's current lease under
   **Address Leases** — or open **Reservations** directly if you already
   know its MAC address (find it from the appliance itself with
   `ip link show` or from Cockpit's per-page network info line, see
   [Network info on every extension page](../manage_the_appliance/manage_intro.md#network-info-on-every-extension-page)).
2. Right-click the lease (or right-click **Reservations** → **New
   Reservation...**) to open the **New Reservation** dialog. Fill in:
      - **Reservation name** — a real, identifiable name, e.g.
        `haas-appliance` or `Haas CNC Data Collection Appliance`
      - **IP address** — the address to reserve (the appliance's current
        IP, so nothing changes for it)
      - **MAC address** — the appliance's MAC (without hyphens)
      - **Description** — free text; use it for anything a helpdesk
        tech or auditor would want to know at a glance, e.g. *"Haas CNC
        data collection appliance — Cockpit :9090, SMB share \\haas\Haas
        — contact: <your IT contact>"*
      - **Supported types** — leave as **Both**, unless your environment
        has a specific reason to restrict to DHCP-only or BOOTP-only
3. Click **Add**, then **Close**.

The reservation guarantees the appliance keeps the same IP across
reboots and lease renewals without needing a static IP configured on the
appliance itself — useful if you're not ready to commit to the static-IP
setup below yet.

----------------------------------------------------------------

## Creating a DNS entry (Windows DNS Server)

1. Open **DNS Manager** (`dnsmgmt.msc`), expand your forward lookup zone,
   right-click it, and choose **New Host (A or AAAA)...**
2. Fill in:
      - **Name** — the appliance's hostname, e.g. `haas`
      - **IP address** — the same IP used in the DHCP reservation above
      - Leave **Create associated pointer (PTR) record** checked, so
        reverse lookups (IP → name) work too — this is what makes the
        appliance's IP show up as a real name in firewall/switch logs
        instead of a bare address
3. Click **Add Host**.

!!! note "There's no \"Description\" field on the DNS record itself"
    Unlike the DHCP reservation above, Windows DNS's **New Host** dialog
    has no description or comment field — that's just not part of what a
    standard DNS A record stores. If you want documentation attached to
    the DNS entry specifically, the two practical options are a
    descriptive hostname itself (e.g. `haas-cnc-appliance` instead of
    just `haas`), or relying on the DHCP reservation's **Description**
    field as the actual documentation, since the two are usually created
    together and reference the same device. Don't take a "Description"
    field for DNS host records at face value if you see it referenced
    elsewhere — verify against your actual DNS Manager version before
    relying on it.

----------------------------------------------------------------

## Locking down to a single interface (Ubuntu Server)

The Cockpit extensions on this appliance show a warning when both
Ethernet and Wi-Fi are active at the same time — see
[Network info on every extension page](../manage_the_appliance/manage_intro.md#network-info-on-every-extension-page).
If you've decided which interface the appliance will actually use in
production (almost always Ethernet — more reliable, and one less radio
to secure), disable the other one at the OS level so it can't
accidentally come back up after a reboot or a netplan re-apply.

Static IP configuration itself is already covered in
[Static IP address](./installing_ubuntu.md#static-ip-address) — the
steps below assume you've already done that and are hardening the
result for production.

### Disable Wi-Fi

Removing the Wi-Fi interface from netplan's config only stops netplan
from *configuring* it — the radio itself can still associate with a
network on its own. The reliable way to actually disable it is at the
kernel/radio level with `rfkill`, independent of netplan entirely:

```bash linenums='1' hl_lines='1'
sudo rfkill block wifi
```

`rfkill` persists across reboots on Ubuntu (it's backed by
`systemd-rfkill`), so this survives a restart without needing any
netplan changes. Verify with:

```bash hl_lines='1'
rfkill list
```

```bash title='Command Output'
0: phy0: Wireless LAN
        Soft blocked: yes
        Hard blocked: no
```

To re-enable it later (e.g. for troubleshooting): `sudo rfkill unblock wifi`.

### Disable IPv6

[Use IPv6](./installing_ubuntu.md#use-ipv6) covers using IPv6 link-local
addressing for zero-touch *initial* provisioning — genuinely useful
before the appliance has an IPv4 address at all. In production, though,
an address family nothing on the shop floor uses is just extra attack
surface with no offsetting benefit — the same "minimize attack surface"
reasoning covered in
[Section 1, Security Objectives](../appendices/appendix-c.md#1-security-objectives).

In your netplan YAML (see [Static IP address](./installing_ubuntu.md#static-ip-address)
for the file location and general structure), three separate settings
are needed to actually turn IPv6 off — each closes a different way an
address can still show up:

```bash linenums='1' hl_lines='7 8 9'
network:
  version: 2
  renderer: networkd
  ethernets:
    eth0:
      dhcp4: no
      dhcp6: false
      accept-ra: false
      link-local: []
      addresses:
        - 192.168.1.100/24
      routes:
        - to: default
          via: 192.168.1.254
      nameservers:
        addresses:
          - 192.168.10.222
          - 192.168.1.222
```

- `dhcp6: false` — stops the interface from requesting an address via DHCPv6
- `accept-ra: false` — ignores IPv6 Router Advertisements, so a router on
  the network can't trigger SLAAC into assigning a global IPv6 address
  even with DHCPv6 off
- `link-local: []` (empty list) — stops even the `fe80::/10` link-local
  address from being assigned, which neither of the above two prevents
  on its own

Apply the same way as any other netplan change:

```bash hl_lines='1-3'
sudo netplan generate
sudo netplan try
sudo netplan apply
```

Verify no IPv6 addresses remain on the interface:

```bash hl_lines='1'
ip -6 addr show eth0
```

No output (besides possibly the interface line itself with no `inet6`
entries) confirms IPv6 is fully disabled on that interface.
