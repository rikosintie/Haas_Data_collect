# SSH Hardening Profile

This appliance includes a hardened OpenSSH configuration designed for secure, predictable, and low‑surface remote management. The goal is to provide strong defaults that meet modern security expectations while remaining simple for MSPs to operate and audit.

The configuration is applied through `/etc/ssh/sshd_config.d/99-haas-hardening.conf`, allowing the base system to remain untouched while enforcing a clear, vendor‑supported security posture.

----------------------------------------------------------------

## 1. Authentication Policy

The appliance supports password and public‑key authentication. All other authentication paths are disabled to reduce complexity and prevent accidental lockouts.

- **PasswordAuthentication yes**
  Standard password logins are allowed for MSPs who rely on them.

- **PubkeyAuthentication yes**
  Strongly recommended for environments that support SSH keys.

- **ChallengeResponseAuthentication no**
  Disables keyboard‑interactive and PAM‑driven challenge flows (e.g., Duo, Okta, TOTP).
  This avoids unexpected MFA prompts and ensures predictable login behavior.
  MSPs with strict MFA requirements may enable this manually.

- **PermitEmptyPasswords no**
  Prevents misconfiguration of accounts without passwords.

- **PermitRootLogin no**
  Root login is disabled; administrators must use sudo.

- **MaxAuthTries 3**
  Limits brute‑force attempts.

- **LoginGraceTime 20**
  Reduces the window for unauthenticated connections.

----------------------------------------------------------------

## 2. Cryptographic Hardening

Only modern, secure cryptographic algorithms are enabled. Legacy and SHA‑1–based algorithms are removed.

- **Protocol 2**
  Explicitly enforces SSH protocol 2.

- **MACs**
hmac-sha2-256-etm@openssh.com,
hmac-sha2-512-etm@openssh.com,
umac-128-etm@openssh.com

Removes all SHA‑1 MACs, including `hmac-sha1`.

- **KexAlgorithms**
curve25519-sha256,
curve25519-sha256@libssh.org

- **HostKeyAlgorithms**
ssh-ed25519,
ssh-ed25519-cert-v01@openssh.com

- **PubkeyAcceptedAlgorithms**
ssh-ed25519,
ssh-ed25519-cert-v01@openssh.com

These settings ensure the appliance uses modern elliptic‑curve cryptography and avoids RSA‑SHA1 signatures.

----------------------------------------------------------------

## 3. Attack Surface Reduction

All SSH features not required for appliance management are disabled. This prevents lateral movement, tunneling, and post‑authentication abuse.

- **AllowAgentForwarding no**
- **AllowTcpForwarding no**
- **PermitTunnel no**
- **GatewayPorts no**
- **X11Forwarding no**
    1. X11 is an old protocol with weak isolation
    1. A compromised remote host could potentially interact with your local display
    1. It increases the complexity of the SSH session
    1. Turning `X11Forwarding` off removes that entire class of risk.
- **Compression no**
- **PermitUserEnvironment no**
- **PermitUserRC no**
(Disables execution of `~/.ssh/rc` even if created.)

These restrictions eliminate common pivoting and persistence mechanisms used in compromised environments.

----------------------------------------------------------------

## 4. Logging and Auditing

The appliance provides clear, auditable SSH logs suitable for MSPs and security reviewers.

- **LogLevel VERBOSE**
Logs key fingerprints and authentication details.

- **PrintLastLog yes**
Displays last login information for accountability.

- **PrintMotd no**
Keeps login output clean and predictable.

- **StrictModes yes**
Ensures secure permissions on user SSH files.

----------------------------------------------------------------

## 5. Network and Port Settings

- **Port 22**
Standard SSH port for compatibility with MSP tooling.

- **Banner /etc/issue.net**
Displays a security banner before authentication.

----------------------------------------------------------------

## 6. Summary of Security Goals

This SSH profile is designed to:

- Provide strong, modern cryptography
- Disable unnecessary SSH features
- Prevent tunneling, forwarding, and agent hijacking
- Avoid ambiguous authentication paths
- Reduce post‑auth persistence vectors
- Maintain compatibility with typical MSP workflows
- Offer clear, auditable logs
- Keep the system predictable and easy to support

MSPs with advanced security requirements (e.g., MFA via Duo/Okta) may extend the configuration, but the default profile is intentionally minimal, secure, and appliance‑appropriate.

----------------------------------------------------------------

### The applied settings

```bash linenums='1' hl_lines='1'
cat /etc/ssh/sshd_config.d/99-haas-hardening.conf
```

```bash title='Command Output'
#pre-authentication login banner
Banner /etc/issue.net
ChallengeResponseAuthentication no
LogLevel VERBOSE
PasswordAuthentication yes
PermitEmptyPasswords no
PermitRootLogin no
PubkeyAuthentication yes
X11Forwarding no
Port 22

# Crypto hardening
Protocol 2
MACs hmac-sha2-256-etm@openssh.com,hmac-sha2-512-etm@openssh.com,umac-128-etm@openssh.com
KexAlgorithms curve25519-sha256,curve25519-sha256@libssh.org
HostKeyAlgorithms ssh-ed25519,ssh-ed25519-cert-v01@openssh.com
PubkeyAcceptedAlgorithms ssh-ed25519,ssh-ed25519-cert-v01@openssh.com

# Attack surface reduction
AllowAgentForwarding no
AllowTcpForwarding no
PermitTunnel no
PermitUserEnvironment no
PermitUserRC no
GatewayPorts no
Compression no

# Authentication behavior
MaxAuthTries 3
MaxSessions 2
LoginGraceTime 30
PrintLastLog yes
PrintMotd no
StrictModes yes
```

----------------------------------------------------------------

## Verification

SSH is a complex protocol. The appliance has been hardened to reduce the attack surface. Use the following method to verify the ssh meets you company's security policy

### Terminal commands

You can use the following from the terminal on the appliance to verify:

```bash
sudo sshd -T
```

But this will display every setting in ssh and is a lot of data to look through. This command will pull the important settings we added:

```bash linenums='1' hl_lines='1'
sudo sshd -T | grep -E 'permitrootlogin|passwordauthentication|pubkeyauthentication|challengeresponseauthentication|permitemptypasswords|^banner|x11f|macs|^kexalgorithms|hostkey|pubbkeyauth'
```

```bash linenums='1' title='Command Output'
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

### Using nmap

If you have [nmap](https://insecure.org){target="_blank} installed on your laptop you can run the following to verify the ssh ciphers exposed by the appliance:

```bash linenums='1' hl_lines='1'
sudo nmap --script ssh2-enum-algos 192.168.10.127
```

```bash title='Command Output'
Starting Nmap 7.95 ( https://nmap.org ) at 2026-03-15 14:40 PDT
Nmap scan report for haas.pu.pri (192.168.10.132)
Host is up (0.027s latency).
Not shown: 997 filtered tcp ports (no-response)
PORT     STATE SERVICE
22/tcp   open  ssh
| ssh2-enum-algos:
|   kex_algorithms: (4)
|       curve25519-sha256
|       curve25519-sha256@libssh.org
|       ext-info-s
|       kex-strict-s-v00@openssh.com
|   server_host_key_algorithms: (1)
|       ssh-ed25519
|   encryption_algorithms: (6)
|       chacha20-poly1305@openssh.com
|       aes128-ctr
|       aes192-ctr
|       aes256-ctr
|       aes128-gcm@openssh.com
|       aes256-gcm@openssh.com
|   mac_algorithms: (3)
|       hmac-sha2-256-etm@openssh.com
|       hmac-sha2-512-etm@openssh.com
|       umac-128-etm@openssh.com
|   compression_algorithms: (1)
|_      none
445/tcp  open  microsoft-Deep Seek
9090/tcp open  zeus-admin
MAC Address: 88:A2:9E:43:4D:DE (Unknown)

Nmap done: 1 IP address (1 host up) scanned in 6.02 seconds
```
