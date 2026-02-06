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

If you are using ssh to connect, you are already at the terminal. If you are using the desktop version of Ubuntu, press `ctrl+alt+t` to open a terminal.

- Make sure you are in your home directory by running `cd ~`
- Verify using `pwd` which is `print working directory` in Linux. You should see:

```bash
╭─haas@haas ~
╰─$ pwd
/home/haas
```

!!! Note
    The examples in this document will have `/home/haas` and `/home/haas/Haas_Data_collect`. When you install Ubuntu on your Raspberry Pi 5 use `haas`, all lowercase, as the username. If you use a different name, remember to update the path after you paste a command into the terminal.

- Clone the repository using

```bash hl_lines="1"
git clone https://github.com/rikosintie/Haas_Data_collect.git`
```

- Change to the `Haas_Data_collect` folder using

```bash hl_lines="1"
cd Haas_Data_collect`
```

- List the files for reference using `ls -l`

----------------------------------------------------------------

## The installation script

The repository includes a script named: `haas_firewall_install.sh`. The script does a lot of the heavy lifting to get the appliance up and running.

- Writes the `/etc/haas-firewall.conf` file that allows you to add a custom subnet for the Haas CNCs if your network uses segmentation. Allow you to set a custom SSH port for the firewall rules if your security policy requires it.
- Installs systemd firewall service + timer
- Installs Samba server and updates /etc/samba/smb.conf
- Sets up Samba security and creates the "[Haas]" share
- Creates Samba users from the `initial_users.csv` file
- Installs Cockpit extension for managing/monitoring the firewall
- Installs the "micro" cli text editor
- Installs the "fresh" cli text editor
- Copies `issue.net` to `/etc/issue.net` (This is the Pre-logon banner)
- Copies csvlens binary to /usr/local/sbin - csvlens is a cli tool for viewing csv files. Example `csvlens users.csv`
- Creates the backup directory in the repo
- Triggers an initial firewall configuration via systemd

It does NOT modify or delete anything inside the repo.

