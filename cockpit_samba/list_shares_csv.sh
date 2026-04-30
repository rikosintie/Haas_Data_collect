#!/usr/bin/env bash
# List Samba shares, paths, users, R/O status
# save to ~/Haas_Data_collect/shares.csv

testparm -s 2>/dev/null | awk '
BEGIN {
    FS="=";
    print "share,path,valid_users,read_only";
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
        print share "," path "," users "," ro;
    }
}
'
