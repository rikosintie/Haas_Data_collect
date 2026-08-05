# Managing the Appliance

----------------------------------------------------------------

![screenshot](./img/tux_ops.png)

----------------------------------------------------------------

The appliance is built on Ubuntu Linux for reliability and stability.

**What is Ubuntu Linux?**

Think of Ubuntu as an enterprise-grade operating system designed for bulletproof reliability and background services.

If you're coming from Windows, here is what you need to know about running the appliance on Ubuntu:

- Zero License Fees & Instant Setups: No Windows Activation keys, no sudden "Windows Update" reboots in the middle of a shift, and no telemetry bloat.

- Built-in Web Management (GUI): You don't need to be a command-line wizard. The appliance uses Cockpit, a browser-based dashboard that lets you manage disk space, network shares, firewalls, and updates visually—just like logging into a smart router or NAS device.

- Seamless Windows Integration: It uses standard Samba (SMB/CIFS) file sharing. To your Windows PCs and Haas machine controls, the appliance looks and acts just like a standard Windows Network Drive (\\APPLIANCE-IP\SHARE).

- Low Resource Overhead: It runs efficiently on light hardware (like a Raspberry Pi 5 or an older spare PC) without needing heavy system specs just to keep the OS running.

## Cockpit login page branding

`haas-install.sh` replaces Cockpit's stock login screen — which otherwise
just shows the bare OS name (e.g. "Ubuntu 24.04 LTS") — with a Tux-on-the-
shop-floor illustration as the background and "Haas CNC Data Collection
Appliance" as the title, so it's obvious at a glance which appliance
you've logged into.

This works by dropping a `branding.css` (plus the background image) into
`/usr/share/cockpit/branding/<os-id>/` — Cockpit's own supported branding
mechanism, not a patch to Cockpit itself, so it survives Cockpit updates.
`<os-id>` comes from `/etc/os-release` (`ubuntu` on this appliance), which
takes precedence over Cockpit's built-in default branding.

To change the background image later, replace
`docs/manage_the_appliance/img/tux_terminal1.resized.jpg` in the repo and
re-run `haas-install.sh` — or edit
`/usr/share/cockpit/branding/ubuntu/branding.css` directly on the
appliance for a quick one-off change.
