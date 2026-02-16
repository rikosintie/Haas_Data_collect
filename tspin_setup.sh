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
echo "[4/4] Configuring shell profiles for Bash and Zsh..."

# Define the lines we want to add
PATH_LINE='export PATH="$HOME/.cargo/bin:$PATH"'
# Replace the URL below with your actual tspin_alias.sh raw URL or local path
SOURCE_LINE='[ -f "$HOME/Haas_Data_collect/tspin_alias.sh" ] && source "$HOME/Haas_Data_collect/tspin_alias.sh"'

# List of profiles to check
PROFILES=("$HOME/.bashrc" "$HOME/.zshrc")

for PROFILE in "${PROFILES[@]}"; do
    if [ -f "$PROFILE" ]; then
        echo "Updating $PROFILE..."

        # Add PATH if not already there
        grep -qF "$PATH_LINE" "$PROFILE" || echo "$PATH_LINE" >> "$PROFILE"

        # Add Alias sourcing if not already there
        grep -qF "tspin_alias.sh" "$PROFILE" || echo "$SOURCE_LINE" >> "$PROFILE"
    fi
done

echo "SUCCESS: Environment configured. Please RESTART your terminal session."
