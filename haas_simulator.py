'''
# Send data from a file
python haas_simulator.py --host 192.168.10.143 --file test_data.txt

# Generate and send test data
python haas_simulator.py –host 192.168.10.143 -p “265-4183” -r “X2”

# Send to localhost for testing
python haas_simulator.py --host localhost -p “TEST-001”

# Multiple sends with delay
python haas_simulator.py -H localhost -p “265-4183” --delay 2
'''

import socket
import time
import argparse
from datetime import datetime

class HaasCNCSimulator:
    def __init__(self, host, port, delay=1.0):
        self.host = host
        self.port = port
        self.delay = delay

    def send_file(self, filename):
        """Read a file and send its contents to the logger"""
        try:
            with open(filename, 'r') as f:
                data = f.read()

            print(f"Connecting to {self.host}:{self.port}...")
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.connect((self.host, self.port))
            print("Connected!")

            # Send data
            print(f"Sending data from {filename}...")
            sock.sendall(data.encode('utf-8'))

            # Wait a bit to ensure data is sent
            time.sleep(self.delay)

            print("Data sent successfully!")
            sock.close()

        except FileNotFoundError:
            print(f"Error: File '{filename}' not found")
        except ConnectionRefusedError:
            print(f"Error: Connection refused. Is the logger running on {self.host}:{self.port}?")
        except Exception as e:
            print(f"Error: {e}")

    def send_test_data(self, part_number, revision="A"):
        """Generate and send test data without requiring a file"""
        now = datetime.now()
        date_str = now.strftime("%y%m%d")
        time_str = now.strftime("%H%M%S")

        test_data = f"""%
O03020
G103 P1 (LIMIT LOOKAHEAD)
(DPRNTS ALL TEXT, A PART NUMBER)
DPRNT[ PART NUMBER: {part_number}, REV. {revision}]
(SIMPLE DATE AND TIME)
DPRNT[ DATE YYMMDD: {date_str}]
DPRNT[ TIME HHMMSS: {time_str}]

(DPRNT BLANK LINE)
DPRNT[]
DPRNT[ End of Cycle]
G103 (RETURN TO NORMAL LOOKAHEAD)
M30
%
"""

        try:
            print(f"Connecting to {self.host}:{self.port}...")
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.connect((self.host, self.port))
            print("Connected!")

            # Send data
            print(f"Sending test data for part {part_number}...")
            print("\n--- Data being sent ---")
            print(test_data)
            print("--- End of data ---\n")

            sock.sendall(test_data.encode('utf-8'))

            # Wait a bit to ensure data is sent
            time.sleep(self.delay)

            print("Test data sent successfully!")
            sock.close()

        except ConnectionRefusedError:
            print(f"Error: Connection refused. Is the logger running on {self.host}:{self.port}?")
        except Exception as e:
            print(f"Error: {e}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description='Haas CNC Simulator - Send test data to the logger',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog='''
Examples:
  # Send data from a file
  python haas_simulator.py --host 192.168.1.100 --file test_data.txt

  # Generate and send test data
  python haas_simulator.py --host 192.168.1.100 --part "265-4183" --rev "X2"

  # Send to localhost for testing
  python haas_simulator.py --host localhost --part "TEST-001"

  # Multiple sends with delay
  python haas_simulator.py -H localhost -p "265-4183" --delay 2
        '''
    )

    parser.add_argument(
        '-H', '--host',
        type=str,
        required=True,
        help='IP address or hostname of the logger (e.g., 192.168.1.100 or localhost)'
    )

    parser.add_argument(
        '--port',
        type=int,
        default=5062,
        help='TCP port of the logger (default: 5062)'
    )

    parser.add_argument(
        '-f', '--file',
        type=str,
        help='File containing CNC data to send'
    )

    parser.add_argument(
        '-p', '--part',
        type=str,
        help='Part number for test data (used if --file not specified)'
    )

    parser.add_argument(
        '-r', '--rev',
        type=str,
        default='A',
        help='Revision for test data (default: A)'
    )

    parser.add_argument(
        '--delay',
        type=float,
        default=1.0,
        help='Delay in seconds after sending data (default: 1.0)'
    )

    args = parser.parse_args()

    simulator = HaasCNCSimulator(args.host, args.port, args.delay)

    if args.file:
        # Send data from file
        simulator.send_file(args.file)
    elif args.part:
        # Generate and send test data
        simulator.send_test_data(args.part, args.rev)
    else:
        print("Error: You must specify either --file or --part")
        print("Run with --help for usage examples")
