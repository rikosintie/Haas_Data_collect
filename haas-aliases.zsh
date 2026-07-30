# Custom zsh aliases

# Display Linux users
alias haas-lusers='awk -F: '\''$3 >= 1000 {print $1}'\'' /etc/passwd'

# Display Samba users
alias haas-susers='sudo pdbedit -L 2>/dev/null | cut -d: -f1'

# Display haas services
alias haas-services='systemctl list-unit-files --type=service | grep haas'

# Troubleshooting aliases
alias t-cockpit='sudo journalctl -u cockpit -f | tspin' # cockpit logs colorized with tspin
alias t-health='sudo journalctl -u smbd -u ssh -u cockpit -f | tspin' # logs for Samba, ssh and cockpit colorized with tspin
alias t-samba='sudo journalctl -u smbd -u -f | tspin' # samba logs colorized with tspin
alias t-ssh='sudo tail -f /var/log/auth.log | tspin' # ssh logs colorized with tspin
alias t-python3='journalctl -f --no-pager | grep -E 'python3' | tspin' # haas data collection script logs

alias t-ufw='journalctl -f --no-pager | grep -Ev 'DST=224\.' | grep -E 'UFW' | tspin' # UFW with filtering for multicast traffic

# Directory aliases
alias haas-bin='cd /usr/local/sbin' # Haas custom scripts for appliance management
alias haas-firewall='cd /usr/share/cockpit/haas-firewall/' # The cockpit directory for the firewall extension
alias haas-log='cd /var/log/' # The appliance log files directory
alias haas-repo='cd /home/haas/Haas_Data_collect/' # The appliance repo directory
alias haas-samba='cd /usr/share/cockpit/haas-samba/' # The cockpit directory for the samba extension
alias haas-ssh='cd /etc/ssh/sshd_config.d/' # the sshd_config.d directory for te ssh customization file
alias haas-system='cd /etc/systemd/system' # The haas service files
alias haas-updates='cd /usr/share/cockpit/haas-update-appliance/' # The cockpit directory for the update/logs extension

# List all haas functions
alias haas-list-functions='print -l ${(k)functions} | grep '^haas' | sort'

# Open the firewall configuration file in the default editor with sudo permissions
alias haas-fw-conf='sudo fresh /etc/haas-firewall.conf'

# Runs sshd -T with a grep for just the custom settings
haas-sshc() {
  sudo sshd -T |
    grep -E '^(permitrootlogin|passwordauthentication|pubkeyauthentication|challengeresponseauthentication|permitemptypasswords|banner|x11forwarding|macs|kexalgorithms|hostkey|pubkeyacceptedalgorithms|port|maxauthtries|maxsessions|logingracetime|allowtcpforwarding|allowagentforwarding|printlastlog|strictmodes)' |
    column -t
}

# Show any differences between the running ssh config and /etc/ssh/sshd_config.d/99-haas-hardening.conf
# this should return "No differences in monitored SSH directives."
haas-sshc-diff() {
  local RUNNING="/tmp/haas-sshd-running.$$"
  local HARDENED="/tmp/haas-sshd-hardening.$$"

  # Same pattern used by haas-sshc
  local PATTERN='^(permitrootlogin|passwordauthentication|pubkeyauthentication|challengeresponseauthentication|permitemptypasswords|banner|x11forwarding|macs|kexalgorithms|hostkey|pubkeyacceptedalgorithms|port|maxauthtries|maxsessions|logingracetime|allowtcpforwarding|allowagentforwarding|printlastlog|strictmodes)'

  # Running config (filtered)
  sudo sshd -T | grep -E "$PATTERN" | sort > "$RUNNING"

  # Hardening file (filtered)
  sudo sshd -T -f /etc/ssh/sshd_config.d/99-haas-hardening.conf \
    | grep -E "$PATTERN" | sort > "$HARDENED"

  echo "Comparing SSH security directives:"
  echo "  Running config vs Haas hardening file"
  echo

  if ! diff -u "$HARDENED" "$RUNNING"; then
    echo
    echo "Differences detected."
  else
    echo "No differences in monitored SSH directives."
  fi

  rm -f "$RUNNING" "$HARDENED"
}

