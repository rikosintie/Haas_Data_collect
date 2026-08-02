# Directories and aliases

The Linux shell allows a mix of `aliases` and `functions` to simplify common tasks. The zsh shell (terminal) on the appliance has several custom `aliases` and `functions` in the file `/home/haas/.oh-my-zsh/custom/haas-aliases.zsh`. To edit the `haas-aliases.zsh` file, enter `ec1` at the terminal prompt. There is an alias defined that opens it in the `fresh` editor.

These `aliases` and `functions` allow you to:

- Jump to important directories without having to remember the full path
- List the custom `haas` service files in the `/etc/systemd/system/` directory
- View the status of the custom `haas` services.
- Edit the firewall configuration file in `/etc/haas-firewall.conf`
- View the files in the cockpit extension directories
- output the complete path, one element per line
- make a directory and switch to it.

I wrote a book on using Ubuntu for network engineering, the chapter [Build a Great Terminal](https://rikosintie.github.io/Ubuntu4NetworkEngineers/terminal) {: target="_blank" rel="noopener" } dives deeper into setting up a terminal. Here is a link to it: [Build a Great Terminal](https://rikosintie.github.io/Ubuntu4NetworkEngineers/terminal/) {: target="_blank" rel="noopener" }

You don't have to be logged in over ssh to use the terminal. The Cockpit management webpage has a terminal built in. You access the cockpit page at:

- `https://<appliance_ip>:9090`
or
- `http://dns_name:9090` if your appliance is registered in DNS (recommended).

----------------------------------------------------------------

![screenshot](../img/cockpit_terminal.resized.png)

----------------------------------------------------------------

## A shell cheat sheet

If you want to skip the details and dive right in, here is a [Shell Cheat sheet](../appendices/appendix-i-cheatsheet.md) {: target="_blank" rel="noopener" } that is easy to use and covers all of the topics in this appendix.

----------------------------------------------------------------

## Aliases

You can type `haas-` and tap the `tab' key to get a list of the haas aliases for changing directories, listing key files and checking the state of the haas service files. These aliases are added during installation..

```bash
haas- [tab]
```

----------------------------------------------------------------

```bash title='Command Output'
haas-bin
haas-docs
haas-firewall
haas-fw-conf
haas-help
haas-list-functions
haas-lldp-chassis
haas-lldp-interface
haas-lldp-neighbors
haas-lldp-stats
haas-log
haas-repo
haas-samba
haas-services
haas-smb-shares
haas-ssh
haas-sshc
haas-sshc-diff
haas-sshc-diff-verbose
haas-sshd
haas-system
haas-systemd
haas-updates
```

----------------------------------------------------------------

Here are the aliases for directories:

```bash
alias | grep ^haas
```

```bash title='Command Output'
haas-bin='cd /usr/local/sbin'
haas-firewall='cd /usr/share/cockpit/haas-firewall/'
haas-fw-conf='sudo fresh /etc/haas-firewall.conf'
haas-list-functions='print -l ${(k)functions} | grep ^haas | sort'
haas-log='cd /var/log/'
haas-repo='cd /home/haas/Haas_Data_collect/'
haas-samba='cd /usr/share/cockpit/haas-samba/'
haas-services='systemctl list-unit-files --type=service | grep haas'
haas-ssh='cd /etc/ssh/sshd_config.d/'
haas-sshd='sudo fresh /etc/ssh/sshd_config.d/99-haas-hardening.conf'
haas-system='cd /etc/systemd/system'
haas-updates='cd /usr/share/cockpit/haas-update-appliance/'
```

----------------------------------------------------------------

## Aliases for managing - troubleshooting

The following aliases and functions will help you:

- List the state of the haas services
- List the haas service files found in /etc/systemd/system
- Edit the haas-firewall.conf file located in /etc/haas-firewall.conf
- Edit the ssh custom config file located in /etc/ssh/sshd_config.d
- Output logs from the data collection scripts
- Output logs from `cockpit`, `Samba` and `ssh`
- List the Linux users
- List the Samba users

### haas service state

The appliance uses several `systemd services` to accomplish its mission. The `haasserv` alias lists the status of all services that start with `haas`. It's important that you preface all CNC service files with haas when you create them or they will not be listed.

Below is the alias:

`alias haas-services='systemctl list-unit-files --type=service | grep haas'`

```bash hl_lines='2'
┌─[haas@haas] - [/usr/share/cockpit] - [3659]
└─[$] haas-services
```

```bash title='Command Output'
haas-firewall.service                        enabled         enabled
haas-minimill.service                        enabled         enabled
haas-st30.service                            enabled         enabled
haas-st30l.service                           enabled         enabled
haas-st40.service                            enabled         enabled
haas-vf2ss.service                           enabled         enabled
haas-vf5ss.service                           enabled         enabled
```

----------------------------------------------------------------

### List the haas system files

`haas-systemd` is a function. It changes to the `/etc/systemd/system/` directory and then lists the custom `haas` service files. This is very useful if you have more than 5-6 CNC machines. It's easy to forget what you named the service file.

```bash
haas-systemd() {
    cd /etc/systemd/system
    ls -l haas-*
    }
```

Here is the output of running the function:

```unixconfig title='Command Output'
-rw-r--r-- 1 root root 1159 Apr 17 21:00 haas-firewall.service
-rw-r--r-- 1 root root  730 Apr 17 21:00 haas-firewall.timer
-rw-r--r-- 1 root root  327 May  2 08:48 haas-minimill.service
-rw-r--r-- 1 root root  302 Mar 18 18:11 haas-st30.service
-rw-r--r-- 1 root root  305 Mar 18 18:08 haas-st30l.service
-rw-r--r-- 1 root root  302 Mar 18 19:33 haas-st40.service
-rw-r--r-- 1 root root  303 May  2 08:48 haas-vf2ss.service
-rw-r--r-- 1 root root  303 May  2 08:48 haas-vf5ss.service
```

----------------------------------------------------------------

### Edit haas-firewall.conf

The `haas-fw-conf` alias opens the configuration file in the `fresh` editor.

Below is the alias:

```bash
alias haas-fw-conf='sudo fresh /etc/haas-firewall.conf'
```

----------------------------------------------------------------

You can also edit the file using the Cockpit Firewall extension from a browser.

![screenshot](../img/edit-firewall-config.resized.png)

----------------------------------------------------------------

### Edit the ssh config file

The `haas-sshd` alias opens the `/etc/ssh/sshd_config.d/99-haas-hardening.conf` file in the fresh editor. Make sure you use `ctrl+s` to save the file if you make edits. You must restart the ssh daemon using `sudo systemctl restart ssh` or the changes will not be active.

```bash
alias haas-sshd='sudo fresh /etc/ssh/sshd_config.d/99-haas-hardening.conf'
```

----------------------------------------------------------------

### CD to ssh config directory

```bash
alias haas-ssh='cd /etc/ssh/sshd_config.d'
```

----------------------------------------------------------------

### List custom ssh settings

`haas-sshc`. This alias is really long! It runs `sshd -T` but `greps` out the custom settings. It's worth running `sshd -T` and the alias to see all the settings and then just the custom settings.

```bash
alias haas-sshc="sudo sshd -T | grep -E 'permitrootlogin|passwordauthentication|pubkeyauthentication|challengeresponseauthentication|permitemptypasswords|^banner|x11f|macs|^kexalgorithms|hostkey|pubbkeyauth|^port|^maxa|^maxse|grace|allowt|allowa|lastlog|strictm'"
```

```bash
┌─[haas@haas] - [/etc/ssh/sshd_config.d] - [3807]
└─[$] haas-sshc
```

```bash title='Command Output'
port 22
logingracetime 30
maxauthtries 3
maxsessions 2
permitrootlogin no
pubkeyauthentication yes
passwordauthentication yes
printlastlog yes
x11forwarding no
strictmodes yes
permitemptypasswords no
allowtcpforwarding no
allowagentforwarding no
macs hmac-sha2-256-etm@openssh.com,hmac-sha2-512-etm@openssh.com,umac-128-etm@openssh.com
banner /etc/issue.net
hostkeyagent none
kexalgorithms curve25519-sha256,curve25519-sha256@libssh.org
hostkeyalgorithms ssh-ed25519,ssh-ed25519-cert-v01@openssh.com
hostkey /etc/ssh/ssh_host_rsa_key
hostkey /etc/ssh/ssh_host_ecdsa_key
hostkey /etc/ssh/ssh_host_ed25519_key
```

----------------------------------------------------------------

### Output logs

The Linux `journalctl` utility is a powerful tool for querying and dis­play­ing event logs or [logfiles](https://www.ionos.com/digitalguide/online-marketing/web-analytics/log-files-recording-computer-processes/) under Linux.

The aliases for displaying logs start with `t-`. You can enter `t-` and press tab so get a list of all aliases for logs. I use the `t-` for aliases that are used for troubleshooting. I started that on HPE Procurve switches to create a kind of menu for customers. I kept it here because it segments the `haas` aliases and the trouble shooting aliases.

```bash
┌─[haas@haas] - [/etc/ssh/sshd_config.d] - [3857]
└─[$] t-
```

```bash title='Command Output'
t-cockpit  t-health   t-python3  t-samba    t-ssh      t-ufw      t-ufwf
```

----------------------------------------------------------------

#### Script data collection logs

The data collection scripts run constantly after they are installed with a service file. The `t-python3` alias opens the Linux journalctl subsystem and limits the output to python3. Machines that are working correctly don't generate logs. Machines that don't accept the script's connection request will create a log similar to this:

Here is the alias:

`alias t-python3='journalctl -f --no-pager | grep -E 'python3' | tspin'`

```bash linenums='1' hl_lines='1'
┌─[haas@haas] - [~/Haas_Data_collect] - [3892]
└─[$] t-python3
```

```bash title='Command Output'
May 06 15:06:49 haas python3[141790]: [VF2SS] Connection refused. Machine may be offline or not accepting connections.
May 06 15:06:49 haas python3[141790]: [VF2SS] Reconnecting in 5 seconds...
May 06 15:06:49 haas python3[141790]: [VF2SS] Attempting to connect to 192.168.10.141:5053...
```

!!! Note
    It can take up to 2 minutes for the log to be displayed.

You an also see the logs in the Cockpit `Updates-Logs` extension. One advantage of the cockpit extension is that there is a filter for `ip address` and `port` so you can look at just one machine. To open cockpit, enter `https://<appliance_ip>:9090` into a browser.

----------------------------------------------------------------

![screenshot](../img/script-logs.resized.png)

----------------------------------------------------------------

#### UFW firewall Logs

The Linux `Uncomplicated Firewall (UFW)` is used to protect the appliance from unauthorized access based on `ip address` and `port number`. The `t-ufw` alias uses the `jounalctl` utility to display UFW logs. It filters out multicast traffic since UFW on the appliance is set to deny by default which includes multicast. The appliance isn't running any services that depend on multicast.

If you suspect that the appliance is under attach you can use this alias to monitor the firewall logs.

Here is the alias:

`alias t-ufw='journalctl -f --no-pager | grep -Ev 'DST=224\.' | grep -E 'UFW' | tspin`

t-ufw example

```bash hl_lines='2'
┌─[haas@haas] - [~/Haas_Data_collect] - [3863]
└─[$] t-ufw
```

```bash title='Command Output'
May 08 22:23:15 haas kernel: [UFW BLOCK] IN=eth0 OUT= MAC=88:a2:9e:43:4d:de:00:0c:29:e0:a4:db:08:00 SRC=192.168.10.223 DST=192.168.10.122 LEN=60 TOS=0x00 PREC=0x00 TTL=64 ID=42339 DF PROTO=TCP SPT=54264 DPT=5052 WINDOW=64240 RES=0x00 SYN URGP=0
May 08 22:23:16 haas kernel: [UFW ALLOW] IN= OUT=eth0 SRC=192.168.10.141 DST=192.168.10.143 LEN=60 TOS=0x00 PREC=0x00 TTL=64 ID=19567 DF PROTO=TCP SPT=36036 DPT=5055 WINDOW=64240 RES=0x00 SYN URGP=0
```

----------------------------------------------------------------

#### UFW Logs with filter

The `t-ufwf` alias allows you to include a filter. The valid filters are:

- ALLOW - Show only packets that were allowed
- AUDIT - Logging is set to `High` on the UFW firewall so some packets that are not malicious get logged
- BLOCK - You will use this most of the time to see machines that didn't accept the connection request from the data logging script

Here is the alias:

`alias t-ufwf='(){journalctl -f --no-pager --grep=$1 | grep -Ev 'DST=224\.' | tspin}'`

t-ufwf example

```bash linenums='1' hl_lines='1'
┌─[haas@haas] - [~/Haas_Data_collect] - [3888]
└─[$] t-ufwf BLOCK
```

```bash title='Command Output'

```

----------------------------------------------------------------

### Path function

This is an incredibly useful function! Sometimes a command just wont run or isn't found. You can use the `which` command to see where the executable is, then `path to see if the executable is in the path.

```bash
# "path" shows current path, one element per line.
# If an argument is supplied, grep for it.
# example path sbin
path() {
    test -n "$1" && {
        echo $PATH | perl -p -e "s/:/\n/g;" | grep -i "$1"
    } || {
        echo $PATH | perl -p -e "s/:/\n/g;"
    }
}
```

```bash hl_lines='1'
┌─[haas@haas] - [/usr/share/samba] - [3704]
└─[$] path
```

```bash title='Command Output'
/usr/local/bin
/usr/sbin
/usr/bin
/sbin
/bin
/usr/games
/usr/local/games
/snap/bin
```

----------------------------------------------------------------

Search the path for `sbin`

```bash hl_lines='1'
path sbin
```

```bash title='Command Output'
/usr/local/sbin
/usr/sbin
/sbin
```

----------------------------------------------------------------

### Make a directory

This script uses `mkdir -p` to create a directory, and if necessary, the parent path, then switches to the directory. THe function saves several steps when creating the CNC machine folders under the `machines` directory.

You can switch to the `machines` folder, then use `mkd` as shown in teh example below.

```bash
mkd() {
    mkdir -p "$@"
    cd "$@" || exit
}
```

#### Example

```bash linenums='1' hl_lines='1'
┌─[haas@haas] - [~/Haas_Data_collect/machines] - [3715]
└─[$] pwd
/home/haas/Haas_Data_collect/machines
```

```bash hl_lines='2 5' title='Command Output'
┌─[haas@haas] - [~/Haas_Data_collect/machines] - [3717]
└─[$] mkd 01_test/cnc_logs
┌─[haas@haas] - [~/Haas_Data_collect/machines/01_test/cnc_logs] - [3718]
└─[$]
```

----------------------------------------------------------------

### Tree aliases

The tree command is useful when review the CNC directories.

#### treeh

The `treeh` alias displays all of the files in a directory using a `Human Readable` format. That means KB, MB instead of bytes. The alias uses `-h` for human readable and `--dirsfirst` to sort directories. If you don't like that just enter `ec` in the terminal, scroll down to the alias and delete the `--dirsfirst` option.

alias treeh='tree -h --dirsfirst'

```bash linenums='1' hl_lines='1'
┌─[haas@haas] - [~/Haas_Data_collect] - [3839]
└─[$] treeh
```

```bash title='Command Output'
├── [ 12K]  backups
│   ├── [ 301]  users_2026-02-16_00-00-07.csv
│   ├── [ 301]  users_2026-02-16_21-20-35.csv
.
. Output truncated
.
├── [ 215]  users1.csv
├── [4.4K]  validate_users_csv.sh
└── [2.0K]  zshrc

23 directories, 399 files
```

----------------------------------------------------------------

#### treed

The `treed` alias displays all of the directories using a `Human Readable` format. That means KB, MB instead of bytes. The alias uses `-dh` for human readable, directories only  and `--dirsfirst` to sort directories. If you don't like that just enter `ec` in the terminal, scroll down to the alias and delete the `--dirsfirst` option.


`alias treed='tree -dh --dirsfirst'`

```bash hl_lines='2'
┌─[haas@haas] - [~/Haas_Data_collect/machines] - [3842]
└─[$] treed
```

```bash title='Command Output'
[4.0K]  .
├── [4.0K]  01_test
│   └── [4.0K]  cnc_logs
├── [4.0K]  minimill
│   └── [4.0K]  cnc_logs
├── [4.0K]  st30
│   └── [4.0K]  cnc_logs
├── [4.0K]  st30l
│   └── [4.0K]  cnc_logs
└── [4.0K]  st40
    └── [4.0K]  cnc_logs

11 directories
```

----------------------------------------------------------------

## Important Directories

----------------------------------------------------------------

### CNC Machine directories are located under

```bash
/home/haas/Haas_Data_collect/machines
```

----------------------------------------------------------------

### Custom SSH config file is located here

```hash
/etc/ssh/sshd_config.d/99-haas-hardening.conf
```

----------------------------------------------------------------

### Cockpit Extensions are located here

```bash
/usr/share/cockpit/haas-firewall
```

```bash
/usr/share/cockpit/haas-update-appliance
```

```bash
/usr/share/cockpit/haas-samba
```

----------------------------------------------------------------

### Prelogin banner is located here

```bash
/etc/issue.net
```

----------------------------------------------------------------

### Samba files

Configuration file location

```bash
/etc/samba/smb.conf
```

Log files for each machine that connected

```bash
/var/log/samba
```

----------------------------------------------------------------

### Systemd services

The service files for each CNC machine and the firewall are located here:

```bash
/etc/systemd/system
```

----------------------------------------------------------------

### System Scripts

All system scripts for the appliance are located here:

```bash
/usr/local/sbin
```

----------------------------------------------------------------

## Scripts

- build-nmap.sh
- configure_ufw_from_csv.sh
- gh-updater.lib.sh
- haas-install.sh
- haas_firewall_uninstall.sh
- install-tools.sh
- lshares.sh
- manage_users.sh
- rollback_csv.sh
- smb_verify.sh
- ssh_port.sh
- ssh_validate.sh
- update-check.sh
- update-system.sh
- validate_users_csv.sh
