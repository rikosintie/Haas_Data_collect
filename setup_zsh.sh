#!/usr/bin/env bash
#
# setup_zsh.sh — Install and configure zsh + Oh My Zsh for a user
#
# Called by haas-install.sh (defaults to the haas user):
#   bash "$REPO_DIR/setup_zsh.sh" "$REPO_DIR"
#
# Also called by the Cockpit Manage Samba "Create User" button for newly
# created Administrator accounts, so they get the same zsh/aliases
# environment as the haas user:
#   bash "$REPO_DIR/setup_zsh.sh" "$REPO_DIR" "$USERNAME"
#
# Must be run as root (callers already enforce this).
#

REPO_DIR="${1:?Usage: sudo bash setup_zsh.sh <repo_dir> [username]}"
TARGET_USER="${2:-haas}"
TARGET_HOME=$(getent passwd "$TARGET_USER" | cut -d: -f6)

CYAN="\e[1;36m"
YELLOW="\e[1;33m"
RED="\e[1;31m"
RESET="\e[0m"

header() { echo ""; echo "############################################################";
           echo -e "#  ${CYAN}[*] $1${RESET}";
           echo "############################################################"; echo ""; }
ok()     { echo -e "  ✅ ${CYAN}$1${RESET}"; }
warn()   { echo -e "  ⚠️  ${YELLOW}$1${RESET}"; }
fail()   { echo -e "  ❌ ${RED}$1${RESET}"; }

# ── Preflight checks ─────────────────────────────────────────────────────────

for f in zshrc haas-aliases.zsh; do
    if [[ ! -f "$REPO_DIR/$f" ]]; then
        fail "Missing required file: $REPO_DIR/$f"
        exit 1
    fi
done

if ! id "$TARGET_USER" &>/dev/null; then
    fail "User '$TARGET_USER' does not exist — run haas-install.sh first."
    exit 1
fi

if [[ -z "$TARGET_HOME" ]]; then
    fail "Could not determine home directory for $TARGET_USER"
    exit 1
fi

PLUGIN_DIR="$TARGET_HOME/.oh-my-zsh/custom/plugins"
ZSH_CUSTOM_DIR="$TARGET_HOME/.oh-my-zsh/custom"

# ── Install zsh ───────────────────────────────────────────────────────────────

header "Installing zsh"
if apt install zsh -y; then
    ZSH_VERSION=$(zsh --version | awk '{print $2}')
    ok "zsh $ZSH_VERSION installed"
else
    fail "Failed to install zsh"
    exit 1
fi

# ── Install zsh-syntax-highlighting (apt package) ─────────────────────────────

header "Installing zsh-syntax-highlighting"
if apt install zsh-syntax-highlighting -y; then
    ok "zsh-syntax-highlighting installed"
else
    warn "Failed to install zsh-syntax-highlighting — the last line of .zshrc sources it."
    warn "Install manually: sudo apt install zsh-syntax-highlighting"
fi

# ── Install Oh My Zsh (unattended, runs as the target user) ─────────────────
# --unattended: skips interactive prompts, does not change the default shell,
# and still creates ~/.oh-my-zsh and a default ~/.zshrc (which we overwrite below).

header "Installing Oh My Zsh for $TARGET_USER"
if [[ -d "$TARGET_HOME/.oh-my-zsh" ]]; then
    ok "Oh My Zsh already present — skipping install"
else
    sudo -u "$TARGET_USER" env HOME="$TARGET_HOME" \
        sh -c "$(curl -fsSL https://raw.githubusercontent.com/ohmyzsh/ohmyzsh/master/tools/install.sh)" \
        "" --unattended

    if [[ -d "$TARGET_HOME/.oh-my-zsh" ]]; then
        ok "Oh My Zsh installed to $TARGET_HOME/.oh-my-zsh"
    else
        fail "Oh My Zsh installation failed"
        exit 1
    fi
fi

# ── Clone third-party plugins ─────────────────────────────────────────────────

sudo -u "$TARGET_USER" mkdir -p "$PLUGIN_DIR"

clone_plugin() {
    local name="$1"
    local url="$2"
    local dest="$3"
    if [[ -d "$dest" ]]; then
        ok "Plugin '$name' already present — skipping"
    else
        echo ""
        echo -e "  ${CYAN}Cloning $name...${RESET}"
        if sudo -u "$TARGET_USER" git clone "$url" "$dest"; then
            ok "$name cloned"
        else
            warn "Failed to clone $name — add it manually later."
        fi
    fi
}

header "Cloning zsh plugins"

clone_plugin "zsh-completions" \
    "https://github.com/zsh-users/zsh-completions" \
    "$PLUGIN_DIR/zsh-completions"

clone_plugin "zsh-autosuggestions" \
    "https://github.com/zsh-users/zsh-autosuggestions" \
    "$PLUGIN_DIR/zsh-autosuggestions"

clone_plugin "zsh-history-substring-search" \
    "https://github.com/zsh-users/zsh-history-substring-search" \
    "$PLUGIN_DIR/zsh-history-substring-search"

clone_plugin "zsh-docker-aliases" \
    "https://github.com/akarzim/zsh-docker-aliases.git" \
    "$PLUGIN_DIR/zsh-docker-aliases"

# ── Copy custom .zshrc (overwrites the default one Oh My Zsh created) ─────────

header "Installing custom .zshrc"
cp "$REPO_DIR/zshrc" "$TARGET_HOME/.zshrc"
chown "$TARGET_USER:$TARGET_USER" "$TARGET_HOME/.zshrc"
ok ".zshrc installed → $TARGET_HOME/.zshrc"

# ── Copy haas-aliases.zsh to Oh My Zsh custom dir ────────────────────────────

header "Installing haas-aliases.zsh"
sudo -u "$TARGET_USER" mkdir -p "$ZSH_CUSTOM_DIR"
cp "$REPO_DIR/haas-aliases.zsh" "$ZSH_CUSTOM_DIR/haas-aliases.zsh"
chown "$TARGET_USER:$TARGET_USER" "$ZSH_CUSTOM_DIR/haas-aliases.zsh"
ok "haas-aliases.zsh installed → $ZSH_CUSTOM_DIR/haas-aliases.zsh"

# ── Set zsh as the default shell for the target user ─────────────────────────

header "Setting default shell to zsh for $TARGET_USER"
ZSH_PATH=$(which zsh)
if chsh -s "$ZSH_PATH" "$TARGET_USER"; then
    ok "Default shell for $TARGET_USER set to $ZSH_PATH"
else
    warn "chsh failed — trying usermod..."
    if usermod -s "$ZSH_PATH" "$TARGET_USER"; then
        ok "Default shell set via usermod"
    else
        warn "Could not set default shell automatically."
        warn "Run manually after install: sudo chsh -s $ZSH_PATH $TARGET_USER"
    fi
fi

echo ""
echo "##############################################################"
echo "#                                                            #"
echo -e "#  ${CYAN}✅ zsh setup complete for user: $TARGET_USER${RESET}"
echo "#                                                            #"
echo -e "#  ${CYAN}Plugins installed:${RESET}"
echo -e "#    ${CYAN}git (built-in)${RESET}"
echo -e "#    ${CYAN}colored-man-pages (built-in)${RESET}"
echo -e "#    ${CYAN}zsh-completions${RESET}"
echo -e "#    ${CYAN}zsh-autosuggestions${RESET}"
echo -e "#    ${CYAN}history-substring-search${RESET}"
echo -e "#    ${CYAN}zsh-syntax-highlighting (system)${RESET}"
echo "#                                                            #"
echo "##############################################################"
echo ""
