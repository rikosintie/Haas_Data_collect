const output             = document.getElementById("output");
const confEditor         = document.getElementById("confEditor");
const panelLabel         = document.getElementById("panelLabel");

const editConfBtn           = document.getElementById("editConfBtn");
const saveRestartBtn        = document.getElementById("saveRestartBtn");
const displaySharesBtn      = document.getElementById("displaySharesBtn");
const displaySharesCsvBtn   = document.getElementById("displaySharesCsvBtn");
const displaySambaUsersBtn  = document.getElementById("displaySambaUsersBtn");
const displayLinuxUsersBtn = document.getElementById("displayLinuxUsersBtn");
const clearOutputBtn       = document.getElementById("clearOutputBtn");
const displaySharesByUserBtn = document.getElementById("displaySharesByUserBtn");
const usernameInput        = document.getElementById("usernameInput");

const SMB_CONF = "/etc/samba/smb.conf";

var editMode = false;

// ── panel helpers ─────────────────────────────────────────────────────────────

function showOutputPanel(text) {
    confEditor.style.display = "none";
    output.style.display = "block";
    if (text !== undefined) output.textContent = text;
    panelLabel.textContent = "";
}

function showEditorPanel(content) {
    output.style.display = "none";
    confEditor.style.display = "block";
    confEditor.value = content;
    panelLabel.textContent = "smb.conf — edit below, then click Save & Restart";
}

// ── button state helpers ──────────────────────────────────────────────────────

// Disable all buttons (used while a command is running)
function lockAll() {
    editConfBtn.disabled            = true;
    saveRestartBtn.disabled         = true;
    displaySharesBtn.disabled       = true;
    displaySharesCsvBtn.disabled    = true;
    displaySambaUsersBtn.disabled   = true;
    displayLinuxUsersBtn.disabled   = true;
    clearOutputBtn.disabled         = true;
    displaySharesByUserBtn.disabled = true;
}

// Normal output mode — all view buttons enabled, Save & Restart disabled
function unlockNormal() {
    editMode = false;
    editConfBtn.disabled            = false;
    saveRestartBtn.disabled         = true;
    displaySharesBtn.disabled       = false;
    displaySharesCsvBtn.disabled    = false;
    displaySambaUsersBtn.disabled   = false;
    displayLinuxUsersBtn.disabled   = false;
    clearOutputBtn.disabled         = false;
    displaySharesByUserBtn.disabled = false;
}

// Edit mode — only Save & Restart and Clear Output active
function unlockEditMode() {
    editMode = true;
    editConfBtn.disabled            = true;
    saveRestartBtn.disabled         = false;
    displaySharesBtn.disabled       = true;
    displaySharesCsvBtn.disabled    = true;
    displaySambaUsersBtn.disabled   = true;
    displayLinuxUsersBtn.disabled   = true;
    clearOutputBtn.disabled         = false;   // acts as Cancel
    displaySharesByUserBtn.disabled = true;
}

// ── run a command and show result in the output panel ─────────────────────────

function runCommand(args, label) {
    lockAll();
    showOutputPanel("Running: " + label + "...\n");

    cockpit.spawn(args, { superuser: "require", err: "message" })
        .done(function(data) {
            output.textContent = "--- " + label + " ---\n\n" + (data || "(no output)");
        })
        .fail(function(ex, data) {
            output.textContent = "--- " + label + " ---\n\nERROR: " + (ex.message || JSON.stringify(ex));
            if (data) output.textContent += "\n" + data;
        })
        .always(function() {
            unlockNormal();
        });
}

// ── Edit smb.conf ─────────────────────────────────────────────────────────────

editConfBtn.addEventListener("click", function() {
    lockAll();
    showOutputPanel("Loading " + SMB_CONF + "...");

    cockpit.file(SMB_CONF, { superuser: "require" }).read()
        .done(function(content) {
            if (content === null) {
                showOutputPanel("ERROR: Could not read " + SMB_CONF);
                unlockNormal();
                return;
            }
            showEditorPanel(content);
            unlockEditMode();
        })
        .fail(function(ex) {
            showOutputPanel("ERROR reading " + SMB_CONF + ": " + (ex.message || JSON.stringify(ex)));
            unlockNormal();
        });
});

