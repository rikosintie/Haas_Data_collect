# Raspberry Pi 5 Appliance

----------------------------------------------------------------

![screenshot](img/Tux-Raspbery-Pi5.resized.jpeg)

Why would you want to build a Raspberry Pi 5 appliance when the Python scripts will run on Windows? A couple of reasons jump out:

- The scripts need to be running anytime the shop is working.
- You will need to have shares available for the files to be copied

The first reason means that a Windows computer would have to be up and running 24/7 with a user logged in. I don't think that many IT security teams would find that acceptable. A cyber attack is most likely when a PC is powered on and a user is logged in. If the scripts are on a user's Windows desktop and they shut down in the evening or over weekends/holidays, data won't be collected.

The workaround to a user being logged in is to use a tool like `NSSM (Non-Sucking Service Manager)` to install the script as a service. I researched `NSSM` and it appears to be abandoned so no security updates will be produced. My Haas scripts use standard Python libraries that will get updated anytime you update Python. There are a few other ways to run Python as a service on Windows, but you would still have to have a machine running 24/7, so the Pi is a less expensive method. The attack surface of a hardened Linux appliance is smaller than a Windows 11 desktop.

!!! Note
    Python doesn't get updated when you run Windows Update. Use `winget upgrade --id Python.Python.3` from a PowerShell terminal if you installed using winget or Update via Microsoft Store (If installed from there).

The second reason means creating file shares on the Windows computer that the scripts are running on. I have had a lot of wasted time in small shops making their MSP understand what is needed (a user account, the shares, security groups, etc.) and getting it done while I'm onsite. Plus, creating shares on a personal workstation may violate IT security policy.

A Raspberry Pi 5 appliance solves both of these problems. It can run 24/7 in the shop or in the server closet. It uses less than 20W of power so no one will be upset at the cost. It's simple to create a service that starts during boot using the systemd init system that Ubuntu is built on. You will still need to discuss the appliance with the IT security team. In the Samba section I will cover enabling the firewall and proving that SMB V1 is disabled.

## Ubuntu Pro coverage

