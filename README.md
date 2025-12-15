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

The port to receive on is a parameter, so multiple copies can be started on the same server to collect from numerous CNC Machines at the same time.

-t is the IP address of the machine tool. The script will connect to the machine using that IP address like putty does in the Haas Video.

## Usage examples

```python
# Machine 1
python haas_logger2.py -t 192.168.1.11  --port 5052 --name "Lathe1"

# Machine 2
python haas_logger2.py -t 192.168.1.12  --port 5053 --name "Lathe2"

# Machine 3
python haas_logger2.py -t 192.168.1.13  -p 5054 -n "Lathe3"

# Machine 4
python haas_logger2.py -t 192.168.1.14  -p 5055 -n "Mill1"

# Machine 5
python haas_logger2.py -t 192.168.1.15  -p 5056 -n "Mill2"

# Machine 6
python haas_logger2.py -t 192.168.1.16 -p 5057 -n "Mill3"
```

A new file is created each time using the naming format: `machine-name_"part-number"_yymmdd_hh:mm:ss.csv`.

For example - `Machine1_“265-4183”_20251202_151020.csv`

----------------------------------------------------------------

### Append mode

If you want all data from a machine collected in one file instead of one file per cycle use the `-a` append flag.

If you run the script with just `-h` as a flag the following help will be printed to the screen.

```bash
python haas_logger2.py -h
usage: haas_logger2.py [-h] [-H HOST] [-p PORT] [-n MACHINE_NAME] [-a] [-t TARGET_IP]

Haas CNC Data Logger - Listens for or connects to machine data and saves to files

options:
  -h, --help            show this help message and exit
  -H, --host HOST       Host IP to bind to in server mode (default: 0.0.0.0)
  -p, --port PORT       Port to listen on or connect to (default: 5062)
  -n, --name MACHINE_NAME
                        Machine name for logging (default: Machine_Port####)
  -a, --append          Append mode: Save all cycles for same part number to one file
  -t, --target TARGET_IP
                        Target IP address to connect to (client mode). If not specified, runs in server mode.

Examples:
    SERVER MODE (machine connects to you):
    python haas_logger.py                          # Listen on default port 5062
    python haas_logger.py -p 5063 -a               # Listen on port 5063 with append mode
    python haas_logger.py -H 0.0.0.0 -p 5062       # Listen on all interfaces

    CLIENT MODE (you connect to machine):
    python haas_logger.py -t 192.168.1.100         # Connect to machine at this IP
    python haas_logger.py -t 192.168.1.100 -p 5063 # Connect to machine on custom port
    python haas_logger.py -t 192.168.1.100 -a -n "Mill_1"  # Connect with append mode and custom name

Notes:
    - Use -t/--target to connect to a Haas machine (client mode)
    - Without -t, the script waits for the machine to connect (server mode)
    - In append mode (-a), close CSV files before production runs to avoid file locks
    - If a file is locked, the script will retry 3 times then create a backup file
    - In client mode, the script will auto-reconnect if the connection is lost
```

One file is created using the naming format: `machine-name_part-number.csv`.

For example - `Machine1_strut.csv`

**NOTE:** Server mode isn't for use with Haas Data Collection. It's a mode for testing the script.
The haas_simulator.py script is used to send data to the script running in server mode.

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

- Open the Edge browser
- Go to this URL https://www.python.org/downloads/
- Click on the button for Python 3.14.2 (or the latest version)
- Select `Open File` so that the install starts when the download finishes.

### Custom settings

You must select `for all users (requires admin privileges). If you don't select the `all users option`, only the user account that did the installation will have access to run the scripts.

<p align="left" width="100%">
    <img width="50%" src="https://github.com/rikosintie/Haas_Data_collect/blob/main/python.png">
</p>

Click next, on this dialog check the check "Add Python to environment variables"

For the path I recommend changing it to `c:\python3.14`. I like to start the script using a batch file and having a space in the path is a pain to deal with.

Click `Install` to finish the installation.

One advantage of installing Python on Windows is that the installer installs Python, pip, and the Python Virtual Environment venv. You can use where python from cmd.exe to verify that Python is installed.

`where python`
C:\python3.14\python.exe

You can use the GUI tool Add or Remove Programs to verify Python is installed.

### Test the installation on Windows

type `python`

You should see something like this:

```python
Python 3.14.2 (tags/v3.14.2:df79316, Dec  5 2025, 17:18:21) [MSC v.1944 64 bit (AMD64)] on win32
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

----------------------------------------------------------------

## If you can't install git

Open the Edge browser and navigate to [Haas_Data_collect](https://github.com/rikosintie/Haas_Data_collect). Click the green `Code` button. At the bottom you will see `Download ZIP`. Once the zip file is downloaded extract the files.

**NOTE: The unzip process with create two `Haas_Data_collect_main` folders. Navigate to the second one, highlight all the files, cut and paste them into the first folder.**

----------------------------------------------------------------

## Start up files

If you have several Haas machines and want to collect data from all of them it gets tiresome to type the script command for each machine. I have created two Windows batch files that you can modify or your own use.

**This batch file uses the Windows cmd.exe to open a new cmd process for each machine:**

```bash
set PY=C:\Python314\python.exe
set SCRIPT=C:\Users\micha\Downloads\Haas_Data_collect-main\haas_logger2.py

rem Start each CNC logger in its own window

start "ST40"      cmd /k "%PY% %SCRIPT% -t 192.168.0.21 -a -p 5052 -n VF2SS"
start "VF2SS "    cmd /k "%PY% %SCRIPT% -t 192.168.0.22 -a -p 5053 -n VF3"
start "VF5SS "    cmd /k "%PY% %SCRIPT% -t 192.168.0.23 -a -p 5054 -n VF4"
start "MINIMILL"  cmd /k "%PY% %SCRIPT% -t 192.168.0.24 -a -p 5055 -n MINIMILL"
start "ST30"      cmd /k "%PY% %SCRIPT% -t 192.168.0.25 -a -p 5056 -n UMC500"
start "ST30L"     cmd /k "%PY% %SCRIPT% -t 192.168.0.26 -a -p 5057 -n ST20"

exit /b
```

You will need to change the PY variable to match where you installed Python, the `SCRIPT` variable to the path where you unzipped the files.

Then update the IP Addresses and names to match your machines.

----------------------------------------------------------------

**This batch file uses the Windows terminal to open a new tab for each machine:**

```bash
@echo off
REM Launch Haas loggers in separate tabs

wt ^
  new-tab -p "Haas Loggers ST40" ^
  ; new-tab -p "Haas Loggers VF2SS" ^
  ; new-tab -p "Haas Loggers VF5SS" ^
  ; new-tab -p "Haas Loggers MINIMILL" ^
  ; new-tab -p "Haas Loggers ST30" ^
  ; new-tab -p "Haas Loggers ST30L"
```

You will need to change the PY variable to match where you installed Python, the `SCRIPT` variable to the path where you unzipped the files.

Then update the IP Addresses and names to match your machines.

I prefer the terminal script if you have the Windows terminal installed.

----------------------------------------------------------------

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