# Show any differences between the running ssh config and /etc/ssh/sshd_config.d/99-haas-hardening.conf
# This will return vervose output.
haas-sshc-diff-verbose() {
  local RUNNING="/tmp/haas-sshd-running.$$"
  local HARDENED="/tmp/haas-sshd-hardening.$$"
  local PATTERN='^(permitrootlogin|passwordauthentication|pubkeyauthentication|challengeresponseauthentication|permitemptypasswords|banner|x11forwarding|macs|kexalgorithms|hostkey|pubkeyacceptedalgorithms|port|maxauthtries|maxsessions|logingracetime|allowtcpforwarding|allowagentforwarding|printlastlog|strictmodes)'

  # Running config (filtered)
  sudo sshd -T | grep -E "$PATTERN" | sort > "$RUNNING"

  # Hardening file (filtered)
  sudo sshd -T -f /etc/ssh/sshd_config.d/99-haas-hardening.conf 2>/dev/null \
    | grep -E "$PATTERN" | sort > "$HARDENED"

  echo "============================================================"
  echo "   SSHD SECURITY SETTINGS — VERBOSE SIDE‑BY‑SIDE VIEW"
  echo "============================================================"
  echo "Left  = Haas Hardening File"
  echo "Right = Running sshd Configuration"
  echo

  # ALWAYS show both sides, even if identical
  diff -y "$HARDENED" "$RUNNING" || true

  echo
  echo "Legend:"
  echo "  <   Value differs (hardening file)"
  echo "  >   Value differs (running config)"
  echo "  |   Values differ on same directive"
  echo "  (blank) Values match"
  echo

  rm -f "$RUNNING" "$HARDENED"
}

# Edit the haas SSH hardening configuration file
alias haas-sshd='sudo fresh /etc/ssh/sshd_config.d/99-haas-hardening.conf'

#CD to the sshd_config.d directory where the custom ssh files
alias haas-ssh='cd /etc/ssh/sshd_config.d/'

# Run tree in human-readable format
alias treeh='tree -h --dirsfirst'

#Run tree with directories first
alias treed='tree -dh --dirsfirst'

