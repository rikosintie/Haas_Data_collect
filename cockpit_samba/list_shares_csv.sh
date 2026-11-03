#!/usr/bin/env bash
# List Samba shares, paths, users, R/O status
# save to ~/Haas_Data_collect/shares.csv

testparm -s 2>/dev/null | awk '
BEGIN {
    print "share,path,valid_users,read_only";
    share=""; path=""; users=""; ro="";
}
/^\[/ {
    # Print the previous share when the next [section] header is seen
    if (share != "" && share != "global") {
        print share "," path "," users "," ro;
    }
    share = $0;
    gsub(/[\[\]]/, "", share);
    gsub(/^[ \t]+|[ \t]+$/, "", share);
    path=""; users=""; ro="";
}
/^[ \t]*path[ \t]*=/ {
    val = $0; sub(/^[ \t]*path[ \t]*=[ \t]*/, "", val); path = val;
}
/^[ \t]*valid users[ \t]*=/ {
    val = $0; sub(/^[ \t]*valid users[ \t]*=[ \t]*/, "", val); users = val;
}
/^[ \t]*read only[ \t]*=/ {
    val = $0; sub(/^[ \t]*read only[ \t]*=[ \t]*/, "", val); ro = val;
}
END {
    # Print the last share
    if (share != "" && share != "global") {
        print share "," path "," users "," ro;
    }
}
'
