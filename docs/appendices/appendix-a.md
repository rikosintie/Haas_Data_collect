# Disable SMBv1 on Linux or Unix when using Samba

The `smb.conf` file should still be open. If not, run the following command to open the Samba Server configuration file:

```bash linenums='1' hl_lines='1'
sudo nano /etc/samba/smb.conf
```

Find the [global] section and append the following line:

```bash linenums='1' hl_lines='1'
min protocol = SMB2
```

Here is what it looks like on my server

```bash linenums='1' hl_lines='1'
#======================= Global Settings =======================

[global]

   client min protocol = SMB2
```

!!! Note:
    smbv1 was permanently removed for Samba Server version 4.16. This step is not strictly necassary, we will verify that smbv1 is disabled later in the installation but I like to make absolutely sure smbv1 is not enabled!

sudo sh -c 'cd /var/lib/samba/usershares && ls -l'
