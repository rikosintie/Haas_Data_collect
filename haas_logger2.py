import argparse
import csv
import os
import re
import socket
import threading
import time
from datetime import datetime
from typing import Dict, Optional, Tuple


class HaasDataLogger:
    """
    A TCP server/client that listens for or connects to Haas CNC machine data and logs it to CSV files.

    This logger can either wait for machines to connect (server mode) or actively connect to a
    machine at a specific IP address (client mode). It extracts part numbers and other relevant
    information, and saves complete cycles to timestamped CSV files.
    """

    def __init__(
        self,
        host: str = "0.0.0.0",
        port: int = 5062,
        machine_name: Optional[str] = None,
        append_mode: bool = False,
        target_ip: Optional[str] = None,
    ) -> None:
        """
        Initialize the Haas Data Logger.

        Args:
            host: IP address to bind the server to. Defaults to '0.0.0.0' (all interfaces).
            port: Port number to listen on or connect to. Defaults to 5062.
            machine_name: Custom name for the machine. If None, generates name from port.
            append_mode: If True, append cycles to existing file per part number.
                        If False, create new file for each cycle.
            target_ip: If provided, connect to this IP address (client mode) instead of
            listening for connections (server mode).
        """
        self.host = host
        self.port = port
        self.machine_name = machine_name or f"Machine_Port{port}"
        self.running = False
        self.append_mode = append_mode
        self.target_ip = target_ip

    def extract_part_number(self, data: str) -> Optional[str]:
        """
        Extract part number from the data string.

        Searches for patterns like "PART NUMBER: 265-4183" in the input data.

        Args:
            data: Raw data string received from the CNC machine.

        Returns:
            The extracted part number string if found, None otherwise.
        """
        # Look for pattern like "PART NUMBER: 265-4183"
        match = re.search(r"PART NUMBER:\s*([^\s,]+)", data, re.IGNORECASE)
        if match:
            return match.group(1).strip()
        return None

    def parse_data_to_dict(self, data: str) -> Dict[str, str]:
        """
        Parse the CNC data into a dictionary for CSV output.

        Extracts structured information including part number, revision, date, time,
        parts counter, and last part timer from the raw CNC machine data string.

        Args:
            data: Raw data string received from the CNC machine.

        Returns:
            Dictionary containing parsed fields including Machine, Timestamp, Part_Number,
            Revision, Date_YYMMDD, Time_HHMMSS, Parts_Counter, and Last_Part_Time_Seconds.
        """
        result = {
            "Machine": self.machine_name,
            "Timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "Part_Number": "",
            "Revision": "",
            "Date_YYMMDD": "",
            "Time_HHMMSS": "",
            "Parts_Counter": "",
            "Last_Part_Time_Seconds": "",
        }

        # Extract part number and revision
        part_match = re.search(
            r"PART NUMBER:\s*([^\s,]+)(?:,\s*REV\.\s*([^\]]+))?", data, re.IGNORECASE
        )
        if part_match:
            result["Part_Number"] = part_match.group(1).strip()
            if part_match.group(2):
                result["Revision"] = part_match.group(2).strip()

        # Extract date
        date_match = re.search(r"DATE YYMMDD:\s*(\d+)", data, re.IGNORECASE)
        if date_match:
            result["Date_YYMMDD"] = date_match.group(1).strip()

        # Extract time
        time_match = re.search(r"TIME HHMMSS:\s*(\d+)", data, re.IGNORECASE)
        if time_match:
            result["Time_HHMMSS"] = time_match.group(1).strip()

        # Extract parts counter (PARTS MADE: ###)
        parts_match = re.search(r"PARTS\s*MADE:\s*(\d+)", data, re.IGNORECASE)
        if parts_match:
            result["Parts_Counter"] = parts_match.group(1).strip()

        # Extract last part timer (TIME, LAST PART: ### SECONDS)
        timer_match = re.search(
            r"TIME,\s*LAST\s*PART:\s*(\d+(?:\.\d+)?)\s*SECONDS", data, re.IGNORECASE
        )
        if timer_match:
            result["Last_Part_Time_Seconds"] = timer_match.group(1).strip()

        return result

    def save_to_file(self, data: str, part_number: Optional[str]) -> str:
        """
        Save data to CSV file with part number and timestamp.

        Creates a CSV file in the cnc_logs directory with parsed machine data.
        In append mode, cycles for the same part number are added to one file.
        In non-append mode, each cycle creates a new timestamped file.
        Includes retry logic and backup file creation if the target file is locked.

        Args:
            data: Raw data string to be saved.
            part_number: Part number extracted from the data, or None if not found.

        Returns:
            Full filepath where the data was saved.

        Raises:
            IOError: If the file cannot be written in non-append mode.
        """
        # Create logs directory if it doesn't exist
        os.makedirs("cnc_logs", exist_ok=True)

        # Parse data into structured format
        parsed_data = self.parse_data_to_dict(data)

        if self.append_mode:
            # Append mode: Use same file for each part number
            if part_number:
                filename = f"{self.machine_name}_{part_number}.csv"
            else:
                filename = f"{self.machine_name}_unknown_part.csv"

            filepath = os.path.join("cnc_logs", filename)

            # Check if file exists to determine if we need to write header
            file_exists = os.path.isfile(filepath)

            # Try to append to CSV with retry logic
            max_retries = 3
            retry_delay = 1  # seconds

            for attempt in range(max_retries):
                try:
                    with open(filepath, "a", newline="") as f:
                        writer = csv.DictWriter(f, fieldnames=parsed_data.keys())
                        if not file_exists:
                            writer.writeheader()
                        writer.writerow(parsed_data)

                    print(f"[{self.machine_name}] Data appended to: {filepath}")
                    break  # Success, exit retry loop

                except (IOError, PermissionError) as e:
                    if attempt < max_retries - 1:
                        print(
                            f"[{self.machine_name}] Warning: File locked or inaccessible, retrying in {retry_delay}s... (Attempt {attempt + 1}/{max_retries})"
                        )
                        time.sleep(retry_delay)
                    else:
                        # Final attempt failed, create backup file with timestamp
                        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                        backup_filename = (
                            f"{self.machine_name}_{part_number}_{timestamp}_BACKUP.csv"
                        )
                        backup_filepath = os.path.join("cnc_logs", backup_filename)

                        with open(backup_filepath, "w", newline="") as f:
                            writer = csv.DictWriter(f, fieldnames=parsed_data.keys())
                            writer.writeheader()
                            writer.writerow(parsed_data)

                        print(
                            f"[{self.machine_name}] ERROR: Could not write to {filepath} (file may be open in Excel)"
                        )
                        print(
                            f"[{self.machine_name}] Data saved to backup file: {backup_filepath}"
                        )
                        filepath = backup_filepath
        else:
            # Normal mode: Create new file for each cycle with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

            if part_number:
                filename = f"{self.machine_name}_{part_number}_{timestamp}.csv"
            else:
                filename = f"{self.machine_name}_unknown_part_{timestamp}.csv"

            filepath = os.path.join("cnc_logs", filename)

            # Write to CSV
            try:
                with open(filepath, "w", newline="") as f:
                    writer = csv.DictWriter(f, fieldnames=parsed_data.keys())
                    writer.writeheader()
                    writer.writerow(parsed_data)

                print(f"[{self.machine_name}] Data saved to: {filepath}")
            except (IOError, PermissionError) as e:
                print(
                    f"[{self.machine_name}] ERROR: Could not write to {filepath}: {e}"
                )
                raise

        return filepath

    def process_data(
        self, client_socket: socket.socket, address: Tuple[str, int]
    ) -> None:
        """
        Process data from a connected socket.

        Receives data from a connected CNC machine, buffers it, extracts part numbers,
        and saves complete cycles to files when "End of Cycle" is detected.

        Args:
            client_socket: The connected socket.
            address: Tuple containing the remote IP address and port.
        """
        print(f"[{self.machine_name}] Connected to {address}")

        buffer = ""
        part_number = None

        try:
            while self.running:
                data = client_socket.recv(4096)
                if not data:
                    print(f"[{self.machine_name}] Connection closed by remote host")
                    break

                # Decode received data
                received = data.decode("utf-8", errors="ignore")
                buffer += received

                # Extract part number if we haven't found it yet
                if not part_number:
                    part_number = self.extract_part_number(buffer)
                    if part_number:
                        print(
                            f"[{self.machine_name}] Part number detected: {part_number}"
                        )

                # Check for end of cycle
                if "End of Cycle" in buffer or "END OF CYCLE" in buffer.upper():
                    print(f"[{self.machine_name}] End of cycle detected!")
                    self.save_to_file(buffer, part_number)

                    # Reset for next cycle
                    buffer = ""
                    part_number = None

        except Exception as e:
            print(f"[{self.machine_name}] Error processing data from {address}: {e}")
        finally:
            client_socket.close()
            print(f"[{self.machine_name}] Connection closed")

    def handle_client(
        self, client_socket: socket.socket, address: Tuple[str, int]
    ) -> None:
        """
        Handle individual client connection in server mode.

        Args:
            client_socket: The connected client socket.
            address: Tuple containing the client's IP address and port.
        """
        print(f"[{self.machine_name}] Connection established from {address}")
        self.process_data(client_socket, address)

    def start_client_mode(self) -> None:
        """
        Start in client mode - connect to the target IP address.

        Continuously attempts to connect to the target machine and process data.
        If connection is lost, it will attempt to reconnect after a delay.
        """
        print(f"[{self.machine_name}] Starting in CLIENT mode")
        print(f"[{self.machine_name}] Will connect to {self.target_ip}:{self.port}")
        if self.append_mode:
            print(
                f"[{self.machine_name}] TIP: Close CSV files in Excel to avoid file lock issues"
            )
        print(f"[{self.machine_name}] Press Ctrl+C to stop")

        reconnect_delay = 5  # seconds

        while self.running:
            client_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)

            try:
                print(
                    f"[{self.machine_name}] Attempting to connect to {self.target_ip}:{self.port}..."
                )
                client_socket.connect((self.target_ip, self.port))
                print(f"[{self.machine_name}] Successfully connected!")

                # Process data from the connection
                self.process_data(client_socket, (self.target_ip, self.port))

            except ConnectionRefusedError:
                print(
                    f"[{self.machine_name}] Connection refused. Machine may be offline or not accepting connections."
                )
            except socket.timeout:
                print(f"[{self.machine_name}] Connection timeout.")
            except Exception as e:
                print(f"[{self.machine_name}] Connection error: {e}")
            finally:
                try:
                    client_socket.close()
                except:
                    pass

            # Wait before attempting to reconnect
            if self.running:
                print(
                    f"[{self.machine_name}] Reconnecting in {reconnect_delay} seconds..."
                )
                time.sleep(reconnect_delay)

    def start_server_mode(self) -> None:
        """
        Start in server mode - listen for incoming connections.

        Binds to the configured host and port, then listens for incoming connections
        from CNC machines. Each connection is handled in a separate daemon thread.
        """
        server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

        try:
            server_socket.bind((self.host, self.port))
            server_socket.listen(5)
            mode_str = "APPEND mode" if self.append_mode else "NEW FILE mode"
            print(
                f"[{self.machine_name}] Haas CNC Data Logger started on {self.host}:{self.port} ({mode_str})"
            )
            print(f"[{self.machine_name}] Waiting for connections...")
            if self.append_mode:
                print(
                    f"[{self.machine_name}] TIP: Close CSV files in Excel to avoid file lock issues"
                )
            print(f"[{self.machine_name}] Press Ctrl+C to stop")

            while self.running:
                try:
                    server_socket.settimeout(1.0)
                    client_socket, address = server_socket.accept()

                    # Handle each client in a separate thread
                    client_thread = threading.Thread(
                        target=self.handle_client, args=(client_socket, address)
                    )
                    client_thread.daemon = True
                    client_thread.start()

                except socket.timeout:
                    continue
                except KeyboardInterrupt:
                    print(f"\n[{self.machine_name}] Shutting down server...")
                    self.running = False
                    break

        except Exception as e:
            print(f"[{self.machine_name}] Server error: {e}")
        finally:
            server_socket.close()
            print(f"[{self.machine_name}] Server stopped")

    def start(self) -> None:
        """
        Start the logger in either client or server mode.

        If target_ip is provided, runs in client mode (connects to machine).
        Otherwise, runs in server mode (waits for machine to connect).

        Raises:
            Exception: If there's an error starting the logger.
        """
        self.running = True

        try:
            if self.target_ip:
                # Client mode: connect to the target IP
                self.start_client_mode()
            else:
                # Server mode: listen for connections
                self.start_server_mode()
        except KeyboardInterrupt:
            print(f"\n[{self.machine_name}] Shutting down...")
            self.running = False


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Haas CNC Data Logger - Connects to a CNC machine and saves output to files",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    CLIENT MODE (Connect to the Haas CNC machine):
    python haas_logger.py -t 192.168.1.100                 # Connect to machine at this IP
    python haas_logger.py -t 192.168.1.100 -p 5063         # Connect to machine on custom port
    python haas_logger.py -t 192.168.1.100 -a -n "Mill_1"  # Connect with append mode and custom name

    ---------------------

    SERVER MODE (Listens for connections. Only used for script development, not production):
    python haas_logger.py                          # Listen on default port 5062
    python haas_logger.py -p 5063 -a               # Listen on port 5063 with append mode
    python haas_logger.py -H 0.0.0.0 -p 5062       # Listen on all interfaces

