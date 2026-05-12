# Custom aliases

# Display Linux users
alias haas-lusers='awk -F: '\''$3 >= 1000 {print $1}'\'' /etc/passwd'

# Display Samba users
alias haas-susers='sudo pdbedit -L 2>/dev/null | cut -d: -f1'

# Display haas services
alias haas-services='systemctl list-unit-files --type=service | grep haas'

# Tailspin logging Aliases
# list cockpit logs colorized with tspin
alias t-cockpit='sudo journalctl -u cockpit -f | tspin'
# list logs for Samba, ssh and cockpit colorized with tspin
alias t-health='sudo journalctl -u smbd -u ssh -u cockpit -f | tspin'
# list samba logs colorized with tspin
alias t-samba='sudo journalctl -u smbd -u -f | tspin'
# list ssh logs colorized with tspin
alias t-ssh='sudo tail -f /var/log/auth.log | tspin'
# List haas python3 services logs
alias t-python3='journalctl -f --no-pager | grep -E 'python3' | tspin'
# Lost logs for UFW with filtering for multicast traffic
alias t-ufw='journalctl -f --no-pager | grep -Ev 'DST=224\.' | grep -E 'UFW' | tspin'
# List logs for UFW with filter - BLOCK, ALLOW, or AUDIT
# exmample: t-ufwf BLOCK
alias t-ufwf='(){journalctl -f --no-pager --grep=$1 | grep -Ev 'DST=224\.' | tspin}'

#Directory aliases
alias haas-bin='cd /usr/local/sbin'
alias haas-firewall='cd /usr/share/cockpit/haas-firewall/'
alias haas-log='cd /var/log/'
alias haas-repo='cd /home/haas/Haas_Data_collect/'
alias haas-samba='cd /usr/share/cockpit/manage-samba/'
alias haas-system='cd /etc/systemd/system'
alias haas-updates='cd /usr/share/cockpit/update-appliance/'

# Open the firewall configuration file in the default editor with sudo permissions
alias haas-fw-conf='sudo fresh /etc/haas-firewall.conf'

# Runs sshd -T with a grep for just the custom settings
alias haas-sshc="sudo sshd -T | grep -E 'permitrootlogin|passwordauthentication|pubkeyauthentication|challengeresponseauthentication|permitemptypasswords|^banner|x11f|macs|^kexalgorithms|hostkey|pubbkeyauth|^port|^maxa|^maxse|grace|allowt|allowa|lastlog|strictm'"

# Edit the haas SSH hardening configuration file
alias haas-sshd='sudo fresh /etc/ssh/sshd_config.d/99-haas-hardening.conf'

#CD to the sshd_config.d directory where the custom ssh files
alias haas-ssh='cd /etc/ssh/sshd_config.d/'

# Run tree in human-readable format
alias treeh='tree -h --dirsfirst'

#Run tree with directories first
alias treed='tree -dh --dirsfirst'


# Functions
# show network neighbors
haas-lldp-neighbors() {
    lldpcli show neighbors
}
# appliance interfaces
haas-lldp-interface() {
    lldpcli show interfaces
}

# show apppliance chassis
haas-lldp-chassis() {
    lldpcli show chassis
}

# show lldp network statistics
haas-lldp-stats() {
    lldpcli show statistics
}

# show lldp running-configuration
haas-lldp-stats() {
    show running-configuration
}

haas-systemd() {
    cd /etc/systemd/system/
    ls -l haas-*
    }

# Display Samaba Shares
haas-smb-shares() {
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

# UFW use BLOCK, ALLOW, or AUDIT to filter
t-ufwf() {
    journalctl -f --no-pager --grep=$1 | grep -Ev 'DST=224\.' | tspin

}

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

haas-help() {
  echo "=============================="
  echo "        Haas Commands"
  echo "=============================="

  echo
  echo "== Aliases =="
  alias | grep -E '^(haas|t-)' | sed 's/^/  /' || echo "  (none found)"

  echo
  echo "== Functions =="
  print -l ${(k)functions} | grep -E '^(haas|t-)' | sed 's/^/  /' || echo "  (none found)"

  echo
  echo "Run 'haas-docs' for detailed descriptions."
}


haas-docs() {
  cat <<'EOF'

==============================
        Haas Documentation
==============================

ALIASES
-------

haas-lusers        – List Linux users (UID >= 1000)
haas-susers        – List Samba users
haas-services      – List systemd services containing "haas"

# Logging (colorized with Tailspin)
t-cockpit          – Follow cockpit logs (colorized)
t-health           – Follow smbd, ssh, cockpit logs
t-samba            – Follow Samba logs
t-ssh              – Follow SSH auth logs
t-python3          – Follow python3 service logs
t-ufw              – Follow UFW logs (filters multicast)
t-ufwf <FILTER>    – Follow UFW logs filtered by BLOCK/ALLOW/AUDIT

# Directory shortcuts
haas-bin           – cd /usr/local/sbin
haas-firewall      – cd /usr/share/cockpit/haas-firewall/
haas-log           – cd /var/log/
haas-repo          – cd /home/haas/Haas_Data_collect/
haas-samba         – cd /usr/share/cockpit/manage-samba/
haas-ssh           – cd to sshd_config.d directory
haas-system        – cd /etc/systemd/system
haas-updates       – cd /usr/share/cockpit/update-appliance/

# Firewall Config editing
haas-fw-conf       – Edit firewall config with sudo

# SSH settings / configuraition
haas-sshc          – Show custom sshd settings
haas-sshd          – Edit Haas SSH hardening config

# Tree helpers
treeh              – tree -h --dirsfirst
treed              – tree -dh --dirsfirst


FUNCTIONS
---------

haas-lldp-neighbors   – Show LLDP neighbors
haas-lldp-interface   – Show LLDP interfaces
haas-lldp-chassis     – Show LLDP chassis info
haas-lldp-stats       – Show LLDP statistics
haas-systemd          – List Haas systemd units
haas-smb-shares       – Display Samba shares + paths

EOF
}

# open ~/.zshrc using the default editor specified in $EDITOR
alias ec="$EDITOR $HOME/.zshrc"

# open ~/.oh-my-zsh/custom/haas-aliases.zsh
alias ec1='$EDITOR ~/.oh-my-zsh/custom/haas-aliases.zsh'

# rerun ~/.zshrc after making changes
alias sc="exec zsh"

# use an underscore to preface sudo
alias _='sudo '

alias cat='batcat'
# export BAT_THEME="Coldark-Cold"
export BAT_THEME="zenburn"

# end