The script does not create the [The systemd service files](configuring_appliance.md/#the-systemd-service-files) because they must be modified for your machine names and ip addresses. They are covered after the installation script.

----------------------------------------------------------------

## Update text files

There are a three files in the `Haas_Data_collect` directory that need to be updated to fit your environment **before you run the install script**:

- users.csv - This file contains usernames, ip addresses and roles for configuring the firewall.
- initial_users.csv - Users who need access to the Windows shares on the appliance. The CNC controls will use the `haassvc` user account. Add CNC programmers, and operations personnel that need to copy files to/from the appliance.
- issue.net - This is the login banner. It gets copied to `/etc/issue.net` by the `haas-firewall-install.sh` script. This is a generic file. Update it per your company's security policy.

These files are used as input to the `haas-firewall-install.sh` script that is presented next.

There two user components to the appliance setup, it may be confusing at first! The appliance is protected by the Ubuntu firewall. The firewall is configured automatically by the data in the file `users.csv`.

There are also `users` created from data in the file `initial_users.csv`. These are users that need to have both Linux and Samba accounts to access the file shares. The installation scripts creates the user accounts.

----------------------------------------------------------------

### users.csv

This is a comma-separated value (csv) file that contains the users, ip addresses and roles of any users that need to access the Raspberry Pi 5 appliance. Every Haas CNC machine will need to be in this file, otherwise the firewall will block access. If your machines are on a dedicated IP subnet, a best practice, you can edit the `/etc/haas-firewall.conf` file and enter the subnet. There is a script that will read the `haas-firewall.conf` file and update the firewall. That is explained in the `Cockpit management` section.

The format for `users.csv` is:

```bash hl_lines='1'
username,ip_address,role
haas,192.168.10.143,Administrator
haassvc,192.168.10.104,user
mchavez,192.168.10.133,user
thubbard,192.168.10.100,user
st30,192.168.10.110,user
st30l,192.168.10.111,user
st40,192.168.10.112,user
vf2ss,192.168.10.113,user
vf5ss,192.168.10.114,user
minimill,192.168.10.115,user
```

- username - The username of a person or machine that will access the appliance.
- ip _address - This is the IP address of devices that need to access the appliance.
- roles:
  1. Administrator - Users that can manage the appliance. They can access ssh, smb shares, Cockpit.
  1. User - This role is configured on the Haas CNC and any users that only nee to map drives. Only file share access through the firewall

The `users.csv` file will remain in the `Haas_Data_collection` folder after the appliance is in production. Anytime the firewall need to be modified you will update the `users.csv` file.

Use the following to edit the file if you are connected over ssh:

```bash hl_lines='1'
cd ~/haas/Haas_Data_collect
nano users.csv
```

When you are finished use the following to `save` and `close` the file:

```bash
ctrl+s
ctrl+x
```

If you are in the Desktop version of Ubuntu you can open the `Files` application and double click on `users.csv`. That will open the file in LibreOffice Calc. Make sure you save the file as `csv` file and not an `odf` or excel format.

----------------------------------------------------------------

### The initial_users.csv file

This is a comma-separated value (csv) file that contains usernames and passwords. These are users authorized to map drives to the appliance. Every user who needs to work with the appliance should be listed in this file. The installation script will create a Linux user account and Samba account for each user in `initial_users.csv`. This would include:

- Haas CNC controls - Use `haassvc` on all machine tools when enabling file sharing. Their role is `user`.
- CNC Programmers - You can map a drive using a Windows user name or use haassvc since the programmers only need to access the shares. Their role would be `user`.
- Operations employees - These are users that will be copying log files for data analysis. You can map a drive using a Windows user name or use haassvc since the programmers only need to access the shares. Their role would be `user`.
- Administrators - These are users that can modify the firewall, add users, etc. Use their Windows user name. Since the appliance isn't integrated into Active Directory, you will have to make up a password for them. Their role would be `administrator`.

#### There are two trains of thoughts on usernames

Use `haassvc` for all CNC controls, programmers, and operations people. They only get r/w access to shares. They cannot manage the appliance.
Use `haassvc` for all CNC controls, use the Windows username for all other users. They only get r/w access to shares. They cannot manage the appliance.

The first method is easier to deploy and maintain, but you lose the ability to track who has been logging in. Verify your company's security policy before deciding on a method to use.

By default, the only user who can run Linux commands with superuser rights is `haas`, the user who installed Ubuntu.

----------------------------------------------------------------

I used `xxxxxxxxx` for all users. This is because GitHub is scanned thousands of times per day by attackers looking for secrets. If I used anything resembling a password, attackers would be publishing my repository all over the dark web. I attended a `Crowdstrike` conference in Las Vegas in 2024. In one of the classes I got to enter `rikosintie` into their `Dark Web` tool. I was stunned that my repositories were listed as having `ssh keys` and passwords in the clear. None of the `ssh keys` or passwords were valid, I had changed several characters in the keys and the passwords were nonsense, but the Dark Web as very excited about them!

Here is the included sample file. Modify it to fit your environment:

```text
username, password
mhubbard, xxxxxxxxx
haassvc, xxxxxxxxx
mchavez, xxxxxxxxx
thubbard, xxxxxxxxx
```

I know it's odd that there are `users.csv` and `initial_users.csv` but there is no secure way to leave passwords lying around in plain text files.

!!! Warning
    This file contains usernames/passwords that the installation script will use to create the Samba shares. You should delete this file as soon as the script finishes the installation.

----------------------------------------------------------------

### The login banner - issue.net

![screenshot](img/tux-authorized2.resized.jpeg)

----------------------------------------------------------------

This is a text file that is displayed ***before*** a user logs in over ssh. The included file is a basic "You need Authorization" banner. Modify it to match your organization's security policy before running the installation script. If you need to update it later, use `sudo nano /etc/issue.net` to open the file. ASCII art is a method of making banners using ASCII characters. I used the [ASCII Art Archive](https://www.asciiart.eu/text-to-ascii-art) to create this banner. You can get much fancier if you want to spend the time! If you are also responsible for network equipment, you can use the approved banner from a switch or router.

----------------------------------------------------------------

```text


                 Haas Data Collection Server

╔═════════════════════════════════════════════════════════════════╗
║                                                                 ║
║ UNAUTHORIZED ACCESS TO THIS NETWORK DEVICE IS PROHIBITED.       ║
║ You must have explicit permission to access or configure this   ║
║ device.  All activities performed on this device are logged and ║
║ violations of this policy may result in disciplinary action.    ║
║                                                                 ║
╚═════════════════════════════════════════════════════════════════╝



```

Use the following to edit the file if you are connected over ssh:

```bash hl_lines='1'
cd ~/haas/Haas_Data_collect
nano issue.net
```

When you are finished use the following to `save` and `close` the file:

```bash hl_lines='1'
ctrl+s
ctrl+x
```

**If you are in the Desktop version of Ubuntu**
Open the `Files` application and right click on `issue.net` and select `Open with text Editor`. That will open the file in `Gnome Text Editor`.

----------------------------------------------------------------

Use the following to edit the file if you are connected over ssh:

```bash hl_lines='1'
cd ~/haas/Haas_Data_collect
sudo initial_users.csv
```

When you are finished use the following to `save` and `close` the file:

```bash hl_lines='1'
ctrl+s
ctrl+x
```

If you are in the Desktop version of Ubuntu you can open the `Files` application and double click on `users.csv`. That will open the file in LibreOffice Calc. Make sure you save the file as `csv` file and not an `odf` or excel format.

----------------------------------------------------------------

## The install script details

The installation script `haas_firewall_install.sh` is written in `bash`, the native Linux language for system administration tasks. I have included comments for every section. You should review the script before running it so that you have an idea what it does.

Use the following to view the file if you are connected over ssh:

```bash hl_lines='1'
cd ~/haas/Haas_Data_collect
cat initial_users.csv
```

**If you are in the Desktop version of Ubuntu**
Open the `Files` application and right click on `haas_firewall_install.sh` and select `Open with text Editor`. That will open the file in `Gnome Text Editor`.

### Run the installation script

In Linux, scripts have to be marked `eXecutable` before you can run them. The files should already have the execute bit set but check with:

```bash hl_lines='1'
cd ~/haas/Haas_Data_collect
ls -l haas_firewall_install.sh
```

```bash title='Command Output'
ls -l haas_firewall_install.sh
-rwxrwxr-x 1 mhubbard mhubbard 14347 Feb  5 15:12 haas_firewall_install.sh
```

If you don't see the `x` in the output, run the following:

```bash linenums='1' hl_lines='1'
chmod +x haas_firewall_install.sh
```

Execute the script using:

```bash linenums='1' hl_lines='1'
cd ~/Haas_Data_collect
./haas_firewall_install.sh
```

There will be a lot of output as the script does it's job! Once it completes, review the output for any error messages. I don't expect any failures, the script has been tested on a Raspberry Pi 5 with an NVME drive, an Intel NUC running Ubuntu Desktop, a virtual machine running ubuntu Desktop.

If there were no errors we can move on to creating the `systemd service files` that will automatically start the scripts when the Raspberry Pi 5 is booted.

----------------------------------------------------------------

## The systemd service files

Ubuntu uses an initialization (init) service named `systemd`. Systemd manages what services are initialized when Ubuntu starts up. We will use `systemd` to manage the Python scripts.

----------------------------------------------------------------

The installation script ***Does Not*** copy any service files so the Python scripts to collect data  are not running immediately after the installation script finishes.

----------------------------------------------------------------

The service files are where you define how to call the Python script when the Pi starts up. In the repository there are six files representing six different machine tools. A service file requires:

- Machine name
- The port to be used on the machine
- The IP address of the CNC controller

These are the machine names, ports and IP addresses in the sample files.

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

### Creating systemd Service files

The systemd service files are located in `/etc/systemd/system/` so you must use sudo to edit them. Think of `sudo` as `UAC` in Windows. The advantage is that you can proactively use `sudo` and not have to deal with pop up dialogs asking for permission!

As an example, let's use the included st40.service file. You should be in the `Haas_Data_collect` directory. You can rename it using `mv st40.service new_name.service`. Use the following to copy `st40.service` to the `/etc/systemd/system/` directory:

`sudo cp st40.service /etc/systemd/system/st40.service`
or
`sudo cp new_name.service /etc/systemd/system/new_name.service`

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

----------------------------------------------------------------

**If you installed the desktop version of Ubuntu**, you can use the GUI Gnome Text Editor GUI to edit the files by running:

`sudo gnome-text-editor /etc/systemd/system/st40.service`

----------------------------------------------------------------

#### What you need to modify

- **Description** - The description is shown when you check the status of the service. Change to something that makes sense in your environment
- **ExecStart** - This is where the table of names, ports, IP addresses comes in handy.

**Nothing else needs to be changed in the service file.**

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

### Create aliases

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

## Samba installation

Key changes:

- Overwrites /etc/samba/smb.conf entirely with tee (without -a)
- Backs up the original to smb.conf.backup first
- Includes all the security settings in the [global] section
- Disables the printer share
- Adds `testparm -s` to validate the configuration before restarting

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
