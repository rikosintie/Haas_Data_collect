# Which version of Ubuntu should you use

Ubuntu comes in three versions for the Raspberry Pi 5:

- Server - No desktop.
- Desktop - Includes the Gnome desktop
- Core - A dedicated version for IoT devices. I haven't used it yet, but it's on my list of projects!

**Server version (Headless)**

I am experienced with Ubuntu, and this is a personal device, so the headless server version is my choice. I use SSH to manage the appliance, and the scripts don't require the Gnome desktop. The server uses less RAM and resources since it doesn't run a desktop. You can still connect a monitor and keyboard, but you have to use terminal-only tools. I recommend purchasing the serial console cable. It allows you to configure the Pi from your laptop if the Pi didn't get an IP address.

**Desktop Version**
If you are new to Linux and building appliances, use the desktop version. During the installation, select "minimal install" since you don't need a word processor, spreadsheet, etc. The desktop version of Ubuntu uses the GNOME desktop, which is similar to a Windows desktop. You can use a Keyboard, Mouse, and Monitor (KVM) to configure the Pi using GUI tools like Gnome Text Editor. This allows you to use a GUI text editor and other GUI tools.

The other advantage is that you can register with Canonical for Ubuntu Pro at $25/year vs $300/year for the server version.

----------------------------------------------------------------

## Installation

Once you pick a version, follow these instructions to install:

- [Raspberry Pi 5 with NVMe](https://wolfpaulus.com/rp5/)
- [Install Ubuntu Server on Raspberry Pi 5 with NVMe SSD (Headless Setup)](https://wolfpaulus.com/rp5-ubuntu-cli/)

### Use IPv6

If you don't mind learning a little IPv6, you can SSH to the Pi over IPv6 even if it doesn't have an IPv4 address.

If you followed the instructions above, add this to the netplan yaml file

network:
  version: 2
  ethernets:
    eth0:
      dhcp4: true
      optional: true
      dhcp6: true

Use the following to find the IPv6 address:

```bash hl_lines="1"
ip a show dev eth0
```

2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast state UP group default qlen 1000
    link/ether 88:a2:9e:43:4d:de brd ff:ff:ff:ff:ff:ff
    inet 192.168.10.137/24 metric 100 brd 192.168.10.255 scope global dynamic eth0
       valid_lft 28463sec preferred_lft 28463sec
    inet6 fe80::8aa2:9eff:fe43:4dde/64 scope link
       valid_lft forever preferred_lft forever

The `fe80::8aa2:9eff:fe43:4dde` is an IPv6 `link local` address. It's similar to an IPv4 APIPA, but it's the same every time the device starts up. It is created using the EUI-64 format, which is based on the 48-bit MAC address.

!!! Note
    The EUI-64 (Extended Unique Identifier) format is a 64-bit interface identifier used in IPv6 to automatically generate host addresses from a 48-bit MAC address. This process involves splitting the MAC address, inserting FFFE in the middle, and flipping the 7th bit (universal/local bit) of the first byte.

### To ssh to this address

macOS wireless interface en0

```bash
ssh haas@fe80::8aa2:9eff:fe43:4dde%en0
```

Linux with wireless interface wlp61so

```bash
ssh haas@fe80::8aa2:9eff:fe43:4dde%wlp61s0
```

Windows
Use

```text
netsh interface ipv6 show interfaces
```

```bash title='Command Output'
Idx     Met         MTU          State                Name
---  ----------  ----------  ------------  ---------------------------
  5          25        1500  connected     Ethernet
 12          25        1500  connected     Wi-Fi
```

Now use:

```text
ssh haas@[fe80::8aa2:9eff:fe43:4dde%5]
```

As always, Windows uses a non-standard method for an industry standard🙁.

----------------------------------------------------------------
