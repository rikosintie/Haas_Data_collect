import sys
import tkinter as tk
from tkinter import ttk


class HaasLoggerGUI:
    """
    GUI wrapper for the Haas CNC Data Logger.

    Provides a simple interface to configure logger parameters and generate
    the command line to run the logger script.
    """

    def __init__(self, root: tk.Tk) -> None:
        """
        Initialize the GUI.

        Args:
            root: The tkinter root window.
        """
        self.root = root
        self.root.title("Haas CNC Data Logger Configuration")
        self.root.geometry("600x500")
        self.root.resizable(True, True)

        # Create main frame with padding
        main_frame = ttk.Frame(root, padding="20")
        main_frame.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))

        # Configure grid weights for resizing
        root.columnconfigure(0, weight=1)
        root.rowconfigure(0, weight=1)
        main_frame.columnconfigure(1, weight=1)

        # IP Address
        ttk.Label(main_frame, text="Target IP Address:").grid(
            row=0, column=0, sticky=tk.W, pady=10
        )
        self.ip_var = tk.StringVar()
        self.ip_entry = ttk.Entry(main_frame, textvariable=self.ip_var, width=35)
        self.ip_entry.grid(row=0, column=1, sticky=(tk.W, tk.E), pady=10, padx=(10, 0))
        ttk.Label(
            main_frame,
            text="(Leave blank for server mode)",
            font=("TkDefaultFont", 8),
            foreground="gray",
        ).grid(row=1, column=1, sticky=tk.W, padx=(10, 0))

        # Machine Name
        ttk.Label(main_frame, text="Machine Name:").grid(
            row=2, column=0, sticky=tk.W, pady=10
        )
        self.name_var = tk.StringVar()
        self.name_entry = ttk.Entry(main_frame, textvariable=self.name_var, width=35)
        self.name_entry.grid(
            row=2, column=1, sticky=(tk.W, tk.E), pady=10, padx=(10, 0)
        )
        ttk.Label(
            main_frame,
            text="(Optional - auto-generated if blank)",
            font=("TkDefaultFont", 8),
            foreground="gray",
        ).grid(row=3, column=1, sticky=tk.W, padx=(10, 0))

        # Port
        ttk.Label(main_frame, text="Port:").grid(row=4, column=0, sticky=tk.W, pady=10)
        self.port_var = tk.StringVar(value="5062")
        port_combo = ttk.Combobox(
            main_frame, textvariable=self.port_var, width=32, state="readonly"
        )
        port_combo["values"] = [str(p) for p in range(5050, 5061)]
        port_combo.grid(row=4, column=1, sticky=(tk.W, tk.E), pady=10, padx=(10, 0))

        # Append Mode
        ttk.Label(main_frame, text="File Mode:").grid(
            row=5, column=0, sticky=tk.W, pady=10
        )
        self.append_var = tk.BooleanVar(value=False)

        radio_frame = ttk.Frame(main_frame)
        radio_frame.grid(row=5, column=1, sticky=tk.W, pady=10, padx=(10, 0))

        ttk.Radiobutton(
            radio_frame,
            text="New file per cycle",
            variable=self.append_var,
            value=False,
        ).pack(anchor=tk.W, pady=2)
        ttk.Radiobutton(
            radio_frame,
            text="Append to same file (by part number)",
            variable=self.append_var,
            value=True,
        ).pack(anchor=tk.W, pady=2)

        # Command Preview
        ttk.Label(
            main_frame, text="Command Preview:", font=("TkDefaultFont", 10, "bold")
        ).grid(row=6, column=0, columnspan=2, sticky=tk.W, pady=(25, 5))

        # Frame for command text with scrollbar
        text_frame = ttk.Frame(main_frame)
        text_frame.grid(
            row=7, column=0, columnspan=2, sticky=(tk.W, tk.E, tk.N, tk.S), pady=5
        )
        text_frame.columnconfigure(0, weight=1)
        text_frame.rowconfigure(0, weight=1)

        self.command_text = tk.Text(
            text_frame,
            height=5,
            width=65,
            wrap=tk.WORD,
            bg="#f0f0f0",
            relief=tk.SUNKEN,
            borderwidth=2,
            font=("Courier", 9),
        )
        self.command_text.grid(row=0, column=0, sticky=(tk.W, tk.E, tk.N, tk.S))

        scrollbar = ttk.Scrollbar(
            text_frame, orient=tk.VERTICAL, command=self.command_text.yview
        )
        scrollbar.grid(row=0, column=1, sticky=(tk.N, tk.S))
        self.command_text["yscrollcommand"] = scrollbar.set

        self.command_text.config(state=tk.DISABLED)

        # Update command preview when values change
        self.ip_var.trace_add("write", self.update_command_preview)
        self.name_var.trace_add("write", self.update_command_preview)
        self.port_var.trace_add("write", self.update_command_preview)
        self.append_var.trace_add("write", self.update_command_preview)

        # Buttons
        button_frame = ttk.Frame(main_frame)
        button_frame.grid(row=8, column=0, columnspan=2, pady=(25, 10))

        ttk.Button(button_frame, text="OK", command=self.on_ok, width=20).pack(
            side=tk.LEFT, padx=10
        )
        ttk.Button(button_frame, text="Cancel", command=self.on_cancel, width=20).pack(
            side=tk.LEFT, padx=10
        )

        # Initial command preview
        self.update_command_preview()

        # Focus on IP entry
        self.ip_entry.focus()

    def update_command_preview(self, *args) -> None:
        """
        Update the command preview text box.

        Builds the command string based on current GUI values and displays it.
        """
        command_parts = ["python haas_logger.py"]

        # Add target IP if provided
        if self.ip_var.get().strip():
            command_parts.append(f"-t {self.ip_var.get().strip()}")

        # Add port
        command_parts.append(f"-p {self.port_var.get()}")

        # Add machine name if provided
        if self.name_var.get().strip():
            command_parts.append(f'-n "{self.name_var.get().strip()}"')

        # Add append flag if selected
        if self.append_var.get():
            command_parts.append("-a")

        command = " ".join(command_parts)

        # Update text widget
        self.command_text.config(state=tk.NORMAL)
        self.command_text.delete(1.0, tk.END)
        self.command_text.insert(1.0, command)
        self.command_text.config(state=tk.DISABLED)

    def on_ok(self) -> None:
        """
        Handle OK button click.

        Prints the command to stdout and closes the GUI, allowing the user
        to press Enter in the terminal to execute it.
        """
        command_parts = ["python haas_logger.py"]

        # Add target IP if provided
        if self.ip_var.get().strip():
            command_parts.append(f"-t {self.ip_var.get().strip()}")

        # Add port
        command_parts.append(f"-p {self.port_var.get()}")

        # Add machine name if provided
        if self.name_var.get().strip():
            command_parts.append(f'-n "{self.name_var.get().strip()}"')

        # Add append flag if selected
        if self.append_var.get():
            command_parts.append("-a")

        command = " ".join(command_parts)

        # Print command to terminal
        print(command)

        # Close the window
        self.root.destroy()

    def on_cancel(self) -> None:
        """
        Handle Cancel button click.

        Closes the GUI without executing anything.
        """
        self.root.destroy()
        sys.exit(0)


if __name__ == "__main__":
    root = tk.Tk()
    app = HaasLoggerGUI(root)
    root.mainloop()
