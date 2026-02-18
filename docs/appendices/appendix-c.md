# Appendix C — Threat Model

This threat model describes the security assumptions, expected adversaries, and defensive posture of the Haas Data Collection Appliance.
It is intended to support penetration testing, vendor risk assessments, and internal security reviews.

---

## 1. Security Objectives

The appliance is designed to:

- Safely collect CNC machine data via Telnet and share via SMBv2
- Provide local administrative access via SSH and Cockpit
- Remain stable, predictable, and low‑maintenance in industrial environments
- Minimize attack surface and eliminate unnecessary functionality
- Prevent unauthorized access, tampering, or lateral movement

The appliance is **not** intended to provide cloud connectivity, remote management, or multi‑tenant operation.

---

## 2. In‑Scope Threat Actors

The following adversaries are considered within scope:

### 2.1. External Network Attackers

Attackers on the same LAN attempting:

- Port scanning
- Brute‑force authentication
- Exploitation of exposed services
- Lateral movement from compromised shop PCs

**Mitigations:**
UFW default‑deny, IP‑restricted access, SMBv2‑only, Cockpit restricted to authorized hosts. The appliance support using SSH keys instead of username/password for ssh access.

---

### 2.2. Malicious or Compromised Internal Users

Users with physical or logical access to the shop network attempting:

- Unauthorized login
- Privilege escalation
- Tampering with configuration or logs
- Accessing machine data they should not see

**Mitigations:**
Local authentication required, no guest access, root login disabled, file permissions locked down, Cockpit limited to authorized IPs.

---

### 2.3. Malware on Nearby Windows Systems

Common in machine shops where unmanaged PCs coexist with CNC equipment.

Potential threats:

- SMB worms
- Credential harvesting
- Lateral movement attempts

**Mitigations:**
SMBv2‑only, no SMB1, no guest access, strict UFW rules, no Windows‑compatible remote execution surfaces.

---

### 2.4. Opportunistic Attackers on the Internet

These are out of scope because the appliance is **not Internet‑exposed**.
If misconfigured by an MSP, the threat becomes relevant.

**Mitigations:**
Documented requirement: appliance must remain on an internal, non‑routable network.

---

## 3. Out‑of‑Scope Threat Actors

These threats are explicitly out of scope for the appliance’s design:

- Nation‑state adversaries
- Advanced persistent threats (APT)
- Hardware supply‑chain attacks
- Physical attacks requiring disassembly or chip‑level access
- Compromise of the CNC machines themselves
- Attacks requiring cloud connectivity (none exists)

The appliance is not intended to withstand high‑budget, targeted attacks.

---

## 4. Attack Surface Summary

The appliance exposes only three network services, all restricted by IP:

| Service | Purpose | Hardening |
| ------- | -------- | ---------- |
| **SSH (22/tcp)** | Admin access | Key‑only auth, root disabled, modern crypto only |
| **SMB (445/tcp)** | CNC data collection | SMBv2+, no guest, minimal share |
| **Cockpit (9090/tcp)** | Local management UI | HTTPS, IP‑restricted, minimal modules |

No other ports or services are exposed.

---

## 5. Key Security Assumptions

The threat model assumes:

- The appliance is deployed on a **trusted internal network**
- Physical access is restricted to authorized personnel
- CNC machines are trusted to provide accurate data and are not adversarial
- MSPs follow the documented network requirements (no WAN exposure)
- Administrators maintain SSH keys securely
- The shop network is not intentionally hostile

If any of these assumptions are violated, the risk profile changes.

---

## 6. Identified Risks & Mitigations

### 6.1. Unauthorized Network Access
**Risk:** Attackers attempt to reach SSH, SMB, or Cockpit.
**Mitigation:** UFW default‑deny, IP allowlists, no guest access, key‑only SSH.

---

### 6.2. Credential Compromise
**Risk:** Stolen passwords or weak credentials.
**Mitigation:** No password logins for SSH, local accounts only, Cockpit behind firewall.

---

### 6.3. Exploitation of Legacy Protocols
**Risk:** SMB1, DSA, CBC ciphers, or other deprecated crypto.
**Mitigation:** SMBv2+, OpenSSH 9.9 modern‑only crypto, legacy algorithms removed.

---

### 6.4. Lateral Movement
**Risk:** Malware on a Windows PC attempts to pivot into the appliance.
**Mitigation:** Strict firewalling, minimal services, no remote execution surfaces.

---

### 6.5. Misconfiguration by MSPs
**Risk:** Appliance accidentally exposed to WAN or guest Wi‑Fi.
**Mitigation:** Documentation explicitly states internal‑only deployment; Cockpit and SSH reject unauthorized IPs.

---

## 7. Residual Risk

Residual risk is low for the intended environment, assuming:

- The appliance remains on an internal network
- Administrators follow documented deployment practices
- Physical access is controlled

Residual risk increases if:

- The appliance is Internet‑exposed
- SSH keys are mishandled
- The shop network is compromised by unmanaged devices

These risks are documented for MSP awareness.

---

## 8. Conclusion

The appliance’s threat model is intentionally simple:
**minimize attack surface, restrict access, use modern cryptography, and avoid unnecessary complexity.**

This design aligns with best practices for industrial environments and supports successful penetration testing outcomes.
