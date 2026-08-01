# Terminal Aliases & Functions

----------------------------------------------------------------

`setup_zsh.sh` installs zsh + Oh My Zsh for the `haas` user and drops
`haas-aliases.zsh` into `~/.oh-my-zsh/custom/`, so every alias and
function below is available automatically in any SSH session as `haas`.

**Quick reference, without leaving the terminal:**

- `haas-help` — lists every `haas-*`/`t-*` alias and function
- `haas-docs` — the same list, with a description for each

----------------------------------------------------------------

## Inspection aliases

| Alias | What it does |
|---|---|
| `haas-lusers` | List Linux users with UID ≥ 1000 |
| `haas-susers` | List Samba users (`pdbedit -L`) |
| `haas-services` | List systemd unit files containing "haas" |

## Live log streaming (colorized with Tailspin)

| Alias | What it does |
|---|---|
| `t-cockpit` | Follow the Cockpit log |
| `t-health` | Follow smbd, ssh, and Cockpit logs together |
| `t-samba` | Follow the Samba (`smbd`) log |
| `t-ssh` | Follow SSH auth log (`/var/log/auth.log`) |
| `t-python3` | Follow the CNC data-collection script logs |
| `t-ufw` | Follow UFW logs, with multicast traffic (`DST=224.*`) filtered out |

### `t-ufwf <BLOCK\|ALLOW\|AUDIT>`

A friendlier version of `t-ufw` that filters to one UFW action at a
time. Case-insensitive, defaults to `BLOCK` if you run it with no
argument, and prints usage + the valid filter list if you pass something
invalid:

```
t-ufwf BLOCK
t-ufwf allow
t-ufwf audit
```

## Directory shortcuts

| Alias | Goes to |
|---|---|
| `haas-bin` | `/usr/local/sbin` — the appliance management scripts |
| `haas-firewall` | `/usr/share/cockpit/haas-firewall/` |
| `haas-samba` | `/usr/share/cockpit/haas-samba/` |
| `haas-updates` | `/usr/share/cockpit/haas-update-appliance/` |
| `haas-log` | `/var/log/` |
| `haas-repo` | `/home/haas/Haas_Data_collect/` |
| `haas-ssh` | `/etc/ssh/sshd_config.d/` |
| `haas-system` | `/etc/systemd/system` |

## Config editing

| Alias | What it does |
|---|---|
| `haas-fw-conf` | Edit `/etc/haas-firewall.conf` with sudo |
| `haas-sshd` | Edit `/etc/ssh/sshd_config.d/99-haas-hardening.conf` with sudo |

## SSH hardening verification

These compare the *live* sshd configuration against the hardening file
the installer wrote, so you can catch drift from manual edits or
updates:

| Command | What it does |
|---|---|
| `haas-sshc` | Prints just the security-relevant directives from `sshd -T` (the running config) |
| `haas-sshc-diff` | Diffs the running config against the hardening file, filtered to the same directives. Prints "No differences in monitored SSH directives." when clean |
| `haas-sshc-diff-verbose` | Same comparison, but always shows both sides side-by-side (`diff -y`), even when identical — actual differences are colored (yellow for a changed value, red for a directive only present on one side) |
| `haas-sshc-stale` | Checks whether the hardening file has been edited more recently than sshd's last start/reload |

!!! Note "Why haas-sshc-stale exists"
    `sshd -T` only ever reads config *files* — it has no way to see what
    the live `sshd` process actually has loaded in memory. That means if
    you edit the hardening file and run `haas-sshc-diff` without
    reloading sshd first, both sides of the diff will already show your
    new values and report no differences, even though the running
    daemon hasn't picked up the change yet. `haas-sshc-stale` closes
    that gap by comparing the file's modification time against sshd's
    last start time and its last SIGHUP reload (from the journal) —
    `haas-sshc-diff` and `haas-sshc-diff-verbose` both run it
    automatically before comparing, and it tells you to
    `sudo systemctl reload ssh` if the file is newer than either.

Directives checked by all three diff commands: `permitrootlogin`,
`passwordauthentication`, `pubkeyauthentication`,
`challengeresponseauthentication`, `permitemptypasswords`, `banner`,
`x11forwarding`, `macs`, `kexalgorithms`, `hostkey`,
`pubkeyacceptedalgorithms`, `port`, `maxauthtries`, `maxsessions`,
`logingracetime`, `allowtcpforwarding`, `allowagentforwarding`,
`printlastlog`, `strictmodes`.

## LLDP (network neighbor discovery)

| Function | What it does |
|---|---|
| `haas-lldp-neighbors` | `lldpcli show neighbors` |
| `haas-lldp-interface` | `lldpcli show interfaces` |
| `haas-lldp-chassis` | `lldpcli show chassis` |
| `haas-lldp-stats` | `lldpcli show statistics` |
| `haas-lldp-running` | `lldpcli show running-configuration` |

## Other functions

| Function | What it does |
|---|---|
| `haas-systemd` | `cd` to the systemd unit directory and list every `haas-*` file |
| `haas-smb-shares` | Print each Samba share name next to its `path =` line from `smb.conf` |

## Tree helpers

| Alias | What it does |
|---|---|
| `treeh` | `tree -h --dirsfirst` — human-readable sizes, directories first |
| `treed` | `tree -dh --dirsfirst` — directories only |

## General shell helpers

These aren't Haas-specific, but ship in the same file:

| Alias/Function | What it does |
|---|---|
| `ec` | Open `~/.zshrc` in `$EDITOR` |
| `ec1` | Open `haas-aliases.zsh` itself in `$EDITOR` |
| `sc` | Reload the shell (`exec zsh`) after editing either of the above |
| `_` | Shorthand prefix for `sudo ` |
| `cat` | Aliased to `batcat` (syntax-highlighted `cat`), theme `zenburn` |
| `path [filter]` | Print `$PATH`, one entry per line; optionally grep it |
| `mkd <dir>` | `mkdir -p` and `cd` into it in one step |
| `nano <file>` | Wrapped so every file you edit gets a timestamped backup in `backups/` first, with backups older than 30 days auto-pruned |

----------------------------------------------------------------

!!! note "Two things worth a look"
    While reviewing this file: `t-samba` runs
    `sudo journalctl -u smbd -u -f` — the trailing `-u` before `-f` looks
    like a leftover from copy-pasting `t-health` and has no unit name
    after it. Also, `haas-ssh` is defined twice (identically) — once in
    the directory-shortcuts block and again further down. Neither breaks
    anything today, but both are worth cleaning up.
