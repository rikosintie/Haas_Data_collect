#!/bin/bash

# Sourcing the repo's own copy rather than a specific user's
# ~/.oh-my-zsh/custom/haas-aliases.zsh (setup_zsh.sh's per-user copy of
# this same file) means this MOTD banner — which runs for every SSH
# login, regardless of which account is connecting — does not depend on
# any particular user's zsh/Oh My Zsh setup having completed
# successfully. Previously hardcoded to haas own copy specifically.
zsh -c '
  source /home/haas/Haas_Data_collect/scripts/haas-aliases.zsh 2>/dev/null

  if typeset -f haas-help >/dev/null; then
        haas-help

  else
    echo "haas-help not found in /home/haas/Haas_Data_collect/scripts/haas-aliases.zsh"
  fi
'
