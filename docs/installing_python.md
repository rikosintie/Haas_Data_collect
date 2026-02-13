# Installing Python

The scripts will run on Mac/Linux/Windows. Each of those operating systems requires different steps to install Python, pip, and the script. All three operating systems are covered below.

## Windows 10 and Windows 11

If you haven't done any Python development on your Windows machine, it won't have Python or Git installed. Python is the language the scripts are written in and Git is the industry standard version control system for NetDevOps. Follow the instructions below to install both packages.

Installing Python on Windows is simple.

!!! Note
    Select "Install for all users" during the installation. If you don't select the all users option, only the user account that did the installation will have access.

----------------------------------------------------------------

- Open the Edge browser
- Go to the [Python download Page](https://www.python.org/downloads/)
- Click on the button for Python 3.14.2 (or the latest version)
- Select `Open File` so that the install starts when the download finishes.

### Custom settings

Check the boxes for documentation, pip, `py launcher` and `for all users (requires admin privileges)`. If you don't select the `all users option`, only the user account that did the installation will have access to run the scripts. If you plan to write Python scripts, check the `Tcl/Tk, turtle, IDLE` box and the `Python test suite` boxes.

----------------------------------------------------------------

![screenshot](img/Python.png)

----------------------------------------------------------------

Click next, on this dialog check the check "Add Python to environment variables"

For the path I recommend changing it to `c:\python3.14`. I like to start the script using a batch file and having a space in the path is a pain to deal with.

----------------------------------------------------------------

![screenshot](img/Python1.png)

Click `Install` to finish the installation.

----------------------------------------------------------------

You can use `where python` from a `cmd` terminal to verify that Python is installed.

`where python`

```unixconfig title='Command Output'
C:\python3.14\python.exe
```

You can also use the GUI tool Add or Remove Programs to verify Python is installed.

To verify that `pip` is installed use:

```bash hl_lines='1'
pip --version
```

----------------------------------------------------------------

### Test the Python installation on Windows

type `python`

You should see something like this:

```python title='Command Output'
Python 3.14.2 (tags/v3.14.2:df79316, Dec  5 2025, 17:18:21) [MSC v.1944 64 bit (AMD64)] on win32
Type "help", "copyright", "credits" or "license" for more information.
>>>
```

To quit Python, type:

`quit()`

----------------------------------------------------------------

### Updating Python on Windows

Python doesn't get updated when you run Windows Update. You will need to go back to the [Python Download Page](https://python.org/downloads/windows) and download the latest version.

When you launch the installer:

✔ If you want to upgrade in place
The installer will detect your existing version and offer “Upgrade Now” (for minor versions, e.g., 3.11 → 3.11.x).

✔ If you’re installing a new major version
(e.g., 3.10 → 3.12), Python installs side‑by‑side.
This is normal and expected. You’ll have multiple versions available, and the py launcher lets you choose which one to run.

----------------------------------------------------------------

Run these commands to update the Python Packages that are installed:

- python -m pip list --outdated
- python -m pip install --upgrade [package-name]

----------------------------------------------------------------

### Install Git on Windows

If you are on Windows and don't have git installed, use

`winget install --id Git.Git -e --source winget`

from cmd or PowerShell to install Git.

WinGet, also known as the Windows Package Manager, is pre-installed on Windows 11 versions 21H2 and later. If you don't have Winget installed, you can install it using these steps:

```text
Type Microsoft Store in the Windows search bar, and press Enter
Search for App Installer
Click on Get
```

Or you can install the git package from The Official Git Page. It seems better to use the Microsoft Store, but I'm not a Windows expert.

### Install on macOS

Apple provides a package called xcode-select full of developer tools like Python, git, and gcc (Gnu C Compiler), etc. To install xcode-select

- Open a terminal ( :material-apple-keyboard-command: + spacebar)
- Type xcode-select --install
- Press [enter]

You can list the tools using

`ls /Library/Developer/CommandLineTools/usr/bin/`

You now have Python, git, venv, and many other dev tools.

### Ubuntu 24.04 or higher

Ubuntu comes with Python installed. We only need to install `git` to clone the repository.

`sudo apt install git`

----------------------------------------------------------------

## Clone the Repository

The installation steps are done in the Mac/Linux terminal or cmd.exe/PowerShell on Windows. In my recent testing on Windows 11 24H2, I learned a lot about using PowerShell on Windows 11. I created a page on what my setup looks like. I highly recommend installing the Windows Terminal and setting up PowerShell if you are a Windows user. Here is a link to the page - [Using PowerShell with the Network Discovery scripts](https://rikosintie.github.io/Discovery/Using_PowerShell/). PowerShell is also available on Mac/Linux. The configurations on the "Using PowerShell" page work on all three OSes.

Open the Mac/Linux terminal or cmd/PowerShell terminal and cd to a location you want to install the scripts into. I have a directory named `Tools` that I use to organize tools I download from the Internet.

Then paste the following:

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
