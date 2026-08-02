const output             = document.getElementById("output");
const confEditor         = document.getElementById("confEditor");
const panelLabel         = document.getElementById("panelLabel");
const validationMsg      = document.getElementById("validationMsg");

const editConfBtn           = document.getElementById("editConfBtn");
const saveRestartBtn        = document.getElementById("saveRestartBtn");
const displaySharesBtn      = document.getElementById("displaySharesBtn");
const displaySharesCsvBtn   = document.getElementById("displaySharesCsvBtn");
const displaySambaUsersBtn  = document.getElementById("displaySambaUsersBtn");
const displayLinuxUsersBtn = document.getElementById("displayLinuxUsersBtn");
const clearOutputBtn       = document.getElementById("clearOutputBtn");
const displaySharesByUserBtn = document.getElementById("displaySharesByUserBtn");
const usernameInput        = document.getElementById("usernameInput");

const createShareBtn    = document.getElementById("createShareBtn");
const createShareForm   = document.getElementById("createShareForm");
const shareMachineName  = document.getElementById("shareMachineName");
const shareComment      = document.getElementById("shareComment");

const SMB_CONF = "/etc/samba/smb.conf";
const SMB_CONF_VALIDATE_TMP_PREFIX = "/tmp/smb.conf.validate.";

// Matches the WorkingDirectory convention in cockpit_updates/update.js's
// Create Service flow — every machine's directory lives here.
const BASE_MACHINES_DIR = "/home/haas/Haas_Data_collect/machines/";

// Static fields every share gets — only the section name, comment, and path vary.
const SHARE_STATIC_LINES = [
    "    browseable = Yes",
    "    writable = Yes",
    "    public = No",
    "    valid users = @HaasGroup, haas",
    "    force user = haas",
    "    force group = HaasGroup",
    "    create mask = 0664",
    "    force create mode = 0664",
    "    directory mask = 0775",
    "    force directory mode = 0775"
].join("\n");

var editMode = false;
var creatingShare = false;

// ── panel helpers ─────────────────────────────────────────────────────────────

function showOutputPanel(text) {
    confEditor.style.display = "none";
    createShareForm.classList.add("hidden");
    output.style.display = "block";
    if (text !== undefined) output.textContent = text;
    panelLabel.textContent = "";
    validationMsg.classList.add("hidden");
}

function showEditorPanel(content) {
    output.style.display = "none";
    createShareForm.classList.add("hidden");
    confEditor.style.display = "block";
    confEditor.value = content;
    panelLabel.textContent = "smb.conf — edit below, then click Save & Restart";
}

function showCreateShareForm() {
    output.style.display = "none";
    confEditor.style.display = "none";
    createShareForm.classList.remove("hidden");
    panelLabel.textContent = "New share — fill in all fields, then click Save & Restart";
    validationMsg.classList.add("hidden");
}

function hideCreateShareForm() {
    createShareForm.classList.add("hidden");
    shareMachineName.value = "";
    shareComment.value = "";
}

// ── button state helpers ──────────────────────────────────────────────────────

// Disable all buttons (used while a command is running)
function lockAll() {
    editConfBtn.disabled            = true;
    saveRestartBtn.disabled         = true;
    createShareBtn.disabled         = true;
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
    creatingShare = false;
    editConfBtn.disabled            = false;
    saveRestartBtn.disabled         = true;
    createShareBtn.disabled         = false;
    displaySharesBtn.disabled       = false;
    displaySharesCsvBtn.disabled    = false;
    displaySambaUsersBtn.disabled   = false;
    displayLinuxUsersBtn.disabled   = false;
    clearOutputBtn.disabled         = false;
    displaySharesByUserBtn.disabled = false;
}

