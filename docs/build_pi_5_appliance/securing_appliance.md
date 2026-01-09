# Securing the Appliance

----------------------------------------------------------------

![screenshot](img/Tux_firewall1.resized.png)

----------------------------------------------------------------

The appliance is running on Ubuntu 24.04 which has many security features that Canonical has learned from being a very popular Internet Web server OS. Since the Raspberry Pi 5 appliance is only meant to transfer files to/from the Haas CNC control and the programmers, and connect to the Haas CNC controls using a redefined port and IP address to collect data, we can lock it down using local user accounts, file permissions, share permissions and the Uncomplicated Firewall (UFW).

In addition to the Haas CNC ports we define, the Raspberry Pi 5 appliance needs to have SSH exposed to the customer user that is responsible for management of the appliance. Ubuntu 24.04 ships with OpenSSH 9.6 which has removed ssh-dss and made many other legacy protocols optional.You can verify the version using:

```bash  hl_lines='1'
ssh -V
```

```bash title='Command Output'
OpenSSH_9.6p1 Ubuntu-3ubuntu13.14, OpenSSL 3.0.13 30 Jan 2024
```
