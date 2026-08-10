const output             = document.getElementById("output");
const confEditor         = document.getElementById("confEditor");
const panelLabel         = document.getElementById("panelLabel");
const validationMsg      = document.getElementById("validationMsg");

// Sanitizes dynamic text (share names, paths, usernames, etc.) before
// it's interpolated into output.innerHTML.
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// Colorizes Display Shares' table: the header row, and just the SHARE
// column of each data row (list_shares.sh's fixed-width "%-20s %-55s
// %-25s %-10s" format, so the first 20 characters of any non-header,
// non-blank line are always the SHARE field) — anchors each row without
// a full divider eating vertical space on what's otherwise a compact,
// one-line-per-share list. Unlike this file's other dynamic content,
// takes RAW (unescaped) text and escapes each sliced piece separately —
// escaping first and then slicing the fixed 20-char offset could cut a
// multi-character entity like "&lt;" in half across the span boundary.
function colorizeSharesOutput(rawText) {
    return rawText.split("\n").map(function(line, i) {
        if (i === 0) {
            return "<span class=\"info\">" + escapeHtml(line) + "</span>";
        }
        if (line.trim() === "") {
            return line;
        }
        var shareCol = line.slice(0, 20);
        var rest = line.slice(20);
        return "<span class=\"info\">" + escapeHtml(shareCol) + "</span>" + escapeHtml(rest);
    }).join("\n");
}

// Same concept as colorizeSharesOutput, but list_shares_csv.sh's output
// is comma-delimited (list_shares_csv.sh:7) rather than fixed-width, so
// the SHARE field is bounded by the first comma instead of a fixed
// column offset. Same raw-text-in, escape-after-split contract, for the
// same reason (an entity split across the boundary).
function colorizeSharesCsvOutput(rawText) {
    return rawText.split("\n").map(function(line, i) {
        if (i === 0) {
            return "<span class=\"info\">" + escapeHtml(line) + "</span>";
        }
        if (line.trim() === "") {
            return line;
        }
        var commaIdx = line.indexOf(",");
        if (commaIdx === -1) {
            return escapeHtml(line);
        }
        var shareCol = line.slice(0, commaIdx);
        var rest = line.slice(commaIdx);
        return "<span class=\"info\">" + escapeHtml(shareCol) + "</span>" + escapeHtml(rest);
    }).join("\n");
}

const editConfBtn           = document.getElementById("editConfBtn");
const saveRestartBtn        = document.getElementById("saveRestartBtn");
const displaySharesBtn      = document.getElementById("displaySharesBtn");
const displaySharesCsvBtn   = document.getElementById("displaySharesCsvBtn");
const displayUsersBtn       = document.getElementById("displayUsersBtn");
const clearOutputBtn       = document.getElementById("clearOutputBtn");
const displaySharesByUserBtn = document.getElementById("displaySharesByUserBtn");
const usernameInput        = document.getElementById("usernameInput");
const verifyAdminNote       = document.getElementById("verifyAdminNote");

const createShareBtn    = document.getElementById("createShareBtn");
const createShareForm   = document.getElementById("createShareForm");
const shareMachineName  = document.getElementById("shareMachineName");
const shareComment      = document.getElementById("shareComment");

const deleteShareBtn = document.getElementById("deleteShareBtn");
const sharesList     = document.getElementById("sharesList");

const createUserBtn         = document.getElementById("createUserBtn");
const createUserForm        = document.getElementById("createUserForm");
const newUsername           = document.getElementById("newUsername");
const newUserRole           = document.getElementById("newUserRole");
const newUserPassword       = document.getElementById("newUserPassword");
const newUserPasswordConfirm = document.getElementById("newUserPasswordConfirm");

const deleteUserBtn = document.getElementById("deleteUserBtn");
const usersList     = document.getElementById("usersList");

const changePasswordBtn        = document.getElementById("changePasswordBtn");
const changePasswordList       = document.getElementById("changePasswordList");
const changePasswordForm       = document.getElementById("changePasswordForm");
const changePasswordUsername   = document.getElementById("changePasswordUsername");
const changePasswordNew        = document.getElementById("changePasswordNew");
const changePasswordConfirm    = document.getElementById("changePasswordConfirm");
const changePasswordSubmitBtn  = document.getElementById("changePasswordSubmitBtn");
const changePasswordCancelBtn  = document.getElementById("changePasswordCancelBtn");

