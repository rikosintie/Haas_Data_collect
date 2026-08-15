# Threat Model for Auditors

----------------------------------------------------------------

![screenshot](../appendices/img/tux-threat-model.png)

----------------------------------------------------------------

This threat model describes the security assumptions, expected adversaries, and defensive posture of the Haas Data Collection Appliance.
It is intended to support penetration testing, vendor risk assessments, and internal security reviews.

----------------------------------------------------------------

## 1. Security Objectives

The appliance is designed to:

- Safely collect CNC machine data via Telnet and share via SMBv2
- Provide local administrative access via SSH and Cockpit
- Remain stable, predictable, and low‑maintenance in industrial environments
- Minimize attack surface and eliminate unnecessary functionality
- Prevent unauthorized access, tampering, or lateral movement

The appliance is **not** intended to provide cloud connectivity, Internet remote management, or multi‑tenant operation.

----------------------------------------------------------------

## 2. In‑Scope Threat Actors

The following adversaries are considered within scope:

### 2.1. External Network Attackers

Attackers on the same LAN attempting:

- Port scanning
- Brute‑force authentication
- Exploitation of exposed services
- Lateral movement from compromised shop PCs

**Mitigations:**

- UFW default‑deny
- IP‑restricted access
- SMBv2‑only
- Cockpit restricted to authorized hosts.
- The appliance supports using SSH keys instead of username/password for ssh access.

----------------------------------------------------------------

### 2.2. Malicious or Compromised Internal Users

Users with physical or logical access to the shop network attempting:

- Unauthorized login
- Privilege escalation
- Tampering with configuration or logs
- Accessing machine data they should not see

**Mitigations:**

- Local authentication required
- no guest access
- root login disabled
- file permissions locked down
- Cockpit limited to authorized IPs.

----------------------------------------------------------------

### 2.3. Malware on Nearby Windows Systems

Common in machine shops where unmanaged PCs coexist with CNC equipment.

Potential threats:

- SMB worms
- Credential harvesting
- Lateral movement attempts

**Mitigations:**

- SMBv2/3‑only eliminates `eternal blue` type attacks
- no SMB1
- no guest access
- strict UFW rules
- no Windows‑compatible remote execution surfaces.

