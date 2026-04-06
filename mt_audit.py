#!/usr/bin/env python3
"""
mt_audit.py - Machine Tool Connectivity Audit Tool

This script verifies TCP connectivity from the local system to a specified
machine tool IP address and port. It is designed for use in manufacturing
environments where an appliance communicates with CNC machines over a
specific port (often via telnet).

The tool performs a simple socket connection test and reports PASS or FAIL
with human-readable error messages and troubleshooting guidance.

USAGE:
    python mt_audit.py <target> -p <port> [options]

REQUIRED ARGUMENTS:
    target              Target machine tool IP address

OPTIONS:
    -p, --port          Port to test (required)
    -l, --log           Log file path
    -v, --verbose       Enable debug output

EXAMPLES:
    python mt_audit.py 192.168.10.50 -p 23
    python mt_audit.py 10.0.0.25 -p 5000 -v
    python mt_audit.py 192.168.1.100 -p 23 -l audit.log

EXIT CODES:
    0   Success (connection established)
    1   Failure (connection failed)
"""

import argparse
import logging
import socket
import sys

# --- Colors ---
COLOR_RED = "\033[91m"
COLOR_GREEN = "\033[92m"
COLOR_YELLOW = "\033[93m"
COLOR_CYAN = "\033[96m"
COLOR_RESET = "\033[0m"


def cyan(text):
    """Return text wrapped in cyan ANSI color codes."""
    return f"{COLOR_CYAN}{text}{COLOR_RESET}"


def setup_logging(log_file=None, verbose=False):
    """
    Configure logging output.

    Args:
        log_file (str, optional): Path to a log file.
        verbose (bool): Enable debug-level logging if True.
    """
    level = logging.DEBUG if verbose else logging.INFO

    handlers = [logging.StreamHandler()]

    if log_file:
        handlers.append(logging.FileHandler(log_file))

    logging.basicConfig(
        level=level,
        format="%(asctime)s - %(levelname)s - %(message)s",
        handlers=handlers,
    )


def get_source_info():
    """
    Retrieve the local system hostname and IP address.

    Returns:
        str: Formatted string containing hostname and IP.
    """
    try:
        hostname = socket.gethostname()
        ip = socket.gethostbyname(hostname)
        return f"{hostname} ({ip})"
    except Exception:
        return "Unknown"


def format_connection_error(e):
    """
    Convert a raw socket exception into a user-friendly message.

    Args:
        e (Exception): The exception raised during connection.

    Returns:
        str: Simplified, human-readable error message.
    """
    msg = str(e).lower()

    if "timed out" in msg:
        return "Connection timed out (host unreachable or port blocked)"
    elif "refused" in msg:
        return "Connection refused (service not listening on port)"
    elif "network is unreachable" in msg:
        return "Network unreachable"
    else:
        return "Connection failed"


def print_quick_commands(target, port):
    """
    Print useful commands for manual troubleshooting.

    Args:
        target (str): Target IP address.
        port (int): Target port.
    """
    logging.info(cyan("=== Quick Commands ==="))
    logging.info("")

    logging.info(cyan("Test Connectivity:"))
    logging.info(f"  Windows:  {cyan(f'Test-NetConnection {target} -Port {port}')}")
    logging.info(f"  Linux:    {cyan(f'nc -zv {target} {port}')}")
    logging.info(f"  Telnet:   {cyan(f'telnet {target} {port}')}")
    logging.info("")


def print_notes():
    """
    Print informational notes about expected behavior and limitations.
    """
    logging.info(cyan("=== Notes ==="))
    logging.info("")

    logging.info(cyan("Expected Behavior:"))
    logging.info(
        "  - The appliance should be able to connect to the machine tool port."
    )
    logging.info("  - A successful connection indicates the service is reachable.")

    logging.info("")
    logging.info(cyan("Important:"))
    logging.info("  - This test does NOT validate application-level communication.")
    logging.info("  - It only verifies TCP connectivity to the specified port.")

    logging.info("")


def print_troubleshooting():
    """
    Print troubleshooting steps when connectivity fails.
    """
    logging.info(cyan("=== Connectivity Troubleshooting ==="))
    logging.info("")

    logging.info("  - Verify the target IP address is correct.")
    logging.info("  - Ensure the machine tool is powered on.")
    logging.info("  - Confirm the correct port is configured on the machine tool.")
    logging.info("  - Options 261-263 set the port on the Haas CNC control.")
    logging.info("  - Check for firewalls blocking the connection.")
    logging.info("  - Ensure the appliance is on the correct network/VLAN.")

    logging.info("")


def run_audit(target, port):
    """
    Perform the connectivity test to the target machine tool.

    Args:
        target (str): Target IP address.
        port (int): Port to test.

    Returns:
        bool: True if connection succeeds, False otherwise.
    """
    source_info = get_source_info()

    logging.info(cyan("--- Machine Tool Connectivity Audit ---"))
    logging.info(
        f"{COLOR_CYAN}Source{COLOR_RESET}: {source_info} | {COLOR_CYAN}Target{COLOR_RESET}: {target}:{port}"
    )

    audit_success = False

    try:
        logging.info(f"Connecting to {COLOR_CYAN}{target}:{port}{COLOR_RESET}...")

        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(10)

        sock.connect((target, port))
        sock.close()

        logging.info(
            f"{COLOR_GREEN}[PASS]{COLOR_RESET} Successfully connected to {COLOR_CYAN}{target}:{port}{COLOR_RESET}."
        )

        audit_success = True

    except Exception as e:
        friendly_error = format_connection_error(e)

        logging.error(f"{COLOR_RED}[FAIL]{COLOR_RESET} {friendly_error}")
        logging.error(f"       Target : {COLOR_CYAN}{target}:{port}{COLOR_RESET}")
        logging.error(f"       Details: {str(e)}")

    logging.info("")
    logging.info("")

    if not audit_success:
        print_troubleshooting()

    print_notes()
    print_quick_commands(target, port)

    return audit_success


def main():
    """
    Parse arguments and execute the audit.
    """
    parser = argparse.ArgumentParser(description="Machine Tool Connectivity Audit Tool")

    parser.add_argument("target", help="Target machine tool IP address")
    parser.add_argument("-p", "--port", required=True, type=int, help="Port to scan")
    parser.add_argument("-l", "--log", help="Log file path")
    parser.add_argument(
        "-v", "--verbose", action="store_true", help="Enable debug output"
    )

    args = parser.parse_args()

    setup_logging(args.log, args.verbose)

    success = run_audit(args.target, args.port)

    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
