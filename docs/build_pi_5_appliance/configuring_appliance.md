# Let's build the appliance

----------------------------------------------------------------
![screenshot](img/Tux_sitting_at_a_workbench.resized.png)

----------------------------------------------------------------

As you can imagine, there are a lot of steps required to build a functional appliance from scratch. But once you have completed it, you will have gained a lot of useful knowledge!

- Clone the repository - This is how you get the code from the repository
- Create the systemd service files - Used to start the collection scripts per machine
- Enable the systemd services - Configure the services to start on boot
- Install Samba Server - Samba is used to create Windows shares
- Create the security group - Used to allow Windows users access to  the appliance
- Create the users - Multiple users are need to function in production
- Add the users to the security group - Required for sharing
- Create the directories - A place to store files
- Create the Samba shares - Allows Windows users to map a network drive to the appliance

The next sections will cover all of these topics in detail.

----------------------------------------------------------------

## Clone the repository

!!! Note
    Linux uses a case sensitive file system. So `Haas` is different from `haas`. If you type a command, for example, `LS -l` and it says
    ```bash linenums='1' hl_lines='1'
    cd haas_data_collect
    cd:cd:1: no such file or directory: haas_data_collect
    ```
    Make sure you have the case correct!

## Open a terminal on the Pi

If you are using ssh to connect, you are at the terminal already. If you are using the GUI, press `ctrl+alt+t` to open a terminal.

- Make sure you are in your home directory by running `cd ~`
- Verify using `pwd` which is `print working directory` in Linux. You should see:

```bash
╭─mhubbard@ubuntu-server ~
╰─$ pwd
/home/mhubbard
```

!!! Note
    The examples in this document will have `/home/mhubbard` and `/home/mhubbard/Haas_Data_collect`. When you install Ubuntu on your Raspberry Pi 5 you will use your own name. Please replace `mhubbard` with your name in all the code you enter!

- Clone the repository using `git clone https://github.com/rikosintie/Haas_Data_collect.git`
- Change to the `Haas_Data_collect` folder using `cd Haas_Data_collect`
- List the files for reference using `ls -l`

----------------------------------------------------------------

## The systemd service files

Ubuntu uses an initialization (init) service named `systemd`. Systemd manages what services are initialized when Ubuntu starts up. We will use `systemd` to manage the Python scripts.

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

You will have different names and IP addresses on your machine tools. No problem, just make a table of your names, the ports, and the IP addresses. Then modify the existing service files. Here is the format:

```unixconfig
[Unit]
Description=Haas Python logger for ST40
After=network.target

[Service]
User=mhubbard
WorkingDirectory=/home/mhubbard/Haas_Data_collect
ExecStart=/usr/bin/python3 /home/mhubbard/Haas_Data_collect/haas_logger2.py -a -t 192.168.10.140  --port 5052 --name ST40
Type=idle

[Install]
WantedBy=multi-user.target
```

!!! Warning
    Be extremely careful when you edit the files. Any mistake will prevent you from successfully receiving data from the machine and can be challenging to troubleshoot.

----------------------------------------------------------------

### Editing the files

The systemd service files are located in `/etc/systemd/system/` so you must use sudo to edit them. Think of `sudo` as `UAC` in Windows. The advantage is that you can proactively use `sudo` and not have to deal with pop up dialogs asking for permission!

As an example, let's use the included st40.service file. You should be in the `Haas_Data_collect` directory. Use the following to copy `st40.service` to the `/etc/systemd/system/` directory:

`sudo cp st40.service /etc/systemd/system/st40.service`

Use the following to edit the st40.service file after you copy it:

```bash
sudo nano /etc/systemd/system/st40.service
```

This will open `st40.service` in the built in `nano` editor.

!!! Note
    For whatever reason, `nano` doesn't use the normal text editor keys. If you are brand new to Linux, use this tutorial to learn nano - [The beginners guide to Nano the Linux command line text editor](https://www.howtogeek.com/42980/the-beginners-guide-to-nano-the-linux-command-line-text-editor/)

