# Haas_Data_collect
Python scripts and Haas DPRNT code to output data from NG controls

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
