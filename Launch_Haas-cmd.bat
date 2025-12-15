set PY=C:\Python\Python314\python.exe
set SCRIPT=C:\Users\micha\Downloads\Haas_Data_collect-main\haas_logger2.py

rem Start each CNC logger in its own window

start "ST40"      cmd /k "%PY% %SCRIPT% -t 192.168.0.21 -a -p 5052 -n VF2SS"
start "VF2SS "    cmd /k "%PY% %SCRIPT% -t 192.168.0.22 -a -p 5053 -n VF3"
start "VF5SS "    cmd /k "%PY% %SCRIPT% -t 192.168.0.23 -a -p 5054 -n VF4"
start "MINIMILL"  cmd /k "%PY% %SCRIPT% -t 192.168.0.24 -a -p 5055 -n MINIMILL"
start "ST30"      cmd /k "%PY% %SCRIPT% -t 192.168.0.25 -a -p 5056 -n UMC500"
start "ST30L"     cmd /k "%PY% %SCRIPT% -t 192.168.0.26 -a -p 5057 -n ST20"

exit /b