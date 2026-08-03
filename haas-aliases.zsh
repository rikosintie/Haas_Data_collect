# Custom zsh aliases

# Colors (same codes as haas-install.sh, but $'...' quoted so the
# variables hold a real escape byte — works with plain `echo`, `echo -e`,
# and `cat` heredocs alike, unlike a literal "\e[...m" string which only
# `echo -e`/`printf` know how to interpret)
CYAN=$'\e[1;36m'
GREEN=$'\e[1;32m'
YELLOW=$'\e[1;33m'
RED=$'\e[1;31m'
RESET=$'\e[0m'

# Display Linux users
alias haas-lusers='awk -F: '\''$3 >= 1000 {print $1}'\'' /etc/passwd'

# Display Samba users
alias haas-susers='sudo pdbedit -L 2>/dev/null | cut -d: -f1'

# Display haas services files in /etc/systemd/system
alias haas-services='systemctl list-unit-files --type=service | grep haas'

# display the ip, port and name from all haas serivce files
# the files are located in /etc/systemd/system
alias haas-ports="grep -Ei "python3" /etc/systemd/system/haas*.service | cut -d' ' -f4- | sort -k 3"

#display services colorized with bat using "ini" syntax highlighting
# the .service is appended, only type "haas-<machine-name>"
# usage haas-cat haas-st40
haas-cat () {
  systemctl cat $1.service | bat -l ini
}

# Display python script service status
# the .service is appended, only type "haas-<machine-name>"
haas-script () {
   sudo systemctl status $1.service
   }

# Troubleshooting aliases
alias t-cockpit='sudo journalctl -u cockpit -f | tspin' # cockpit logs colorized with tspin
alias t-health='sudo journalctl -u smbd -u ssh -u cockpit -f | tspin' # logs for Samba, ssh and cockpit colorized with tspin
alias t-samba='sudo journalctl -u smbd -f | tspin' # samba logs colorized with tspin
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

# Warn if the SSH hardening file has been edited more recently than sshd
# last (re)started or reloaded. sshd -T only ever reads config fresh from
# disk — it has no idea what the live daemon actually has loaded in memory
# — so haas-sshc-diff/-verbose can't detect "I edited the file but haven't
# reloaded sshd yet" on their own. This checks it separately by comparing
# the file's mtime against sshd's last start time (systemd) and last SIGHUP
# reload (journal), whichever is more recent.
haas-sshc-stale() {
  local conf="/etc/ssh/sshd_config.d/99-haas-hardening.conf"
  local file_mtime start_mtime reload_mtime last_applied

  file_mtime=$(stat -c %Y "$conf" 2>/dev/null)
  if [[ -z "$file_mtime" ]]; then
    echo -e "${RED}ERROR: cannot stat $conf${RESET}"
    return 1
  fi

  start_mtime=$(systemctl show ssh -p ActiveEnterTimestamp --value 2>/dev/null)
  [[ -n "$start_mtime" ]] && start_mtime=$(date -d "$start_mtime" +%s 2>/dev/null)

  reload_mtime=$(sudo journalctl -u ssh --no-pager -q -g 'Received SIGHUP' -n 1 --output=short-unix 2>/dev/null | awk '{print int($1)}')

  last_applied="$start_mtime"
  if [[ -n "$reload_mtime" ]] && (( reload_mtime > ${last_applied:-0} )); then
    last_applied="$reload_mtime"
  fi

  if [[ -z "$last_applied" ]]; then
    echo -e "${YELLOW}[WARN] Could not determine when sshd last (re)loaded its config — skipping staleness check.${RESET}"
    return 1
  fi

  if (( file_mtime > last_applied )); then
    echo -e "${RED}[STALE] $conf was modified after sshd last (re)loaded — the running daemon may not have your changes yet.${RESET}"
    echo "  File modified:        $(date -d @$file_mtime)"
    echo "  sshd last (re)loaded: $(date -d @$last_applied)"
    echo -e "${YELLOW}Run: sudo systemctl reload ssh${RESET}"
    return 1
  fi

  echo -e "${GREEN}[OK] sshd has (re)loaded since $conf was last modified.${RESET}"
  return 0
}

# Show any differences between the running ssh config and /etc/ssh/sshd_config.d/99-haas-hardening.conf
# this should return "No differences in monitored SSH directives."
haas-sshc-diff() {
  haas-sshc-stale
  echo

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
  echo "  Full config chain (sshd_config + includes) vs Haas hardening file alone"
  echo -e "  ${YELLOW}Note: this detects directives overridden elsewhere in the config chain —${RESET}"
  echo -e "  ${YELLOW}it does NOT tell you whether sshd has reloaded (see the check above).${RESET}"
  echo

  if ! diff -u "$HARDENED" "$RUNNING"; then
    echo
    echo -e "${RED}Differences detected.${RESET}"
  else
    echo -e "${GREEN}No differences in monitored SSH directives.${RESET}"
  fi

  rm -f "$RUNNING" "$HARDENED"
}

