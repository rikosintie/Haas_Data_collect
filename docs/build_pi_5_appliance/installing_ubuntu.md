# Which version of Ubuntu should you use

Ubuntu comes in three versions for the Raspberry Pi 5:

- Server - No desktop.
- Desktop - Includes the Gnome desktop
- Core - A dedicated version for IoT devices. I haven't used it yet, but it's on my list of projects!

## Server version (Headless)

I am experienced with Ubuntu, and this is a personal device; the headless server version is my choice. I use SSH to manage the appliance and the scripts don't require the Gnome desktop. The server uses fewer resources since it doesn't run a desktop.

You can connect a monitor and keyboard, but you still use terminal-only tools since the desktop isn't installed. To copy files off the server to another PC, you can use SCP. On WIndows, the popular `putty` application has an SCP client. I recommend purchasing the serial console cable. It allows you to configure the Pi from your laptop if the Pi doesn't have an IP Address.

----------------------------------------------------------------

## Desktop Version

If you are new to Linux and building appliances, use the desktop version. The desktop version of Ubuntu uses the GNOME desktop, which is similar to a Windows desktop. It includes LibreOffice Calc (spreadsheet), allowing you to manage the firewall configuration file from the appliance.

With the desktop version, you can use a keyboard, mouse, and monitor (KVM) to configure the Pi using GUI tools like Gnome Text Editor, File Manager, Local Send, etc. [Local Send](https://localsend.org/) is a free, open-source Flatpak app that allows you to move files between two systems. It supports Windows, Mac, Linux, Android, and iOS.

The other advantage is that you can register with Canonical for Ubuntu Pro at $25/year vs. $300/year for the server version. The Ubuntu Pro is a great deal. You get automatic updates and most do not require a reboot. The appliance will stay patched for at least one quarter with no user intervention.

----------------------------------------------------------------

## Installation

During the installation:

- Use `haas` as the username, all lowercase, and use a simple password that you can type with both hands on the keyboard. You will be typing the password a lot during the creation of the appliance.
- Use `haas` as the hostname, all lowercase. You can use anything, but the examples use `haas`.

The code in the rest of the setup expects the username to be haas, which creates a home directory at /home/haas, used in all the examples in the guide. When the appliance is ready for production, change the password to a long and complex password. Save it in a password manager so that you don't forget it.

Once you have decided on a version, follow these instructions to complete the installation. The instructions are from the Wolf Paulus blog, he does a great job, and I didn't see that I could do any better!

Regardless of which version you want for production, install the desktop version of Raspberry Pi OS for the first step.

- [Raspberry Pi 5 with NVMe](https://wolfpaulus.com/rp5/)
- [Install Ubuntu Server on Raspberry Pi 5 with NVMe SSD (Headless Setup)](https://wolfpaulus.com/rp5-ubuntu-cli/)

!!! Note
    Read the instructions below before you do the install to the nvme drive.

----------------------------------------------------------------

### Copy files to a PC

You can copy the cmdline.txt, network-config, user-data files to a flash drive or use scp to a laptop.

To copy from the RPi to my laptop at 192.168.10.138

- scp /boot/firmware/user-data mhubbard@192.168.19.138:/home/mhubbard/Downloads
- scp /boot/firmware/network-config mhubbard@192.168.19.138:/home/mhubbard/Downloads
- scp /boot/firmware/cmdline.txt mhubbard@192.168.19.138:/home/mhubbard/Downloads

### Copy back to the Pi

- sudo scp mhubbard@192.168.19.138:/home/mhubbard/Downloads/user-data /mnt/nvfat
- sudo scp mhubbard@192.168.19.138:/home/mhubbard/Downloads/network-config /mnt/nvfat
- sudo scp mhubbard@192.168.19.138:/home/mhubbard/Downloads/cmdline.txt /mnt/nvfat

----------------------------------------------------------------

### Ubuntu is version 24.04.3 now

Below are updated links to `wget` 24.04.3.

Change to the home directory using `cd ~` before you run:

**Server installer**
`wget https://cdimage.ubuntu.com/releases/24.04.3/release/ubuntu-24.04.3-preinstalled-server-arm64+raspi.img.xz`.

**Desktop installer**
`wget https://cdimage.ubuntu.com/releases/24.04.3/release/ubuntu-24.04.3-preinstalled-desktop-arm64+raspi.img.xz`

----------------------------------------------------------------

### Change the shell to zsh

When the installation is complete and you have rebooted, follow these [instructions](https://rikosintie.github.io/Ubuntu4NetworkEngineers/terminal) to configure the terminal for ease of use. I wrote that procedure on Ubuntu 18.04 and have updated it as versions have changed. It will make your terminal use much easier.

----------------------------------------------------------------

### Static IP address

If you need to use a static IP address instead of DHCP, replace `/etc/netplan/91-nw-init.yaml` with this yaml file:

```bash linenums='1' hl_lines='1'
network:
  version: 2
  renderer: networkd
  ethernets:
    eth0:
      dhcp4: no
      dhcp6: true
      addresses:
        - 192.168.1.100/24
      routes:
        - to: default
          via: 192.168.1.1
      nameservers:
        addresses:
          - 8.8.8.8
          - 8.8.4.4
      parameters:
        stp: false
        forward-delay: 0
```

----------------------------------------------------------------

Use the following code to create a backup and then edit the yaml file:

```bash linenums='1' hl_lines='1'
cd /etc/netplan/
ls -l # look for a yaml file
sudo cp /etc/netplan/91-nw-init.yaml /etc/netplan/91-nw-init.bak
ls -l # look for the backup file
sudo nano /etc/netplan/91-nw-init.yaml
```

----------------------------------------------------------------

- Replace eth0 with the actual interface name (use ip link to find it, often eth0 or enp1s0 on Pi 5)
- Replace 192.168.1.100/24 with the desired static IP and subnet
- Replace 192.168.1.1 with the actual gateway IP
- Replace DNS servers (8.8.8.8, 8.8.4.4) with appropriate ones for the shop network
- The stp: false and forward-delay: 0 parameters disable Spanning Tree Protocol and reduce network startup delay

In general, do not use a public DNS server address. Your company security policy ***SHOULD*** require you to use their DNS Server or Proxy. Bypassing either could allow the appliance to contact a `control and command C2` server on the Internet without detection!

----------------------------------------------------------------

!!! Note
    The yaml file might not be named "91-nw-init.yaml" depending on the version you install. If that is the case, substitute the actual filename. The last time I installed the server version the file was named `50-cloud-init.yaml`.

Yaml is very particular about indentation. Ubuntu provides `netplan try` that will show any errors in the yaml file.

### Apply the configuration

```bash hl_lines='1'
# This is all you really need:
sudo netplan generate
sudo netplan try
sudo netplan apply
```

### Verify the configuration

```bash hl_lines='1-2'
ip addr show eth0
ip route show
```

### YAML Validation script

If you are doing a lot of changes to the yaml file you can use this script to automate the testing:

Change directory to `/etc/netplan` and open `nano`

```bash
cd /etc/netplan
sudo nano netplan-try.sh
```

Paste this into `nano`, save `ctrl+s`, exit `ctrl+x`

```bash
# Validate the configuration
echo "Validating network configuration..."
if sudo netplan generate; then
    echo "Configuration is valid!"
    echo ""
    echo "Testing network configuration with auto-revert..."
    echo "If the network configuration works, you'll be prompted to confirm."
    echo "If you don't confirm within 120 seconds, it will auto-revert."
    echo ""

    # Use netplan try for safe testing with auto-revert
    sudo netplan try

    echo "Network configuration completed!"
else
    echo "ERROR: Invalid netplan configuration!"
    echo "Restoring backup..."
    sudo cp "$BACKUP_FILE" "$NETPLAN_FILE"
    exit 1
fi
```

----------------------------------------------------------------

make the script executable
`sudo chmod +x netplan-try.sh`

run the script

`./netplan-try.sh`

----------------------------------------------------------------

## Show the processor

The Raspberry Pi uses `Advanced RISC Machine (ARM)` architecture vs the Intel x86 in your laptop. You can use the standard Linux command `List CPU - lscpu' to verify:

```bash linenums='1' hl_lines='1'
lscpu
```

```unixconfig title='Command Output'
Architecture:             aarch64
  CPU op-mode(s):         32-bit, 64-bit
  Byte Order:             Little Endian
CPU(s):                   4
  On-line CPU(s) list:    0-3
Vendor ID:                ARM
  Model name:             Cortex-A76
    Model:                1
    Thread(s) per core:   1
    Core(s) per cluster:  4
    Socket(s):            -
    Cluster(s):           1
    Stepping:             r4p1
    CPU(s) scaling MHz:   62%
    CPU max MHz:          2400.0000
    CPU min MHz:          1500.0000
    BogoMIPS:             108.00
```

----------------------------------------------------------------

### Linux List commands

You can get a list of all `ls` commands by typying `ls` and pressing `tab`. You can google or use `man lscommand` to see help on any ls command. Some useful `ls` commands:

- ls - list files in current directory
- lsattr - list file attributes on a Linux extended file system
- lsblk - list block storage devices line SD cards, USB Flash Drives, NVMEs.
- lsb_release - the `-a` option displays all information about a release.
- lshw - list hardware - A detailed list of installed hardware.
- lslocks - list local system locks
- lsof - list open files. example sudo lsof -i -n | grep localsend to see the PID and IPv4 info.
- lsusb - list all USB devices

----------------------------------------------------------------

procs - not an ls command but very userful - example `procs localsend` will show the `localsend` app's PID, CPU/Mem data, filepath

```bash linenums='1' hl_lines='1'
procs localsend
 PID:▲  User     │ TTY CPU MEM CPU Time │ Command
                 │     [%] [%]          │
 515639 mhubbard │     0.0 0.2 08:02:59 │ /snap/localsend/32/usr/share/localsend_app/localsend_app
```

----------------------------------------------------------------

## Use IPv6

If you don't mind learning a little IPv6, you can SSH to the Pi over IPv6 even if it doesn't have an IPv4 address.

If you followed the Paulus blog, add `dhcp6: true` to the netplan yaml file

```bash
network:
  version: 2
  ethernets:
    eth0:
      dhcp4: true
      optional: true
      dhcp6: true
```

Use the following to find the IPv6 address:

```bash hl_lines="1"
ip a show dev eth0
```

```unixconfig hl_lines="5" title='Command Output'
2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 qdisc pfifo_fast state UP group default qlen 1000
    link/ether 88:a2:9e:43:4d:de brd ff:ff:ff:ff:ff:ff
    inet 192.168.10.137/24 metric 100 brd 192.168.10.255 scope global dynamic eth0
       valid_lft 28463sec preferred_lft 28463sec
    inet6 fe80::8aa2:9eff:fe43:4dde/64 scope link
       valid_lft forever preferred_lft forever
```

The `fe80::8aa2:9eff:fe43:4dde` is an IPv6 `link local` address. It's similar to an IPv4 APIPA, but it's the same every time the device starts up. It is created using the EUI-64 format, which is based on the 48-bit MAC address.

----------------------------------------------------------------

!!! Note
    The EUI-64 (Extended Unique Identifier) format is a 64-bit interface identifier used in IPv6 to automatically generate host addresses from a 48-bit MAC address. This process involves splitting the MAC address, inserting FFFE in the middle, and flipping the 7th bit (universal/local bit) of the first byte.

What flipping the 7th bit looks like:

```bash linenums='1' hl_lines='1'
10001000 → 10001010
                 ^
                flipped b7
88 → 8A
```

----------------------------------------------------------------

### How to ssh to this IPv6 address

**macOS wireless interface en0**
Use the following command to ssh from a MacBook:

```bash
ssh haas@fe80::8aa2:9eff:fe43:4dde%en0
```

**Linux with wireless interface wlp61s0**
Use the following command to ssh from a Linux laptop:

```bash
ssh haas@fe80::8aa2:9eff:fe43:4dde%wlp61s0
```

**Windows**
Use these commands to ssh from a Windows laptop:

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

!!! Warning
    Windows Wi-Fi interface don't support `IPv6 Neighbor Discovery` reliably. If you want to use this method, connect your laptop to ethernet.

You can use the following command to see if the Raspberry Pi 5 is visble from a Windows machine:

```bash
netsh interface ipv6 show neighbors | Select-String "4dde"
```

As always, Windows uses a non-standard method for an industry standard🙁.

----------------------------------------------------------------

### IPv6 Link Local addresses

IPv6 link‑local + EUI‑64 is the industry standard for zero‑touch provisioning.
Switches, routers, firewalls, PDUs, storage arrays, OT gear — they all do it.

And Linux handles it flawlessly.

Windows is the outlier.

🧩 Why IPv6 link‑local + EUI‑64 is brilliant

- Every NIC has a MAC
- EUI‑64 turns that MAC into a deterministic IPv6 address
- You can derive the link‑local address instantly
- No DHCP
- No RA (IPv6 Router Advertisement)
- No SLAAC (Stateless Address Autoconfiguration)
- No guessing
- No APIPA garbage
- No vendor‑specific discovery tools
- No proprietary protocols
- No broadcast storms
- No “magic IP” like 192.168.1.1
- It’s elegant.
- It’s predictable.
- It’s universal.
- It’s how IPv6 was meant to be used.

----------------------------------------------------------------
