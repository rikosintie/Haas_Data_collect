"""
usage: smb_audit.py [-h] -u USER [-l LOG] [-s SHARES] [-v] target

Appliance SMB Compliance Auditor

positional arguments:
  target               Target IP or hostname

options:
  -h, --help           show this help message and exit
  -u, --user USER      Samba username
  -l, --log LOG        Log file path
  -s, --shares SHARES  Optional: Comma-separated extra shares to check
  -v, --verbose        Enable debug output
"""

import argparse
import getpass
import logging
import socket
import sys
import uuid

from smbprotocol.connection import Connection
from smbprotocol.session import Session
from smbprotocol.tree import TreeConnect

# ==============================================
# COLOR SUPPORT
# ==============================================
USE_COLOR = sys.stdout.isatty()

COLOR_RESET = "\033[0m"
COLOR_RED = "\033[31m"
COLOR_GREEN = "\033[32m"
COLOR_YELLOW = "\033[33m"
COLOR_CYAN = "\033[36m"  # optional alternative to green for informational output
COLOR_DIM = "\033[2m"  # Used in error message details to de-emphasize them.


def cyan(text):
    return f"{COLOR_CYAN}{text}{COLOR_RESET}"


def get_source_info():
    """Retrieves the hostname and local IP of the auditing machine."""
    try:
        hostname = socket.gethostname()
        return f"{hostname} ({socket.gethostbyname(hostname)})"
    except Exception:
        return "Unknown Source"


def setup_audit_log(log_file, verbose):
    """Configures logging for console and file output."""
    log_format = "%(asctime)s - %(levelname)s - %(message)s"
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format=log_format,
        handlers=[logging.FileHandler(log_file), logging.StreamHandler()],
    )
    if not verbose:
        logging.getLogger("smbprotocol").setLevel(logging.WARNING)


# def filetime_to_dt(filetime):
#     from datetime import datetime, timezone

#     return datetime.fromtimestamp(filetime / 10**7 - 11644473600, tz=timezone.utc)


def format_smb_error(e):
    msg = str(e)

    if "STATUS_LOGON_FAILURE" in msg:
        return "Authentication failed (bad username/password)"
    elif "timed out" in msg.lower():
        return "Connection timed out (host unreachable or port 445 blocked)"
    elif "STATUS_ACCESS_DENIED" in msg:
        return "Access denied"
    else:
        return "Connection/authentication failed"


def print_notes():
    logging.info(cyan("=== Summary & Notes ==="))
    logging.info("")

    logging.info(cyan("Expected Behavior From an authorized ip address:"))

    # logging.info(f"  - {COLOR_CYAN}From an authorized ip address:{COLOR_RESET}")
    logging.info("  - Authorized users should see at a minimum the 'Haas' share.")
    logging.info("  - Anonymous access should be denied.")
    logging.info("")
    logging.info(cyan("Expected Behavior From an unauthorized ip address:"))
    # logging.info(f" - {COLOR_CYAN}From an unauthorized ip address:{COLOR_RESET}")
    logging.info("  - Connection timed out (host unreachable or port 445 blocked)")

    logging.info("")
    logging.info(cyan("Time Synchronization:"))
    logging.info("  - This script does not verify the appliance clock.")
    logging.info("  - SSH to the appliance and run the 'date' command.")
    logging.info("  - Compare the appliance time/date to your local system.")
    logging.info(
        "  - A difference greater than a few seconds may indicate a time sync issue."
    )

    logging.info("")


def print_smb_troubleshooting():
    print("")
    logging.info(cyan("=== SMB Troubleshooting ==="))
    logging.info("")

    logging.info("  - Confirm username/password are correct (Appendix G, Stage 2).")
    logging.info("  - Ensure that the local machine is using an authorized ip address.")
    logging.info(
        "  - On the appliance, run 'sudo ufw status  | sort -k5' to verify allowed IPs."
    )
    logging.info("  - Verify TCP port 445 is reachable.")
    logging.info("  - See Appendix F for SMB troubleshooting commands.")

    logging.info("")


def print_quick_commands(target):
    logging.info(cyan("=== Quick Commands ==="))
    logging.info("")

    logging.info(cyan("List Shares:"))
    logging.info(f"  Windows:  {cyan(f'net view \\\\{target}')}")
    logging.info(f"  Linux:    {cyan(f'smbclient -L //{target} -U <username>')}")

    logging.info("")
    logging.info(cyan("Access Haas Share:"))
    logging.info(f"  Windows:  {cyan(f'\\\\{target}\\Haas')}")
    logging.info(
        f"  Linux:    {cyan(f'smbclient //{target}/Haas -U <username> type "help"')}"
    )

    logging.info("")
    logging.info(cyan("Test Connectivity:"))
    logging.info(f"  Windows:  {cyan(f'Test-NetConnection {target} -Port 445')}")
    logging.info(f"  Linux:    {cyan(f'nc -zv {target} 445')}")

    logging.info("")
    logging.info(cyan("Check Time (SSH):"))
    logging.info(f"  {cyan(f'ssh <username>@{target}')}")
    logging.info(f"  {cyan('date')}")

    logging.info("")


