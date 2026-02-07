#!/usr/bin/env bash
#
# build-nmap.sh — Conflict-free Nmap + libpcap source build for Ubuntu 24.04 (ARM64-safe)
#
#   • Builds libpcap from source (avoids broken libpcap-dev chain)
#   • Builds Nmap with minimal dependencies, using bundled Lua
#   • Installs flex + bison (required by libpcap)
#   • No dbus-dev, no ibverbs-dev, no nl-dev, no zstd-dev
#   • Fully deterministic and appliance-friendly
#

set -euo pipefail

# -----------------------------
# CONFIG
# -----------------------------

SRC_ROOT="/usr/local/src"

LIBPCAP_VERSION="1.10.4"
LIBPCAP_TARBALL="libpcap-${LIBPCAP_VERSION}.tar.gz"
LIBPCAP_URL="https://www.tcpdump.org/release/${LIBPCAP_TARBALL}"

NMAP_URL="https://nmap.org/dist/nmap-latest.tar.bz2"

USE_CHECKINSTALL=true

# -----------------------------
# HELPERS
# -----------------------------

log() {
    echo "[+] $(date '+%Y-%m-%d %H:%M:%S') — $*"
}

fail() {
    echo "[!] ERROR: $*" >&2
    exit 1
}

# -----------------------------
# ROOT CHECK
# -----------------------------

if [[ $EUID -ne 0 ]]; then
    fail "This script must be run as root."
fi

log "Starting Nmap + libpcap build..."

# -----------------------------
# BASE DEPS (NO libpcap-dev, NO lua dev)
# -----------------------------

log "Installing base build dependencies..."
apt update -y
apt install -y \
    build-essential \
    checkinstall \
    libssl-dev \
    python3 \
    wget \
    git \
    flex \
    bison

# -----------------------------
# BUILD libpcap FROM SOURCE
# -----------------------------

log "Building libpcap ${LIBPCAP_VERSION} from source..."

mkdir -p "${SRC_ROOT}"
cd "${SRC_ROOT}"

rm -rf "libpcap-${LIBPCAP_VERSION}" "${LIBPCAP_TARBALL}" || true

wget -q "${LIBPCAP_URL}" -O "${LIBPCAP_TARBALL}"
tar xzf "${LIBPCAP_TARBALL}"
cd "libpcap-${LIBPCAP_VERSION}"

./configure
make -j"$(nproc)"
make install

# Ensure /usr/local/lib is visible
if ! grep -q "/usr/local/lib" /etc/ld.so.conf.d/*.conf 2>/dev/null; then
    echo "/usr/local/lib" >/etc/ld.so.conf.d/usr-local-lib.conf
fi
ldconfig

log "libpcap installed successfully."

# -----------------------------
# BUILD Nmap (USES /usr/local libpcap + BUNDLED LUA)
# -----------------------------

log "Building Nmap from source..."

cd "${SRC_ROOT}"
rm -rf nmap-* nmap-latest.tar.bz2 || true

wget -q "${NMAP_URL}" -O nmap-latest.tar.bz2
tar xjf nmap-latest.tar.bz2
cd nmap-* || fail "Failed to enter Nmap source directory."

log "Configuring Nmap (bundled Lua, minimal features)..."
./configure \
    --with-openssl \
    --with-libpcap \
    --without-zenmap \
    --without-ncat \
    --without-nping

make -j"$(nproc)"

if [[ "${USE_CHECKINSTALL}" == true ]]; then
    log "Packaging Nmap with checkinstall..."
    checkinstall --pkgname=nmap --pkgversion="latest" --backup=no --deldoc=yes --fstrans=no -y
else
    log "Installing Nmap via make install..."
    make install
fi

# -----------------------------
# VERIFY
# -----------------------------

log "Verifying Nmap installation..."
command -v nmap >/dev/null || fail "Nmap binary not found in PATH."
nmap --version

log "Nmap + libpcap build completed successfully."
