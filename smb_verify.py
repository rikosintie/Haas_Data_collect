#!/usr/bin/env python3

import json
import re
import subprocess
import sys
from datetime import datetime

TARGET_IP = "192.168.10.127"
SMB_USER = "haas"

FAILURES = 0
WARNINGS = 0
JSON_MODE = "--json" in sys.argv

results = {
    "target": TARGET_IP,
    "timestamp": str(datetime.now()),
    "tests": {},
    "summary": {},
}


def run_command(cmd):
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=60
        )
        return result.stdout + result.stderr, result.returncode
    except subprocess.TimeoutExpired:
        return "Command timed out", 1


def log(test, status, message):
    global FAILURES, WARNINGS

    if status == "FAIL":
        FAILURES += 1
    elif status == "WARN":
        WARNINGS += 1

    if not JSON_MODE:
        symbol = {"PASS": "✓", "FAIL": "✗", "WARN": "⚠"}[status]
        print(f"{symbol} {status}: {message}")

    results["tests"].setdefault(test, []).append({"status": status, "message": message})


def header(title):
    if not JSON_MODE:
        print(f"\n[TEST] {title}")
        print("-" * 50)


#################################################
# HEADER
#################################################
if not JSON_MODE:
    print("==============================================")
    print("  SMB SECURITY VERIFICATION REPORT")
    print(f"  Target: {TARGET_IP}")
    print(f"  Date: {datetime.now()}")
    print("==============================================\n")

#################################################
# TEST 1 - SMB Protocols
#################################################
header("SMB Protocol Versions")

cmd = f"nmap -Pn --host-timeout 30s --script smb-protocols -p 445 {TARGET_IP}"
output, _ = run_command(cmd)

if not JSON_MODE:
    print(output)

dialects = re.findall(r"\b\d+:\d+:\d+\b", output)

dialect_map = {
    "2:0:2": "SMB 2.0.2",
    "2:1:0": "SMB 2.1",
    "3:0:0": "SMB 3.0",
    "3:0:2": "SMB 3.0.2",
    "3:1:1": "SMB 3.1.1",
}

readable = [dialect_map.get(d, d) for d in dialects]

if readable:
    log("SMB", "PASS", f"Detected SMB dialects: {', '.join(readable)}")
else:
    log("SMB", "FAIL", "No SMB dialects detected")

has_smb1 = any(d.startswith("1:") for d in dialects)
has_smb2 = any(d.startswith("2:") for d in dialects)
has_smb3 = any(d.startswith("3:") for d in dialects)

if has_smb1:
    log("SMB", "FAIL", "SMB1 is ENABLED")
else:
    log("SMB", "PASS", "SMB1 is DISABLED")

# Grade logic
SMB_GRADE = "FAIL"

if has_smb1:
    SMB_GRADE = "FAIL"

elif has_smb2 or has_smb3:
    SMB_GRADE = "PASS"

    if has_smb3 and not has_smb2:
        log("SMB", "PASS", "Only SMB3 detected (best practice)")
    elif has_smb3 and has_smb2:
        log("SMB", "PASS", "SMB2 and SMB3 detected (secure and compatible)")
    elif has_smb2 and not has_smb3:
        log("SMB", "PASS", "Only SMB2 detected (secure, but SMB3 recommended)")

else:
    log("SMB", "FAIL", "No modern SMB protocols detected")

if not dialects:
    log("SMB", "FAIL", "Unable to determine SMB versions")

results["summary"]["smb_grade"] = SMB_GRADE

#################################################
# TEST 2 - Anonymous Access
#################################################
header("Anonymous Access")

output, _ = run_command(f"smbclient -L //{TARGET_IP} -N")

if re.search(r"NT_STATUS_ACCESS_DENIED|NT_STATUS_LOGON_FAILURE", output, re.I):
    log("AUTH", "PASS", "Anonymous access blocked")
else:
    log("AUTH", "FAIL", "Anonymous access allowed")

#################################################
# TEST 3 - Authenticated Access
#################################################
header("Authenticated SMB")

proc = subprocess.run(f"smbclient -L //{TARGET_IP} -U {SMB_USER}", shell=True)

if proc.returncode == 0:
    log("AUTH", "PASS", "Authenticated access successful")
else:
    log("AUTH", "FAIL", "Authenticated access failed")

#################################################
# TEST 4 - SMB Ports
#################################################
header("SMB Ports")

output, _ = run_command(
    f"nmap --open --host-timeout 30s -Pn -p 139,445 -oG - {TARGET_IP}"
)

if "445/open" in output:
    log("PORTS", "PASS", "Port 445 open")
else:
    log("PORTS", "FAIL", "Port 445 not open")

if "139/open" in output:
    log("PORTS", "FAIL", "Port 139 open (legacy)")
else:
    log("PORTS", "PASS", "Port 139 closed")

#################################################
# TEST 5 - Allowed Ports
#################################################
header("Allowed Ports")

output, _ = run_command(f"nmap --open --host-timeout 30s -Pn -oG - {TARGET_IP}")

open_ports = set()

for line in output.splitlines():
    if "Ports:" in line:
        for p in line.split("Ports:")[1].split(","):
            parts = p.strip().split("/")
            if len(parts) > 1 and parts[1] == "open":
                open_ports.add(parts[0])

expected = {"22", "445", "9090"}

for port in expected:
    if port in open_ports:
        log("PORTS", "PASS", f"Port {port} open")
    else:
        log("PORTS", "FAIL", f"Port {port} missing")

for port in open_ports:
    if port not in expected:
        log("PORTS", "FAIL", f"Unexpected open port: {port}")

#################################################
# SUMMARY
#################################################
results["summary"]["failures"] = FAILURES
results["summary"]["warnings"] = WARNINGS
results["summary"]["overall"] = "SECURE" if FAILURES == 0 else "NOT_SECURE"

# --- ALWAYS print summary ---
print("\n==============================================")
print("  SECURITY SUMMARY")
print("==============================================")
print(f"Target: {TARGET_IP}")
print(f"Overall: {results['summary']['overall']}")
print(f"Failures: {FAILURES}, Warnings: {WARNINGS}")
print(f"SMB Grade: {SMB_GRADE}")
print("==============================================")

# --- JSON output (with banner) ---
if JSON_MODE:
    print("\n==============================================")
    print("  JSON OUTPUT")
    print("==============================================")
    print(json.dumps(results, indent=2))

# Exit code
sys.exit(FAILURES)
