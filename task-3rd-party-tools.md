# review "tools.yaml"

Write a markdown file to go into the "Managing the appliance navigation, that explains what each tools does and a few examples of how they help managing the appliance from the terminal.

For zoxide
Maybe something showing how easy it is to jump around directories in the repo and how you can jump to a completely different directory like

┌─[haas@haas] - [~/Haas_Data_collect/cockpit_samba] - [4878]
└─[$] z mach
┌─[haas@haas] - [~/Haas_Data_collect/machines] - [4879]

┌─[haas@haas] - [~/Haas_Data_collect/machines] - [4890]
└─[$] z cock
┌─[haas@haas] - [~/Haas_Data_collect/cockpit_samba] - [4891]

And how you can view the entries in the zoxide database
zoxide query -l
/home/haas/Haas_Data_collect
/home/haas/Haas_Data_collect/machines
/home/haas/Haas_Data_collect/cockpit_samba
/etc/ssh/sshd_config.d
/etc/systemd/system
/home/haas/Haas_Data_collect/machines/st10y
/home/haas/Haas_Data_collect/machines/minimill
/etc/ssh
/home/haas/Haas_Data_collect/machines/minimill/cnc_logs