The appliance can be used with no Active Directory accounts. See [There are two trains of thoughts on usernames](../build_the_appliance/configuring_appliance.md/#there-are-two-trains-of-thoughts-on-usernames) for more detail.

----------------------------------------------------------------

### 2.4. Opportunistic Attackers on the Internet

These are out of scope because the appliance is **not Internet‑exposed**.
If misconfigured by an MSP, the threat becomes relevant.

**Mitigations:**

- Documented requirement: appliance ***must*** remain on an internal network,firewalled off from the Internet.

----------------------------------------------------------------

## 3. Out‑of‑Scope Threat Actors

These threats are explicitly out of scope for the appliance’s design:

- Nation‑state adversaries
- Advanced persistent threats (APT)
- Hardware supply‑chain attacks
- Physical attacks requiring disassembly or chip‑level access
- Compromise of the CNC machines themselves
- Attacks requiring cloud connectivity (none exists)

The appliance is not intended to withstand high‑budget, targeted attacks.

----------------------------------------------------------------

## 4. Attack Surface Summary

The appliance exposes only three network services, all restricted by IP:

| Service | Purpose | Hardening |
| ------- | -------- | ---------- |
| **SSH (22/tcp)** | Admin access | Key‑only auth (optional), root disabled, modern crypto only |
| **SMB (445/tcp)** | CNC data collection | SMBv2+, no guest, minimal share permissions |
| **Cockpit (9090/tcp)** | Local management UI | IP‑restricted by UFW, minimal modules installed, custom extension inputs reviewed for injection/traversal (see 6.7) |

**No other ports or services are exposed.**

----------------------------------------------------------------

## 5. Key Security Assumptions

The threat model assumes:

- The appliance is deployed on a **trusted internal network**
- Physical access is restricted to **authorized personnel**
- CNC machines are trusted to provide accurate data and are not adversarial
- MSPs follow the documented network requirements (**no WAN exposure**)
- Administrators maintain SSH keys securely
- The shop network is not intentionally hostile

If any of these assumptions are violated, the risk profile changes.

----------------------------------------------------------------

## 6. Identified Risks & Mitigations

### 6.1. Unauthorized Network Access

**Risk:** Attackers attempt to reach SSH, SMB, or Cockpit.

**Mitigation:**

- UFW default‑deny
- IP allowlists
- no guest access
- key‑only SSH optional to prevent `spray and pray`, `brute force` attacks.

----------------------------------------------------------------

### 6.2. Credential Compromise

**Risk:** Stolen passwords or weak credentials.

**Mitigation:**

- No password logins for SSH (optional)
- local accounts only
- Cockpit behind firewall.

----------------------------------------------------------------

### 6.3. Exploitation of Legacy Protocols

**Risk:** SMB1, DSA, CBC ciphers, or other deprecated crypto.

**Mitigation:**

- SMBv2+
- OpenSSH 9.9 modern‑only crypto
- legacy algorithms removed.

See [In Wireshark](../build_the_appliance/create-groups.md/#in-wireshark){target='_blank'} for details.

----------------------------------------------------------------

### 6.4. Lateral Movement

**Risk:** Malware on a Windows PC attempts to pivot into the appliance.

**Mitigation:**

- Strict firewalling
- minimal services
- no remote execution surfaces.

If only local Linux accounts are used there is no risk. See [There are two trains of thoughts on usernames](../build_the_appliance/configuring_appliance.md/#there-are-two-trains-of-thoughts-on-usernames)

----------------------------------------------------------------

### 6.5. Misconfiguration by MSPs

**Risk:** Appliance accidentally exposed to WAN or guest Wi‑Fi.

**Mitigation:**

- Documentation explicitly states internal‑only deployment
- SMB Shares, Cockpit and SSH reject unauthorized IPs

----------------------------------------------------------------

### 6.6. Ransomware

How Ransomware Impacts a Samba Server

If a Windows machine gets hit with ransomware and that user has write access to a Samba share (Haas, st30, etc.):

- The malware will happily encrypt files on the share
- Samba will treat the encryption as legitimate file writes
- Linux permissions and filesystem type (ext4, XFS, Btrfs, ZFS) do not protect you
- Samba does not “filter” or “inspect” file writes — it just writes what the client sends

This is identical to what happens on a Windows file server. Samba is protocol‑compatible, so it inherits the same exposure.

#### What cannot happen

- The ransomware cannot execute on Ubuntu
- It cannot infect Samba binaries
- It cannot spread “into” Linux
- It cannot compromise the OS or Samba daemon

The threat is strictly data‑level, not system‑level.

----------------------------------------------------------------

### 6.7. Custom Cockpit Extension Input Handling

**Risk:** An authenticated Cockpit user — or a penetration tester replaying/fuzzing the underlying WebSocket RPC traffic directly (e.g. with Burp Suite Intruder), bypassing the page's own JavaScript entirely — sends malformed or malicious input to one of the appliance's custom Cockpit extensions (Manage Samba, Updates ‑ Logs, Python Script Services, Firewall Control), attempting to crash a process, inject shell commands, or read/write files outside the intended location.

**Mitigation:**

- All three custom extensions call `cockpit.spawn()` with argument arrays rather than shell strings. Commands execute without a shell interpreter, so injection via `;`, backticks, or `$()` isn't possible no matter what a field contains.
- Where a value must be used inside a shell script, it's passed as a script argument (`$1`), never concatenated into the script's source text.
- Claude found a path‑traversal issue during the security review, in the CSV backup‑rollback script: an unvalidated filename field allowed `../` sequences to escape the intended backup directory. It has been fixed with a `realpath`‑based containment check. See [Securing the Custom Cockpit Extensions](../appendices/appendix-a.md/#securing-the-custom-cockpit-extensions) for the technical detail.
- Fields whose values are also user‑visible expectations (IP addresses, ports, machine names) are additionally restricted client‑side to their expected character set — a defense‑in‑depth/UX measure, not the actual security boundary, since client‑side JavaScript can't be relied on against a tool that talks to cockpit‑bridge directly.

----------------------------------------------------------------

## 7. Residual Risk

Residual risk is low for the intended environment, assuming:

- The appliance remains on an internal network
- Administrators follow documented deployment practices
- Physical access is controlled

Residual risk increases if:

- The appliance is Internet‑exposed
- SSH keys are mishandled
- The shop network is compromised by unmanaged devices

These risks are documented for MSP awareness. The script `smb_verify.sh` can be run from a remote Linux laptop/server to verify.

----------------------------------------------------------------

## 8. Software Supply Chain Attack

The Open Source community is facing more and more supply chain attacks. The appliance has a limited number of packages installed besides Ubuntu itself. You can list the packages installed by the installation script using:

```bash linenums='1' hl_lines='1'
grep -E '(apt|nala)[[:space:]]+install\b' haas-install.sh
grep -E '\-f[[:space:]]+fresh-editor\b' haas-install.sh
```

```bash title='Command Output'
if sudo apt install nala -y; then
if sudo nala install tree -y; then
if sudo nala install python3-pip -y; then
if sudo apt install micro -y; then
if sudo nala install inetutils-traceroute -y; then
if sudo apt install samba -y; then
if sudo apt install smbclient -y; then
if sudo nala install cockpit cockpit-pcp -y; then
rm -f fresh-editor.deb
```

The only packages that are necessary for appliance functionality are:

- samba
- smbclient
- cockpit

The other packages are for convenience. If you want the appliance locked down as much as possible you should remove the extra packages using:

```bash linenums='1' hl_lines='1'
sudo apt remove nala
sudo apt remove python3-pip
sudo apt remove micro
sudo apt remove inetutils-traceroute
sudo dpkg -r fresh
```

The risk from this packages is low since the appliance firewalls off all IP addresses that are authorized.

----------------------------------------------------------------

## 9. Network Visibility & Asset Inventory (LLDP)

An unmanaged or unidentified device on the network is a common finding in
security audits and a common early indicator in incident response — the
core assumption behind "IT/SOC knows about every device on the network"
is that anything they *don't* recognize gets treated as suspicious by
default.

The appliance runs `lldpd` ([IEEE 802.1AB](https://github.com/lldpd/lldpd)),
installed automatically by `haas-install.sh` with no custom configuration,
transmitting and receiving on all interfaces by default. This means:

- The appliance announces its hostname, OS version, and management IP to
  whatever switch port it's connected to, every ~30 seconds.
- It shows up in that switch's own LLDP neighbor table — visible to
  IT/SOC from the network equipment side, independent of the appliance
  itself. This is meaningful for audit purposes specifically *because*
  it's third-party evidence: an auditor pulling neighbor data from the
  switch doesn't have to trust anything the appliance reports about
  itself. [Network Visibility (LLDP)](../manage_the_appliance/lldp.md#what-itsoc-sees-from-their-side)
  has a real example: a Cisco switch's own `show lldp neighbor` output
  identifying the appliance by hostname on a specific port, independent
  of any query run against the appliance itself.
- It supports asset inventory / CMDB reconciliation — the appliance can
  be matched against a switch port and physical location without a site
  visit or manual documentation that can drift out of date.

**Fair characterization of the tradeoff:** LLDP is link-local only (a
single hop, not routed beyond the directly connected switch), so this
exposes hostname/OS/IP information to whatever else shares that same
Ethernet segment. That's not new risk in this threat model specifically
— [Section 5](#5-key-security-assumptions) already assumes the appliance
sits on a trusted internal network, and anything already on that same L2
segment already has direct access to the appliance's exposed services
(SSH/SMB/Cockpit) regardless of LLDP. LLDP doesn't expand what an
on-segment attacker could already reach; it makes the appliance
identifiable to legitimate network management on that same segment.

See [Network Visibility (LLDP)](../manage_the_appliance/lldp.md) for the
operator-facing explanation and
[Troubleshooting: LLDP](../build_the_appliance/TS_cockpit.md#lldp) for
full command output.

----------------------------------------------------------------

## 10. Conclusion

The appliance’s threat model is intentionally simple:
**minimize attack surface, restrict access, use modern cryptography, and avoid unnecessary complexity.**

This design aligns with best practices for industrial environments and supports successful penetration testing outcomes.