If you are building the appliance for personal use, Ubuntu has a service that is free for up to five devices called `Ubuntu Pro`. Think of it as Microsoft support but for Ubuntu. The details are on the [Ubuntu Pro Pricing](https://ubuntu.com/pricing/pro) page. For business use, the desktop version is $25/yr and the server version is $300/yr.

**Ubuntu Pro includes:**

- Security updates
- Kernel Livepatch
- Advanced Active Directory policies for Ubuntu Desktop
- And much more

----------------------------------------------------------------

## Why use a Raspberry Pi instead of a cheap SFF Intel machine

Raspberry Pis have become popular for industrial applications. They are inexpensive, reliable and have a massive community of blogs, YouTube videos, and magazine articles supporting them.

If you have never seen Raspberry Pi 5s in the Industrial and Manufacturing spaces here are couple of example companies:

- [Revolution Pi](https://revolutionpi.com/en/products/revolution-pi-series) - Revolution Pi is your open-source Linux platform for future-oriented industrial solutions:
    1. Powered by the Raspberry Pi Compute Module
    1. Raspberry Pi OS-based, industry-optimized operating system
- [Strato Pi](https://sferalabs.cc/strato-pi/) - Industrial Raspberry Pi for Maximum Reliability
    1. Edge Computing
    1. Industrial Automation
    1. Building & Energy Management
    1. Data Acquisition
    1. Marine
    1. Fleet Management

It's worth a few minutes to look that homepages of those two companies.

There is also a vibrant ecosystem of add-on hardware boards, sometimes called `Hats`. For example, Waveshare makes a $30 PoE hat that will power the RPI 5 from the Ethernet cable. Very convenient on the manufacturing floor. Here is a link to it - [PoE hat](https://www.waveshare.com/poe-hat-h.htm). Waveshare also produces a board with four 2.5Gbs Ethernet ports - [Waveshare 4 port Ethernet](https://www.cnx-software.com/2025/12/30/add-four-gigabit-or-2-5gbps-ethernet-ports-to-the-raspberry-pi-5-with-this-expansion-board/)

Finally, Waveshare makes great [e-paper displays](https://www.waveshare.com/product/displays/e-paper/3.97inch-e-paper-hat-plus.htm) for the Pi. I built a serial console server using a Pi Zero W and a Waveshare display. On startup:

- Shows me the ip addresses it got
- Shows the MFG-S/N of the USB serial adapters that are connected.
- If it gets internet access, it emails my `gmail` account it the address.

The email is handy if the console is in a rack up high and you can't see the display. Waveshare provides a Python library to talk to the display and there are tons of YouTube videos and blogs on coding it..

Here is a photo of my Pi Zero 2 W serial console. It has a PoE hat so that I can just plug it into a switch, and it's ready to go. It has one FTDI serial cable connected. The `P 2003` means that I telnet to port 2003 to console to the device it's connected to.

----------------------------------------------------------------

![screenshot](img/pi.resized.jpg)

In the future I might add one and display what machines are online. Here is the link to the Waveshare site - [3.97inch E-Paper Display](https://www.waveshare.com/product/displays/e-paper/epaper-2/3.97inch-e-paper-hat-plus.htm)

----------------------------------------------------------------

The RPi 5 is available in several different models. The difference is the amount of RAM. To build a dedicated RPi 5 for this project I recommend the 8GB RAM model. That is overkill for just the scripts, but the difference in cost is negligible compared to the 4GB model, and I find that it's always better to have more RAM for future proofing.

**On 12/29/2025, Amazon's site offered this cost:**

- Raspberry Pi 5 8GB - $93.99
- Raspberry Pi 5 4GB - $76.95

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

To build a high performance appliance for a manufacturing plant, I think the Canakit is worth the cost. You can also purchase a Raspberry Pi 5 from Micro Center, Ameridroid and many others if you want to piece it out instead of buying the Canakit.

!!! Note
    The Canakit isn't compatible with the Waveshare PoE hat. You need to remove the case to use the hat.

----------------------------------------------------------------

## Which version of Ubuntu should you use

Ubuntu comes in three versions for the Raspberry Pi 5:

- Server - No desktop.
- Desktop - Includes the Gnome desktop
- Core - A dedicated version for IoT devices. I haven't used it yet, but it's on my list of projects!

### Server version (Headless)

I am experienced with Ubuntu, so the headless server version is my choice. I use SSH to manage the appliance, and the scripts don't require the Gnome desktop. The server uses less RAM and resources since it doesn't run a desktop.

If you are creating a headless (no desktop) version of an appliance using Ubuntu server, you will be using SSH or a serial console cable to configure the Pi.

### Desktop Version

If you are new to Linux and building appliances you should pick the desktop. During the installation, select "minimal" install since you don't need a word processor, spreadsheet, etc. The desktop version of Ubuntu uses the Gnome desktop, which is similar to a Windows desktop. You can use a Keyboard, Mouse, and Monitor to configure the Pi. This allows you to use a GUI text editor and other GUI tools.

### Download Raspberry Pi 5 Ubuntu images

Canonical, Ubuntu's publisher, has a dedicated Raspberry Pi page located here: [Install Ubuntu
on a Raspberry Pi](https://ubuntu.com/download/raspberry-pi). Follow the instructions on that page to install Ubuntu onto the Raspberry Pi 5.

----------------------------------------------------------------

## Installation

Once you decide on a version, follow the instructions in the link above.

## What is needed to create the appliance

As you can imagine, there are a lot of steps required to build a functional appliance from scratch. But once you have completed it, you will have gained a lot of useful knowledge!

- Clone the repository - This is how you get the code from the repository
- Create the systemd service files
- Enable the Haas data collection service
- Install Samba to create Windows shares

The next sections will cover all of these topics in detail.

----------------------------------------------------------------

### Clone the repository

NOTE: Linux uses a case sensitive file system. So `Haas` is different from `haas`. Make sure you use `mkdir Haas` when you create the directory.

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

The service files are where you define how to call the Python script when the Pi starts up. In the repository there are six files representing six different machine tools. The ports and IP addresses used are:

| Machine  | Port# |   IP Address   |
|----------|-------|:--------------:|
| ST40     | 5052  | 192.168.10.141 |
| VF2SS    | 5053  | 192.168.10.142 |
| VF5SS    | 5054  | 192.168.10.143 |
| MINIMILL | 5055  | 192.168.10.143 |
| ST30     | 5056  | 192.168.10.144 |
| ST30L    | 5057  | 192.168.10.145 |

----------------------------------------------------------------

You will have different names and IP addresses on your machine tools. No problem, just make a table of the name you want, the port, and the IP address. Then modify the existing service files. Here is the format:

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

!!! Warning
    Be extremely careful when you edit the files. Any mistake will prevent you from successfully receiving data from the machine and can be challenging to troubleshoot.

----------------------------------------------------------------

### Editing the files

The systemd service files are located in `/etc/systemd/system/` so you must use sudo to edit them.

As an example, let's use the included st40.service file. You should be in the `Haas_Data_collect` directory. Use the following to copy `st40.service` to the `/etc/systemd/system/` directory:

`sudo cp st40.service /etc/systemd/system/st40.service`

Use the following to edit the included st40.service file: `sudo nano /etc/systemd/system/st40.service`

This will open `st40.service` in the built in `nano` editor.

!!! Note
    For whatever reason, `nano` doesn't use the normal text editor keys. If you are brand new to Linux, use this tutorial to learn nano - [The beginners guide to Nano the Linux command line text editor](https://www.howtogeek.com/42980/the-beginners-guide-to-nano-the-linux-command-line-text-editor/)

If you installed the desktop version of Ubuntu, you can use the GUI Gnome Text Editor GUI to edit the files by running:

`sudo gnome-text-editor /etc/systemd/system/st40.service`

#### What you need to modify

- Description - The description is shown when you check the status of the service. Change to something that makes sense in your environment
- User - Your username probably isn't mhubbard. Change to your username
- WorkingDirectory - I recommend you keep this format and just change the username in the path.
- ExecStart - This is where the table of names, ports, IP addresses comes in handy.

Nothing else needs to be changed in the service file.

----------------------------------------------------------------

### Configuring systemd to use the service files

Once you have the service file modified, use the following commands to set up the service:

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

#### Memory Usage

The status command also lists the amount of RAM used by the script. You can see that the peak usage was 7.1MB. I haven't seen the script use more than that, so a Raspberry Pi 5 with 8GB of RAM could support many machine tools.

----------------------------------------------------------------

#### Other options for the service file

systemd has capabilities far beyond what is needed for this script. I used Gemini to research systemd for this project. Gemini has a lot of knowledge of `systemd` if you want to add more services to your appliance :smiley:

The `Type=` directive in a systemd service file's [Service] section defines how the service manager determines that a service has successfully started.

Beyond simple, the available Type options include:

- exec: Similar to simple, but systemd considers the service started only after the main service binary has been successfully executed. This is often the preferred choice for long-running processes because it ensures errors like "missing file" are caught during startup.
- forking: Used for traditional UNIX daemons that "fork" into the background. Systemd considers the service started when the parent process exits. It is highly recommended to use PIDFile= with this type so systemd can track the correct child process.
- oneshot: Ideal for scripts that perform a task and then exit. Unlike simple, systemd waits for the process to exit before starting follow-up units. It is often paired with RemainAfterExit=yes to keep the service marked as "active" after completion.
- notify: Similar to exec, but the application must explicitly send a "READY=1" signal to systemd (via sd_notify) once it is fully initialized. This is the most reliable way to handle services with long internal initialization periods.
- notify-reload: A more recent addition that behaves like notify but also implements a standardized protocol for reloading. It expects the service to send "RELOADING=1" when it starts a configuration reload.
- dbus: The service is considered started once it acquires a specific name on the D-Bus bus. You must specify the expected name using the BusName= directive.
- idle: Similar to simple, but execution is delayed until all other active jobs are finished. This is primarily used to prevent service output from cluttering the boot console.

----------------------------------------------------------------

### Scaling up

If you only have a handful of machines, editing the included service files and changing the name of the `systemctl` commands is the quickest way to create the service files and enable the services.

If you have double or triple digits of machines, that gets old fast. You can use the Python script, `conf-gen_xlsx_v1.py` included in the repository, and a spreadsheet to generate the files and `systemd` commands automatically.

It's probably easier to clone the repo to your laptop and run the scripts on it. The script will run on Mac/Linux/Windows and you can create the spreadsheet on the laptop. Or just create the spreadsheet on the laptop and copy it to the appliance.

The spreadsheet name is `machines.xlsx`. The format of the spreadsheet is row 1 is a header with the following data:

```bash
description, username, ip_address, port, name
```

Fill out as many rows as you need, save it in the root of the project folder.

----------------------------------------------------------------

Here is a example:

| description    | username | ip_address    | name |
|----------------|----------|---------------|------|
| Logger for st1 | mhubbard | 192.168.0.140 | st1  |
| Logger for st2 | mhubbard | 192.168.0.141 | st2  |
| Logger for st3 | mhubbard | 192.168.0.142 | st3  |

----------------------------------------------------------------

#### Create the service files

Run the following:

`python3 conf-gen_xlsx_v1.py -f machines.xlsx -t service-template.txt`

This creates the service files and saves them as `<name>.service` to the root of the project. Note that you can name the spreadsheet anything you want. Just change the `machines.xlsx` to the new filename.

----------------------------------------------------------------

#### Create the sudo commands

Run the following:
`python3 conf-gen_xlsx_v1.py -f machines.xlsx -t systemd-template.txt`

The files are saved as `<name>.txt` in the root of the project directory. Here are the contents of st1.txt

```bash
sudo cp st1.service /etc/systemd/system/st1.service
sudo systemctl daemon-reload
sudo systemctl enable st1.service
sudo systemctl start st1.service
sudo systemctl status st1.service

# Create the directory for the share
mkdir /home/mhubbard/Haas/st1

Create the share configuration
[st1]
    comment =
    path = /home/mhubbard/Haas/st1
    read only = no
    browsable = yes
```

It's much easier to peer review a spreadsheet than a bunch of files! If the spreadsheet is accurate, you will instantly get the service files and the commands to install them.

#### bash aliases

During debugging you will find yourself typing the `systemctl` commands a lot. I recommend creating some bash aliases to cut down on the typing. Open the bashrc file on the Pi using `nano ~/.bashrc` or `gnome-text-editor ~/.bashrc`.

!!! note
    Notice the period in front of the bashrc filename. In Linux/Unix the period at the front of a filename means it is a hidden file. To see hidden files use `ls -la` which means show all files.

Paste the following in at the bottom of the file:

```bash
alias gte='gnome-text-editor
alias dmr='sudo systemctl daemon-reload'
alias stop='(){sudo systemctl stop "$1".service}'
alias start='(){sudo systemctl start "$1".service}'
alias status='(){sudo systemctl status "$1".service}'
alias servfile='(){sudo nano /etc/systemd/system."$1".service}'
```

Save the file with `ctrl+s`, close it with `ctrl+x` Update bash by typing `exec bash` and pressing enter.

----------------------------------------------------------------

#### What does the $1 do

The `$1` is a placeholder, it gets replaced with the first text on the command line after the alias name. For example `stop st40` will become `sudo systemctl stop st40.service`.

----------------------------------------------------------------

#### Use the aliases

Now you can type the following:

- `gte ~/.bashrc` instead of `gnome-text-editor ~/.bashrc`
- `stop st40` to stop the st40.service
- `start st40` to start the st40.service
- `status st40` to show the status of the st40.service
- `dmr` to reload the daemons

----------------------------------------------------------------

### Install Dependencies

The script requires some dependencies. Use the following to install them:

```bash
python -m pip install pandas
python -m pip install jinja2
python -m pip install openpyxl
```

----------------------------------------------------------------

## Use Samba Server for Windows integration

----------------------------------------------------------------

![screenshot](img/Tux-DC.resized.jpeg)

----------------------------------------------------------------

**What is a Samba Server?**

A [Samba server](https://www.samba.org/) is an open-source software suite that enables seamless file and printer sharing between Linux/Unix systems and Windows systems. It implements the Server Message Block (SMB) and Common Internet File System (CIFS) protocols, which are standard for Windows-based file sharing. Samba also supports integration with Active Directory (AD) environments, making it a versatile tool for mixed-OS networks.

- Active Directory Integration: It can act as an Active Directory Domain Controller or a member server, supporting protocols like LDAP and Kerberos.

For my project I chose not to use Active Directory integration because 99% of MSPs will freak out if you say you need a Linux server connected to Active Directory. We are only dealing with one account for the machines, and a handful of accounts for the CNC Programmers, and Operations personnel that will use spreadsheets created by the scripts, so we will create local accounts on the Raspberry Pi 5. If you want use  Active Directory integration there are plenty of blogs/YouTube Videos available.

### Install Samba Server

We will need the table we created earlier for reference. The concept is to create a share on the `Haas` directory for the scripts to use and a directory/share for each Haas machine tool. This share will be used for the CNC programmer to drop programs into and the machine operator to load from.

The final structure will look like this:

```bash linenums='1' hl_lines='1'
├── Haas
│   ├── Haas_Data_collect
│   │   ├── cnc_logs
|   ├── minimill
│   ├── st30
│   ├── st30l
│   ├── st40
│   ├── vf2ss
│   └── vf5ss
```

Open a terminal on the Raspberry Pi 5 and enter

```bash hl_lines='1'
sudo apt update && sudo apt install -y samba
```

This will install the Samba Server packages

Configure the Samba Server to start on boot and start the Samba Server

```bash
sudo systemctl enable --now smbd
sudo systemctl start smbd
```

If you want to restart the Samba Server use the following:

```bash hl_lines='1'
sudo systemctl restart smbd
```

#### Verify the installation

Run the following to verify the Samba Server installation and location:

```bash hl_lines='1'
whereis samba
```

`samba: /usr/sbin/samba /usr/lib/x86_64-linux-gnu/samba /etc/samba /usr/libexec/samba /usr/share/samba /usr/share/man/man8/samba.8.gz /usr/share/man/man7/samba.7.gz`

Now run this to view the Samba Server version:

```bash hl_lines='1'
samba --version
```

`Version 4.19.5-Ubuntu`

As you can see, on January 4th, 2025 the current version is 4.19.5.

Run the following to see the smb.conf file and service status

```bash
testparm -s
```

```bash
Load smb config files from /etc/samba/smb.conf
Loaded services file OK.
Weak crypto is allowed by GnuTLS (e.g. NTLM as a compatibility fallback)

Server role: ROLE_STANDALONE
```

This is just the top of the file. The entire smb.conf file will be displayed

Run the following to display the Samba Server service status:

```bash linenums='1' hl_lines='1'
sudo systemctl status smbd

● smbd.service - Samba SMB Daemon
     Loaded: loaded (/usr/lib/systemd/system/smbd.service; enabled; preset: enabled)
     Active: active (running) since Fri 2025-12-26 21:59:34 PST; 1 week 1 day ago
       Docs: man:smbd(8)
             man:samba(7)
             man:smb.conf(5)
   Main PID: 10736 (smbd)
     Status: "smbd: ready to serve connections..."
      Tasks: 4 (limit: 4601)
     Memory: 24.9M (peak: 48.2M swap: 1.4M swap peak: 1.4M)
        CPU: 23.914s
     CGroup: /system.slice/smbd.service
             ├─10736 /usr/sbin/smbd --foreground --no-process-group
             ├─10739 "smbd: notifyd" .
             ├─10740 "smbd: cleanupd "
             └─75813 "smbd: client [192.168.10.143]"

Dec 27 19:07:06 ubuntu-server smbd[20940]: pam_unix(samba:session): session opened for user mhubbard(uid=1000) by (uid=0)
```

----------------------------------------------------------------

### Create the shares

First we need to create the directories. We can refer to our table for the names:

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

If you are only doing a handful of machines use:

```bash
mkdir /home/mhubbard/Haas/ST40
```

And repeat for each machine. If you used the Python script under [Scaling up](Pi_5_Appliance.md/#scaling-up) with the `systemd-template.txt` it creates the 'mkdir' command along with the aliases.

**Open the `smb.conf` file**

```bash
sudo nano /etc/samba/smb.conf
```

Go to the bottom of the file and paste this code in:

```bash
# Share for Haas CNC Programs

[Haas]
    comment = Haas
    path = /home/mhubbard/Haas
    read only = no
    browsable = yes
```

This is the root directory. All other shares with be appended to the end of `/home/mhubbard/Haas`. For example:

```bash linenums='1' hl_lines='1'
[ST40]
    comment = st40
    path = /home/mhubbard/Haas/st40
    read only = no
    browsable = yes
```

If you used the Python script with the `systemd-template.txt`, it creates all of the smb.conf share commands. Open each file and copy the code after `Create the share configuration`.

```bash linenums='1' hl_lines='13-17'
sudo cp st1.service /etc/systemd/system/st1.service
sudo systemctl daemon-reload
sudo systemctl enable st1.service
sudo systemctl start st1.service
sudo systemctl status st1.service

# Create the directory for the share

mkdir /home/mhubbard/Haas/st1

Create the share configuration

[st1]
    comment =
    path = /home/mhubbard/Haas/st1
    read only = no
    browsable = yes
```

After you add all the share configurations, save `/etc/samba/smb.conf` and exit nano.

Based on the [table](Pi_5_Appliance.md/#create-the-shares) above this is what the share section will look like:

```bash linenums='1'
# Share for Haas CNC Programs

[Haas]
    comment = Haas
    path = /home/mhubbard/Haas
    read only = no
    browsable = yes
[ST40]
    comment = ST40
    path = /home/mhubbard/Haas/st40
    read only = no
    browsable = yes
[minimill]
    comment = minimill
    path = /home/mhubbard/Haas/minimill
    read only = no
    browsable = yes
[VF2SS]
    comment = vf2ss
    path = /home/mhubbard/Haas/vf2ss
    read only = no
    browsable = yes
[VF5SS]
    comment = vf5ss
    path = /home/mhubbard/Haas/vf5ss
    read only = no
    browsable = yes
[ST30]
    comment = st30
    path = /home/mhubbard/Haas/st30
    read only = no
    browsable = yes
[ST30L]
    comment = st30l
    path = /home/mhubbard/Haas/st30l
    read only = no
    browsable = yes
```

----------------------------------------------------------------

### Restart the Samba Server and create the users

This command restarts the samba service. You will need to run it any time you modify the `/etc/samba/smb.conf` file.

```bash
sudo systemctl restart smbd
```

You will need to build a list of users that will need to access the shares. In this example I have:

```text
Michael Hubbard - The administrator for the Raspberry Pi 5
        haassvc - The limited permission account used on the Hass CNC control
       haassvc2 - An account for the customer to manage the Raspberry Pi 5
 Robert Goodwin - Operations. Needs access to the `cnc_logs` directory to move files
  Manuel Chavez - CNC Setup technician. Needs to review the CNC Programs from his Windows desktop and review the spreadsheets
```

Run these command for each user:

```bash linenums='1' hl_lines='1'
sudo useradd -M -s /usr/sbin/nologin haassvc
sudo smbpasswd -a haassvc
```

The first command creates the user `haassvc`.

- The `-M` skips creating a user `home` directory..
- The `-s /usr/sbin/nologin` disables shell login (good for service accounts that only need SMB access)

The second command creates the Samba Server user. You will be prompted to enter and confirm a password. Here is the output for the `haassvc` user:

```bash hl_lines='1'
sudo smbpasswd -a haassvc
New SMB password:
Retype new SMB password:
Added user haassvc.
```

#### Local Group Management

I find it better to manage permissions using groups. For this project all uses will be in the same group. That isn't a security best practice since a disgruntled employee could delete everything. If you have compliance requirements or other concerns just repeat this process to create multiple groups.

**To create the  HaasGroup group:**

```bash
sudo groupadd HaasGroup
```

**To add the haassvc User account to the group:**

```bash
sudo usermod -aG HaasGroup haassvc
```

**To see all users in the HaasGroup:**

```bash hl_lines='1'
cat /etc/group | grep Haas
HaasGroup:x:1002:haassvc,mhubbard
```

**Set permissions on the folders:**

You need to be in the root of your home director before changing permissions. Use the following to verify that you are in the correct location:

```bash
cd ~
pwd
ls -l
```

```bash
/home/mhubbard
drwx------ 3 mhubbard mhubbard   4096 Jun 15  2025 easy-rsa
drwxrwxr-x 9 mhubbard HaasGroup  4096 Jan  4 20:26 Haas
drwxrwxr-x 4 mhubbard mhubbard   4096 Jun 16  2024 reverse-proxy
drwxrwxr-x 2 tftp     tftp      12288 Jan  3 23:00 tftp-root
drwxrwxr-x 4 mhubbard mhubbard   4096 Dec 28 11:21 tools
```

We can see the `Haas` folder, so we are in the correct location. Now run:

```bash linenums='1' hl_lines='1'
sudo chown -R mhubbard:HaasGroup Haas
ls -l
```

```bash
drwx------ 3 mhubbard mhubbard   4096 Jun 15  2025 easy-rsa
drwxrwxr-x 9 mhubbard HaasGroup  4096 Jan  4 20:26 Haas
drwxrwxr-x 4 mhubbard mhubbard   4096 Jun 16  2024 reverse-proxy
drwxrwxr-x 2 tftp     tftp      12288 Jan  3 23:00 tftp-root
drwxrwxr-x 4 mhubbard mhubbard   4096 Dec 28 11:21 tools
```

Note the Haas directory had changed from `mhubbard mhubbard` to `mhubbard HaasGroup`. That means mhubbard is the owner and HaasGroup is the group that will be applied.

**Now we will set the file permissions:**

From the root of your home directory run:

```bash
chmod -R 766 Haas
```

There won't be any output from this command. Run a directory listing to see the results:

```bash
cd Haas
ls -l
```

```bash
ls -l
total 52
drwxrw-rw- 6 mhubbard HaasGroup 4096 Dec 29 20:30 Haas_Data_collect
-rwxrw-rw- 1 mhubbard HaasGroup  646 Jan  4 20:26 lshare.sh
drwxrw-rw- 2 mhubbard HaasGroup 4096 Dec 25 22:43 minimill
-rwxrw-rw- 1 mhubbard HaasGroup 6923 Dec 26 22:29 smb-enum-shares.nse
-rwxrw-rw- 1 mhubbard HaasGroup 6923 Dec 26 22:30 smb-enum-shares.nse.1
-rwxrw-rw- 1 mhubbard HaasGroup 2620 Dec 26 23:01 smb_verify.sh
drwxrw-rw- 2 mhubbard HaasGroup 4096 Dec 26 21:37 st30
drwxrw-rw- 2 mhubbard HaasGroup 4096 Dec 26 21:37 st30l
drwxrw-rw- 2 mhubbard HaasGroup 4096 Jan  4 15:18 st40
drwxrw-rw- 2 mhubbard HaasGroup 4096 Dec 26 21:37 vf2ss
drwxrw-rw- 2 mhubbard HaasGroup 4096 Dec 26 21:37 vf5ss
```

Now my account has `rwx` and the HaasGroup has `rw`.

----------------------------------------------------------------

### Verify the Samba Server

testparm -s
smbclient -L //192.168.10.223 -U mhubbard

Here is a function that you can add to your ~/.zshrc file to display the paths to each share. use the following to open your ~./bashrc (or ~/.zshrc) file:

```bash linenums='1' hl_lines='1'
nano ~/.bashrc
```

Then paste this at the bottom of the file, save and exit.

----------------------------------------------------------------

```bash linenums='1' hl_lines='1'
smb-shares() {
    while IFS= read -r line; do
        if [[ "$line" == \[*\] ]]; then
            # Extract share name without brackets
            name="${line#\[}"
            name="${name%\]}"
        fi
        if [[ "$line" == *path\ =* ]]; then
            # Skip global, printers, and print$ shares
            if [[ "$name" != "global" && "$name" != "printers" && "$name" != "print$" ]]; then
                # Extract path after "path = "
                sharepath="${line#*path = }"
                # Print formatted output
                printf "%-12s %s\n" "$name" "$sharepath"
            fi
        fi
    done < /etc/samba/smb.conf
}
```

If you don't want to add the function to your .bashrc file you can use the `lshares.sh` file that is included with the repository. You have to make it executable using:

```bash linenums='1' hl_lines='1'
chmod +x lshare.sh
```

Then run the script from the `/home/mhubbard/Haas/Haas_Data_collect` direcory using:

```bash linenums='1' hl_lines='1'
./lshare.sh
```

----------------------------------------------------------------

Here is the output of the function:

```bash
smb-shares
Haas         /home/mhubbard/Haas
ST40         /home/mhubbard/Haas/st40
minimill     /home/mhubbard/Haas/minimill
VF2SS        /home/mhubbard/Haas/vf2ss
VF5SS        /home/mhubbard/Haas/vf5ss
ST30         /home/mhubbard/Haas/st30
ST30L        /home/mhubbard/Haas/st30l
```

----------------------------------------------------------------

#### Disable SMBv1 on Linux or Unix when using Samba

The `smb.conf` file should still be open. If not, run the following command to open the Samba Server configuration file:

```bash linenums='1' hl_lines='1'
sudo nano /etc/samba/smb.conf
```

Find the [global] section and append the following line:

```bash linenums='1' hl_lines='1'
min protocol = SMB2
```

Here is what it looks like on my server

```bash linenums='1' hl_lines='1'
#======================= Global Settings =======================

[global]

   client min protocol = SMB2
   client max protocol = SMB3

```


!!! Note:
    smbv1 was permanently removed for Samba Server version 4.16. This step is not strictly necassary, we will verify that smbvq is disabled later in the installation but I like to make absolutely sure smbv1 is not enabled!

sudo sh -c 'cd /var/lib/samba/usershares && ls -l'
