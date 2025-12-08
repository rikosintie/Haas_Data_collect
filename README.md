# Haas_Data_collect

A repository for scripts and information related to collecting data from Hass CNC machine tools

----------------------------------------------------------------

## Haas Connect

Haas provides a cloud-based monitoring system for all new Next Gen controls. Here is a video describing it:

[Haas Connect Intro](https://youtu.be/bvz6Fdciodo?si=HqzlgCH-FUSv_iA2)

----------------------------------------------------------------

## Python scripts and Haas DPRNT code to output data from NG controls

The Haas CNC control supports a command named DPRNT. It allows data such as date/time, cycle count, cycle time, inspecion data, etc to be sent to a file on a USB Flash drive or a computer. Here is a Haas YouTube video on setting up your machine, writing a program and collecting the data on a Flash drive or PC.

[DRNT for Haas CNC Controls](https://youtube.com/watch?v=g7hl2Lw4KdM&si=txrjMdDefbxXeBxp)

### Configuring the control to output drpnt

On the `settings` page, search for dprnt

- Option 261 - set to tcp port 
- Option 262 - set to User Data
- Option 263 - set to 5052

The port number has to be unique per machine. For example, my shop has six machines:

- Machine1 - set to 5052
- Machine2 - set to 5053
- Machine3 - set to 5054
- Machine4 - set to 5055
- Machine5 - set to 5056
- Machine6 - set to 5057

Here is a screenshot for machine1

<p align="left" width="100%">
    <img width="50%" src="https://github.com/rikosintie/Haas_Data_collect/blob/main/Haas-dprnt.png">
</p>


----------------------------------------------------------------

The script `Haas_logger2.py` starts up and runs continuously until you press `ctrl_c`. When it receives the text string `End of Cycle` it writes the data to disk and resumes listening.

The port to receive on is a parameter, so multiple copies can be started to collect from numerous CNC Machines at the same time.

## Usage examples

```python
# Machine 1
python haas_logger2.py -t 192.168.1.10  --port 5052 --name "Lathe1"

# Machine 2
python haas_logger2.py -t 192.168.1.10  --port 5053 --name "Lathe2"

# Machine 3
python haas_logger2.py -t 192.168.1.10  -p 5054 -n "Lathe3"

# Machine 4
python haas_logger2.py -t 192.168.1.10  -p 5055 -n "Mill1"

# Machine 5
python haas_logger2.py -t 192.168.1.10  -p 5056 -n "Mill2"

# Machine 6
python haas_logger2.py -t 192.168.1.10 -p 5057 -n "Mill3"
```

A new file is created each time using the naming format: `machine-name_"part-number"_yymmdd_hh:mm:ss.csv`.

For example - `Machine1_“265-4183”_20251202_151020.csv`

----------------------------------------------------------------

### Append mode

If you want all data from a machine collected in one file instead of one file per cycle use the `-a` append flag.

```bsh
python haas_logger2.py -h
usage: haas_logger2.py [-h] [-H HOST] [-p PORT] [-n MACHINE_NAME] [-a]

Haas CNC Data Logger - Listens for machine data and saves to files

options:
  -h, --help            show this help message and exit
  -H, --host HOST       Host IP to bind to (default: 0.0.0.0)
  -p, --port PORT       Port to listen on (default: 5052)
  -n, --name MACHINE_NAME
                        Machine name for logging (default: Machine_Port####)
  -a, --append          Append mode: Save all cycles for the same part number to one file

Examples:
    python haas_logger2.py                          # Start on default port 5052 (new file per cycle)
    python haas_logger2.py -a                       # Append mode - all cycles for the same part in one file
    python haas_logger2.py -p 5053                  # Start on custom port
    python haas_logger2.py -p 5052 -n "Mill_1" -a  # Custom name with append mode
    python haas_logger2.py -H 192.168.1.100 -p 5052 # Bind to specific IP. If the server the script is running on has multiple IP addresses.

Notes:
    - In append mode (-a), close CSV files before production runs to avoid file locks
    - If a file is locked, the script will retry 3 times, then create a backup file
    - Use read-only mode in Excel if you need to view data during production
```

One file is created using the naming format: `machine-name_part-number.csv`.

For example - `Machine1_strut.csv`

----------------------------------------------------------------

## CNC Program Format

Haas has a YouTube channel and this [video](https://youtube.com/watch?v=g7hl2Lw4KdM&si=txrjMdDefbxXeBxp) clearly explains how to configure the control to send `DPRNT` statements to a USB flash drive or a telnet sever.

[This page on the Haas site](https://www.haascnc.com/video/Video-Bonus-Content.html) has links to all the Haas videos on YouTube.

The sample code for DPRNT can be found [here](https://www.haascnc.com/content/dam/haascnc/videos/bonus-content/ep63-dprnt/dprntexample_1.nc):

### Here is a simple example

```cnc
%
O03020 (DPRNT PART DATA)
G04 P1. (1 SECOND DWELL, SO WE HAVE A CYCLE TIME)
G103 P1 (LIMIT LOOKAHEAD)
(DPRNT BLANK LINE)
DPRNT[]
(DPRNTS ALL TEXT, A PART NUMBER)
DPRNT[ PART NUMBER: 265-4183, REV. X2]
(DPRNT BLANK LINE)
DPRNT[]
(SIMPLE DATE AND TIME)
DPRNT[ DATE YYMMDD: #3011[60]]
DPRNT[ TIME HHMMSS: #3012[60]]
(DPRNT BLANK LINE)
DPRNT[]
(DPRNT BLANK LINE)
DPRNT[]
(#3901 PARTS COUNTER)
DPRNT[*PARTS*MADE:*#3901[90]]
(DPRNT BLANK LINE)
DPRNT[]
(#3024 LAST PART TIMER)
DPRNT[*TIME,*LAST PART:*#3024[40]*SECONDS]
G103 (RETURN TO NORMAL LOOKAHEAD)
DPRNT[End of Cycle]
M30
%
```

----------------------------------------------------------------

**Screen output from haas_logger2.py when using the Append flag**

```python
python haas_logger2.py --port 5052 -a --name "Machine1"
[Machine1] Haas CNC Data Logger started on 0.0.0.0:5052 (APPEND mode)
[Machine1] Waiting for connections...
[Machine1] TIP: Close CSV files in Excel to avoid file lock issues
[Machine1] Press Ctrl+C to stop
[Machine1] Connection established from ('192.168.10.143', 59994)
[Machine1] Part number detected: “265-4183”
[Machine1] End of cycle detected!
[Machine1] Data appended to: cnc_logs/Machine1_“265-4183”.csv
[Machine1] Connection closed from ('192.168.10.143', 59994)
[Machine1] Connection established from ('192.168.10.143', 46606)
[Machine1] Part number detected: “265-4183”
[Machine1] End of cycle detected!
[Machine1] Data appended to: cnc_logs/Machine1_“265-4183”.csv
[Machine1] Connection closed from ('192.168.10.143', 46606)
```

**Screen output from haas_logger2.py without the Append flag**

```python
python haas_logger2.py --port 5052 --name "Machine1"
[Machine1] Haas CNC Data Logger started on 0.0.0.0:5052
[Machine1] Waiting for connections...
[Machine1] Press Ctrl+C to stop
[Machine1] Connection established from ('127.0.0.1', 43052)
[Machine1] Part number detected: TEST-001
[Machine1] End of cycle detected!
[Machine1] Data saved to: cnc_logs/Machine1_TEST-001_20251202_141427.csv
[Machine1] Connection closed from ('127.0.0.1', 43052)
[Machine1] Connection established from ('127.0.0.1', 56304)
[Machine1] Part number detected: TEST-002
[Machine1] End of cycle detected!
[Machine1] Data saved to: cnc_logs/Machine1_TEST-002_20251202_141537.csv
[Machine1] Connection closed from ('127.0.0.1', 56304)
[Machine1] Connection established from ('127.0.0.1', 49556)
[Machine1] Part number detected: TEST-002
[Machine1] End of cycle detected!
[Machine1] Data saved to: cnc_logs/Machine1_TEST-002_20251202_150918.csv
[Machine1] Connection closed from ('127.0.0.1', 49556)
[Machine1] Connection established from ('127.0.0.1', 39222)
[Machine1] Part number detected: “265-4183”
[Machine1] End of cycle detected!
[Machine1] Data saved to: cnc_logs/Machine1_“265-4183”_20251202_151020.csv
```

----------------------------------------------------------------

## Installing the script

**Windows 10 and Windows 11**

If you haven't done any Python development on your Windows machine, it won't have Python or Git installed. Python is the language the scripts are written in and Git is the industry standard version control system for NetDevOps. Follow the instructions below to install both packages.

Installing Python on Windows is simple.

**NOTE: Select "Install for all users" during the installation. If you don't select the all users option, only the user account that did the installation will have access.**

- click the start menu
- Type Microsoft Store and press Enter
- search for Python 3.12
- Click on the Free button
- click on Get

One advantage of installing Python on Windows is that the installer installs Python, pip, and the Python Virtual Environment venv. You can use where python from cmd.exe to verify that Python is installed.

`where python`
C:\Users\mhubbard\AppData\Local\Microsoft\WindowsApps\python.exe

You can also use the GUI tool Add or Remove Programs to verify Python is installed.

### Test the installation on Windows

type `python`

You should see something like this:

```python
Python 3.12.10 (tags/v3.12.10:0cc8128, Apr  8 2025, 12:21:36) [MSC v.1943 64 bit (AMD64)] on win32
Type "help", "copyright", "credits" or "license" for more information.
```

To quit Python, type:

`quit()`

## Install Git

If you are on Windows and don't have git installed, use

`winget install --id Git.Git -e --source winget`

from cmd or PowerShell to install Git.

WinGet, also known as the Windows Package Manager, is pre-installed on Windows 11 versions 21H2 and later. If you don't have Winget installed, you can install it using these steps:

    Type Microsoft Store in the Windows search bar, and press Enter
    Search for App Installer
    Click on Get

Or you can install the git package from The Official Git Page. It seems better to use the Microsoft Store, but I'm not a Windows expert.

**macOS**

Apple provides a package called xcode-select full of developer tools like Python, git, and gcc (Gnu C Compiler), etc. To install xcode-select

    Open a terminal
    Type xcode-select --install, press enter

You can list the tools using

`ls /Library/Developer/CommandLineTools/usr/bin/`

You now have Python, git, venv, and many other dev tools.

**Ubuntu 24.04 or higher**

Ubuntu comes with Python installed. We only need to install `git` to clone the repository.

`sudo apt install git`

----------------------------------------------------------------

## Clone the Repository

The installation steps are done in the Mac/Linux terminal or cmd.exe/PowerShell on Windows. In my recent testing on Windows 11 24H2, I learned a lot about PowerShell using on Windows 11. I created a page on what my setup looks like. I highly recommend installing the Windows Terminal and setting up PowerShell if you are a Windows user. Here is a link to the page - [Using PowerShell with the Network Discovery scripts](https://rikosintie.github.io/Discovery/Using_PowerShell/). PowerShell is also available on Mac/Linux. The configurations on the "Using PowerShell" page work on all three OSes.

Open the Mac/Linux terminal or cmd/PowerShell and cd to a location you want to install the scripts into. Then paste the following:

```bash
git clone https://github.com/rikosintie/Haas_Data_collect.git
cd Haas_Data_collect
```

The cloning operation creates a subfolder named `Haas_Data_collect`

Inside the folder will be the :

- haas_logger2.py - The script to listen for the Haas machines' output
- cnc_logs - a folder to hold the data files
- dprnt_example.txt - A sample CNC program with the dprnt statements
- README.md - A copy of this README file in markdown format

Note: You should run `git clone https://github.com/rikosintie/Haas_Data_collect.git` on a regular basis. If there are any updates to the project, this will copy them down and overwrite the existing script.

You can now execute the script to collect data.

## If you don't have access to a Haas control

You can use the Linux `netcat` application to simulate a Haas control on a Linux laptop.

- Open a terminal
- paste in `sudo nc -lvkp 5052` and press Enter

You will see `Listening on 0.0.0.0 5052` in the terminal. 

Type the dprnt commands, pressing Enter after each one. 
Type `End of Cycle` to write the data.

```bash
sudo nc -lvkp 5052
[sudo] password for mhubbard: 
Listening on 0.0.0.0 5052
Connection received on 1S1K-G5-5587.pu.pri 41104
PART NUMBER: 265-4183, REV. X2
End of Cycle
```

In this example, my server is at 192.168.10.223.

On the machine with the script running:

```bash
[Machine2] Attempting to connect to 192.168.10.223:5052...
[Machine2] Successfully connected!
[Machine2] Connected to ('192.168.10.223', 5052)
[Machine2] Part number detected: 265-4183
[Machine2] End of cycle detected!
[Machine2] Data saved to: cnc_logs/Machine2_265-4183_20251208_121016.csv
```


