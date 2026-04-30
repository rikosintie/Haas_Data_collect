#!/usr/bin/env bash
# List Samba shares, paths, users, R/O status

testparm -s 2>/dev/null | awk '
BEGIN {
    FS="=";
    printf "%-20s %-40s %-25s %-10s\n", "SHARE", "PATH", "VALID USERS", "READ ONLY";
}
/^\[/ {
    share=$0;
    gsub(/[\[\]]/, "", share);

    if (share != "global") {
        path=""; users=""; ro="";
    }
}
/^[ \t]*path[ \t]*=/ {
    path=$2; gsub(/^[ \t]+/, "", path);
}
/^[ \t]*valid users[ \t]*=/ {
    users=$2; gsub(/^[ \t]+/, "", users);
}
/^[ \t]*read only[ \t]*=/ {
    ro=$2; gsub(/^[ \t]+/, "", ro);
}
/^$/ {
    if (share != "" && share != "global") {
        printf "%-20s %-40s %-25s %-10s\n", share, path, users, ro;
    }
}
'
