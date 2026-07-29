#!/usr/bin/env bash

# Check for root FIRST
if [[ $EUID -ne 0 ]]; then
  echo -e "${RED}[ERROR] This script must be run as root${RESET}" >&2
  exit 1
fi

set -euo pipefail

# =========================
# CONFIG
# =========================
GH_INSTALL_DIR="${GH_INSTALL_DIR:-/usr/local/bin}"

# =========================
# BOOTSTRAP (jq + yq)
# =========================
gh_bootstrap() {
    echo "[BOOTSTRAP] Checking dependencies..."

    # jq (required)
    if ! command -v jq >/dev/null 2>&1; then
        echo "[BOOTSTRAP] Installing jq..."
        sudo apt-get update -y
        sudo apt-get install -y jq
    fi

    # yq (required for YAML parsing)
    if ! command -v yq >/dev/null 2>&1; then
        echo "[BOOTSTRAP] Installing yq..."

        local arch
        arch=$(uname -m)

        case "$arch" in
            x86_64)
                sudo wget -qO /usr/local/bin/yq \
                    https://github.com/mikefarah/yq/releases/latest/download/yq_linux_amd64
                ;;
            aarch64|arm64)
                sudo wget -qO /usr/local/bin/yq \
                    https://github.com/mikefarah/yq/releases/latest/download/yq_linux_arm64
                ;;
            *)
                echo "ERROR: Unsupported architecture for yq: $arch"
                exit 1
                ;;
        esac

        sudo chmod +x /usr/local/bin/yq
    fi

    echo "[BOOTSTRAP] Done."
}

# =========================
# ARCH DETECTION
# =========================
gh_detect_arch() {
    local arch
    arch=$(uname -m)

    case "$arch" in
        x86_64)
            echo "x86_64-unknown-linux-gnu"
            ;;
        aarch64|arm64)
            echo "aarch64-unknown-linux-gnu"
            ;;
        *)
            echo "ERROR: Unsupported architecture: $arch" >&2
            return 1
            ;;
    esac
}

# =========================
# CURRENT VERSION
# =========================
gh_current_version() {
    local bin="$1"
    local cmd="${2:---version}"

    if command -v "$bin" >/dev/null 2>&1; then
        # Convert string to array safely
        local -a cmd_array
        read -r -a cmd_array <<< "$cmd"

        "$bin" "${cmd_array[@]}" 2>/dev/null \
            | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' || true
    else
        echo "none"
    fi
}

# =========================
# LATEST VERSION (GitHub API)
# =========================
gh_latest_version() {
    local repo="$1"

    curl -fsSL "https://api.github.com/repos/$repo/releases/latest" \
        | jq -r .tag_name \
        | sed 's/^v//'
}

# =========================
# GET DOWNLOAD URL
# =========================
gh_get_asset_url() {
    local repo="$1"
    local json
    json=$(curl -fsSL "https://api.github.com/repos/$repo/releases/latest")

    # Patterns are tried in priority order. Rust-style triples (gnu/musl)
    # are preferred when present; Go-style arch names (amd64/arm64) are
    # tried as a fallback since many repos (e.g. yorukot/superfile) only
    # publish those.
    local -a patterns

    case "$(uname -m)" in
        aarch64|arm64)
            patterns=(
                "aarch64.*linux.*gnu"
                "aarch64.*linux.*musl"
                "aarch64.*linux"
                "linux.*arm64"
                "arm64.*linux"
            )
            ;;
        x86_64)
            patterns=(
                "x86_64.*linux.*gnu"
                "x86_64.*linux.*musl"
                "x86_64.*linux"
                "linux.*amd64"
                "amd64.*linux"
            )
            ;;
        *)
            echo ""
            return 1
            ;;
    esac

    local pattern url
    for pattern in "${patterns[@]}"; do
        url=$(echo "$json" | jq -r \
            ".assets[]
            | select(.name | test(\"$pattern\"))
            | .browser_download_url" \
            | head -n1)

        if [[ -n "$url" ]]; then
            echo "$url"
            return 0
        fi
    done

    echo ""
    return 1
}

# =========================
# INSTALL FROM URL
# =========================
gh_install_from_url() {
    local url="$1"
    local bin_name="$2"

    local tmp
    tmp=$(mktemp -d)
    cd "$tmp"

    echo "[DOWNLOAD] $url"
    curl -fLO "$url"

    local file
    file=$(basename "$url")

    case "$file" in
        *.tar.gz|*.tgz)
            tar -xzf "$file"
            ;;
        *.tar.xz)
            tar -xJf "$file"
            ;;
        *.zip)
            unzip "$file"
            ;;
        *)
            chmod +x "$file"
            sudo mv "$file" "$GH_INSTALL_DIR/$bin_name"
            echo "[INSTALL] Installed $bin_name"
            return 0
            ;;
    esac

    # find executable inside archive
    local found
    found=$(find . -type f -name "$bin_name" -perm -111 | head -n1)

    if [[ -z "$found" ]]; then
        echo "ERROR: Binary $bin_name not found in archive"
        return 1
    fi

    chmod +x "$found"
    sudo mv "$found" "$GH_INSTALL_DIR/$bin_name"

    echo "[INSTALL] Installed $bin_name"
}

# =========================
# MAIN INSTALL FUNCTION
# =========================
gh_install() {
    local repo="$1"
    local bin="$2"
    local version_cmd="${3:---version}"

    echo ""
    echo "==== $repo ($bin) ===="

    local target
    target=$(gh_detect_arch)

    echo "Arch   : $target"

    local current latest
    current=$(gh_current_version "$bin" "$version_cmd")
    latest=$(gh_latest_version "$repo")

    echo "Current: ${current:-unknown}"
    echo "Latest : $latest"

    if [[ "$current" == "$latest" ]]; then
        echo "[SKIP] Already up to date"
        return 0
    fi

    local url
    url=$(gh_get_asset_url "$repo" "$target")

    if [[ -z "$url" ]]; then
        echo "ERROR: No matching asset for $target"
        return 1
    fi

    gh_install_from_url "$url" "$bin"

    echo "[DONE] $bin updated to $latest"
}

# =========================
# INSTALL FROM YAML INVENTORY
# =========================
gh_install_inventory() {
    gh_bootstrap

    local file="$1"

    if [[ ! -f "$file" ]]; then
        echo "ERROR: Inventory file not found: $file"
        return 1
    fi

    local count
    count=$(yq '.tools | length' "$file")

    echo ""
    echo "[INFO] Installing $count tools from $file"

    # 👇 ADD THIS
    local failures=0

    for i in $(seq 0 $((count - 1))); do
        local repo binary version_cmd

        repo=$(yq -r ".tools[$i].repo" "$file")
        binary=$(yq -r ".tools[$i].binary" "$file")
        version_cmd=$(yq -r ".tools[$i].version_cmd // \"--version\"" "$file")

        echo ""
        echo "[ITEM $((i+1))/$count] $repo ($binary)"

        # 👇 CHANGE THIS LINE
        if ! gh_install "$repo" "$binary" "$version_cmd"; then
            echo "[WARN] Failed: $repo ($binary)"
            failures=$((failures + 1))
        fi
    done

    echo ""

    # 👇 ADD THIS SUMMARY
    if [[ $failures -gt 0 ]]; then
        echo "[COMPLETE] Finished with $failures failure(s)"
    else
        echo "[COMPLETE] All tools installed successfully"
    fi
}
