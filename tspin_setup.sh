#!/bin/bash
set -e

echo "--- Starting Tailspin Setup (Ubuntu 24.04) ---"

# 1. System Dependencies
echo "[1/3] Installing build-essential..."
sudo apt update && sudo apt install -y build-essential curl git less

# 2. Rust/Cargo Check
if ! command -v cargo &> /dev/null; then
    echo "[2/3] Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    # This is the line that was missing in your manual run:
    . "$HOME/.cargo/env"
else
    echo "[2/3] Cargo already present."
fi

# 3. Direct Install (No Cargo.toml needed in current folder)
echo "[3/3] Installing tailspin via crates.io..."
if cargo install tailspin; then
    echo "------------------------------------------------"
    echo "SUCCESS: tailspin installed to ~/.cargo/bin"
    echo "------------------------------------------------"

    # Ensure it works immediately in this session
    export PATH="$HOME/.cargo/bin:$PATH"
    tspin --version
else
    echo "ERROR: Installation failed."
    exit 1
fi
