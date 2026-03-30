#!/usr/bin/env python3
"""
smb_verify.py

Validate SMB version and firewall behavior for an appliance.

ROLES:
    admin → SSH + SMB + web (22,445,9090)
    user  → SMB only (445)
    none  → no access

USAGE:
    python3 smb_verify.py --target <IP> [--expected-access admin|user|none] [--strict]
"""

import argparse
import re
import subprocess
import sys

# ==============================================
# COLOR SUPPORT
# ==============================================
USE_COLOR = sys.stdout.isatty()

COLOR_RESET = "\033[0m"
COLOR_RED = "\033[31m"
COLOR_GREEN = "\033[32m"
COLOR_YELLOW = "\033[33m"


def colorize(status, text):
    """Apply ANSI color based on status."""
    if not USE_COLOR:
        return text

    if status == "PASS":
        return f"{COLOR_GREEN}{text}{COLOR_RESET}"
    if status == "FAIL":
        return f"{COLOR_RED}{text}{COLOR_RESET}"
    if status == "WARN":
        return f"{COLOR_YELLOW}{text}{COLOR_RESET}"
    return text


COLOR_CYAN = "\033[36m"  # optional alternative to green for informational output


def cyan(text):
    """Force cyan color (for informational output)."""
    if not USE_COLOR:
        return text
    return f"{COLOR_CYAN}{text}{COLOR_RESET}"


def log(test, status, message):
    """Print formatted log output."""
    print(f"{colorize(status, status)}: [{test}] {message}")


# ==============================================
# ARGUMENT PARSING
# ==============================================
def parse_args():
    """Parse command-line arguments."""
    parser = argparse.ArgumentParser(
        description="Validate SMB exposure and firewall behavior."
    )

    parser.add_argument(
        "--target",
        required=True,
        help="Target IP address",
    )

    parser.add_argument(
        "--expected-access",
        choices=["admin", "user", "none"],
        default="admin",
        help="Access role: admin=22,445,9090 | user=445 only | none=no access",
    )

    parser.add_argument(
        "--strict",
        action="store_true",
        help="Treat WARN as FAIL (CI mode)",
    )

    return parser.parse_args()


# ==============================================
# UTIL
# ==============================================
def run_cmd(cmd):
    """Execute shell command and return stdout."""
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=60
        )
        return result.stdout
    except subprocess.TimeoutExpired:
        return ""


# ==============================================
# SMB PARSING
# ==============================================
def parse_smb_protocols(nmap_output):
    """
    Extract SMB dialects and determine protocol support.

    Supports formats:
        2:1:0
        3:0:0
        2.1
        3.0.2

    Returns:
        tuple: (dialects_list, has_smb1, has_smb2, has_smb3)
    """
    if re.search(r"445/tcp\s+(filtered|closed)", nmap_output, re.IGNORECASE):
        return [], False, False, False

    lines = nmap_output.splitlines()

    in_smb = False
    in_dialects = False
    dialects = []

    for line in lines:
        stripped = line.strip()

        if "smb-protocols" in stripped:
            in_smb = True
            continue

        if not in_smb:
            continue

        if "dialects" in stripped.lower():
            in_dialects = True
            continue

        if in_dialects:
            if stripped.startswith("|_") or stripped == "":
                break

            clean = stripped.lstrip("|").strip()

            # Match 2:1:0 OR 2.1 OR 3.0.2
            match = re.match(r"(\d+(?:[:.]\d+)+)", clean)
            if match:
                dialects.append(match.group(1))

    major_versions = {int(d.split(":")[0].split(".")[0]) for d in dialects}

    has_smb1 = 1 in major_versions
    has_smb2 = 2 in major_versions
    has_smb3 = 3 in major_versions

    return dialects, has_smb1, has_smb2, has_smb3


