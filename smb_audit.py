import argparse
import getpass
import logging
import uuid

from smbprotocol.connection import Connection
from smbprotocol.session import Session
from smbprotocol.tree import TreeConnect


def setup_audit_log(log_file, verbose):
    """Configures logging for the console and a local log file."""
    log_format = "%(asctime)s - %(levelname)s - %(message)s"
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format=log_format,
        handlers=[logging.FileHandler(log_file), logging.StreamHandler()],
    )
    if not verbose:
        logging.getLogger("smbprotocol").setLevel(logging.WARNING)


def test_connection(target, username, password):
    """
    Tests if a connection can be established with the given credentials.
    Returns True if successful, False otherwise.
    """
    try:
        connection = Connection(uuid.uuid4(), target, 445)
        connection.connect()
        session = Session(connection, username, password)
        session.connect()
        # Connect to IPC$ to verify share-listing capability
        tree = TreeConnect(session, f"\\\\{target}\\IPC$")
        tree.connect()
        return True
    except Exception as e:
        logging.debug(f"Connection failed for {username}: {e}")
        return False


def run_audit(target, username, password):
    """Executes the two-part compliance audit."""
    logging.info(f"--- Starting SMB Compliance Audit on {target} ---")

    # Test 1: Anonymous Access (Should FAIL)
    logging.info("Testing Anonymous Access (Compliance Check)...")
    if test_connection(target, "", ""):
        logging.warning("[!] SECURITY ALERT: Anonymous access allowed to IPC$!")
    else:
        logging.info("[PASS] Anonymous access successfully refused.")

    # Test 2: Authenticated Access (Should PASS)
    logging.info(f"Testing Authenticated Access for: {username}...")
    if test_connection(target, username, password):
        logging.info("[PASS] Authentication successful. Appliance is reachable.")
    else:
        logging.error(f"[FAIL] Authentication failed for {username}.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Appliance SMB Compliance Auditor")
    parser.add_argument("target", help="Target IP or hostname")
    parser.add_argument("-u", "--user", required=True, help="Samba username")
    parser.add_argument("-l", "--log", default="smb_audit.log", help="Log file path")
    parser.add_argument(
        "-v", "--verbose", action="store_true", help="Enable verbose output"
    )

    args = parser.parse_args()
    setup_audit_log(args.log, args.verbose)
    pwd = getpass.getpass(f"Enter password for {args.user}: ")

    try:
        run_audit(args.target, args.user, pwd)
    except KeyboardInterrupt:
        print("\nAudit aborted.")
    finally:
        logging.info("--- Audit Session Closed ---")
