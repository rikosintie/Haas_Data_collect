#!/bin/bash
while IFS= read -r line; do
    if [[ "$line" == \[*\] ]]; then
        # Extract share name without brackets
        name="${line#\[}"
        name="${name%\]}"
    fi
    if [[ "$line" == *path\ =* ]]; then
        # Skip global, printers, and print$ shares
        if [[ "$name" != "global" && "$name" != "printers" && "$name" != "print$" ]]; then
            # Extract path after "path = "
            sharepath="${line#*path = }"
            # Print formatted output
            printf "%-12s %s\n" "$name" "$sharepath"
        fi
    fi
done < /etc/samba/smb.conf
