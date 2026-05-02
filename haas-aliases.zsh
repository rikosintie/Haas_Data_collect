# Example aliases
alias _='sudo '
alias treeh='tree -h'
alias treed='treed -dh'
alias cat='batcat'
# export BAT_THEME="Coldark-Cold"
export BAT_THEME="zenburn"

# Display Linux users
alias lusers='awk -F: '\''$3 >= 1000 {print $1}'\'' /etc/passwd'

# Display Samba users
alias susers='sudo pdbedit -L 2>/dev/null | cut -d: -f1'

# Display hass services
alias haasserv='systemctl list-unit-files --type=service | grep haas'

# Tailspin Aliases
alias t-cockpit='sudo journalctl -u cockpit -f | tspin'
alias t-health='sudo journalctl -u smbd -u ssh -u cockpit -f | tspin'
alias t-samba='sudo journalctl -u smbd -u -f | tspin'
alias t-ssh='sudo tail -f /var/log/auth.log | tspin'
# log for UFW with filtering for multicast traffic
alias t-ufw='journalctl -f --no-pager --grep=BLOCK | grep -Ev 'DST=224\.' | tspin'
# live log for UFW with filtering for multicast traffic
alias t-ufwl='journalctl -f --no-pager --grep=$1 | grep -Ev 'DST=224\.' | tspin'

#Directory aliases
alias haas-log='cd /var/log/'
alias haas-fw-conf='sudo fresh /etc/haas-firewall.conf'
alias haas-repo='cd /home/haas/Haas_Data_collect/'
alias haas-bin='cd /usr/local/sbin'
alias haas-firewall='cd /usr/share/cockpit/haas-firewall/'
alias haas-samba='cd /usr/share/cockpit/manage-samba/'
alias haas-updates='cd /usr/share/cockpit/update-appliance/'
haas-systemd() {
    cd /etc/systemd/system/
    ls -l haas-*
    }
alias haas-sshd='cd /etc/ssh/sshd_config.d/'
