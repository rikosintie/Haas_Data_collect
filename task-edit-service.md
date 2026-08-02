# Review directory cockpit_updates

I edited the st40 service in the browser.

I changed the ip address to 192.168.10.143,

-----
[Unit]
Description=Logger for ST40
After=network.target

[Service]
User=haas
WorkingDirectory=/home/haas/Haas_Data_collect/machines/st40
ExecStart=/usr/bin/python3 /home/haas/Haas_Data_collect/haas_logger2.py -a -t 192.168.10.143 --port 5054 --name st40
Type=idle

[Install]
WantedBy=multi-user.target
----

clicked "Save & Reload". The output shows it saving haas-st40.service and reloading the daemon. But the status shows current time/date and the old ip address.

Saving /etc/systemd/system/haas-st40.service...
Saved. Running systemctl daemon-reload...
daemon-reload complete. Restart the service to apply changes.
● haas-st40.service - Logger for ST40
     Loaded: loaded (/etc/systemd/system/haas-st40.service; enabled; preset: enabled)
     Active: active (running) since Thu 2026-07-30 12:15:36 PDT; 2 days ago
   Main PID: 1024 (python3)
      Tasks: 1 (limit: 9063)
     Memory: 6.7M (peak: 7.2M)
        CPU: 4.307s
     CGroup: /system.slice/haas-st40.service
             └─1024 /usr/bin/python3 /home/haas/Haas_Data_collect/haas_logger2.py -a -t 192.168.10.133 --port 5054 --name st40

Aug 01 16:00:22 haas python3[1024]: [st40] Attempting to connect to 192.168.10.133:5054...
Aug 01 16:00:22 haas python3[1024]: [st40] Connection refused. Machine may be offline or not accepting connections.
Aug 01 16:00:22 haas python3[1024]: [st40] Reconnecting in 5 seconds...
Aug 01 16:00:22 haas python3[1024]: [st40] Attempting to connect to 192.168.10.133:5054...
Aug 01 16:00:22 haas python3[1024]: [st40] Connection refused. Machine may be offline or not accepting connections.
Aug 01 16:00:22 haas python3[1024]: [st40] Reconnecting in 5 seconds...
Aug 01 16:00:22 haas python3[1024]: [st40] Attempting to connect to 192.168.10.133:5054...
Aug 01 16:00:22 haas python3[1024]: [st40] Connection refused. Machine may be offline or not accepting connections.
Aug 01 16:00:22 haas python3[1024]: [st40] Reconnecting in 5 seconds...
Aug 01 16:00:22 haas python3[1024]: [st40] Attempting to connect to 192.168.10.133:5054.
