'''Haas CNC Data Logger
Usage examples:

# Machine 1
python haas_logger.py --port 5062 --name "Machine1"

# Machine 2
python haas_logger.py --port 5063 --name "Machine2"

# Machine 3
python haas_logger.py -p 5064 -n "Machine3"

# Machine 4
python haas_logger.py -p 5065 -n "Mill_A"

# Machine 5
python haas_logger.py -p 5066 -n "Lathe_B"

# Machine 6
python haas_logger.py -p 5067 -n "VF2"
'''

import socket
import threading
import re
from datetime import datetime
import os
import argparse
import csv
from typing import Optional, Dict, Tuple

class HaasDataLogger:
    """
    A TCP server that listens for Haas CNC machine data and logs it to CSV files.

    This logger captures machine data transmitted over TCP, extracts part numbers
    and other relevant information, and saves complete cycles to timestamped CSV files.
    """

    def __init__(self, host: str = '0.0.0.0', port: int = 5062,
        machine_name: Optional[str] = None) -> None:
        """
        Initialize the Haas Data Logger.

        Args:
            host: IP address to bind the server to. Defaults to '0.0.0.0' (all interfaces).
            port: Port number to listen on. Defaults to 5062.
            machine_name: Custom name for the machine. If None, generates name from port.
        """
        self.host = host
        self.port = port
        self.machine_name = machine_name or f"Machine_Port{port}"
        self.running = False

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
        match = re.search(r'PART NUMBER:\s*([^\s,]+)', data, re.IGNORECASE)
        if match:
            return match.group(1).strip()
        return None

    def parse_data_to_dict(self, data: str) -> Dict[str, str]:
        """
        Parse the CNC data into a dictionary for CSV output.

        Extracts structured information including part number, revision, date, and time
        from the raw CNC machine data string.

        Args:
            data: Raw data string received from the CNC machine.

        Returns:
            Dictionary containing parsed fields including Machine, Timestamp, Part_Number,
            Revision, Date_YYMMDD, Time_HHMMSS, and Raw_Data.
        """
        result = {
            'Machine': self.machine_name,
            'Timestamp': datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            'Part_Number': '',
            'Revision': '',
            'Date_YYMMDD': '',
            'Time_HHMMSS': '',
            'Raw_Data': data
        }

        # Extract part number and revision
        part_match = re.search(r'PART NUMBER:\s*([^\s,]+)(?:,\s*REV\.\s*([^\]]+))?', data, re.IGNORECASE)
        if part_match:
            result['Part_Number'] = part_match.group(1).strip()
            if part_match.group(2):
                result['Revision'] = part_match.group(2).strip()

        # Extract date
        date_match = re.search(r'DATE YYMMDD:\s*(\d+)', data, re.IGNORECASE)
        if date_match:
            result['Date_YYMMDD'] = date_match.group(1).strip()

        # Extract time
        time_match = re.search(r'TIME HHMMSS:\s*(\d+)', data, re.IGNORECASE)
        if time_match:
            result['Time_HHMMSS'] = time_match.group(1).strip()

        return result

    def save_to_file(self, data: str, part_number: Optional[str]) -> str:
        """
        Save data to CSV file with part number and timestamp.

        Creates a CSV file in the cnc_logs directory with parsed machine data.
        The filename includes the machine name, part number (if available), and timestamp.

        Args:
            data: Raw data string to be saved.
            part_number: Part number extracted from the data, or None if not found.

        Returns:
            Full filepath where the data was saved.
        """
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        if part_number:
            filename = f"{self.machine_name}_{part_number}_{timestamp}.csv"
        else:
            filename = f"{self.machine_name}_unknown_part_{timestamp}.csv"

        # Create logs directory if it doesn't exist
        os.makedirs('cnc_logs', exist_ok=True)
        filepath = os.path.join('cnc_logs', filename)

        # Parse data into structured format
        parsed_data = self.parse_data_to_dict(data)

        # Write to CSV
        with open(filepath, 'w', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=parsed_data.keys())
            writer.writeheader()
            writer.writerow(parsed_data)

        print(f"[{self.machine_name}] Data saved to: {filepath}")
        return filepath

    def handle_client(self, client_socket: socket.socket,
        address: Tuple[str, int]) -> None:
        """
        Handle individual client connection.

        Receives data from a connected CNC machine, buffers it, extracts part numbers,
        and saves complete cycles to files when "End of Cycle" is detected.

        Args:
            client_socket: The connected client socket.
            address: Tuple containing the client's IP address and port.
        """
        print(f"[{self.machine_name}] Connection established from {address}")

        buffer = ""
        part_number = None

        try:
            while self.running:
                data = client_socket.recv(4096)
                if not data:
                    break

                # Decode received data
                received = data.decode('utf-8', errors='ignore')
                buffer += received

                # Extract part number if we haven't found it yet
                if not part_number:
                    part_number = self.extract_part_number(buffer)
                    if part_number:
                        print(f"[{self.machine_name}] Part number detected: {part_number}")

                # Check for end of cycle
                if "End of Cycle" in buffer or "END OF CYCLE" in buffer.upper():
                    print(f"[{self.machine_name}] End of cycle detected!")
                    self.save_to_file(buffer, part_number)

                    # Reset for next cycle
                    buffer = ""
                    part_number = None

        except Exception as e:
            print(f"[{self.machine_name}] Error handling client {address}: {e}")
        finally:
            client_socket.close()
            print(f"[{self.machine_name}] Connection closed from {address}")

    def start(self) -> None:
        """
        Start the TCP server.

        Binds to the configured host and port, then listens for incoming connections
        from CNC machines. Each connection is handled in a separate daemon thread.
        The server runs until interrupted by Ctrl+C or an error occurs.

        Raises:
            Exception: If there's an error binding to the port or accepting connections.
        """
        self.running = True

        server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

        try:
            server_socket.bind((self.host, self.port))
            server_socket.listen(5)
            print(f"[{self.machine_name}] Haas CNC Data Logger started on {self.host}:{self.port}")
            print(f"[{self.machine_name}] Waiting for connections...")
            print(f"[{self.machine_name}] Press Ctrl+C to stop")

            while self.running:
                try:
                    server_socket.settimeout(1.0)
                    client_socket, address = server_socket.accept()

                    # Handle each client in a separate thread
                    client_thread = threading.Thread(
                        target=self.handle_client,
                        args=(client_socket, address)
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

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description='Haas CNC Data Logger - Listens for machine data and saves to files',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  python haas_logger.py                          # Start on default port 5062
  python haas_logger.py -p 5063                  # Start on custom port
  python haas_logger.py -p 5062 -n "Mill_1"     # Start with custom machine name
  python haas_logger.py -H 192.168.1.100 -p 5062 # Bind to specific IP
        '''
    )

    parser.add_argument('-H', '--host',
                        default='0.0.0.0',
                        help='Host IP to bind to (default: 0.0.0.0)')
    parser.add_argument('-p', '--port',
                        type=int,
                        default=5062,
                        help='Port to listen on (default: 5062)')
    parser.add_argument('-n', '--name',
                        dest='machine_name',
                        help='Machine name for logging (default: Machine_Port####)')

    args = parser.parse_args()

    # Create and start the logger
    logger = HaasDataLogger(
        host=args.host,
        port=args.port,
        machine_name=args.machine_name
    )

    try:
        logger.start()
    except KeyboardInterrupt:
        print("\nShutting down...")
