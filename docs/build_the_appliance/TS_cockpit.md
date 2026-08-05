# Troubleshooting cockpit

----------------------------------------------------------------

![screenshot](../build_the_appliance/img/cockpit-ts.png)

## The firewall

----------------------------------------------------------------

![screenshot](../appendices/img/tux-firewall-dash.png)

----------------------------------------------------------------

The extension `Privacy Badger` will cause the:

- Accounts
-Services

Pages to flash constantly. If this occurs, click on the `Privacy Badger` and then click "Disable for this site"

The web console in `Developer tools` is useful for troubleshooting Cockpit. While the cockpit homepage is displayed (`https://localhost:9090` or `https://[appliance_ip:9090]`) press F12 to view the developer tools. The click on `console` to view real time messages.

So we can now eliminate:

permissions

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

Use the `namei - follow a pathname until a terminal point is found` tool to view all the permissions. One advanatege of `namei` is that it shows you the entire path.

```bash hl_lines='1'
/usr/share/cockpit/haas-firewall ⌚ 18:34:28
$ namei -l /usr/share/cockpit/haas-firewall
f: /usr/share/cockpit/haas-firewall
drwxr-xr-x root root /
drwxr-xr-x root root usr
drwxr-xr-x root root share
drwxr-xr-x root root cockpit
drwxr-xr-x root root haas-firewall

----------------------------------------------------------------
```

``` bash
┌─[haas@haas] - [/usr/share/cockpit/haas-firewall] - [2875]
└─[$] cat -p manifest.json
```

```bash title='Command Output'
{
    "version": 2,
    "name": "haas-firewall",
    "label": "Haas Firewall",
    "icon": "icon.png",
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

## LLDP

Link Layer Discovery Protocol (LLDP) is an IEEE standard that comes installed on a majority of networking appliances. This appliance uses the [lldpd: implementation of IEEE 802.1ab (LLDP)](https://github.com/lldpd/lldpd) from GitHub. The tool is useful when you are connecting the appliance to a network and want to know what it is connected to over Ethernet or WiFI.

!!! Note
    lldpd also implements CDP (Cisco Discovery Protocol), FDP (Foundry Discovery Protocol), SONMP (Nortel Discovery Protocol) and EDP (Extreme Discovery Protocol). However, recent versions of IOS should support LLDP and most Extreme stuff support LLDP. When a EDP, CDP or SONMP frame is received on a given interface, lldpd starts sending EDP, CDP, FDP or SONMP frame on this interface. Information collected through EDP/CDP/FDP/SONMP are integrated with other information and can be queried with lldpcli or through SNMP.

The `lldp` daemon has a lot of capabilities beyond just showing what the appliance is directly connected to. We are only going to use:

- show neighbor - if the device the appliance is connected to supports lldp, you will see a lot of information. LLDP is a layer 2 tool so only directly connected devices will be shown.
- show interface - shows the interfaces on the appliance.
- show chassis - lists information about the Operating System, and capabilities

Start the user interface by running `lldpcli`. You can then type `help` to see the category of commands available. Once you enter a category you can type a question mark `?` to get more hel.

[lldpcli] $ help

-- Help
      show  Show running system information
     watch  Monitor neighbor changes
      help  Get help on a possible command
     pause  Pause lldpd operations
    resume  Resume lldpd operations
      exit  Exit interpreter

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