# Show any differences between the running ssh config and /etc/ssh/sshd_config.d/99-haas-hardening.conf
# This will return vervose output.
haas-sshc-diff-verbose() {
  haas-sshc-stale
  echo

  local RUNNING="/tmp/haas-sshd-running.$$"
  local HARDENED="/tmp/haas-sshd-hardening.$$"
  local PATTERN='^(permitrootlogin|passwordauthentication|pubkeyauthentication|challengeresponseauthentication|permitemptypasswords|banner|x11forwarding|macs|kexalgorithms|hostkey|pubkeyacceptedalgorithms|port|maxauthtries|maxsessions|logingracetime|allowtcpforwarding|allowagentforwarding|printlastlog|strictmodes)'

  # Running config (filtered)
  sudo sshd -T | grep -E "$PATTERN" | sort > "$RUNNING"

  # Hardening file (filtered)
  sudo sshd -T -f /etc/ssh/sshd_config.d/99-haas-hardening.conf 2>/dev/null \
    | grep -E "$PATTERN" | sort > "$HARDENED"

  echo -e "${CYAN}============================================================${RESET}"
  echo -e "${CYAN}   SSHD SECURITY SETTINGS — VERBOSE SIDE‑BY‑SIDE VIEW${RESET}"
  echo -e "${CYAN}============================================================${RESET}"
  echo "Left  = Haas Hardening File (that file alone)"
  echo "Right = Full Config Chain (sshd_config + includes, as currently on disk)"
  echo -e "${YELLOW}Note: this detects directives overridden elsewhere in the config chain —${RESET}"
  echo -e "${YELLOW}it does NOT tell you whether sshd has reloaded (see the check above).${RESET}"
  echo

  # ALWAYS show both sides, even if identical.
  # Color any row diff -y marks as differing. Its marker sits in the
  # gutter between columns, preceded by a space and followed by either a
  # tab or end-of-line — not surrounded by plain spaces on both sides,
  # since diff -y pads with tabs, not spaces.
  #   |  same directive, different value (yellow)
  #   <  only in the hardening file (red)
  #   >  only in the running config (red)
  diff -y "$HARDENED" "$RUNNING" | while IFS= read -r line; do
    if [[ "$line" =~ $'[ \t][|]([ \t]|$)' ]]; then
      echo -e "${YELLOW}${line}${RESET}"
    elif [[ "$line" =~ $'[ \t][<>]([ \t]|$)' ]]; then
      echo -e "${RED}${line}${RESET}"
    else
      echo "$line"
    fi
  done

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
    lldpcli show running-configuration
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
    echo -e "${YELLOW}Usage: t-ufwf <BLOCK|ALLOW|AUDIT>${RESET}"
    echo "Example: t-ufwf BLOCK"
    echo
    echo -e "${CYAN}Valid filters:${RESET}"
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
    echo -e "${RED}Invalid filter: $1${RESET}"
    echo -e "${CYAN}Valid filters:${RESET}"
    printf '  - %s\n' "${VALID_FILTERS[@]}"
    return 1
  fi

  # Run filtered UFW logs
  journalctl -f --no-pager --grep="$FILTER" \
    | grep -Ev 'DST=224\.' \
    | tspin
}


haas-help() {
  echo -e "${CYAN}==============================${RESET}"
  echo -e "${CYAN}        Haas Commands${RESET}"
  echo -e "${CYAN}==============================${RESET}"

  echo
  echo -e "${CYAN}== Aliases ==${RESET}"
  alias | grep -E '^(haas|t-)' | sort | sed 's/^/  /' || echo "  (none found)"


  echo
  echo -e "${CYAN}== Functions ==${RESET}"
  print -l ${(k)functions} | grep -E '^(haas|t-)' | sort | sed 's/^/  /' || echo "  (none found)"

  echo
  echo "Run 'haas-docs' for detailed descriptions."
}

haas-docs() {
  cat <<EOF

${CYAN}==============================${RESET}
${CYAN}        Haas Documentation${RESET}
${CYAN}==============================${RESET}

${CYAN}ALIASES${RESET}
-------

haas-lusers        – List Linux users (UID >= 1000)
haas-susers        – List Samba users
haas-services      – List systemd services containing "haas"
haas-ports         - List ip, port and name from all haas service files

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


${CYAN}FUNCTIONS${RESET}
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
haas-cat <unit>       – systemctl cat <unit>, piped through bat with ini
                        syntax highlighting, e.g. haas-cat haas-st40.service
haas-script <machine> – sudo systemctl status <machine>.service — type just
                        the machine name, .service is appended automatically
haas-systemd          – List Haas systemd units

${CYAN}LOGGING${RESET}
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
