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

The script `Haas_logger.py` starts up and runs continuously until you press `ctrl_c`. When it receives the text string `End of Cycle` it writes the data to disk and resumes listening.

The port to receive on is a parameter so multiple copies can be started to collect from multiple CNC Machines at the same time.

## Usage examples

```python
# Machine 1
python haas_logger.py --port 5062 --name "Lathe1"

# Machine 2
python haas_logger.py --port 5063 --name "Lathe2"

# Machine 3
python haas_logger.py -p 5064 -n "Lathe3"

# Machine 4
python haas_logger.py -p 5065 -n "Mill1"

# Machine 5
python haas_logger.py -p 5066 -n "Mill2"

# Machine 6
python haas_logger.py -p 5067 -n "Mill3"
```

A new file is created each time using the naming format: `machine-name_"part-number"_yymmdd_hh:mm:ss.csv`.

For example - `Machine1_“265-4183”_20251202_151020.csv`

----------------------------------------------------------------

### Append mode

If you want all data from a machine collected in one file instead of one file per cycle use the `-a` append flag.

```bsh
python haas_logger.py -h
usage: haas_logger.py [-h] [-H HOST] [-p PORT] [-n MACHINE_NAME] [-a]

Haas CNC Data Logger - Listens for machine data and saves to files

options:
  -h, --help            show this help message and exit
  -H, --host HOST       Host IP to bind to (default: 0.0.0.0)
  -p, --port PORT       Port to listen on (default: 5062)
  -n, --name MACHINE_NAME
                        Machine name for logging (default: Machine_Port####)
  -a, --append          Append mode: Save all cycles for same part number to one file

Examples:
    python haas_logger.py                          # Start on default port 5062 (new file per cycle)
    python haas_logger.py -a                       # Append mode - all cycles for same part in one file
    python haas_logger.py -p 5063                  # Start on custom port
    python haas_logger.py -p 5062 -n "Mill_1" -a  # Custom name with append mode
    python haas_logger.py -H 192.168.1.100 -p 5062 # Bind to specific IP

Notes:
    - In append mode (-a), close CSV files before production runs to avoid file locks
    - If a file is locked, the script will retry 3 times then create a backup file
    - Use read-only mode in Excel if you need to view data during production
```

One file is created using the naming format: `machine-name_part-number.csv`.

For example - `Machine1_strut.csv`

----------------------------------------------------------------

## CNC Program Format

Haas has a YouTube channel and this [video](https://youtube.com/watch?v=g7hl2Lw4KdM&si=txrjMdDefbxXeBxp) clearly explains how to configure the control to send `DPRNT` statements to a USB flash drive or a telnet sever.

[This page on the Haas site](https://www.haascnc.com/video/Video-Bonus-Content.html) has links to all the Haas videos on YouTube.

The sample code for dprnt can be found [here](https://www.haascnc.com/content/dam/haascnc/videos/bonus-content/ep63-dprnt/dprntexample_1.nc):

### Here is a simple example

```cnc
%
O03020 (DPRNT PART DATA)
G04 P1. (1 SECOND DWELL, JUST SO WE HAVE A CYCLE TIME)
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

Screen output from haas_logger.py when using teh Append flag

```python
python haas_logger.py --port 5062 -a --name "Machine1"
[Machine1] Haas CNC Data Logger started on 0.0.0.0:5062 (APPEND mode)
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

Screen output form haas_logger.py without the Append flag

```python
python haas_logger.py --port 5062 --name "Machine1"
[Machine1] Haas CNC Data Logger started on 0.0.0.0:5062
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
