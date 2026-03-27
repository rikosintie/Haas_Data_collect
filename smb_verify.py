#!/usr/bin/env python3
import json
import re
import subprocess
import sys

# ==============================================
# CONFIGURATION
# ==============================================
TARGET_IP = "192.168.10.127"
SMB_USER = "haas"
REQUIRED_PORTS = ["22", "445", "9090"]
JSON_MODE = "--json" in sys.argv

# ==============================================
# ARG PARSING FOR EXPECTED ACCESS
# ==============================================
EXPECTED_ACCESS = "authorized"  # default
for arg in sys.argv:
    if arg.startswith("--expected-access"):
        try:
            EXPECTED_ACCESS = arg.split("=")[1]
        except IndexError:
            print("Usage: --expected-access=authorized|unauthorized")
            sys.exit(2)

if EXPECTED_ACCESS not in ["authorized", "unauthorized"]:
    print("Invalid value for --expected-access (authorized|unauthorized)")
    sys.exit(2)


# ==============================================
# HELPER FUNCTIONS
# ==============================================
def run_cmd(cmd):
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=60
        )
        return result.stdout
    except subprocess.TimeoutExpired:
        return ""


def log(test, status, message):
    print(f"{status}: [{test}] {message}")


# ==============================================
# RESULTS STRUCTURE
# ==============================================
results = {"target": TARGET_IP, "summary": {}, "tests": {}}
FAILURES = 0
WARNINGS = 0

# ==============================================
# TEST 1: SMB Protocols
# ==============================================
if EXPECTED_ACCESS == "authorized":
    output = run_cmd(
        f"nmap -Pn --open --host-timeout 30s --script smb-protocols -p 445 {TARGET_IP}"
    )
    has_smb1 = "1.0" in output
    has_smb2 = bool(re.search(r"2:", output))
    has_smb3 = bool(re.search(r"3:", output))

    if has_smb1:
        log("SMB", "FAIL", "SMB1 detected (insecure)")
        FAILURES += 1
    elif has_smb2 or has_smb3:
        log("SMB", "PASS", "Modern SMB protocols detected")
    else:
        log("SMB", "FAIL", "No modern SMB protocols detected")
        FAILURES += 1

    SMB_GRADE = "FAIL" if has_smb1 or (not has_smb2 and not has_smb3) else "PASS"

else:  # unauthorized host
    output = run_cmd(
        f"nmap -Pn --open --host-timeout 30s --script smb-protocols -p 445 {TARGET_IP}"
    )
    smb_detected = bool(re.search(r"2:|3:", output))
    smb1_detected = "1.0" in output

    if smb_detected or smb1_detected:
        log(
            "SMB",
            "WARN",
            "SMB reachable from unauthorized host! Firewall may be misconfigured",
        )
        WARNINGS += 1
        SMB_GRADE = "WARN"
    else:
        log("SMB", "PASS", "Unauthorized host cannot reach SMB services (expected)")
        SMB_GRADE = "PASS"

results["tests"]["smb_protocols"] = {
    "smb1_detected": has_smb1 if EXPECTED_ACCESS == "authorized" else False,
    "smb2_detected": has_smb2 if EXPECTED_ACCESS == "authorized" else False,
    "smb3_detected": has_smb3 if EXPECTED_ACCESS == "authorized" else False,
    "smb_grade": SMB_GRADE,
}

# ==============================================
# TEST 2: Check Firewall / Ports
# ==============================================
# Scan all required ports
nmap_output = run_cmd(
    f"nmap -Pn --open --host-timeout 30s -p {','.join(REQUIRED_PORTS)} {TARGET_IP}"
)

# Robust open ports parsing
open_ports = re.findall(r"^(\d+)/tcp\s+open", nmap_output, re.MULTILINE)

open_ports_set = set(p.strip() for p in open_ports)
required_ports_set = set(REQUIRED_PORTS)

if EXPECTED_ACCESS == "authorized":
    missing_ports = required_ports_set - open_ports_set
    if missing_ports:
        FIREWALL_STATUS = "DISABLED or MISCONFIGURED"
        log(
            "FIREWALL",
            "FAIL",
            f"Authorized host cannot reach ports: {','.join(sorted(missing_ports))}",
        )
        FAILURES += 1
    else:
        FIREWALL_STATUS = "ENABLED"
        log(
            "FIREWALL",
            "PASS",
            "Firewall allowing access from authorized host (expected)",
        )
    ACCESS_RESULT = "PASS" if not missing_ports else "FAIL"

