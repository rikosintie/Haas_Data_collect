import argparse
import datetime
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


def run_audit(target, username, password):
    """Performs the audit, confirms share availability, and checks time sync."""
    source_info = get_source_info()
    logging.info("--- Starting SMB Compliance Audit ---")
    logging.info(f"Source: {source_info} | Target: {target}")

    connection = Connection(uuid.uuid4(), target, 445)

    # 1. Connection and Time Drift Check
    logging.info("Verifying System Integrity and Time Sync...")
    connection.connect()

    # Access the raw data from the negotiate response
    neg_res = getattr(connection, "negotiate_response", None)

    if neg_res and hasattr(neg_res, "data"):
        # The 'system_time' is inside the .data attribute of the response
        remote_time = neg_res["system_time"].get_value()
        local_time = datetime.datetime.now(datetime.timezone.utc)
        time_diff = abs((remote_time - local_time).total_seconds())

        logging.info(
            f"    Appliance Time (UTC): {remote_time.strftime('%Y-%m-%d %H:%M:%S')}"
        )
        logging.info(
            f"    Local Machine Time (UTC): {local_time.strftime('%Y-%m-%d %H:%M:%S')}"
        )

        if time_diff > 60:
            logging.warning(
                f"[!] TIME SYNC ALERT: Drift of {int(time_diff)}s detected!"
            )
        else:
            logging.info(f"[PASS] Time sync within limits ({int(time_diff)}s drift).")

    # 2. Anonymous Access Check
    logging.info("Testing Anonymous Access (Compliance Check)...")
    try:
        anon_session = Session(connection, "", "")
        anon_session.connect()
        anon_tree = TreeConnect(anon_session, f"\\\\{target}\\IPC$")
        anon_tree.connect()
        logging.warning("[!] SECURITY ALERT: Anonymous access allowed to IPC$!")
        anon_tree.disconnect()
    except Exception:
        logging.info("[PASS] Anonymous access successfully refused.")

    # 3. Authenticated Access & Share Listing
    logging.info(f"Testing Authenticated Access for: {username}...")
    try:
        auth_session = Session(connection, username, password)
        auth_session.connect()

        known_shares = ["st30", "st40", "minimill", "Haas", "st30l"]
        found_shares = []

        for share in known_shares:
            try:
                tree = TreeConnect(auth_session, f"\\\\{target}\\{share}")
                tree.connect()
                found_shares.append(share)
                tree.disconnect()
            except Exception:
                continue

        if found_shares:
            logging.info("[PASS] Auth successful. Accessible shares found:")
            for s in found_shares:
                logging.info(f"    - {s}")
        else:
            logging.warning("[!] Auth successful, but no tool shares were accessible.")

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

    # Prompt for password
    pwd = getpass.getpass(f"Enter password for {args.user}: ")

    try:
        run_audit(args.target, args.user, pwd)
    except KeyboardInterrupt:
        print("\nAudit aborted by user.")
    finally:
        logging.info("--- Audit Session Closed ---")