// Edit mode and Create Share mode share this layout — only Save & Restart
// and Clear Output active. Which flow runs on Save is decided by creatingShare.
function unlockEditMode() {
    editMode = true;
    editConfBtn.disabled            = true;
    saveRestartBtn.disabled         = false;
    createShareBtn.disabled         = true;
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

// Writes the real smb.conf, restarts smbd, and shows status. Only called
// after testparm has validated the content.
function writeConfAndRestart(content) {
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
}

// Validates content with testparm via a scratch copy — never touches the
// real smb.conf. Calls onValid() or onInvalid(errorText); errorText is
// already fully described (cause + detail), ready to display as-is.
function validateSmbConf(content, onValid, onInvalid) {
    var tmpPath = SMB_CONF_VALIDATE_TMP_PREFIX + Date.now();

    cockpit.file(tmpPath).replace(content)
        .done(function() {
            cockpit.spawn(["testparm", "-s", tmpPath], { err: "message" })
                .done(function() {
                    cockpit.spawn(["rm", "-f", tmpPath]);
                    onValid();
                })
                .fail(function(ex, data) {
                    cockpit.spawn(["rm", "-f", tmpPath]);
                    onInvalid("testparm rejected this configuration:\n\n" + (data || ex.message || "(no details)"));
                });
        })
        .fail(function(ex) {
            onInvalid("ERROR writing temp file for validation: " + (ex.message || JSON.stringify(ex)));
        });
}

// Shows errText above the editor/form (whichever is active) and returns
// control to the user in that same mode — nothing was saved or restarted.
function showValidationError(errText, modeLabel) {
    validationMsg.textContent = errText + "\n\nNothing was saved or restarted.";
    validationMsg.classList.remove("hidden");
    panelLabel.textContent = modeLabel;
    unlockEditMode();
}

saveRestartBtn.addEventListener("click", function() {
    if (creatingShare) {
        var machine = shareMachineName.value.trim().toLowerCase();
        var comment = shareComment.value.trim();
        var path    = BASE_MACHINES_DIR + machine;
        var createShareModeLabel = "New share — fill in all fields, then click Save & Restart";

        if (!machine || !comment) {
            validationMsg.textContent = "ERROR: Both fields are required.";
            validationMsg.classList.remove("hidden");
            return;
        }

        if (!confirm("This will create " + path + " (if it doesn't already exist), add share [" + machine + "] to " + SMB_CONF + ", and restart smbd. Continue?")) {
            return;
        }

        lockAll();
        validationMsg.classList.add("hidden");
        panelLabel.textContent = "Ensuring " + path + " exists...";

        cockpit.spawn(["mkdir", "-p", path], { superuser: "require", err: "message" })
            .done(function() {
                panelLabel.textContent = "Loading current " + SMB_CONF + "...";

                cockpit.file(SMB_CONF, { superuser: "require" }).read()
                    .done(function(currentContent) {
                        currentContent = currentContent || "";

                        if (new RegExp("^\\s*\\[" + machine + "\\]", "im").test(currentContent)) {
                            showValidationError(
                                "A share named [" + machine + "] already exists in " + SMB_CONF + " — edit it directly via Edit smb.conf instead.",
                                createShareModeLabel
                            );
                            return;
                        }

                        var stanza = "\n[" + machine + "]\n" +
                            "    comment = " + comment + "\n" +
                            "    path = " + path + "\n" +
                            SHARE_STATIC_LINES + "\n";

                        var newContent = currentContent.replace(/\s*$/, "\n") + stanza;

                        panelLabel.textContent = "Validating configuration with testparm...";
                        validateSmbConf(newContent,
                            function onValid() {
                                hideCreateShareForm();
                                showOutputPanel("Configuration OK. Saving " + SMB_CONF + "...\n");
                                writeConfAndRestart(newContent);
                            },
                            function onInvalid(errText) {
                                showValidationError(errText, createShareModeLabel);
                            }
                        );
                    })
                    .fail(function(ex) {
                        showValidationError("ERROR reading " + SMB_CONF + ": " + (ex.message || JSON.stringify(ex)), createShareModeLabel);
                    });
            })
            .fail(function(ex, data) {
                showValidationError("ERROR creating " + path + ": " + (data || ex.message || JSON.stringify(ex)), createShareModeLabel);
            });
        return;
    }

    var content = confEditor.value;
    if (!content.trim()) {
        output.textContent = "ERROR: Editor is empty — not saving.";
        showOutputPanel("ERROR: Editor is empty — not saving.");
        unlockNormal();
        return;
    }

    if (!confirm("This will overwrite " + SMB_CONF + " and restart smbd. Continue?")) {
        return;
    }

    // Stay on the editor panel during validation — if testparm rejects the
    // config, the user's unsaved edits must still be there to fix, not the
    // last-known-good file they'd get back from re-opening "Edit smb.conf".
    lockAll();
    validationMsg.classList.add("hidden");
    panelLabel.textContent = "Validating configuration with testparm...";

    validateSmbConf(content,
        function onValid() {
            showOutputPanel("Configuration OK. Saving " + SMB_CONF + "...\n");
            writeConfAndRestart(content);
        },
        function onInvalid(errText) {
            showValidationError(errText, "smb.conf — edit below, then click Save & Restart");
        }
    );
});

// ── Create Share ──────────────────────────────────────────────────────────────

createShareBtn.addEventListener("click", function() {
    creatingShare = true;
    showCreateShareForm();
    unlockEditMode();
});

shareMachineName.addEventListener("input", function() {
    var pos = shareMachineName.selectionStart;
    var cleaned = shareMachineName.value.replace(/[^0-9a-zA-Z_-]/g, "");
    if (cleaned !== shareMachineName.value) {
        shareMachineName.value = cleaned;
        shareMachineName.setSelectionRange(pos - 1, pos - 1);
    }
});

shareComment.addEventListener("input", function() {
    var pos = shareComment.selectionStart;
    var cleaned = shareComment.value.replace(/[^0-9a-zA-Z_ -]/g, "");
    if (cleaned !== shareComment.value) {
        shareComment.value = cleaned;
        shareComment.setSelectionRange(pos - 1, pos - 1);
    }
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
    if (creatingShare) hideCreateShareForm();
    showOutputPanel("Ready.");
    unlockNormal();
});