You can install the [Fresh Editor](https://github.com/Nsoro-Allan/fresh-editor?tab=readme-ov-file#installation) using the command below. The site for the Fresh Editor is [Fresh](https://sinelaw.github.io/fresh/). I find it easier to use than `nano` because it uses the same key bindings as most GUI editors.

```bash hl_lines='1'
https://raw.githubusercontent.com/sinelaw/fresh/refs/heads/master/scripts/install.sh | sh
```

!!! Note
    In the Linux/Unix world it is considered bad security practice to pipe a command to the shell that you found on the Internet. Feel free to go to the Fresh webpage and copy the command from there.

If you installed the desktop version of Ubuntu, you can use the GUI Gnome Text Editor GUI to edit the files by running:

`sudo gnome-text-editor /etc/systemd/system/st40.service`

#### What you need to modify

- **Description** - The description is shown when you check the status of the service. Change to something that makes sense in your environment
- **User** - Your username probably isn't mhubbard. Change to your username
- **WorkingDirectory** - I recommend you keep this format and just change the username in the path.
- **ExecStart** - This is where the table of names, ports, IP addresses comes in handy.

Nothing else needs to be changed in the service file.

----------------------------------------------------------------

## Configuring systemd to use the service files

Once you have the service file modified, use the following commands to set up the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable st40.service
sudo systemctl start st40.service
```

There is no output from these commands.

----------------------------------------------------------------

### What the commands do

- sudo systemctl daemon-reload - Forces `systemd` to read the changes in the systemd files
- sudo systemctl enable st40.service - Tells `systemd` to run the service on boot
- sudo systemctl start st40.service - Actually starts the `systemd` service

Once these commands are run the `st40.service` should be active.

----------------------------------------------------------------

**Run this command to check the status of the `st40.service`:**

```bash
sudo systemctl status st40.service
```

```unixconfig hl_lines="2" title="Status of the st40.service"
╭─mhubbard@ubuntu-server ~
╰─$ sudo systemctl status st40.service
● st40.service - Haas Python logger for ST40
     Loaded: loaded (/etc/systemd/system/st40.service; enabled; preset: enabled)
     Active: active (running) since Mon 2025-12-29 16:09:45 PST; 2s ago
   Main PID: 115518 (python3)
      Tasks: 1 (limit: 4601)
     Memory: 6.9M (peak: 7.1M)
        CPU: 37ms
     CGroup: /system.slice/st40.service
             └─115518 /usr/bin/python3 /home/mhubbard/Haas_Data_collect/haas_logger2.py -a -t 192.168.10.122 --port 5052 --name ST40

Dec 29 16:09:45 ubuntu-server systemd[1]: Started st40.service - Haas Python logger for ST40.
```

----------------------------------------------------------------

Notice the description from the service file is shown. Also, `Main PID` can be useful during troubleshooting. That is the Process ID, similar to what you would see in the `Windows Task Manager`. In this case it's 115518 and we can track it using:

```bash hl_lines="1"
ps -ef | grep -E "115518|PID"
```

```bash title='Command Output'
UID          PID    PPID  C STIME TTY          TIME CMD
mhubbard  115518       1  0 06:28 ?        00:00:04 /usr/bin/python3 /home/mhubbard/Haas/Haas_Data_collect/haas_logger2.py -a -t 192.168.10.122 --port 5052 --name ST40
```

The `mhubbard` is the User ID (UID) that owns the process, 115518 is the Process ID (PID).

----------------------------------------------------------------

#### Memory Usage

The status command also lists the amount of RAM used by the script. You can see that the peak usage was 7.1MB. I haven't seen the script use more than that, so a Raspberry Pi 5 with 8GB of RAM could support many machine tools.

----------------------------------------------------------------

### Other options for the service file

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

## Scaling up

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

| description   -  | username | ip_address    |  name |
|------------------|----------|---------------|-------|
| Logger for ST40  | mhubbard | 192.168.0.140 | st40  |
| Logger for ST30  | mhubbard | 192.168.0.141 | st30  |
| Logger for ST30L | mhubbard | 192.168.0.142 | st30l |

----------------------------------------------------------------

### Create the service files

Run the following:

`python3 conf-gen_xlsx_v1.py -f machines.xlsx -t service-template.txt`

This creates the service files and saves them as `<name>.service` to the root of the project. Note that you can name the spreadsheet anything you want. Just change the `machines.xlsx` to the new filename.

----------------------------------------------------------------

### Create the sudo commands

Run the following:
`python3 conf-gen_xlsx_v1.py -f machines.xlsx -t systemd-template.txt`

The files are saved as `<name>.txt` in the root of the project directory. Here are the contents of st40.txt

```bash
sudo cp st40.service /etc/systemd/system/st40.service
sudo systemctl daemon-reload
sudo systemctl enable st40.service
sudo systemctl start st40.service
sudo systemctl status st40.service

# Create the directory for the share

mkdir /home/mhubbard/Haas/st40

# Create the share configuration

[st40]
    comment = Logger for ST40
    path = /home/mhubbard/Haas/st40
    read only = no
    browsable = yes
```

It's much easier to peer review a spreadsheet than a bunch of files! If the spreadsheet is accurate, you will instantly get the service files and the commands to install them.

!!! Note
    The template files are just text files formatted for Jinja2. Basically a set of curly braces like this represent a variable `{{}}`. You can create your own templates and run them. The Python script doesn't care what is in the template, it just reads the spreadsheet and renders the template.

I have a lot of Jinja2 resources on my [Cisco DevNet](https://github.com/rikosintie/DevNetAssoc/tree/main/Jinja2) github if you are interested.

----------------------------------------------------------------

### Create bash aliases

During debugging you will find yourself typing the `systemctl` commands a lot. I recommend creating some bash aliases to cut down on the typing. Open the bashrc file on the Pi using `nano ~/.bashrc` or `gnome-text-editor ~/.bashrc`. If you are using zsh as your shell, the commands will be `nano ~/.zshrc` or `gnome-text-editor ~/.zshrc`

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

### Use the aliases

Now you can type the following:

- `gte st30l.service` instead of `gnome-text-editor st30l.service`
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

## Install Samba for Windows integration

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

This will install the Samba Server packages. The `-y` means "Don't prompt for yes". If you want to be in control during the installation don't include the `-y`.

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

```bash title='Command Output'
samba: /usr/sbin/samba /usr/lib/x86_64-linux-gnu/samba /etc/samba /usr/libexec/samba /usr/share/samba /usr/share/man/man8/samba.8.gz /usr/share/man/man7/samba.7.gz
```

Now run this to view the Samba Server version:

```bash hl_lines='1'
samba --version
```

```bash title='Command Output'
Version 4.19.5-Ubuntu
```

As you can see, on January 4th, 2025 the current version is 4.19.5.

Run the following to see the smb.conf file and service status

```bash
testparm -s
```

```bash title='Command Output'
Load smb config files from /etc/samba/smb.conf
Loaded services file OK.
Weak crypto is allowed by GnuTLS (e.g. NTLM as a compatibility fallback)

Server role: ROLE_STANDALONE
```

This is just the top of the file. The entire smb.conf file will be displayed

Run the following to display the Samba Server service status:

```bash linenums='1' hl_lines='1'
sudo systemctl status smbd
```

```bash title='Command Output'
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

## Create the shares

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

And repeat for each machine. If you used the Python script under [Scaling up](configuring_appliance.md/#scaling-up) with the `systemd-template.txt` it creates the 'mkdir' command along with the aliases.

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

Based on the [table](configuring_appliance.md/#create-the-shares) above this is what the share section will look like:

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

## Restart the Samba Server

This command restarts the samba service. You will need to run it any time you modify the `/etc/samba/smb.conf` file.

```bash
sudo systemctl restart smbd
```

There is no output from this command.
