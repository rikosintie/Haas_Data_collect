# Manage Samba

----------------------------------------------------------------

The `haas-install.sh` installer sets up a Cockpit extension for viewing and
editing the Samba configuration without needing SSH access. Log into
Cockpit at `https://<appliance-ip>:9090` and look for **Manage Samba** in
the sidebar.

----------------------------------------------------------------

The page has a single output/editor panel below a row of buttons. Only one
of three things is ever shown there: command output, the `smb.conf`
editor, or the Create Share form — never more than one at once.

## View buttons

These are read-only and safe to click any time:

| Button | What it does |
|---|---|
| Display Shares | Runs `list_shares.sh` — lists the shares defined in `smb.conf` |
| Shares CSV | Runs `list_shares_csv.sh` — same share list in CSV format |
| Samba Users | Lists every account in the Samba password database (`pdbedit -L`) |
| Linux Users | Lists local Linux accounts with UID 1000–59999, showing UID, GID, and home directory |
| Shares by User | Enter a username in the field next to the button, then click it to run `smbstatus --user=<name>` and show that user's active Samba sessions |

## Edit smb.conf

1. Click **Edit smb.conf** to load `/etc/samba/smb.conf` into the editor
   panel. While editing, every other view button is disabled except
   **Save & Restart** and **Clear Output**.
2. Make your changes directly in the text box.
3. Click **Save & Restart**. A confirmation dialog asks you to confirm
   before anything is written. Confirming first validates your edits with
   `testparm` — nothing is written or restarted yet. Only if that passes
   does it write the file and restart `smbd`, and the output panel shows
   the restart result followed by `systemctl status smbd`, so you can
   confirm the service came back up cleanly.
4. Click **Clear Output** instead of saving to discard your edits and
   return to the output panel — it doubles as a Cancel button while in
   edit mode.

!!! note "Invalid configs are rejected before anything is touched"
    `testparm` checks your edits before `smb.conf` is overwritten. If it
    finds a problem, the real config file is left untouched and `smbd` is
    not restarted — the error from `testparm` is shown above the editor so
    you can fix it and try again. Note that `testparm` only catches
    *syntax* errors; it can't tell you whether a share definition actually
    does what you intend.

## Create Share

Adds a new share stanza to `smb.conf` without hand-editing the file — the
same idea as **Create Service** on the Updates/Logs page: only the parts
that vary between shares are exposed as fields, and everything else is
filled in from a fixed template.

1. Click **Create Share**. Every other view button is disabled except
   **Save & Restart** and **Clear Output**, same as edit mode.

2. Fill in the two fields:

    | Field | Becomes | Notes |
    |---|---|---|
    | Machine Name | The `[section]` name | Letters, digits, `_`, `-` only; lower-cased on save |
    | Comment | `comment =` | Letters, digits, `_`, `-`, spaces only |

    There's no Path field — the share's directory is always
    `/home/haas/Haas_Data_collect/machines/<machine name>`, the same
    convention **Create Service** uses for a machine's working directory.
    Every other share setting (`browseable`, `writable`, `valid users`,
    `force user`/`force group`, the create/directory mask fields, etc.) is
    also fixed and identical for every share — none of it is user-editable
    through this form.

3. Click **Save & Restart**. A confirmation dialog names the directory and
   share it's about to create, and reminds you that this only creates the
   share — you still need to use **Create Service** on the Updates - Logs
   page to set up the logger service that actually collects data into it. The logic here is that you probably have machines that aren't Haas, but you still want to drop CNC programs onto the appliance and load them to the control.

    Before anything is written:

    * The machine directory is created with `mkdir -p` if it doesn't
      already exist yet — you don't need to create it (or a service for
      that machine) first.
    * The **machine name** is checked against the existing `smb.conf` for
      a section that already uses it — duplicates are rejected rather
      than silently shadowing the existing share.
    * The assembled config (existing `smb.conf` + the new stanza) is run
      through `testparm`, exactly like the Edit smb.conf flow.

    Only if the name is free and `testparm` passes is the new stanza
    appended to `smb.conf` and `smbd` restarted; the output panel then shows
    the restart result and `systemctl status smbd`.

4. Click **Clear Output** to discard the form and cancel — it doubles as
   Cancel here too.

Removes a share's stanza from `smb.conf` — the same idea as **Delete
Service** on the Updates/Logs page: pick from a dropdown, confirm, done.

1. Click **Delete Share** to populate a dropdown with every share
   currently defined in `smb.conf` (via `testparm -s`). The `[Haas]` share
   — the appliance's main data share, set up by `haas-install.sh` — is
   deliberately left out of this list, since it isn't a per-machine share;
   if it ever genuinely needs to be removed, do that through Edit smb.conf
   instead.
2. Select a share. A confirmation dialog names it and warns this cannot
   be undone. It also makes clear that only the `smb.conf` entry is
   removed — the machine's data directory itself is never touched or
   deleted.
3. Confirming reads the current `smb.conf`, removes that share's stanza,
   runs the result through `testparm` (same gate as Edit smb.conf and
   Create Share), and only then writes the file and restarts `smbd`. If
   `testparm` rejects the result, nothing is saved or restarted.

## Clear Output

Resets the panel back to a plain **Ready.** message and, if you were
mid-edit, discards the unsaved editor contents.