Notes:
    - Use -t to connect to a Haas machine (client mode)
    - Without -t, the script waits for the machine to connect (server mode)
    - In append mode (-a), close CSV files on PCs before production runs to avoid file locks
    - If a file is locked, the script will retry 3 times then create a backup file
    - In client mode, the script will auto-reconnect if the connection is lost
        """,
    )

    parser.add_argument(
        "-H",
        "--host",
        default="0.0.0.0",
        help="Host IP to bind to in server mode (default: 0.0.0.0)",
    )
    parser.add_argument(
        "-p",
        "--port",
        type=int,
        default=5062,
        help="Port to listen on or connect to (default: 5062)",
    )
    parser.add_argument(
        "-n",
        "--name",
        dest="machine_name",
        help="Machine name for filename (default: Machine_Port####)",
    )
    parser.add_argument(
        "-a",
        "--append",
        action="store_true",
        dest="append_mode",
        help="Append mode: Save all cycles for same part number to one file",
    )
    parser.add_argument(
        "-t",
        "--target",
        dest="target_ip",
        help="Target IP address to connect to (client mode). If not specified, runs in server mode.",
    )

    args = parser.parse_args()

    # Create and start the logger
    logger = HaasDataLogger(
        host=args.host,
        port=args.port,
        machine_name=args.machine_name,
        append_mode=args.append_mode,
        target_ip=args.target_ip,
    )

    try:
        logger.start()
    except KeyboardInterrupt:
        print("\nShutting down...")
