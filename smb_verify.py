#!/usr/bin/env python3
"""
smb_verify.py

Security validation script for SMB exposure and firewall behavior.

Performs:
1. SMB protocol detection using Nmap smb-protocols script
2. Firewall/port accessibility validation

USAGE:
    python3 smb_verify.py --target=<IP> [--expected-access=authorized|unauthorized] [--strict]

OPTIONS:
    --target=<IP>
        Target IP address (required)

    --expected-access=authorized|unauthorized
        Perspective of the test (default: authorized)

    --strict
        Treat WARN conditions as FAIL (useful for CI/CD)
"""

import re
import subprocess
import sys

# ==============================================
# ARG PARSING
# ==============================================
TARGET_IP = None
EXPECTED_ACCESS = "authorized"
STRICT_MODE = False

for arg in sys.argv:
    if arg.startswith("--target="):
        TARGET_IP = arg.split("=", 1)[1]
    elif arg.startswith("--expected-access="):
        EXPECTED_ACCESS = arg.split("=", 1)[1]
    elif arg == "--strict":
        STRICT_MODE = True

if not TARGET_IP:
    print("ERROR: --target=<IP> is required")
    sys.exit(2)

if EXPECTED_ACCESS not in ["authorized", "unauthorized"]:
    print("Invalid value for --expected-access")
    sys.exit(2)

REQUIRED_PORTS = ["22", "445", "9090"]


# ==============================================
# HELPER FUNCTIONS
# ==============================================
def run_cmd(cmd):
    """Execute a shell command and return stdout."""
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=60
        )
        return result.stdout
    except subprocess.TimeoutExpired:
        return ""


def log(test, status, message):
    """Print formatted log output."""
    print(f"{status}: [{test}] {message}")


# ==============================================
# SMB PARSING
# ==============================================
def parse_smb_protocols(nmap_output):
    """
    Parse SMB protocol versions from Nmap smb-protocols output.

    Supports both:
    - Old format: SMBv2, SMBv3
    - New format: dialect numbers (2:1:0, 3:0:0, etc.)

    Returns:
        tuple: (has_smb1, has_smb2, has_smb3)
    """

    # If port is filtered or closed → no SMB
    if re.search(r"445/tcp\s+(filtered|closed)", nmap_output, re.IGNORECASE):
        return False, False, False

    smb_block = []
    capture = False

    for line in nmap_output.splitlines():
        if "smb-protocols" in line:
            capture = True
            continue
        if capture:
            if line.startswith("|") or line.startswith(" "):
                smb_block.append(line.strip())
            else:
                break

    smb_text = "\n".join(smb_block)

    # ---- Detection logic ----

    # SMB1 detection
    has_smb1 = bool(
        re.search(r"SMBv1", smb_text)
        or re.search(r"^\s*\|?\s*1:", smb_text, re.MULTILINE)
    )

    # SMB2 detection
    has_smb2 = bool(
        re.search(r"SMBv2", smb_text)
        or re.search(r"^\s*\|?\s*2:", smb_text, re.MULTILINE)
    )

    # SMB3 detection
    has_smb3 = bool(
        re.search(r"SMBv3", smb_text)
        or re.search(r"^\s*\|?\s*3:", smb_text, re.MULTILINE)
    )

    return has_smb1, has_smb2, has_smb3


# ==============================================
# TESTS
# ==============================================
def test_smb(target_ip, expected_access):
    """Run SMB protocol test."""
    failures = 0
    warnings = 0

    output = run_cmd(
        f"nmap -Pn --host-timeout 30s --script smb-protocols -p 445 {target_ip}"
    )

    has_smb1, has_smb2, has_smb3 = parse_smb_protocols(output)

    if expected_access == "authorized":
        if has_smb1:
            log("SMB", "FAIL", "SMB1 detected (insecure)")
            failures += 1
        elif has_smb2 or has_smb3:
            log("SMB", "PASS", "Modern SMB protocols detected")
        else:
            log("SMB", "FAIL", "No modern SMB protocols detected")
            failures += 1

        smb_grade = "FAIL" if has_smb1 or (not has_smb2 and not has_smb3) else "PASS"

    else:
        if has_smb1 or has_smb2 or has_smb3:
            log(
                "SMB",
                "WARN",
                "SMB reachable from unauthorized host! Firewall issue",
            )
            warnings += 1
            smb_grade = "WARN"
        else:
            log("SMB", "PASS", "Unauthorized host cannot reach SMB (expected)")
            smb_grade = "PASS"

    return smb_grade, failures, warnings


def test_firewall(target_ip, expected_access, required_ports):
    """Run firewall/port accessibility test."""
    failures = 0
    warnings = 0

    output = run_cmd(
        f"nmap -Pn --host-timeout 30s -p {','.join(required_ports)} {target_ip}"
    )

    open_ports = re.findall(r"^(\d+)/tcp\s+open", output, re.MULTILINE)
    open_ports_set = set(open_ports)
    required_ports_set = set(required_ports)

    if expected_access == "authorized":
        missing = required_ports_set - open_ports_set
        if missing:
            log(
                "FIREWALL",
                "FAIL",
                f"Authorized host cannot reach ports: {','.join(sorted(missing))}",
            )
            failures += 1
            status = "DISABLED or MISCONFIGURED"
        else:
            log("FIREWALL", "PASS", "Firewall allowing access (expected)")
            status = "ENABLED"

        access_result = "PASS" if not missing else "FAIL"

    else:
        unexpected = required_ports_set & open_ports_set
        if unexpected:
            log(
                "FIREWALL",
                "WARN",
                f"Unauthorized access allowed! Open ports: {','.join(sorted(unexpected))}",
            )
            warnings += 1
            status = "DISABLED or MISCONFIGURED"
        else:
            log("FIREWALL", "PASS", "Firewall blocking unauthorized access")
            status = "ENABLED"

        access_result = "PASS" if not unexpected else "FAIL"

    return status, access_result, failures, warnings


# ==============================================
# MAIN
# ==============================================
def main():
    """Main execution."""
    smb_grade, smb_fail, smb_warn = test_smb(TARGET_IP, EXPECTED_ACCESS)
    fw_status, access_result, fw_fail, fw_warn = test_firewall(
        TARGET_IP, EXPECTED_ACCESS, REQUIRED_PORTS
    )

    failures = smb_fail + fw_fail
    warnings = smb_warn + fw_warn

    if EXPECTED_ACCESS == "unauthorized":
        overall_secure = (access_result == "PASS") and (smb_grade != "WARN")
    else:
        overall_secure = failures == 0

    print("\n==============================================")
    print("  SECURITY SUMMARY")
    print("==============================================")
    print(f"Target: {TARGET_IP}")
    print(f"Expected Access: {EXPECTED_ACCESS}")
    print(f"Access Result: {access_result}")
    print(f"Overall: {'SECURE' if overall_secure else 'NOT_SECURE'}")
    print(f"Failures: {failures}, Warnings: {warnings}")
    print(f"SMB Grade: {smb_grade}")
    print("==============================================")

    # ==========================================
    # EXIT LOGIC (CI FRIENDLY)
    # ==========================================
    if STRICT_MODE:
        exit_code = 1 if (failures > 0 or warnings > 0) else 0
    else:
        exit_code = failures

    sys.exit(exit_code)


if __name__ == "__main__":
    main()