// ── Save smb.conf & restart Samba ────────────────────────────────────────────

saveRestartBtn.addEventListener("click", function() {
    var content = confEditor.value;
    if (!content.trim()) {
        output.textContent = "ERROR: Editor is empty — not saving.";
        showOutputPanel("ERROR: Editor is empty — not saving.");
        unlockNormal();
        return;
    }

    lockAll();
    showOutputPanel("Saving " + SMB_CONF + "...\n");

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
                            unlockNormal();
                        });
                })
                .fail(function(ex, data) {
                    output.textContent += "ERROR restarting smbd: " + (ex.message || JSON.stringify(ex));
                    if (data) output.textContent += "\n" + data;
                    unlockNormal();
                });
        })
        .fail(function(ex) {
            output.textContent += "ERROR saving file: " + (ex.message || JSON.stringify(ex));
            unlockNormal();
        });
});

// ── Display Shares ────────────────────────────────────────────────────────────

displaySharesBtn.addEventListener("click", function() {
    runCommand(["/usr/local/sbin/list_shares.sh"], "Samba Shares");
});

// ── Display Shares CSV ────────────────────────────────────────────────────────

displaySharesCsvBtn.addEventListener("click", function() {
    runCommand(["/usr/local/sbin/list_shares_csv.sh"], "Samba Shares (CSV)");
});

// ── Display Shares by Username ────────────────────────────────────────────────

displaySharesByUserBtn.addEventListener("click", function() {
    var username = usernameInput.value.trim();
    if (!username) {
        showOutputPanel("ERROR: Enter a username first.");
        return;
    }
    lockAll();
    showOutputPanel("Querying active sessions for: " + username + "...\n");

    cockpit.spawn(["smbstatus", "--user=" + username], { superuser: "require", err: "message" })
        .done(function(data) {
            output.textContent = "--- Active Samba Sessions: " + username + " ---\n\n" + (data || "(no active sessions)");
        })
        .fail(function(ex, data) {
            output.textContent = "--- Active Samba Sessions: " + username + " ---\n\nERROR: " + (ex.message || JSON.stringify(ex));
            if (data) output.textContent += "\n" + data;
        })
        .always(function() {
            unlockNormal();
        });
});

// ── Display Samba Users ───────────────────────────────────────────────────────

displaySambaUsersBtn.addEventListener("click", function() {
    runCommand(["bash", "-c", "pdbedit -L 2>/dev/null | cut -d: -f1"], "Samba Users");
});

// ── Display Linux Users ───────────────────────────────────────────────────────

displayLinuxUsersBtn.addEventListener("click", function() {
    lockAll();
    showOutputPanel("Loading Linux users...\n");

    cockpit.spawn(
        ["bash", "-c", "getent passwd | awk -F: '$3 >= 1000 && $3 < 60000 {printf \"%-20s UID:%-6s GID:%-6s %s\\n\", $1, $3, $4, $6}'"],
        { superuser: "require", err: "message" }
    )
        .done(function(data) {
            output.textContent  = "--- Linux Local User Accounts ---\n\n";
            output.textContent += "Username             UID    GID    Home\n";
            output.textContent += "─────────────────────────────────────────────────────\n";
            output.textContent += (data || "(none found)");
        })
        .fail(function(ex, data) {
            output.textContent = "ERROR: " + (ex.message || JSON.stringify(ex));
            if (data) output.textContent += "\n" + data;
        })
        .always(function() {
            unlockNormal();
        });
});

// ── Clear Output ──────────────────────────────────────────────────────────────

clearOutputBtn.addEventListener("click", function() {
    showOutputPanel("Ready.");
    unlockNormal();
});
