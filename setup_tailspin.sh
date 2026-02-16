#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "--- Starting Tailspin Build Environment Setup (Ubuntu 24.04) ---"

# 1. Update and install system dependencies
echo "[1/4] Installing build-essential and dependencies..."
sudo apt update
sudo apt install -y build-essential curl git less

# 2. Check for Rust/Cargo
if ! command -v cargo &> /dev/null; then
    echo "[2/4] Cargo not found. Installing Rust via rustup.rs..."
    # The -s -- -y flags bypass the interactive prompt for an automated install
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y

    # Source the environment for the current script session
    source "$HOME/.cargo/env"
else
    echo "[2/4] Cargo already installed. Skipping Rustup."
fi

# 3. Verify we are in a directory with a Cargo.toml
echo "[3/4] Validating local path..."
if [ ! -f "Cargo.toml" ]; then
    echo "ERROR: No Cargo.toml found in $(pwd)."
    echo "Please run this script from inside the tailspin source directory."
    exit 1
fi

# 4. Run the installation
echo "[4/4] Executing cargo install..."
if cargo install --path .; then
    echo "------------------------------------------------"
    echo "SUCCESS: tailspin (tspin) installed to ~/.cargo/bin"
    echo "------------------------------------------------"

    # Final check to ensure the binary is accessible
    export PATH="$HOME/.cargo/bin:$PATH"
    tspin --version
else
    echo "ERROR: Cargo build failed. Check for missing library dependencies."
    exit 1
fi

echo "NOTE: If 'tspin' command is not found in a new terminal, add this to your .bashrc:"
echo 'export PATH="$HOME/.cargo/bin:$PATH"'
