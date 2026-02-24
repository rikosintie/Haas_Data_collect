#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Cockpit Upstream Container Installer for Ubuntu 24.04 (ARM64 / Raspberry Pi 5)
# ==============================================================================
# This script installs Docker, pulls the upstream Cockpit container, mounts
# your Cockpit extension, and registers a systemd service so Cockpit runs
# automatically on boot.
#
# This bypasses Ubuntu’s crippled Cockpit packaging on ARM and gives you the
# full upstream Cockpit environment (shell, JS injection, extension loader).
# ==============================================================================

EXTENSION_DIR="/usr/share/cockpit/haas-firewall"
CONTAINER_NAME="cockpit-ws"
IMAGE="quay.io/cockpit/ws"
SERVICE_FILE="/etc/systemd/system/cockpit-container.service"

echo "==> Installing Docker (if not already installed)..."
if ! command -v docker >/dev/null 2>&1; then
    sudo apt update
    sudo apt install -y docker.io
    sudo systemctl enable --now docker
fi

echo "==> Creating Cockpit extension directory..."
sudo mkdir -p "$EXTENSION_DIR"
sudo chown root:root "$EXTENSION_DIR"
sudo chmod 755 "$EXTENSION_DIR"

echo "==> Pulling upstream Cockpit container..."
sudo docker pull "$IMAGE"

echo "==> Creating systemd service for Cockpit container..."
sudo tee "$SERVICE_FILE" >/dev/null <<EOF
[Unit]
Description=Cockpit Web Service (Upstream Container)
After=network-online.target docker.service
Wants=network-online.target

[Service]
Restart=always
ExecStart=/usr/bin/docker run \\
    --name ${CONTAINER_NAME} \\
    --privileged \\
    -p 9090:9090 \\
    -v /:/host \\
    -v ${EXTENSION_DIR}:/usr/share/cockpit/haas-firewall:ro \\
    ${IMAGE}

ExecStop=/usr/bin/docker stop ${CONTAINER_NAME}
ExecStopPost=/usr/bin/docker rm ${CONTAINER_NAME}

[Install]
WantedBy=multi-user.target
EOF

echo "==> Reloading systemd and enabling Cockpit service..."
sudo systemctl daemon-reload
sudo systemctl enable --now cockpit-container.service

echo "==> Installation complete!"
echo "Cockpit is now running at: https://<appliance-ip>:9090"
echo "Your extension is mounted at: $EXTENSION_DIR"