# ==============================================
# TESTS
# ==============================================
def test_smb(target_ip, expected_access):
    """Validate SMB exposure."""
    failures = 0
    warnings = 0

    output = run_cmd(
        f"nmap -Pn --host-timeout 30s --script smb-protocols -p 445 {target_ip}"
    )

    dialects, has_smb1, has_smb2, has_smb3 = parse_smb_protocols(output)

    if dialects:
        # print(f"SMB: Detected SMB dialects → [{', '.join(dialects)}]")
        dialect_str = ", ".join(dialects) if dialects else "NONE"
        print(f"{COLOR_CYAN} SMB{COLOR_RESET}: Detected SMB dialects → [{dialect_str}]")

    if expected_access in ["admin", "user"]:
        if has_smb1:
            log("SMB", "FAIL", "SMB1 detected (insecure)")
            failures += 1
        elif has_smb2 or has_smb3:
            log("SMB", "PASS", "Modern SMB protocols detected")
        else:
            log("SMB", "FAIL", "SMB not reachable when it should be")
            failures += 1

        smb_grade = "FAIL" if has_smb1 or not (has_smb2 or has_smb3) else "PASS"

    else:  # none
        if has_smb1 or has_smb2 or has_smb3:
            log("SMB", "WARN", "SMB reachable when it should be blocked")
            warnings += 1
            smb_grade = "WARN"
        else:
            log("SMB", "PASS", "SMB correctly blocked")
            smb_grade = "PASS"

    return smb_grade, failures, warnings


def test_firewall(target_ip, expected_access, required_ports):
    """Validate firewall behavior."""
    failures = 0
    warnings = 0

    output = run_cmd(
        f"nmap -Pn --host-timeout 30s -p {','.join(required_ports)} {target_ip}"
    )

    open_ports = set(re.findall(r"^(\d+)/tcp\s+open", output, re.MULTILINE))

    if expected_access == "admin":
        expected_open = set(required_ports)
    elif expected_access == "user":
        expected_open = {"445"}
    else:
        expected_open = set()

    unexpected_open = open_ports - expected_open
    missing_expected = expected_open - open_ports

    if missing_expected:
        log("FIREWALL", "FAIL", f"Missing ports: {','.join(sorted(missing_expected))}")
        failures += 1

    if unexpected_open:
        log(
            "FIREWALL",
            "WARN",
            f"Unexpected open ports: {','.join(sorted(unexpected_open))}",
        )
        warnings += 1

    if not missing_expected and not unexpected_open:
        log("FIREWALL", "PASS", "Firewall behavior matches expected role")

    access_result = "PASS" if not missing_expected and not unexpected_open else "FAIL"

    return access_result, failures, warnings


# ==============================================
# MAIN
# ==============================================
def main():
    """Main execution."""
    args = parse_args()

    target = args.target
    expected = args.expected_access
    strict = args.strict

    required_ports = ["22", "445", "9090"]

    smb_grade, smb_fail, smb_warn = test_smb(target, expected)
    fw_result, fw_fail, fw_warn = test_firewall(target, expected, required_ports)

    failures = smb_fail + fw_fail
    warnings = smb_warn + fw_warn

    if expected == "none":
        overall_secure = (fw_result == "PASS") and (smb_grade != "WARN")
    else:
        overall_secure = failures == 0

    if overall_secure:
        if expected == "admin":
            overall_text = "PASS: Admin access verified"
        elif expected == "user":
            overall_text = "PASS: User access verified"
        else:
            overall_text = "PASS: No access as expected"
    else:
        if expected == "admin":
            overall_text = "FAIL: Admin access check failed"
        elif expected == "user":
            overall_text = "FAIL: User access check failed"
        else:
            overall_text = "FAIL: Unexpected access detected"
    overall_colored = colorize("PASS" if overall_secure else "FAIL", overall_text)

    print("\n==============================================")
    print("           SECURITY SUMMARY")
    print("==============================================")
    print(f"         Target: {COLOR_CYAN}{target}{COLOR_RESET}")
    print(f"Expected Access: {COLOR_CYAN}{expected.upper()}{COLOR_RESET}")
    print(f"  Access Result: {colorize(fw_result, fw_result)}")
    print(f"        Overall: {overall_colored}")
    print(
        f"       Failures: {COLOR_CYAN}{failures}{COLOR_RESET}, {COLOR_CYAN}Warnings: {warnings}{COLOR_RESET}"
    )
    print(f"      SMB Grade: {colorize(smb_grade, smb_grade)}")
    print("==============================================")

    if strict:
        sys.exit(1 if (failures > 0 or warnings > 0) else 0)
    else:
        sys.exit(failures)


if __name__ == "__main__":
    main()