// Not copied to /usr/local/sbin by haas-install.sh — stays in the repo,
// run via `sudo ./manage_users.sh` per its own usage comments.
const REPO_DIR = "/home/haas/Haas_Data_collect";
const MANAGE_USERS_SCRIPT = REPO_DIR + "/manage_users.sh";
const SETUP_ZSH_SCRIPT = REPO_DIR + "/setup_zsh.sh";

const SMB_CONF = "/etc/samba/smb.conf";
const SMB_CONF_VALIDATE_TMP_PREFIX = "/tmp/smb.conf.validate.";

// setup_zsh.sh colorizes its banners with raw ANSI SGR codes for terminal
// use. The output panel is plain text (textContent), not a terminal
// emulator, so those codes would otherwise show up as literal "[1;36m"
// junk instead of being rendered as color — strip them before display.
function stripAnsi(str) {
    return str.replace(/\x1b\[[0-9;]*m/g, "");
}

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
var creatingUser = false;

// ── panel helpers ─────────────────────────────────────────────────────────────

function showOutputPanel(text) {
    confEditor.style.display = "none";
    createShareForm.classList.add("hidden");
    createUserForm.classList.add("hidden");
    changePasswordForm.classList.add("hidden");
    output.style.display = "block";
    if (text !== undefined) output.textContent = text;
    panelLabel.textContent = "";
    validationMsg.classList.add("hidden");
}

function showEditorPanel(content) {
    output.style.display = "none";
    createShareForm.classList.add("hidden");
    createUserForm.classList.add("hidden");
    changePasswordForm.classList.add("hidden");
    confEditor.style.display = "block";
    confEditor.value = content;
    panelLabel.textContent = "smb.conf — edit below, then click Save & Restart";
}

function showCreateShareForm() {
    output.style.display = "none";
    confEditor.style.display = "none";
    createUserForm.classList.add("hidden");
    changePasswordForm.classList.add("hidden");
    createShareForm.classList.remove("hidden");
    panelLabel.textContent = "New share — fill in all fields, then click Save & Restart";
    validationMsg.classList.add("hidden");
}

function hideCreateShareForm() {
    createShareForm.classList.add("hidden");
    shareMachineName.value = "";
    shareComment.value = "";
}

function showCreateUserForm() {
    output.style.display = "none";
    confEditor.style.display = "none";
    createShareForm.classList.add("hidden");
    changePasswordForm.classList.add("hidden");
    createUserForm.classList.remove("hidden");
    saveRestartBtn.textContent = "Create User";
    panelLabel.textContent = "New user — fill in all fields, then click Create User";
    validationMsg.classList.add("hidden");
}

function hideCreateUserForm() {
    createUserForm.classList.add("hidden");
    saveRestartBtn.textContent = "Save & Restart";
    newUsername.value = "";
    newUserRole.value = "user";
    newUserPassword.value = "";
    newUserPasswordConfirm.value = "";
}

function showChangePasswordForm(username) {
    output.style.display = "none";
    confEditor.style.display = "none";
    createShareForm.classList.add("hidden");
    createUserForm.classList.add("hidden");
    changePasswordForm.classList.remove("hidden");
    changePasswordUsername.value = username;
    changePasswordNew.value = "";
    changePasswordConfirm.value = "";
    panelLabel.textContent = "New password for \"" + username + "\" — fill in both fields, then click Set New Password";
    validationMsg.classList.add("hidden");
}

function hideChangePasswordForm() {
    changePasswordForm.classList.add("hidden");
    changePasswordUsername.value = "";
    changePasswordNew.value = "";
    changePasswordConfirm.value = "";
}

// ── button state helpers ──────────────────────────────────────────────────────

// Disable all buttons (used while a command is running)
function lockAll() {
    editConfBtn.disabled            = true;
    saveRestartBtn.disabled         = true;
    createShareBtn.disabled         = true;
    deleteShareBtn.disabled         = true;
    displaySharesBtn.disabled       = true;
    displaySharesCsvBtn.disabled    = true;
    displayUsersBtn.disabled        = true;
    clearOutputBtn.disabled         = true;
    displaySharesByUserBtn.disabled = true;
    createUserBtn.disabled          = true;
    deleteUserBtn.disabled          = true;
    changePasswordBtn.disabled      = true;
}

// Normal output mode — all view buttons enabled, Save & Restart hidden
// (it only means something while editing/creating).
function unlockNormal() {
    editMode = false;
    creatingShare = false;
    creatingUser = false;
    editConfBtn.disabled            = false;
    saveRestartBtn.disabled         = true;
    saveRestartBtn.classList.add("hidden");
    createShareBtn.disabled         = false;
    deleteShareBtn.disabled         = false;
    displaySharesBtn.disabled       = false;
    displaySharesCsvBtn.disabled    = false;
    displayUsersBtn.disabled        = false;
    clearOutputBtn.disabled         = false;
    displaySharesByUserBtn.disabled = false;
    createUserBtn.disabled          = false;
    deleteUserBtn.disabled          = false;
    changePasswordBtn.disabled      = false;
}

// Edit mode, Create Share mode, and Create User mode all share this layout —
// only Save & Restart and Clear Output active. Which flow runs on Save is
// decided by creatingShare / creatingUser.
function unlockEditMode() {
    editMode = true;
    editConfBtn.disabled            = true;
    saveRestartBtn.disabled         = false;
    saveRestartBtn.classList.remove("hidden");
    createShareBtn.disabled         = true;
    deleteShareBtn.disabled         = true;
    displaySharesBtn.disabled       = true;
    displaySharesCsvBtn.disabled    = true;
    displayUsersBtn.disabled        = true;
    clearOutputBtn.disabled         = false;   // acts as Cancel
    displaySharesByUserBtn.disabled = true;
    createUserBtn.disabled          = true;
    deleteUserBtn.disabled          = true;
    changePasswordBtn.disabled      = true;
}

// Change Password's own lock state — like unlockEditMode, but Clear Output
// stays disabled since the form has its own Cancel button (the shared
// Clear Output button would otherwise also need to know about this form).
function lockForChangePassword() {
    editConfBtn.disabled            = true;
    saveRestartBtn.disabled         = true;
    createShareBtn.disabled         = true;
    deleteShareBtn.disabled         = true;
    displaySharesBtn.disabled       = true;
    displaySharesCsvBtn.disabled    = true;
    displayUsersBtn.disabled        = true;
    clearOutputBtn.disabled         = true;
    displaySharesByUserBtn.disabled = true;
    createUserBtn.disabled          = true;
    deleteUserBtn.disabled          = true;
    changePasswordBtn.disabled      = true;
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
    if (creatingUser) {
        var username = newUsername.value.trim().toLowerCase();
        var role = newUserRole.value; // "user" or "admin"
        var pw1 = newUserPassword.value;
        var pw2 = newUserPasswordConfirm.value;

        if (!username || !pw1 || !pw2) {
            validationMsg.textContent = "ERROR: All fields are required.";
            validationMsg.classList.remove("hidden");
            return;
        }

        if (pw1 !== pw2) {
            validationMsg.textContent = "ERROR: Passwords do not match.";
            validationMsg.classList.remove("hidden");
            return;
        }

        var roleLabel = (role === "admin")
            ? "Administrator (SSH + sudo + Samba)"
            : "Standard user (Samba share access only)";

        if (!confirm(
            "This will create a new Linux + Samba account for \"" + username + "\" (" + roleLabel + ") " +
            "and set its password to what you entered.\n\nContinue?"
        )) {
            return;
        }

        var args = [MANAGE_USERS_SCRIPT, username, "--set-password", "--force"];
        if (role === "admin") {
            args.push("--admin-user");
        }

        // manage_users.sh interactively prompts twice for the Linux
        // password (passwd) and, for a brand-new username, twice more for
        // the Samba password (smbpasswd -a) — four lines total, fed as
        // one stdin write. This matches the script's own logic exactly
        // (verified by reading it — both prompts run unconditionally for
        // a genuinely new username, for either role), but the actual
        // interactive behavior under cockpit.spawn hasn't been exercised
        // against a real appliance yet — test with a throwaway account
        // first before relying on this for a real person.
        var stdinSequence = pw1 + "\n" + pw1 + "\n" + pw1 + "\n" + pw1 + "\n";

        lockAll();
        validationMsg.classList.add("hidden");
        hideCreateUserForm();
        showOutputPanel("Creating user \"" + username + "\"...\n\n");

        cockpit.spawn(args, { superuser: "require", err: "out" })
            .input(stdinSequence)
            .stream(function(data) {
                output.textContent += data;
                output.scrollTop = output.scrollHeight;
            })
            .done(function() {
                output.textContent += "\n[SUCCESS] User \"" + username + "\" created.\n";
                refreshAdminNoteVisibility();

                if (role === "admin") {
                    output.textContent += "\nSetting up zsh, Oh My Zsh, and haas-aliases for \"" + username +
                        "\" (this can take a bit)...\n\n";
                    output.scrollTop = output.scrollHeight;

                    cockpit.spawn(["bash", SETUP_ZSH_SCRIPT, REPO_DIR, username], { superuser: "require", err: "out" })
                        .stream(function(data) {
                            output.textContent += stripAnsi(data);
                            output.scrollTop = output.scrollHeight;
                        })
                        .done(function() {
                            output.textContent += "\n[SUCCESS] zsh environment configured for \"" + username + "\".\n";
                            unlockNormal();
                        })
                        .fail(function(ex, data) {
                            output.textContent += "\n[WARNING] User \"" + username + "\" was created, but zsh setup " +
                                "failed: " + (data || ex.message || JSON.stringify(ex)) + "\n" +
                                "The account still works over SSH with the default shell. Run manually to finish " +
                                "setup:\n  sudo bash " + SETUP_ZSH_SCRIPT + " " + REPO_DIR + " " + username + "\n";
                            unlockNormal();
                        });
                    return;
                }

                unlockNormal();
            })
            .fail(function(ex, data) {
                output.textContent += "\n[ERROR] " + (data || ex.message || JSON.stringify(ex)) + "\n";
                unlockNormal();
            });
        return;
    }

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

        if (!confirm(
            "This will create " + path + " (if it doesn't already exist), add share [" + machine + "] to " + SMB_CONF + ", and restart smbd.\n\n" +
            "Note: this only creates the share. Use the Updates - Logs page's Create Service button to set up the logger service for this machine.\n\n" +
            "Continue?"
        )) {
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

// ── Create User ───────────────────────────────────────────────────────────────

createUserBtn.addEventListener("click", function() {
    creatingUser = true;
    showCreateUserForm();
    unlockEditMode();
});

newUsername.addEventListener("input", function() {
    var pos = newUsername.selectionStart;
    var cleaned = newUsername.value.replace(/[^0-9a-zA-Z_-]/g, "");
    if (cleaned !== newUsername.value) {
        newUsername.value = cleaned;
        newUsername.setSelectionRange(pos - 1, pos - 1);
    }
});

// ── Delete Share ──────────────────────────────────────────────────────────────

function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// [Haas] is the appliance's main data share, created by haas-install.sh —
// it is not a per-machine share, so it's kept out of the delete list.
function populateSharesList() {
    sharesList.innerHTML = "<option value=\"\">— loading... —</option>";
    sharesList.classList.remove("hidden");

    cockpit.spawn(
        ["bash", "-c", "testparm -s 2>/dev/null | grep '^\\['"],
        { superuser: "require", err: "message" }
    )
        .done(function(data) {
            var lines = data.trim() ? data.trim().split("\n") : [];
            var shares = lines
                .map(function(l) { return l.replace(/[\[\]]/g, "").trim(); })
                .filter(function(name) {
                    var lower = name.toLowerCase();
                    return name && lower !== "global" && lower !== "haas";
                });

            sharesList.innerHTML = "<option value=\"\">— select a share to delete —</option>";
            if (shares.length === 0) {
                sharesList.innerHTML = "<option value=\"\">No shares found</option>";
            } else {
                shares.forEach(function(name) {
                    var opt = document.createElement("option");
                    opt.value = name;
                    opt.textContent = name;
                    sharesList.appendChild(opt);
                });
            }
        })
        .fail(function(ex) {
            sharesList.innerHTML = "<option value=\"\">Error: " + (ex.message || "failed to list shares") + "</option>";
        })
        .always(function() {
            unlockNormal();
        });
}

deleteShareBtn.addEventListener("click", function() {
    lockAll();
    showOutputPanel("Loading shares...\n");
    populateSharesList();
});

sharesList.addEventListener("change", function() {
    var machine = sharesList.value;
    if (!machine) return;

    if (!confirm("Delete share [" + machine + "]? This cannot be undone. Only the smb.conf entry is removed — the machine's data directory is not touched.")) {
        sharesList.value = "";
        return;
    }

    lockAll();
    showOutputPanel("Loading current " + SMB_CONF + "...\n");

    cockpit.file(SMB_CONF, { superuser: "require" }).read()
        .done(function(currentContent) {
            currentContent = currentContent || "";
            var sectionRe = new RegExp("\\n?\\[" + escapeRegExp(machine) + "\\][^\\[]*", "i");

            if (!sectionRe.test(currentContent)) {
                output.textContent += "ERROR: Share [" + machine + "] not found in " + SMB_CONF + " — nothing changed.\n";
                unlockNormal();
                return;
            }

            var newContent = currentContent.replace(sectionRe, "");

            output.textContent += "Validating configuration with testparm...\n";
            validateSmbConf(newContent,
                function onValid() {
                    sharesList.classList.add("hidden");
                    output.textContent += "Configuration OK. Saving " + SMB_CONF + "...\n";
                    writeConfAndRestart(newContent);
                },
                function onInvalid(errText) {
                    output.textContent += "\n" + errText + "\n\nNothing was saved or restarted.\n";
                    unlockNormal();
                }
            );
        })
        .fail(function(ex) {
            output.textContent += "ERROR reading " + SMB_CONF + ": " + (ex.message || JSON.stringify(ex)) + "\n";
            unlockNormal();
        });
});

// ── Delete User ───────────────────────────────────────────────────────────────

// Scoped to HaasGroup members, excluding "haas" itself (the appliance's own
// admin/service account) — the same "don't offer to delete the thing that
// runs everything" exclusion already used for the [Haas] share above.
function populateUsersList() {
    usersList.innerHTML = "<option value=\"\">— loading... —</option>";
    usersList.classList.remove("hidden");

    cockpit.spawn(
        ["bash", "-c", "getent group HaasGroup | cut -d: -f4 | tr ',' '\\n' | grep -v '^haas$' | grep -v '^$' | sort"],
        { superuser: "require", err: "message" }
    )
        .done(function(data) {
            var users = data.trim() ? data.trim().split("\n") : [];

            usersList.innerHTML = "<option value=\"\">— select a user to delete —</option>";
            if (users.length === 0) {
                usersList.innerHTML = "<option value=\"\">No users found</option>";
            } else {
                users.forEach(function(name) {
                    var opt = document.createElement("option");
                    opt.value = name;
                    opt.textContent = name;
                    usersList.appendChild(opt);
                });
            }
        })
        .fail(function(ex) {
            usersList.innerHTML = "<option value=\"\">Error: " + (ex.message || "failed to list users") + "</option>";
        })
        .always(function() {
            unlockNormal();
        });
}

deleteUserBtn.addEventListener("click", function() {
    lockAll();
    showOutputPanel("Loading users...\n");
    populateUsersList();
});

usersList.addEventListener("change", function() {
    var username = usersList.value;
    if (!username) return;

    if (!confirm(
        "Delete user \"" + username + "\"? This removes both the Linux and Samba " +
        "accounts and cannot be undone. Their home directory (if any) is not deleted."
    )) {
        usersList.value = "";
        return;
    }

    lockAll();
    showOutputPanel("Deleting user \"" + username + "\"...\n\n");

    // --force skips manage_users.sh's own interactive "Are you sure?"
    // prompt — without it, that read() would get an immediate EOF (no tty,
    // nothing piped) and silently abort, since there's nothing here to
    // answer that prompt. This confirm() dialog is the actual safety gate.
    cockpit.spawn([MANAGE_USERS_SCRIPT, username, "--delete-user", "--force"], { superuser: "require", err: "out" })
        .stream(function(data) {
            output.textContent += data;
            output.scrollTop = output.scrollHeight;
        })
        .done(function() {
            usersList.classList.add("hidden");
            output.textContent += "\n[SUCCESS] User \"" + username + "\" deleted.\n";
            refreshAdminNoteVisibility();
            unlockNormal();
        })
        .fail(function(ex, data) {
            output.textContent += "\n[ERROR] " + (data || ex.message || JSON.stringify(ex)) + "\n";
            unlockNormal();
        });
});

// ── Change Password ──────────────────────────────────────────────────────────

// Same population as Delete User (HaasGroup members, minus haas). Marking
// completed entries "✓ done" and disabling them — rather than removing
// them from the list — keeps the full roster visible during a multi-user
// sweep (e.g. an incident response "change everyone's password" pass),
// so progress is a glance away instead of only being visible by counting
// what's left. The list, and its done-markers, are rebuilt fresh every
// time Change Password is clicked.
function populateChangePasswordList() {
    changePasswordList.innerHTML = "<option value=\"\">— loading... —</option>";
    changePasswordList.classList.remove("hidden");

    cockpit.spawn(
        ["bash", "-c", "getent group HaasGroup | cut -d: -f4 | tr ',' '\\n' | grep -v '^haas$' | grep -v '^$' | sort"],
        { superuser: "require", err: "message" }
    )
        .done(function(data) {
            var users = data.trim() ? data.trim().split("\n") : [];

            changePasswordList.innerHTML = "<option value=\"\">— select a user to change password —</option>";
            if (users.length === 0) {
                changePasswordList.innerHTML = "<option value=\"\">No users found</option>";
            } else {
                users.forEach(function(name) {
                    var opt = document.createElement("option");
                    opt.value = name;
                    opt.textContent = name;
                    changePasswordList.appendChild(opt);
                });
            }
        })
        .fail(function(ex) {
            changePasswordList.innerHTML = "<option value=\"\">Error: " + (ex.message || "failed to list users") + "</option>";
        })
        .always(function() {
            unlockNormal();
        });
}

changePasswordBtn.addEventListener("click", function() {
    lockAll();
    showOutputPanel("Loading users...\n");
    populateChangePasswordList();
});

changePasswordList.addEventListener("change", function() {
    var username = changePasswordList.value;
    if (!username) return;

    changePasswordList.classList.add("hidden");
    lockForChangePassword();
    showChangePasswordForm(username);
});

changePasswordCancelBtn.addEventListener("click", function() {
    hideChangePasswordForm();
    confEditor.style.display = "none";
    output.style.display = "none";
    changePasswordList.classList.remove("hidden");
    changePasswordList.value = "";
    panelLabel.textContent = "Select a user, or click Clear Output to stop.";
    validationMsg.classList.add("hidden");
    unlockNormal();
});

changePasswordSubmitBtn.addEventListener("click", function() {
    var username = changePasswordUsername.value;
    var pw1 = changePasswordNew.value;
    var pw2 = changePasswordConfirm.value;

    if (!pw1 || !pw2) {
        validationMsg.textContent = "ERROR: Both password fields are required.";
        validationMsg.classList.remove("hidden");
        return;
    }

    if (pw1 !== pw2) {
        validationMsg.textContent = "ERROR: Passwords do not match.";
        validationMsg.classList.remove("hidden");
        return;
    }

    if (!confirm("Set a new password for \"" + username + "\"? This changes their Linux and Samba password immediately.")) {
        return;
    }

    // Same 4-line stdin sequence as Create User: for an *existing* user,
    // --set-password drives one `passwd` prompt (2 lines) then one plain
    // `smbpasswd` prompt (2 lines) — verified by reading manage_users.sh,
    // not by exercising it against a real appliance. Test with a
    // throwaway account first.
    var stdinSequence = pw1 + "\n" + pw1 + "\n" + pw1 + "\n" + pw1 + "\n";

    lockAll();
    validationMsg.classList.add("hidden");
    hideChangePasswordForm();
    showOutputPanel("Setting new password for \"" + username + "\"...\n\n");

    cockpit.spawn([MANAGE_USERS_SCRIPT, username, "--set-password", "--force"], { superuser: "require", err: "out" })
        .input(stdinSequence)
        .stream(function(data) {
            output.textContent += data;
            output.scrollTop = output.scrollHeight;
        })
        .done(function() {
            output.textContent += "\n[SUCCESS] Password changed for \"" + username + "\".\n";

            // Mark this entry done and put the list back for the next pick,
            // rather than returning to the plain Ready state — the whole
            // point is making a multi-user sweep fast.
            Array.prototype.forEach.call(changePasswordList.options, function(opt) {
                if (opt.value === username) {
                    opt.textContent = "✓ " + username + " (done)";
                    opt.disabled = true;
                }
            });
            changePasswordList.value = "";
            changePasswordList.classList.remove("hidden");
            unlockNormal();
        })
        .fail(function(ex, data) {
            output.textContent += "\n[ERROR] " + (data || ex.message || JSON.stringify(ex)) + "\n";
            changePasswordList.classList.remove("hidden");
            unlockNormal();
        });
});

// ── Display Shares ────────────────────────────────────────────────────────────

displaySharesBtn.addEventListener("click", function() {
    lockAll();
    showOutputPanel("Running: Samba Shares...\n");

    cockpit.spawn(["/usr/local/sbin/list_shares.sh"], { superuser: "require", err: "message" })
        .done(function(data) {
            output.innerHTML = "<span class=\"info\">--- Samba Shares ---</span>\n\n" +
                (data ? colorizeSharesOutput(data) : "(no output)");
        })
        .fail(function(ex, data) {
            output.innerHTML = "<span class=\"info\">--- Samba Shares ---</span>\n\n<span class=\"error\">ERROR: " +
                escapeHtml(ex.message || JSON.stringify(ex)) + "</span>";
            if (data) output.innerHTML += "\n" + escapeHtml(data);
        })
        .always(function() {
            unlockNormal();
        });
});

// ── Display Shares CSV ────────────────────────────────────────────────────────

displaySharesCsvBtn.addEventListener("click", function() {
    lockAll();
    showOutputPanel("Running: Samba Shares (CSV)...\n");

    cockpit.spawn(["/usr/local/sbin/list_shares_csv.sh"], { superuser: "require", err: "message" })
        .done(function(data) {
            output.innerHTML = "<span class=\"info\">--- Samba Shares (CSV) ---</span>\n\n" +
                (data ? colorizeSharesCsvOutput(data) : "(no output)");
        })
        .fail(function(ex, data) {
            output.innerHTML = "<span class=\"info\">--- Samba Shares (CSV) ---</span>\n\n<span class=\"error\">ERROR: " +
                escapeHtml(ex.message || JSON.stringify(ex)) + "</span>";
            if (data) output.innerHTML += "\n" + escapeHtml(data);
        })
        .always(function() {
            unlockNormal();
        });
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

// ── Display Users (Linux + Samba, merged) ─────────────────────────────────────

// One row per Linux local account (UID 1000-59999, same range Linux Users
// used), each annotated with whether it also has a Samba account —
// replaces the separate Samba Users / Linux Users buttons since the two
// account sets overlap almost completely and were awkward to cross-reference
// as two separate button clicks.
displayUsersBtn.addEventListener("click", function() {
    lockAll();
    showOutputPanel("Loading users...\n");

    cockpit.spawn(["bash", "-c", "pdbedit -L 2>/dev/null | cut -d: -f1"], { superuser: "require", err: "message" })
        .then(function(sambaData) {
            var sambaUsers = {};
            (sambaData || "").trim().split("\n").forEach(function(u) {
                if (u.trim()) sambaUsers[u.trim()] = true;
            });

            return cockpit.spawn(
                ["bash", "-c", "getent passwd | awk -F: '$3 >= 1000 && $3 < 60000 {printf \"%s|%s|%s|%s\\n\", $1, $3, $4, $6}'"],
                { superuser: "require", err: "message" }
            ).then(function(linuxData) {
                var rows = (linuxData || "").trim() ? linuxData.trim().split("\n") : [];
                var users = rows.map(function(line) {
                    var f = line.split("|");
                    return { name: f[0], uid: f[1], gid: f[2], home: f[3], hasSamba: !!sambaUsers[f[0]] };
                }).sort(function(a, b) { return a.name.localeCompare(b.name); });

                var header = "Username             UID    GID    Samba   Home\n" +
                    "─────────────────────────────────────────────────────────────";
                var html = "<span class=\"info\">--- Users (Linux + Samba) ---</span>\n\n" +
                    "<span class=\"info\">" + escapeHtml(header) + "</span>\n";

                if (users.length === 0) {
                    html += "(none found)";
                } else {
                    html += users.map(function(u, i) {
                        var line = u.name.padEnd(20) + " " + u.uid.padEnd(6) + " " + u.gid.padEnd(6) + " " +
                            (u.hasSamba ? "Yes" : "No").padEnd(7) + " " + u.home;
                        // Alternating row coloring: 1st/3rd/... rows default
                        // white, 2nd/4th/... rows blue (.info) — makes a
                        // long user list easier to scan line-by-line.
                        return (i % 2 === 1)
                            ? "<span class=\"info\">" + escapeHtml(line) + "</span>"
                            : escapeHtml(line);
                    }).join("\n");
                }

                output.innerHTML = html;
                unlockNormal();
            });
        })
        // Chained through .then(), so cleanup can't use the jQuery-style
        // .always() the rest of this file relies on elsewhere (that method
        // isn't guaranteed to survive a .then() hop) — unlockNormal() is
        // called explicitly on both the success path above and here.
        .catch(function(ex) {
            output.innerHTML = "<span class=\"info\">--- Users (Linux + Samba) ---</span>\n\n<span class=\"error\">ERROR: " +
                escapeHtml((ex && ex.message) || JSON.stringify(ex)) + "</span>";
            unlockNormal();
        });
});

// ── Verify Administrator note visibility ─────────────────────────────────────

// The note only means something once an Administrator account exists (role
// "admin" == sudo group membership, per manage_users.sh's --admin-user).
// Checked against actual current state — not a flag set at Create User time
// — so it stays correct across page reloads and after Delete User removes
// the last admin, not just within one browser session.
function refreshAdminNoteVisibility() {
    cockpit.spawn(
        ["bash", "-c", "getent group sudo | cut -d: -f4 | tr ',' '\\n' | grep -v '^haas$' | grep -v '^$'"],
        { superuser: "require", err: "message" }
    )
        .then(function(data) {
            verifyAdminNote.classList.toggle("hidden", !(data || "").trim());
        })
        .catch(function() {
            // Leave current visibility as-is on error.
        });
}

refreshAdminNoteVisibility();

// ── Clear Output ──────────────────────────────────────────────────────────────

clearOutputBtn.addEventListener("click", function() {
    if (creatingShare) hideCreateShareForm();
    if (creatingUser) hideCreateUserForm();
    sharesList.classList.add("hidden");
    usersList.classList.add("hidden");
    changePasswordList.classList.add("hidden");
    showOutputPanel("Ready.");
    unlockNormal();
});

// Show the appliance's IPv4 + MAC for each active physical network
// interface next to the page title — lets an admin confirm at a glance
// which interface(s) Cockpit is actually reachable on, without needing
// a terminal. Only physical interfaces (real NICs, not bridges/VMs) are
// considered, via checking that /sys/class/net/<iface>/device exists.
// No sudo needed — reading interface info doesn't require root.
(function loadNetworkInfo() {
    const el = document.getElementById("network-info");
    if (!el) return;

    const script = [
        'for i in $(ip -4 -o addr show scope global | awk \'{print $2}\'); do',
        '    if [ -e "/sys/class/net/$i/device" ]; then',
        '        ip_addr=$(ip -4 -o addr show dev "$i" scope global | awk \'{print $4}\' | cut -d/ -f1)',
        '        mac=$(cat "/sys/class/net/$i/address" 2>/dev/null)',
        '        echo "$i|$ip_addr|$mac"',
        '    fi',
        'done'
    ].join('\n');

    cockpit.spawn(["bash", "-c", script], { err: "message" })
        .then(function(result) {
            const lines = result.trim().split('\n').filter(function(l) { return l.length > 0; });

            if (lines.length === 0) {
                el.textContent = "Network: no active interface found.";
                return;
            }

            const parts = lines.map(function(line) {
                const fields = line.split('|');
                return fields[0] + ": " + fields[1] + " (MAC " + fields[2] + ")";
            });

            el.innerHTML = "";

            const addressLine = document.createElement("div");
            addressLine.textContent = "Network — " + parts.join("   |   ");
            el.appendChild(addressLine);

            if (lines.length > 1) {
                const warningLine = document.createElement("div");
                warningLine.className = "network-warning";
                warningLine.textContent = "⚠ Multiple active interfaces — for best security and manageability, only one should be connected.";
                el.appendChild(warningLine);
            }
        })
        .catch(function() {
            el.textContent = "";
        });
})();

// Opens the published docs page for this extension in a new tab.
document.getElementById("helpBtn").addEventListener("click", function() {
    window.open(
        "https://rikosintie.github.io/Haas_Data_collect/manage_the_appliance/samba/",
        "_blank",
        "noopener,noreferrer"
    );
});
