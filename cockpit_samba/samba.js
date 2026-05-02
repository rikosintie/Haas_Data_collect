const output        = document.getElementById("output");
const confEditor    = document.getElementById("confEditor");
const editorSection = document.getElementById("editorSection");

const editConfBtn          = document.getElementById("editConfBtn");
const saveRestartBtn       = document.getElementById("saveRestartBtn");
const displaySharesBtn     = document.getElementById("displaySharesBtn");
const displaySambaUsersBtn = document.getElementById("displaySambaUsersBtn");
const displayLinuxUsersBtn = document.getElementById("displayLinuxUsersBtn");
const clearOutputBtn       = document.getElementById("clearOutputBtn");
const displaySharesByUserBtn = document.getElementById("displaySharesByUserBtn");
const usernameInput        = document.getElementById("usernameInput");

const SMB_CONF = "/etc/samba/smb.conf";

// ── helpers ──────────────────────────────────────────────────────────────────

function setAllDisabled(state) {
    editConfBtn.disabled          = state;
    saveRestartBtn.disabled       = state ? true : !editorSection.style.display || editorSection.style.display === "none";
    displaySharesBtn.disabled     = state;
    displaySambaUsersBtn.disabled = state;
    displayLinuxUsersBtn.disabled = state;
    clearOutputBtn.disabled       = state;
    displaySharesByUserBtn.disabled = state;
}

function showOutput(text) {
    output.className = "";
    output.textContent = text;
}

function runCommand(args, label) {
    setAllDisabled(true);
    showOutput("Running: " + label + "...\n");

    cockpit.spawn(args, { superuser: "require", err: "message" })
        .done(function(data) {
            output.textContent = "--- " + label + " ---\n\n" + (data || "(no output)");
        })
        .fail(function(ex, data) {
            output.textContent = "--- " + label + " ---\n\nERROR: " + (ex.message || JSON.stringify(ex));
            if (data) output.textContent += "\n" + data;
        })
        .always(function() {
            setAllDisabled(false);
        });
}

// ── Edit smb.conf ─────────────────────────────────────────────────────────────

editConfBtn.addEventListener("click", function() {
    setAllDisabled(true);
    showOutput("Loading " + SMB_CONF + "...");

    cockpit.file(SMB_CONF, { superuser: "require" }).read()
        .done(function(content) {
            if (content === null) {
                showOutput("ERROR: Could not read " + SMB_CONF);
                setAllDisabled(false);
                return;
            }
            confEditor.value = content;
            editorSection.style.display = "block";
            saveRestartBtn.disabled = false;
            showOutput("smb.conf loaded. Edit above, then click Save & Restart.");
        })
        .fail(function(ex) {
            showOutput("ERROR reading " + SMB_CONF + ": " + (ex.message || JSON.stringify(ex)));
        })
        .always(function() {
            editConfBtn.disabled          = false;
            displaySharesBtn.disabled     = false;
            displaySambaUsersBtn.disabled = false;
            displayLinuxUsersBtn.disabled = false;
            clearOutputBtn.disabled       = false;
            displaySharesByUserBtn.disabled = false;
        });
});

// ── Save smb.conf & restart Samba ────────────────────────────────────────────

saveRestartBtn.addEventListener("click", function() {
    var content = confEditor.value;
    if (!content.trim()) {
        showOutput("ERROR: Editor is empty — not saving.");
        return;
    }

    setAllDisabled(true);
    showOutput("Saving " + SMB_CONF + "...\n");

    cockpit.file(SMB_CONF, { superuser: "require" }).replace(content)
        .done(function() {
            output.textContent += "Saved. Restarting smbd...\n";

            cockpit.spawn(["systemctl", "restart", "smbd"], { superuser: "require", err: "message" })
                .done(function() {
                    output.textContent += "smbd restarted.\n\n--- systemctl status smbd ---\n";

                    cockpit.spawn(["systemctl", "status", "smbd", "--no-pager"], { superuser: "require", err: "message" })
                        .done(function(data) {
                            output.textContent += data || "(no status output)";
                        })
                        .fail(function(ex, data) {
                            output.textContent += "ERROR getting status: " + (ex.message || JSON.stringify(ex));
                            if (data) output.textContent += "\n" + data;
                        })
                        .always(function() {
                            setAllDisabled(false);
                        });
                })
                .fail(function(ex, data) {
                    output.textContent += "ERROR restarting smbd: " + (ex.message || JSON.stringify(ex));
                    if (data) output.textContent += "\n" + data;
                    setAllDisabled(false);
                });
        })
        .fail(function(ex) {
            output.textContent += "ERROR saving file: " + (ex.message || JSON.stringify(ex));
            setAllDisabled(false);
        });
});

// ── Display Shares ────────────────────────────────────────────────────────────

displaySharesBtn.addEventListener("click", function() {
    runCommand(["/usr/local/sbin/list_shares.sh"], "Samba Shares");
});

// ── Display Shares by Username ────────────────────────────────────────────────

displaySharesByUserBtn.addEventListener("click", function() {
    var username = usernameInput.value.trim();
    if (!username) {
        showOutput("ERROR: Enter a username first.");
        return;
    }
    setAllDisabled(true);
    showOutput("Querying active sessions for: " + username + "...\n");

    cockpit.spawn(["smbstatus", "--user=" + username], { superuser: "require", err: "message" })
        .done(function(data) {
            output.textContent = "--- Active Samba Sessions: " + username + " ---\n\n" + (data || "(no active sessions)");
        })
        .fail(function(ex, data) {
            output.textContent = "--- Active Samba Sessions: " + username + " ---\n\nERROR: " + (ex.message || JSON.stringify(ex));
            if (data) output.textContent += "\n" + data;
        })
        .always(function() {
            setAllDisabled(false);
        });
});

// ── Display Samba Users ───────────────────────────────────────────────────────

displaySambaUsersBtn.addEventListener("click", function() {
    runCommand(["pdbedit", "-L", "-v"], "Samba Users (pdbedit)");
});

// ── Display Linux Users ───────────────────────────────────────────────────────

displayLinuxUsersBtn.addEventListener("click", function() {
    setAllDisabled(true);
    showOutput("Loading Linux users...\n");

    // getent passwd | awk filters to UID 1000-60000 (local human accounts)
    cockpit.spawn(
        ["bash", "-c", "getent passwd | awk -F: '$3 >= 1000 && $3 < 60000 {printf \"%-20s UID:%-6s GID:%-6s %s\\n\", $1, $3, $4, $6}'"],
        { superuser: "require", err: "message" }
    )
        .done(function(data) {
            output.textContent = "--- Linux Local User Accounts ---\n\n";
            output.textContent += "Username             UID    GID    Home\n";
            output.textContent += "─────────────────────────────────────────────────────\n";
            output.textContent += (data || "(none found)");
        })
        .fail(function(ex, data) {
            output.textContent = "ERROR: " + (ex.message || JSON.stringify(ex));
            if (data) output.textContent += "\n" + data;
        })
        .always(function() {
            setAllDisabled(false);
        });
});

// ── Clear Output ──────────────────────────────────────────────────────────────

clearOutputBtn.addEventListener("click", function() {
    confEditor.value = "";
    editorSection.style.display = "none";
    saveRestartBtn.disabled = true;
    showOutput("Ready.");
});