# Custom Haas Functions

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
haas-lldp-running() {
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
#t-ufwf() {
#    journalctl -f --no-pager --grep="$1" | grep -Ev 'DST=224\.' | tspin
#}

t-ufwf() {
  # Valid filters
  local VALID_FILTERS=("BLOCK" "ALLOW" "AUDIT")

  # Default filter
  local DEFAULT_FILTER="BLOCK"

  # If no argument provided, show usage and valid filters
  if [[ -z "$1" ]]; then
    echo "Usage: t-ufwf <BLOCK|ALLOW|AUDIT>"
    echo "Example: t-ufwf BLOCK"
    echo
    echo "Valid filters:"
    printf '  - %s\n' "${VALID_FILTERS[@]}"
    echo
    echo "Default: $DEFAULT_FILTER"
    echo "Running with default filter..."
    set -- "$DEFAULT_FILTER"
  fi

  # Normalize to uppercase (Zsh syntax)
  local FILTER="${1:u}"

  # Validate filter
  if [[ ! " ${VALID_FILTERS[*]} " =~ " ${FILTER} " ]]; then
    echo "Invalid filter: $1"
    echo "Valid filters:"
    printf '  - %s\n' "${VALID_FILTERS[@]}"
    return 1
  fi

  # Run filtered UFW logs
  journalctl -f --no-pager --grep="$FILTER" \
    | grep -Ev 'DST=224\.' \
    | tspin
}


haas-help() {
  echo "=============================="
  echo "        Haas Commands"
  echo "=============================="

  echo
  echo "== Aliases =="
  alias | grep -E '^(haas|t-)' | sort | sed 's/^/  /' || echo "  (none found)"


  echo
  echo "== Functions =="
  print -l ${(k)functions} | grep -E '^(haas|t-)' | sort | sed 's/^/  /' || echo "  (none found)"

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
t-ufwf               – Follow UFW logs filtered by BLOCK, ALLOW, or AUDIT.
                       Features:
                         • Case‑insensitive filter matching
                         • Usage guard with help message
                         • Lists valid filters when input is missing or invalid
                         • Defaults to BLOCK when no filter is provided
                       Examples:
                         t-ufwf BLOCK
                         t-ufwf allow
                         t-ufwf audit

# Directory shortcuts
haas-bin           – cd /usr/local/sbin
haas-firewall      – cd /usr/share/cockpit/haas-firewall/
haas-log           – cd /var/log/
haas-repo          – cd /home/haas/Haas_Data_collect/
haas-samba         – cd /usr/share/cockpit/haas-samba/
haas-ssh           – cd to sshd_config.d directory
haas-system        – cd /etc/systemd/system
haas-updates       – cd /usr/share/cockpit/haas-update-appliance/

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

haas-lldp-chassis     – Show LLDP chassis info
haas-lldp-interface   – Show LLDP interfaces
haas-lldp-neighbors   – Show LLDP neighbors
haas-lldp-stats       – Show LLDP statistics
haas-smb-shares       – Display Samba shares + paths
haas-sshc             – Display only Haas‑relevant SSH daemon settings
                        Filters sshd -T output to show security‑critical directives:
                       - allowagentforwarding
                       - allowtcpforwarding
                       - banner
                       - challengeresponseauthentication
                       - hostkey
                       - kexalgorithms
                       - logingracetime
                       - macs
                       - maxauthtries
                       - maxsessions
                       - passwordauthentication
                       - permitrootlogin
                       - permitemptypasswords
                       - port
                       - printlastlog
                       - pubkeyacceptedalgorithms
                       - pubkeyauthentication
                       - strictmodes
                       - x11forwarding
haas-sshc-diff       – Compare running SSH daemon settings with the Haas
                       hardening configuration file. Highlights differences
                       between:
                         • sshd -T (effective running configuration)
                         • /etc/ssh/sshd_config.d/99-haas-hardening.conf
                       Useful for verifying that hardening rules are applied
                       correctly and detecting drift after updates or manual
                       edits.
haas-sshc-diff-verbose
                       – Side‑by‑side comparison of SSH security settings.
                         Shows differences between:
                           • Running sshd configuration (sshd -T)
                           • Haas hardening file
                         Only compares critical security directives such as:
                           permitrootlogin, passwordauthentication,
                           pubkeyauthentication, x11forwarding, macs,
                           kexalgorithms, hostkey, port, maxauthtries,
                           maxsessions, allowtcpforwarding, strictmodes, etc.
                         Output is shown in a clean left/right diff view:
                           Left  = Hardening file
                           Right = Running config
                         Useful for visual verification and drift detection.
haas-systemd          – List Haas systemd units

LOGGING
-------

The appliance includes several helper commands for viewing system logs in a
colorized, readable format using the tspin log viewer.

t-cockpit           – Follow Cockpit logs
t-health            – Follow smbd, ssh, and cockpit logs
t-samba             – Follow Samba logs
t-ssh               – Follow SSH authentication logs
t-python3           – Follow Python3 service logs
t-ufw               – Follow UFW logs (filters multicast)
t-ufwf              – Follow UFW logs filtered by BLOCK/ALLOW/AUDIT
                       (case‑insensitive, with usage guard and default filter)

All logging commands stream live output and are colorized for readability.

EOF
}

#========== General Aliases and Functions ==========
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

# shows current path, one element per line.
# If an argument is supplied, grep for it.
# example path sbin
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

# Custom nano wrapper for Zsh with clean timestamped backups and auto-cleanup
# if a file is edited with nano, a backup is created in the backups directory with a timestamp
nano() {
    local backup_dir="/home/haas/Haas_Data_collect/backups"

    # Ensure backup directory exists
    mkdir -p "$backup_dir"

    # 1. Back up existing target files
    for arg in "$@"; do
        # Ignore options/flags (arguments starting with -)
        if [[ "$arg" != -* ]] && [[ -f "$arg" ]]; then
            local filename="$(basename "$arg")"
            local timestamp="$(date +"%Y%m%d_%H%M%S")"

            # Copy original file with timestamp (e.g., myfile_20260730_143500.bak)
            cp -p "$arg" "$backup_dir/${filename}_${timestamp}.bak"
        fi
    done

    # 2. Auto-delete backups older than 30 days
    find "$backup_dir" -type f -name "*.bak" -mtime +30 -delete 2>/dev/null

    # 3. Launch the real nano command
    command nano "$@"
}

# end
