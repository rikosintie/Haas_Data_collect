# Which version of Ubuntu should you use

Ubuntu comes in three versions for the Raspberry Pi 5:

- Server - No desktop.
- Desktop - Includes the Gnome desktop
- Core - A dedicated version for IoT devices. I haven't used it yet, but it's on my list of projects!

**Server version (Headless)**
I am experienced with Ubuntu, so the headless server version is my choice. I use SSH to manage the appliance, and the scripts don't require the Gnome desktop. The server uses less RAM and resources since it doesn't run a desktop.

If you are creating a headless (no desktop) version of an appliance using Ubuntu server, you will be using SSH or a serial console cable to configure the Pi.

**Desktop Version**
If you are new to Linux and building appliances you should pick the desktop. During the installation, select "minimal" install since you don't need a word processor, spreadsheet, etc. The desktop version of Ubuntu uses the Gnome desktop, which is similar to a Windows desktop. You can use a Keyboard, Mouse, and Monitor to configure the Pi. This allows you to use a GUI text editor and other GUI tools.

## Download Raspberry Pi 5 Ubuntu images

Canonical, Ubuntu's publisher, has a dedicated Raspberry Pi page located here: [Install Ubuntu
on a Raspberry Pi](https://ubuntu.com/download/raspberry-pi). Follow the instructions on that page to install Ubuntu onto the Raspberry Pi 5.

----------------------------------------------------------------

## Installation

Once you decide on a version, follow the instructions in the link above.
