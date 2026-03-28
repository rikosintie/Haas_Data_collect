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

USE_COLOR = sys.stdout.isatty()

# ==============================================
# COLOR DEFINITIONS (ANSI)
# ==============================================
COLOR_RESET = "\033[0m"
COLOR_RED = "\033[31m"
COLOR_GREEN = "\033[32m"
COLOR_YELLOW = "\033[33m"


def colorize(status, text):
    """
    Apply color based on status.

    Args:
        status (str): PASS, FAIL, WARN, SMB
        text (str): Text to colorize

    Returns:
        str: Colored string
    """
    if not USE_COLOR:
        return text
    if status == "PASS":
        return f"{COLOR_GREEN}{text}{COLOR_RESET}"
    elif status == "FAIL":
        return f"{COLOR_RED}{text}{COLOR_RESET}"
    elif status == "WARN":
        return f"{COLOR_YELLOW}{text}{COLOR_RESET}"
    elif status == "SMB":
        return f"{COLOR_GREEN}{text}{COLOR_RESET}"
    return text


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
    """
    Print formatted log output with color.
    """
    colored_status = colorize(status, status)
    print(f"{colored_status}: [{test}] {message}")


# ==============================================
# SMB PARSING
# ==============================================
def parse_smb_protocols(nmap_output):
    """
    Parse SMB protocol versions from Nmap smb-protocols output.

    This implementation:
    - Extracts only the 'dialects:' block
    - Parses numeric dialects (e.g., 2:1:0, 3:0:0)
    - Maps major version:
        1.x -> SMB1
        2.x -> SMB2
        3.x -> SMB3

    Args:
        nmap_output (str): Raw Nmap output.

    Returns:
        tuple: (has_smb1, has_smb2, has_smb3)
    """

    # If port is filtered/closed → no SMB reachable
    if re.search(r"445/tcp\s+(filtered|closed)", nmap_output, re.IGNORECASE):
        return False, False, False

    lines = nmap_output.splitlines()

    in_smb = False
    in_dialects = False
    dialects = []

    for line in lines:
        stripped = line.strip()

        # Enter smb-protocols section
        if "smb-protocols" in stripped:
            in_smb = True
            continue

        if not in_smb:
            continue

        # Enter dialects subsection
        if "dialects" in stripped.lower():
            in_dialects = True
            continue

        # If we hit end of block
        if in_dialects:
            # End conditions (next script or blank)
            if stripped.startswith("|_") or stripped == "":
                break

            # Clean formatting: remove leading "|" and whitespace
            clean = stripped.lstrip("|").strip()

            # Match dialect pattern like 2:1:0
            match = re.match(r"(\d+:\d+:\d+)", clean)
            if match:
                dialects.append(match.group(1))

    # Deduce versions
    major_versions = {int(d.split(":")[0]) for d in dialects}

    has_smb1 = 1 in major_versions
    has_smb2 = 2 in major_versions
    has_smb3 = 3 in major_versions
    COLORIZED_SMB = colorize("SMB", "SMB")
    print(f"{COLORIZED_SMB}: Detected SMB dialects → [{', '.join(dialects)}]")

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
    overall_text = "SECURE" if overall_secure else "NOT_SECURE"
    overall_colored = colorize("PASS" if overall_secure else "FAIL", overall_text)
    print("\n==============================================")
    print("  SECURITY SUMMARY")
    print("==============================================")
    print(f"Target: {TARGET_IP}")
    print(f"Expected Access: {EXPECTED_ACCESS}")
    print(f"Access Result: {access_result}")
    print(f"Overall: {overall_colored}")
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
