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

---

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

---

## 3. Attack Surface Reduction

All SSH features not required for appliance management are disabled. This prevents lateral movement, tunneling, and post‑authentication abuse.

- **AllowAgentForwarding no**
- **AllowTcpForwarding no**
- **PermitTunnel no**
- **GatewayPorts no**
- **X11Forwarding no**
- **Compression no**
- **PermitUserEnvironment no**
- **PermitUserRC no**
(Disables execution of `~/.ssh/rc` even if created.)

These restrictions eliminate common pivoting and persistence mechanisms used in compromised environments.

---

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

---

## 5. Network and Port Settings

- **Port 22**
Standard SSH port for compatibility with MSP tooling.

- **Banner /etc/issue.net**
Displays a security banner before authentication.

---

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
