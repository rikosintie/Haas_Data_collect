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


def run_audit(target, username, password, custom_shares=None):
    """Performs the audit and verifies tool-specific shares."""
    source_info = get_source_info()
    logging.info("--- Starting SMB Compliance Audit ---")
    logging.info(
        f"{COLOR_CYAN}Source{COLOR_RESET}: {source_info} | {COLOR_CYAN}Target{COLOR_RESET}: {target}"
    )

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
        # Default discovery list + any custom shares passed by the MSP
        base_shares = ["st30", "st40", "minimill", "Haas", "st30l"]
        if custom_shares:
            base_shares.extend(custom_shares.split(","))

        # Remove duplicates and clean whitespace
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
                f"{COLOR_GREEN}[PASS]{COLOR_RESET} Accessible shares verified:"
            )
            for s in found_shares:
                logging.info(f"    - {s}")
        else:
            logging.warning(
                f"{COLOR_YELLOW}[!]{COLOR_RESET} Auth successful, but no tool shares were accessible."
            )

    except Exception as e:
        logging.error(
            f"{COLOR_RED}[FAIL]{COLOR_RESET} Primary connection/auth to {target} failed: {e}"
        )
        return

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
    except Exception:
        logging.info(
            f"{COLOR_GREEN}[PASS]{COLOR_RESET} Anonymous access successfully refused."
        )


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Appliance SMB Compliance Auditor")
    parser.add_argument("target", help="Target IP or hostname")
    parser.add_argument("-u", "--user", required=True, help="Samba username")
    parser.add_argument("-l", "--log", default="smb_audit.log", help="Log file path")
    parser.add_argument(
        "-s", "--shares", help="Optional: Comma-separated extra shares to check"
    )
    parser.add_argument(
        "-v", "--verbose", action="store_true", help="Enable debug output"
    )

    args = parser.parse_args()
    setup_audit_log(args.log, args.verbose)

    pwd = getpass.getpass(f"Enter password for {args.user}: ")

    try:
        run_audit(args.target, args.user, pwd, args.shares)
    except KeyboardInterrupt:
        print("\nAudit aborted.")
    finally:
        logging.info("--- Audit Session Closed ---")
