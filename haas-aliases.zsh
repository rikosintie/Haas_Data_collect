# Example aliases
# use an underscore to preface sudo
alias _='sudo '

# Run tree in human-readable format
alias treeh='tree -h'

#Run tree with directories first
alias treed='tree -dh'

alias cat='batcat'
# export BAT_THEME="Coldark-Cold"
export BAT_THEME="zenburn"

# Display Linux users
alias lusers='awk -F: '\''$3 >= 1000 {print $1}'\'' /etc/passwd'

# Display Samba users
alias susers='sudo pdbedit -L 2>/dev/null | cut -d: -f1'

# Display hass services
alias haasserv='systemctl list-unit-files --type=service | grep haas'

# Tailspin logging Aliases
alias t-cockpit='sudo journalctl -u cockpit -f | tspin'
alias t-health='sudo journalctl -u smbd -u ssh -u cockpit -f | tspin'
alias t-samba='sudo journalctl -u smbd -u -f | tspin'
alias t-ssh='sudo tail -f /var/log/auth.log | tspin'

# log for UFW with filtering for multicast traffic
alias t-ufw='journalctl -f --no-pager | grep -Ev 'DST=224\.' | tspin'

# UFW use BLOCK, ALLOW, or AUDIT to filter
alias t-ufwf='(){journalctl -f --no-pager --grep=$1 | grep -Ev 'DST=224\.' | tspin}'

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

# "path" shows current path, one element per line.
# If an argument is supplied, grep for it.
path() {
    test -n "$1" && {
        echo $PATH | perl -p -e "s/:/\n/g;" | grep -i "$1"
    } || {
        echo $PATH | perl -p -e "s/:/\n/g;"
    }
}

# Create a new directory and enter it
mkd() {
    mkdir -p "$@"
    cd "$@" || exit
}

# Display Samaba Shares
smb-shares() {
    while IFS= read -r line; do
        if [[ "$line" ==

\[*\]

 ]]; then
            name="$line"
        fi
        if [[ "$line" == *path\ =* ]]; then
            echo "$name    $line"
        fi
    done < /etc/samba/smb.conf
}
# end
