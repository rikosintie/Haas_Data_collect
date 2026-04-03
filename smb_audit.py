import argparse
import getpass
import logging
import socket
import uuid

from smbprotocol.connection import Connection
from smbprotocol.session import Session
from smbprotocol.tree import TreeConnect


def get_source_info():
    """Retrieves the hostname and local IP of the auditing machine."""
    try:
        hostname = socket.gethostname()
        return f"{hostname} ({socket.gethostbyname(hostname)})"
    except:
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


def run_audit(target, username, password):
    """Performs the audit and confirms share availability with separate line logging."""
    source_info = get_source_info()
    logging.info("--- Starting SMB Compliance Audit ---")
    logging.info(f"Source: {source_info} | Target: {target}")

    # 1. Anonymous Check
    logging.info("Testing Anonymous Access...")
    try:
        connection = Connection(uuid.uuid4(), target, 445)
        connection.connect()
        session = Session(connection, "", "")
        session.connect()
        tree = TreeConnect(session, f"\\\\{target}\\IPC$")
        tree.connect()
        logging.warning("[!] SECURITY ALERT: Anonymous access allowed to IPC$!")
    except:
        logging.info("[PASS] Anonymous access successfully refused.")

    # 2. Authenticated Check & Share Listing
    logging.info(f"Testing Authenticated Access for: {username}...")
    try:
        connection = Connection(uuid.uuid4(), target, 445)
        connection.connect()
        session = Session(connection, username, password)
        session.connect()

        # List of shares to verify for machine shop tools
        known_shares = ["st30", "st40", "minimill", "Haas", "st30l"]
        found_shares = []

        for share in known_shares:
            try:
                tree = TreeConnect(session, f"\\\\{target}\\{share}")
                tree.connect()
                found_shares.append(share)
                tree.disconnect()
            except:
                continue

        if found_shares:
            logging.info(f"[PASS] Auth successful. Accessible shares found:")
            for share in found_shares:
                logging.info(f"    - {share}")
        else:
            logging.info(
                "[PASS] Auth successful, but no expected shares were accessible."
            )

    except Exception as e:
        logging.error(f"[FAIL] Authentication failed for {username}: {e}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Appliance SMB Compliance Auditor")
    parser.add_argument("target", help="Target IP or hostname")
    parser.add_argument("-u", "--user", required=True, help="Samba username")
    parser.add_argument("-l", "--log", default="smb_audit.log", help="Log file path")
    parser.add_argument(
        "-v", "--verbose", action="store_true", help="Enable debug output"
    )

    args = parser.parse_args()
    setup_audit_log(args.log, args.verbose)
    pwd = getpass.getpass(f"Enter password for {args.user}: ")

    try:
        run_audit(args.target, args.user, pwd)
    except KeyboardInterrupt:
        print("\nAborted.")
    finally:
        logging.info("--- Audit Session Closed ---")