def run_audit(target, username, password, custom_shares=None):
    """Performs the audit and verifies machine-tool-specific shares."""
    source_info = get_source_info()
    logging.info(cyan("--- Starting SMB Compliance Audit ---"))
    logging.info(
        f"{COLOR_CYAN}Source{COLOR_RESET}: {source_info} | {COLOR_CYAN}Target{COLOR_RESET}: {target}"
    )

    audit_success = False  # 🔑 Track overall success

    connection = Connection(uuid.uuid4(), target, 445)

    # 1. Authenticated Session
    try:
        logging.info(f"Connecting to {COLOR_CYAN}{target}{COLOR_RESET}...")
        connection.connect()

        auth_session = Session(connection, username, password)
        auth_session.connect()

        logging.info(
            f"{COLOR_GREEN}[PASS]{COLOR_RESET} Authentication successful for {COLOR_CYAN}{username}{COLOR_RESET}."
        )

        # 2. Share Verification
        logging.info("Auditing Machine Tool Shares...")

        base_shares = ["Haas"]
        if custom_shares:
            base_shares.extend(custom_shares.split(","))

        test_list = sorted(list(set([s.strip() for s in base_shares])))
        found_shares = []

        for share in test_list:
            try:
                tree = TreeConnect(auth_session, f"\\\\{target}\\{share}")
                tree.connect()
                found_shares.append(share)
                tree.disconnect()
            except Exception:
                continue

        if found_shares:
            logging.info(
                f"{COLOR_GREEN}[PASS]{COLOR_RESET} Accessible share(s) that could be verified:"
            )
            for s in found_shares:
                logging.info(f"    - {s}")
            audit_success = True  # ✅ Only set here
        else:
            logging.warning(
                f"{COLOR_YELLOW}[!]{COLOR_RESET} Auth successful, but no shares were accessible."
            )

    except Exception as e:
        friendly_error = format_smb_error(e)

        logging.error(f"{COLOR_RED}[FAIL]{COLOR_RESET} {friendly_error}")
        logging.error(f"       Target : {COLOR_CYAN}{target}{COLOR_RESET}")
        logging.error(f"       Details: {COLOR_CYAN}{str(e)}{COLOR_RESET}")

        print("")
        print_smb_troubleshooting()
        print_notes()
        return  # 🔑 Exit early

    # 3. Anonymous Access Check
    logging.info("Testing Anonymous Access (Compliance Check)...")
    try:
        anon_session = Session(connection, "", "")
        anon_session.connect()

        anon_tree = TreeConnect(anon_session, f"\\\\{target}\\IPC$")
        anon_tree.connect()

        logging.warning(
            f"{COLOR_YELLOW}[!]{COLOR_RESET} SECURITY ALERT: Anonymous access allowed to IPC$!"
        )

        anon_tree.disconnect()

        audit_success = False  # ❗ Force failure if this happens

    except Exception:
        logging.info(
            f"{COLOR_GREEN}[PASS]{COLOR_RESET} Anonymous access successfully {COLOR_RED}refused{COLOR_RESET}."
        )

    # --- Final Output ---
    print("")
    print("")
    print_notes()

    if not audit_success:
        print_smb_troubleshooting()
    print("")
    print_quick_commands(target)
    print("")
    if audit_success:
        sys.exit(0)
    else:
        sys.exit(1)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Appliance SMB Compliance Auditor")
    parser.add_argument("target", help="Target IP or hostname")
    parser.add_argument("-u", "--user", required=True, help="Samba username")
    parser.add_argument(
        "-l", "--log", default="smb_audit.log", help="Optional: Log file path"
    )
    parser.add_argument(
        "-s", "--shares", help="Optional: Comma-separated extra shares to check"
    )
    parser.add_argument(
        "-v", "--verbose", action="store_true", help="Enable debug output"
    )

    args = parser.parse_args()
    setup_audit_log(args.log, args.verbose)
    print("")
    logging.info(cyan("Haas SMB Audit Tool"))
    logging.info(cyan("---------------------"))
    print("")
    logging.info(cyan("Run this tool from an authorized network location."))
    logging.info(cyan("Then run it from an unauthorized network location."))
    print("")
    pwd = getpass.getpass(f"Enter password for {args.user}: ")

    try:
        run_audit(args.target, args.user, pwd, args.shares)
    except KeyboardInterrupt:
        print("\nAudit aborted.")
    finally:
        logging.info("--- Audit Session Closed ---")