else:  # unauthorized
    unexpected_ports = required_ports_set & open_ports_set
    if unexpected_ports:
        FIREWALL_STATUS = "DISABLED or MISCONFIGURED"
        log(
            "FIREWALL",
            "WARN",
            f"Firewall allowing access from unauthorized host! Open ports: {','.join(sorted(unexpected_ports))}",
        )
        WARNINGS += 1
    else:
        FIREWALL_STATUS = "ENABLED"
        log(
            "FIREWALL",
            "PASS",
            "Firewall blocking all required ports from unauthorized host (expected)",
        )
    ACCESS_RESULT = "PASS" if not unexpected_ports else "FAIL"

results["tests"]["firewall_status"] = FIREWALL_STATUS
results["summary"]["access_result"] = ACCESS_RESULT

# ==============================================
# TEST 3: Firewall Status Check
# Explicitly flag if firewall is disabled/misconfigured
# ==============================================
FIREWALL_STATUS = "UNKNOWN"

# Scan all required ports
# Convert open_ports to a set of stripped strings
open_ports_set = set(p.strip() for p in open_ports)
required_ports_set = set(REQUIRED_PORTS)

if EXPECTED_ACCESS == "authorized":
    missing_ports = required_ports_set - open_ports_set
    if missing_ports:
        FIREWALL_STATUS = "DISABLED or MISCONFIGURED"
        log(
            "FIREWALL",
            "FAIL",
            f"Authorized host cannot reach ports: {','.join(sorted(missing_ports))}",
        )
        FAILURES += 1
    else:
        FIREWALL_STATUS = "ENABLED"
        log(
            "FIREWALL",
            "PASS",
            "Firewall allowing access from authorized host (expected)",
        )
    ACCESS_RESULT = "PASS" if not missing_ports else "FAIL"

else:  # unauthorized host
    unexpected_ports = required_ports_set & open_ports_set
    if unexpected_ports:
        FIREWALL_STATUS = "DISABLED or MISCONFIGURED"
        log(
            "FIREWALL",
            "WARN",
            f"Firewall allowing access from unauthorized host! Open ports: {','.join(sorted(unexpected_ports))}",
        )
        WARNINGS += 1
    else:
        FIREWALL_STATUS = "ENABLED"
        log(
            "FIREWALL",
            "PASS",
            "Firewall blocking all required ports from unauthorized host (expected)",
        )
    ACCESS_RESULT = "PASS" if not unexpected_ports else "FAIL"

results["tests"]["firewall_status"] = FIREWALL_STATUS
results["summary"]["access_result"] = ACCESS_RESULT

# ==============================================
# OVERALL RESULT
# ==============================================
if EXPECTED_ACCESS == "unauthorized":
    overall_secure = (ACCESS_RESULT == "PASS") and (SMB_GRADE != "WARN")
else:
    overall_secure = FAILURES == 0

results["summary"]["overall"] = "SECURE" if overall_secure else "NOT_SECURE"
results["summary"]["failures"] = FAILURES
results["summary"]["warnings"] = WARNINGS
results["summary"]["smb_grade"] = SMB_GRADE

# ==============================================
# SUMMARY OUTPUT
# ==============================================
print("\n==============================================")
print("  SECURITY SUMMARY")
print("==============================================")
print(f"Target: {TARGET_IP}")
print(f"Expected Access: {EXPECTED_ACCESS}")
print(f"Access Result: {ACCESS_RESULT}")
print(f"Overall: {results['summary']['overall']}")
print(f"Failures: {FAILURES}, Warnings: {WARNINGS}")
print(f"SMB Grade: {SMB_GRADE}")
print("==============================================")

# ==============================================
# JSON OUTPUT (if requested)
# ==============================================
if JSON_MODE:
    print("\n==============================================")
    print("  JSON OUTPUT")
    print("==============================================")
    print(json.dumps(results, indent=2))

# ==============================================
# EXIT CODE
# ==============================================
sys.exit(FAILURES)
