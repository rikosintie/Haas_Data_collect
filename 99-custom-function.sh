#!/bin/bash

zsh -c '
  source /home/haas/.oh-my-zsh/custom/haas-aliases.zsh 2>/dev/null

  if typeset -f haas-help >/dev/null; then
        haas-help

  else
    echo "haas-help not found in /home/haas/.oh-my-zsh/custom/haas-aliases.zsh"
  fi
'
