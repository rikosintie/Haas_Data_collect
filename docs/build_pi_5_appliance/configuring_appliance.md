# Let's build the appliance

----------------------------------------------------------------
![screenshot](img/Tux_sitting_at_workbench1.resized.png)

----------------------------------------------------------------

As you can imagine, there are a lot of steps required to build a functional appliance from scratch. But once you have completed it, you will have gained a lot of useful knowledge!

- Clone the repository - This is how you get the code from the repository
- Create the systemd service files - Used to start the collection scripts per machine
- Enable the systemd services - Configure the services to start on boot
- Install Samba Server - Samba is used to create Windows shares
- Create the security group - Used to allow Windows users access to  the appliance
- Create the users - Multiple users are needed to deploy into production
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
╭─haas@haas ~
╰─$ pwd
/home/haas
```

!!! Note
    The examples in this document will have `/home/haas` and `/home/haas/Haas_Data_collect`. When you install Ubuntu on your Raspberry Pi 5 use `haas`, all lowercase, as the username.

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
User=haas
WorkingDirectory=/home/haas/Haas_Data_collect
ExecStart=/usr/bin/python3 /home/haas/Haas_Data_collect/haas_logger2.py -a -t 192.168.10.140  --port 5052 --name ST40
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

**If you installed the desktop version of Ubuntu**, you can use the GUI Gnome Text Editor GUI to edit the files by running:

`sudo gnome-text-editor /etc/systemd/system/st40.service`

#### What you need to modify

- **Description** - The description is shown when you check the status of the service. Change to something that makes sense in your environment
- **User** - Your username probably isn't haas. Change to your username
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
╭─haas@haas ~
╰─$ sudo systemctl status st40.service
● st40.service - Haas Python logger for ST40
     Loaded: loaded (/etc/systemd/system/st40.service; enabled; preset: enabled)
     Active: active (running) since Mon 2025-12-29 16:09:45 PST; 2s ago
   Main PID: 115518 (python3)
      Tasks: 1 (limit: 4601)
     Memory: 6.9M (peak: 7.1M)
        CPU: 37ms
     CGroup: /system.slice/st40.service
             └─115518 /usr/bin/python3 /home/haas/Haas_Data_collect/haas_logger2.py -a -t 192.168.10.122 --port 5052 --name ST40

Dec 29 16:09:45 ubuntu-server systemd[1]: Started st40.service - Haas Python logger for ST40.
```

----------------------------------------------------------------

Notice the description from the service file is shown. Also, `Main PID` can be useful during troubleshooting. That is the Process ID, similar to what you would see in the `Windows Task Manager`. In this case it's 115518 and we can track it using:

```bash hl_lines="1"
ps -ef | grep -E "115518|PID"
```

```bash title='Command Output'
UID          PID    PPID  C STIME TTY          TIME CMD
haas  115518       1  0 06:28 ?        00:00:04 /usr/bin/python3 /home/haas/Haas_Data_collect/haas_logger2.py -a -t 192.168.10.122 --port 5052 --name ST40
```

The `haas` is the User ID (UID) that owns the process, 115518 is the Process ID (PID).

----------------------------------------------------------------

#### Memory Usage

The status command also lists the amount of RAM used by the script. You can see that the peak usage was 7.1MB. I haven't seen the script use more than that, so a Raspberry Pi 5 with 8GB of RAM could support many machine tools.

----------------------------------------------------------------

## Scaling up

If you only have a handful of machines, editing the included service files and changing the name of the `systemctl` commands is the quickest way to create the service files and enable the services.

If you have double or triple digits of machines, that gets old fast. You can use the Python script, `conf-gen_xlsx_v1.py` included in the repository, and a spreadsheet to generate the files and `systemd` commands automatically.

It's probably easier to clone the repo to your laptop and run the scripts on it. The script will run on Mac/Linux/Windows and you can create the spreadsheet on the laptop. Or just create the spreadsheet on the laptop and copy it to the appliance after the `Samba shares` are created.

The spreadsheet name is `machines.xlsx`. The format of the spreadsheet is that row one is a header with the following data:

```bash
description, username, ip_address, port, name
```

Fill out as many rows as you need, save it in the root of the Haas_Data_collect folder.

----------------------------------------------------------------

Here is a example:

| description   -  | username | ip_address    |  name |
|------------------|----------|---------------|-------|
| Logger for ST40  | haas     | 192.168.0.140 | st40  |
| Logger for ST30  | haas     | 192.168.0.141 | st30  |
| Logger for ST30L | haas     | 192.168.0.142 | st30l |

----------------------------------------------------------------

### Install Dependencies

The script requires some dependencies. Use the following to install them:

```bash
python -m pip install pandas
python -m pip install jinja2
python -m pip install openpyxl
```

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

mkdir /home/haas/st40

# Create the share configuration

[st40]
    comment = Logger for ST40
    path = /home/haas/st40
    read only = no
    browsable = yes
    writable = yes
    public = no
    valid users = @HaasGroup, haas # Ensure the user is valid
    force user = haas
    force group = HaasGroup
    create mask = 0664
    force create mode = 0664
    directory mask = 0775
    force directory mode = 0775
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

## The installation script


Samba

Key changes:

- Overwrites /etc/samba/smb.conf entirely with tee (without -a)
- Backs up the original to smb.conf.backup first
 - Includes all the security settings in the [global] section
 - Disable the printer share
- Adds testparm to validate the configuration before restarting

```text linenums='1' hl_lines='1'
[global]
    workgroup = WORKGROUP
    server string = %h server (Samba, Ubuntu)
    log file = /var/log/samba/log.%m
    max log size = 10000
    logging = file
    panic action = /usr/share/samba/panic-action %d

    # Authentication
    server role = standalone server
    obey pam restrictions = Yes
    unix password sync = Yes
    passwd program = /usr/bin/passwd %u
    passwd chat = *Enter\snew\s*\spassword:* %n\n *Retype\snew\s*\spassword:* %n\n *password\supdated\ssuccessfully* .
    pam password change = Yes
    map to guest = Bad User

    # Protocol Security - Force SMB2/SMB3 only
    client min protocol = SMB2
    client max protocol = SMB3
    server min protocol = SMB2
    server max protocol = SMB3

    # Disable legacy protocols and services
    disable netbios = Yes
    disable spoolss = Yes

    # Disable printing
    load printers = No
    printing = bsd
    printcap name = /dev/null

    [printers]
    available = No
    browseable = No
    printable = Yes

[print$]
    available = No

    # Performance
    socket options = TCP_NODELAY IPTOS_LOWDELAY

[Haas]
    comment = Haas Directory Share
    create mask = 0664
    directory mask = 0775
    force create mode = 0664
    force directory mode = 0775
    force user = haas
    force group = HaasGroup
    path = /home/haas/Haas_Data_collect
    read only = No
    valid users = @HaasGroup haas
    browseable = yes
```

Security improvements in this config:

Forces SMB2 minimum (blocks SMB1 which has security vulnerabilities)
Disables NetBIOS completely
Disables printing services
Only allows authenticated users (@HaasGroup)

This approach is cleaner and ensures no duplicate entries!
