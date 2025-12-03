# Haas_Data_collect

## Python scripts and Haas DPRNT code to output data from NG controls

The Haas CNC control supports a command named DPRNT. It allows data such as date/time, cycle count, cycle time, inspecion data, etc to be sent to a file on a USB Flash drive or a computer. Here is a Haas YouTube video on setting up your machine, writing a program and collecting the data on a Flash drive or PC.

[DRNT](https://youtube.com/watch?v=g7hl2Lw4KdM&si=txrjMdDefbxXeBxp)

The script `Haas_logger.py` starts up and runs continuously until you press `ctrl_c`. When it receives the text string `End of Cycle` it writes the data to disk and resumes listening. 

The port to receive on is a parameter so multiple copies can be started to collect from multiple CNC Machines at the same time.

## Usage examples:
```
# Machine 1
python haas_logger.py --port 5062 --name "Machine1"

# Machine 2
python haas_logger.py --port 5063 --name "Machine2"

# Machine 3
python haas_logger.py -p 5064 -n "Machine3"

# Machine 4
python haas_logger.py -p 5065 -n "Mill_A"

# Machine 5
python haas_logger.py -p 5066 -n "Lathe_B"

# Machine 6
python haas_logger.py -p 5067 -n "VF2"
```

A new file is created each time using the naming format `machine-name_"part-number"_yymmdd_hh:mm:ss.csv`. 

For example - `Machine1_“265-4183”_20251202_151020.csv`

## CNC Program Format

Haas has a YouTube channel and this [video](https://youtube.com/watch?v=g7hl2Lw4KdM&si=txrjMdDefbxXeBxp) clearly explains how to configure the control to send `DPRNT` statements to a USB flash drive or a telnet sever. The sample code can be found [here](https://www.haascnc.com/video/Video-Bonus-Content.html):

## Here is a simple example

```
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
