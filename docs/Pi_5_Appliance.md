# Raspberry Pi 5 Appliance

Raspberry Pis have become popular for industrial applications. They are inexpensive, reliable and have a massive community of blogs, YouTube videos, and magazine articles supporting them.

Canonical, Ubuntu's publisher, has a dedicated Raspberry Pi page located here [Install Ubuntu
on a Raspberry Pi](https://ubuntu.com/download/raspberry-pi).

The RPi 5 is available in several different models. The difference is the amount of RAM. To build a dedicated RPi 5 for this project I recommend the 8GB RAM model. That is overkill for just the scripts but the difference in cost is negligible compared to the 4GB model and I find that it's always better to have more RAM for future proofing.

**On 12/29/2025 on the Amazon site:**
Raspberry Pi 5 8GB - $93.99
Raspberry Pi 5 4GB - $76.95

You will need:

- Raspberry 5 8GB
- A certified power adapter
- An SD card of at least 32GB
- A case

Amazon has a [CanaKit Raspberry Pi 5 Starter Kit PRO - Turbine Black (128GB Edition) (8GB RAM)](https://www.amazon.com/CanaKit-Raspberry-Starter-Kit-PRO/dp/B0CRSNCJ6Y) for $169.95 that includes all of the above and:

- a fan
- a heat sink
- a 128GB SD card
- CanaKit 45W PD Power Supply

To build a high performance appliance for a manufacturing plant I think the Canakit is worth the cost. You can also purchase a Raspberry Pi 5 from Micro Center, Ameridroid and many others if you want to piece it out instead of buying the Canakit.

----------------------------------------------------------------

## Which version of Ubuntu should you use

Ubuntu comes in three versions:

- Server - No desktop.
- Desktop - Includes the Gnome desktop
- Core - A dedicated version for IoT devices. I haven't used it yet but its on my list of projects!

### Server version (Headless)

I am experienced with Ubuntu so the headless server version is my choice. I use ssh to manage the appliance and the scripts don't require the Gnome desktop. The server uses less RAM and resources since it doesn't run a desktop.

If you are creating a headless (no desktop) version of an appliance using Ubuntu server you will be using ssh or a serial console cable to configure the Pi.

### Desktop Version

If you are new to Linux and building appliances you should pick the desktop. During the installation select "minimal" install since you don't need a word processor, spreadsheet, etc. The Desktop version of Ubuntu has the Gnome desktop which is similar to a Windows desktop. You can use a Keyboard, Mouse, Monitor to configure the Pi. This allows you to use a GUI text editor and other GUI tools.

----------------------------------------------------------------

## Installation

Once you decide on a version, follow the instructions in the link above.

## What is needed to create the appliance

As you can imagine, there are a lot of steps required to build a functional appliance from scratch. But once you have completed it, you will have gained a lot of useful knowledge!

- clone the repository - This is how you get the code from the repository
- Create the systemd service files
- Enable the Haas data collection service
- Install Samba to create Windows shares

The next sections will cover all of these topics in detail.

----------------------------------------------------------------

### Clone the repository

NOTE: Linux uses a case sensitive file system. So `Haas` is different than `haas`. Make sure you use `mkdir Haas` when you create the directory.

Open a terminal on the Pi.

- Make sure you are in your home directory by running `cd ~`
- Verify using `pwd` which is `print working directory` in Linux. You should see:

```bash
╭─mhubbard@ubuntu-server ~
╰─$ pwd
/home/mhubbard
```

- Create a folder named `Haas` using `mkdir Haas`.
- Change to the Haas directory using `cd Haas`
- Clone the repository using `git clone https://github.com/rikosintie/Haas_Data_collect.git`
- Change to the `Haas_Data_collect` folder using `cd Haas_Data_collect`
- List the files for reference using `ls -l`

----------------------------------------------------------------

### The systemd service files

Ubuntu uses an initialization (init) service named `systemd`. This service manages what services are initialized when Ubuntu starts up. We will use `systemd` to manage the Python scripts.

The service files are where you define how to call the python script when the Pi starts up. In the repository there are six files representing six different machine tools. The Ports and IP addresses used are:

----------------------------------------------------------------

| Machine  | Port# |   IP Address   |
|----------|-------|:--------------:|
| ST40     | 5052  | 192.168.10.141 |
| VF2SS    | 5053  | 192.168.10.142 |
| VF5SS    | 5054  | 192.168.10.143 |
| MINIMILL | 5055  | 192.168.10.143 |
| ST30     | 5056  | 192.168.10.144 |
| ST30L    | 5057  | 192.168.10.145 |

----------------------------------------------------------------

You will have different names and IP addresses on your machine tools. No problem, just make a table of the name you want, the port, and the IP Address. Then modify the existing service files. Here is the format:

```unixconfig
[Unit]
Description=Haas Python logger for ST40
After=network.target

[Service]
User=mhubbard
WorkingDirectory=/home/mhubbard/Haas/Haas_Data_collect
ExecStart=/usr/bin/python3 /home/mhubbard/Haas/Haas_Data_collect/haas_logger2.py -a -t 192.168.10.140  --port 5052 --name ST40
Type=idle

[Install]
WantedBy=multi-user.target
```

!!! warning
    Be extremely careful when you edit the files. Any mistake will prevent you from successfully receiving data from the machine and can be challenging to troubleshoot.

----------------------------------------------------------------

### Editing the files

The systemd service files are located in `/etc/systemd/system/` so you must use sudo to edit them.

As an example, let's use the included st40.service file. You should be in the `Haas_Data_collect` directory. Use the following to copy `st40.service` to the `/etc/systemd/system/` directory:

`cp st40.service /etc/systemd/system/st40.service`

Use the following to edit the included st40.service file `sudo nano /etc/systemd/system/st40.service`

This will open `st40.service` in the built in `nano` editor.

!!! Note
    For whatever reason, `nano` doesn't use the normal text editor keys. If you are brand new to Linux use this tutorial to learn nano - [The beginners guide to Nano the Linux command line text editor](https://www.howtogeek.com/42980/the-beginners-guide-to-nano-the-linux-command-line-text-editor/)

#### What you need to modify

- Description - The description is shown when you check the status of the service. Change to something that makes sense in your environment
- User - Your username probably isn't mhubbard. Change to your username
- WorkingDirectory - I recommend you keep this format and just change the username in the path.
- ExecStart - This is where the table of Names, ports, IP addresses comes in handy.

Nothing else needs to be changed in the service file.

----------------------------------------------------------------

### Configuring systemd to use the service files

Once you have the service file modified use the following commands to setup the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable st40.service
sudo systemctl start st40.service
sudo systemctl status st40.service
```

#### What the commands do

- sudo systemctl daemon-reload - Forces `systemd` to read the changes
- sudo systemctl enable st40.service - Tells `systemd` to run the service on boot
- sudo systemctl start st40.service - Actually starts the `systemd` service
- sudo systemctl status st40.service - Displays the status of the `systemd` service

```unixconfig hl_lines="2" title="Status of the st40.service"
╭─mhubbard@ubuntu-server ~
╰─$ sudo systemctl status st40.service
● st40.service - Haas Python logger for ST40
     Loaded: loaded (/etc/systemd/system/st40.service; enabled; preset: enabled)
     Active: active (running) since Mon 2025-12-29 16:09:45 PST; 2s ago
   Main PID: 44301 (python3)
      Tasks: 1 (limit: 4601)
     Memory: 6.9M (peak: 7.1M)
        CPU: 37ms
     CGroup: /system.slice/st40.service
             └─44301 /usr/bin/python3 /home/mhubbard/Haas/Haas_Data_collect/haas_logger2.py -a -t 192.168.10.122 --port 5052 --name ST40

Dec 29 16:09:45 ubuntu-server systemd[1]: Started st40.service - Haas Python logger for ST40.
```

----------------------------------------------------------------

Notice the description from the service file is shown. Also, `Main PID` can be useful during troubleshooting. That is the Process ID, similar to what you would see in the `Windows Task Manager`. In this case it's 44301 and we can track it using:

```bash hl_lines="1"
ps -ef | grep 5052
mhubbard   44301       1  0 16:09 ?        00:00:00 /usr/bin/python3 /home/mhubbard/Haas/Haas_Data_collect/haas_logger2.py -a -t 192.168.10.122 --port 5052 --name ST40
```

----------------------------------------------------------------

### Scaling up

If you only have a handful of machines editing the included service files is the quickest way to create the service files. If you have double or triple digits of machines you can use a Python script included in the repository and a spreadsheet to generate the files automatically.

The format of the spreadsheet, `machines.xlsx`, is row 1 is a header with the following data:

```bash
description, username, ip_address, port, name
```

Fill out as many rows as you need, save it and run the following:

`python3 conf-gen_xlsx_v1.py -f machines.xlsx`

This creates the service files and save them to the root of the project. The script requires some dependencies. The installation process is documented at the end of this section.
