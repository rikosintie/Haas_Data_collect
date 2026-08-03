const output = document.getElementById("output");
const statusBox = document.getElementById("status");
const tableContainer = document.getElementById("tableContainer");
const lastRun = document.getElementById("lastRun");

const checkBtn = document.getElementById("checkBtn");
const updateBtn = document.getElementById("updateBtn");
const rebootBtn = document.getElementById("rebootBtn");
const syncToolsBtn = document.getElementById("syncToolsBtn");

const cockpitLogBtn = document.getElementById("cockpitLogBtn");
const sshLogBtn = document.getElementById("sshLogBtn");
const sambaLogBtn = document.getElementById("sambaLogBtn");
const authLogBtn = document.getElementById("authLogBtn");
const ufwLiveBtn = document.getElementById("ufwLiveBtn");
const stopLogBtn = document.getElementById("stopLogBtn");

const serviceEditorSection = document.getElementById("serviceEditorSection");
const serviceEditorArea    = document.getElementById("serviceEditorArea");
const serviceEditorLabel   = document.getElementById("serviceEditorLabel");
const editorValidationMsg  = document.getElementById("editorValidationMsg");
const saveServiceBtn       = document.getElementById("saveServiceBtn");
const cancelServiceEditBtn = document.getElementById("cancelServiceEditBtn");

const editSyncToolsBtn = document.getElementById("editSyncToolsBtn");

const TOOLS_YAML_PATH = "/usr/local/sbin/tools.yaml";
const TOOLS_YAML_VALIDATE_TMP_PREFIX = "/tmp/tools.yaml.validate.";

// Runs against a scratch copy of the edited tools.yaml, never the real
// file. Checks (in order): yq is installed, the YAML parses, the top-level
// "tools:" key is a list, and every entry has both repo/binary — then, for
// each repo, that it actually exists on GitHub and has a published release
// (the same endpoint gh_install_inventory itself calls), so a typo or a
// renamed/deleted repo is caught here instead of failing mid-sync.
var TOOLS_YAML_VALIDATE_SCRIPT = [
    "set -u",
    "tmp=\"$1\"",
    "",
    "if ! command -v yq >/dev/null 2>&1; then",
    "    echo \"yq is not installed yet. Run the Sync Tools button once first, then try Edit Sync Tools again.\"",
    "    exit 1",
    "fi",
    "",
    "yq_err=$(yq eval '.' \"$tmp\" 2>&1 >/dev/null)",
    "if [ -n \"$yq_err\" ]; then",
    "    echo \"Invalid YAML syntax:\"",
    "    echo \"$yq_err\"",
    "    exit 1",
    "fi",
    "",
    "list_type=$(yq eval '.tools | type' \"$tmp\" 2>/dev/null)",
    "if [ \"$list_type\" != \"!!seq\" ]; then",
    "    echo \"Invalid structure: top-level tools: must be a list.\"",
    "    exit 1",
    "fi",
    "",
    "count=$(yq eval '.tools | length' \"$tmp\")",
    "problems=()",
    "",
    "for i in $(seq 0 $((count - 1))); do",
    "    repo=$(yq eval \".tools[$i].repo\" \"$tmp\")",
    "    binary=$(yq eval \".tools[$i].binary\" \"$tmp\")",
    "    entry_num=$((i + 1))",
    "",
    "    if [ \"$repo\" = \"null\" ] || [ -z \"$repo\" ]; then",
    "        problems+=(\"Entry $entry_num is missing repo\")",
    "        continue",
    "    fi",
    "    if [ \"$binary\" = \"null\" ] || [ -z \"$binary\" ]; then",
    "        problems+=(\"Entry $entry_num ($repo) is missing binary\")",
    "        continue",
    "    fi",
    "",
    "    echo \"Checking $repo on GitHub...\"",
    "    code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 \"https://api.github.com/repos/$repo/releases/latest\")",
    "",
    "    if [ \"$code\" = \"200\" ]; then",
    "        echo \"[OK] $repo\"",
    "    elif [ \"$code\" = \"000\" ]; then",
    "        problems+=(\"Entry $entry_num ($repo): could not reach GitHub to verify, check network connectivity and try again\")",
    "    elif [ \"$code\" = \"404\" ]; then",
    "        problems+=(\"Entry $entry_num ($repo): not found on GitHub, or has no published releases\")",
    "    else",
    "        problems+=(\"Entry $entry_num ($repo): unexpected GitHub API response $code\")",
    "    fi",
    "done",
    "",
    "if [ \"${#problems[@]}\" -gt 0 ]; then",
    "    echo \"\"",
    "    echo \"VALIDATION FAILED:\"",
    "    printf '%s\\n' \"${problems[@]}\"",
    "    exit 1",
    "fi",
    "",
    "echo \"\"",
    "echo \"All $count entries valid.\""
].join("\n");

var isEditingToolsYaml = false;

var liveLogProcess = null;
var isUfwLive = false;
var logSessionId = 0;

function setUfwFilterEnabled(state) {
    document.querySelectorAll("input[name='ufwFilter']").forEach(function(r) {
        r.disabled = !state;
    });
}

function setStatus(text, cls) {
    statusBox.className = "status " + cls;
    statusBox.textContent = text;
}

function disableButtons(state) {
    checkBtn.disabled = state;
    updateBtn.disabled = state;
    rebootBtn.disabled = state;
    syncToolsBtn.disabled = state;
    editSyncToolsBtn.disabled = state;
    cockpitLogBtn.disabled = state;
    sshLogBtn.disabled = state;
    sambaLogBtn.disabled = state;
    authLogBtn.disabled = state;
    ufwLiveBtn.disabled = state;
    if (state) stopLogBtn.disabled = true;
}

// Show the tools.yaml editor, hiding the output <pre>
function showToolsYamlEditor(content) {
    serviceEditorLabel.textContent = TOOLS_YAML_PATH + " — edit below, then click Save & Sync";
    saveServiceBtn.textContent = "Save & Sync";
    editorValidationMsg.classList.add("hidden");
    editorValidationMsg.textContent = "";
    serviceEditorArea.value = content;
    output.classList.add("hidden");
    serviceEditorSection.classList.remove("hidden");
    disableButtons(true);
    saveServiceBtn.disabled = false;
    cancelServiceEditBtn.disabled = false;
}

// Hide the tools.yaml editor, restoring the output <pre>
function hideServiceEditor() {
    serviceEditorSection.classList.add("hidden");
    editorValidationMsg.classList.add("hidden");
    output.classList.remove("hidden");
    isEditingToolsYaml = false;
    disableButtons(false);
}

var activeLogBtn = null;

function setActiveLogBtn(btn) {
    if (activeLogBtn) activeLogBtn.classList.remove("active");
    activeLogBtn = btn || null;
    if (activeLogBtn) activeLogBtn.classList.add("active");
}

function onLiveLogEnd(session) {
    if (logSessionId !== session) return;
    liveLogProcess = null;
    stopLogBtn.disabled = true;
    isUfwLive = false;
    setUfwFilterEnabled(false);
    setActiveLogBtn(null);
}

function stopLiveLog() {
    logSessionId++;  // invalidate all callbacks from the previous stream
    if (liveLogProcess) {
        try { liveLogProcess.close("terminated"); } catch(e) { /* ignore */ }
        liveLogProcess = null;
    }
    stopLogBtn.disabled = true;
    isUfwLive = false;
    setUfwFilterEnabled(false);
    setActiveLogBtn(null);
}

function startLiveLog(args, label) {
    stopLiveLog();                  // bumps logSessionId, kills old process
    var mySession = logSessionId;   // capture this stream's session

    output.textContent = "--- " + label + " (live) ---\n";
    output.scrollTop = 0;
    stopLogBtn.disabled = false;

    liveLogProcess = cockpit.spawn(args, { superuser: "require", err: "message" });

    liveLogProcess.stream(function(data) {
        if (logSessionId !== mySession) return;  // stale — silently discard
        output.textContent += data;
        output.scrollTop = output.scrollHeight;
    });

    liveLogProcess.done(function() {
        if (logSessionId !== mySession) return;
        output.textContent += "\n[Stream ended]\n";
        onLiveLogEnd(mySession);
    });

    liveLogProcess.fail(function(ex) {
        if (logSessionId !== mySession) return;
        if (ex.problem !== "terminated") {
            output.textContent += "\nERROR: " + (ex.message || JSON.stringify(ex));
        }
        onLiveLogEnd(mySession);
    });
}

function startUfwLive() {
    var filter = document.querySelector("input[name='ufwFilter']:checked").value;
    var grepPattern, label;

    if (filter === "block") {
        grepPattern = "UFW BLOCK"; label = "UFW Live — BLOCK";
    } else if (filter === "allow") {
        grepPattern = "UFW ALLOW"; label = "UFW Live — ALLOW";
    } else if (filter === "audit") {
        grepPattern = "UFW AUDIT"; label = "UFW Live — Audit";
    } else {
        grepPattern = "\\[UFW"; label = "UFW Live — All";
    }

    // Use journalctl --grep instead of tail|grep pipes.
    // A single process is reliably terminated by .close(); piped
    // child processes inherited bash's stdout and keep writing
    // to the channel even after bash is killed.
    startLiveLog(
        ["journalctl", "-f", "--no-pager", "--grep=" + grepPattern],
        label
    );
    isUfwLive = true;
    setUfwFilterEnabled(true);
    setActiveLogBtn(ufwLiveBtn);
}

function showStaticLog(args, label) {
    stopLiveLog();
    output.textContent = "--- " + label + " ---\n";

    cockpit.spawn(args, { superuser: "require", err: "message" })
        .done(function(data) {
            output.textContent += data || "(no output)";
            output.scrollTop = output.scrollHeight;
        })
        .fail(function(ex, data) {
            output.textContent += "\nERROR: " + (ex.message || JSON.stringify(ex));
            if (data) output.textContent += "\n" + data;
        });
}

function renderTable(data) {
    if (!data || !data.trim()) {
        tableContainer.innerHTML = "";
        return;
    }

    var rows = data.trim().split("\n");
    var html = "<table><tr><th>Package</th><th>Version</th></tr>";

    rows.forEach(function(line) {
        var parts = line.split("|");
        if (parts.length === 2) {
            html += "<tr><td>" + parts[0] + "</td><td>" + parts[1] + "</td></tr>";
        }
    });

    html += "</table>";
    tableContainer.innerHTML = html;
}

function checkUpdates() {
    disableButtons(true);
    output.textContent = "Checking for updates...\n";

    cockpit.spawn(["/usr/local/sbin/update-check.sh"], { superuser: "require", err: "message" })
        .done(function(data) {
            data = data || "";
            output.textContent += data;

            var lines = data.split("\n");
            var tableData = lines.filter(function(l) { return l.indexOf("|") !== -1; }).join("\n");
            renderTable(tableData);

            if (data.indexOf("REBOOT_REQUIRED") !== -1) {
                setStatus("Reboot required", "bad");
            } else if (data.indexOf("UPDATES_AVAILABLE") !== -1) {
                setStatus("Updates available", "warn");
            } else {
                setStatus("System up to date", "ok");
            }
        })
        .fail(function(ex, data) {
            output.textContent += "\nERROR: " + (ex.message || JSON.stringify(ex));
            if (data) output.textContent += "\n" + data;
            setStatus("Error checking updates", "bad");
        })
        .always(function() {
            disableButtons(false);
        });
}

function runUpdate() {
    disableButtons(true);
    output.textContent = "Installing updates...\n";

    cockpit.spawn(["/usr/local/sbin/update-system.sh"], { superuser: "require", err: "message" })
        .stream(function(data) { output.textContent += data; })
        .done(function() {
            var now = new Date().toLocaleString();
            lastRun.textContent = "Last updated: " + now;
            localStorage.setItem("haasLastUpdate", now);
            checkUpdates();
        })
        .fail(function(ex, data) {
            output.textContent += "\nERROR: " + (ex.message || JSON.stringify(ex));
            if (data) output.textContent += "\n" + data;
            setStatus("Update failed", "bad");
            disableButtons(false);
        });
}

function syncTools() {
    disableButtons(true);
    output.textContent = "Syncing tools from GitHub...\n";

    cockpit.spawn(["/usr/local/sbin/install-tools.sh"], { superuser: "require", err: "message" })
        .stream(function(data) {
            output.textContent += data;
            output.scrollTop = output.scrollHeight;
        })
        .done(function() {
            output.textContent += "\nSync complete.\n";
            output.scrollTop = output.scrollHeight;
        })
        .fail(function(ex, data) {
            output.textContent += "\nERROR: " + (ex.message || JSON.stringify(ex));
            if (data) output.textContent += "\n" + data;
        })
        .always(function() {
            disableButtons(false);
        });
}

function rebootSystem() {
    if (!confirm("Are you sure you want to reboot the system?")) return;

    disableButtons(true);
    output.textContent = "Rebooting system...\n";

    cockpit.spawn(["reboot"], { superuser: "require" });
}

// Restore last update time from persistent storage
var savedTime = localStorage.getItem("haasLastUpdate");
if (savedTime) {
    lastRun.textContent = "Last updated: " + savedTime;
}

// Wire up system buttons
checkBtn.addEventListener("click", checkUpdates);
updateBtn.addEventListener("click", runUpdate);
rebootBtn.addEventListener("click", rebootSystem);
syncToolsBtn.addEventListener("click", syncTools);

// Wire up log buttons
cockpitLogBtn.addEventListener("click", function() {
    startLiveLog(
        ["journalctl", "-u", "cockpit", "-n", "50", "-f", "--no-pager"],
        "Cockpit Log"
    );
    setActiveLogBtn(cockpitLogBtn);
});

sshLogBtn.addEventListener("click", function() {
    startLiveLog(
        ["journalctl", "-u", "ssh", "-n", "50", "-f", "--no-pager"],
        "SSH Log"
    );
    setActiveLogBtn(sshLogBtn);
});

sambaLogBtn.addEventListener("click", function() {
    startLiveLog(
        ["journalctl", "-u", "smbd", "-n", "50", "-f", "--no-pager"],
        "Samba Log"
    );
    setActiveLogBtn(sambaLogBtn);
});

authLogBtn.addEventListener("click", function() {
    startLiveLog(
        ["tail", "-n", "50", "-f", "/var/log/auth.log"],
        "Auth Log"
    );
    setActiveLogBtn(authLogBtn);
});

ufwLiveBtn.addEventListener("click", startUfwLive);

// Changing the filter while UFW Live is running auto-restarts the stream
document.querySelectorAll("input[name='ufwFilter']").forEach(function(radio) {
    radio.addEventListener("change", function() {
        if (isUfwLive) {
            startUfwLive();
        }
    });
});

stopLogBtn.addEventListener("click", function() {
    stopLiveLog();
    output.textContent += "\n[Stopped]\n";
});

// ── Edit Sync Tools ───────────────────────────────────────────────────────────

editSyncToolsBtn.addEventListener("click", function() {
    stopLiveLog();
    setActiveLogBtn(null);
    output.textContent = "Loading " + TOOLS_YAML_PATH + "...\n";
    output.classList.remove("hidden");

    cockpit.file(TOOLS_YAML_PATH, { superuser: "require" }).read()
        .done(function(content) {
            if (content === null) {
                output.textContent = "ERROR: Could not read " + TOOLS_YAML_PATH + "\n";
                return;
            }
            isEditingToolsYaml = true;
            showToolsYamlEditor(content);
        })
        .fail(function(ex) {
            output.textContent = "ERROR reading " + TOOLS_YAML_PATH + ": " + (ex.message || JSON.stringify(ex)) + "\n";
        });
});

// ── Save & Sync ────────────────────────────────────────────────────────────────

saveServiceBtn.addEventListener("click", function() {
    var yamlContent = serviceEditorArea.value;
    if (!yamlContent.trim()) {
        editorValidationMsg.textContent = "ERROR: Editor is empty — not saving.";
        editorValidationMsg.classList.remove("hidden");
        return;
    }

    if (!confirm("This will overwrite " + TOOLS_YAML_PATH + " and run Sync Tools. Continue?")) {
        return;
    }

    disableButtons(true);
    saveServiceBtn.disabled = true;
    cancelServiceEditBtn.disabled = true;
    editorValidationMsg.textContent = "";
    editorValidationMsg.classList.remove("hidden");
    serviceEditorLabel.textContent = "Validating tools.yaml — checking each repo on GitHub...";

    var tmpPath = TOOLS_YAML_VALIDATE_TMP_PREFIX + Date.now();

    cockpit.file(tmpPath).replace(yamlContent)
        .done(function() {
            cockpit.spawn(
                ["bash", "-c", TOOLS_YAML_VALIDATE_SCRIPT, "bash", tmpPath],
                { err: "message" }
            )
                .stream(function(data) {
                    editorValidationMsg.textContent += data;
                    editorValidationMsg.scrollTop = editorValidationMsg.scrollHeight;
                })
                .done(function() {
                    cockpit.spawn(["rm", "-f", tmpPath]);
                    isEditingToolsYaml = false;
                    hideServiceEditor();

                    cockpit.file(TOOLS_YAML_PATH, { superuser: "require" }).replace(yamlContent)
                        .done(function() {
                            syncTools();
                        })
                        .fail(function(ex) {
                            output.textContent += "\nERROR saving " + TOOLS_YAML_PATH + ": " + (ex.message || JSON.stringify(ex)) + "\n";
                        });
                })
                .fail(function(ex) {
                    cockpit.spawn(["rm", "-f", tmpPath]);
                    if (ex.message) editorValidationMsg.textContent += "\n" + ex.message;
                    editorValidationMsg.textContent += "\n\nNothing was saved — fix the issue(s) above and try again.";
                    serviceEditorLabel.textContent = TOOLS_YAML_PATH + " — edit below, then click Save & Sync";
                    disableButtons(true);
                    saveServiceBtn.disabled = false;
                    cancelServiceEditBtn.disabled = false;
                });
        })
        .fail(function(ex) {
            editorValidationMsg.textContent = "ERROR writing temp file for validation: " + (ex.message || JSON.stringify(ex));
            editorValidationMsg.classList.remove("hidden");
            serviceEditorLabel.textContent = TOOLS_YAML_PATH + " — edit below, then click Save & Sync";
            disableButtons(true);
            saveServiceBtn.disabled = false;
            cancelServiceEditBtn.disabled = false;
        });
});

cancelServiceEditBtn.addEventListener("click", function() {
    hideServiceEditor();
    output.textContent = "Edit cancelled.\n";
    setActiveLogBtn(null);
});

// Auto check on load
checkUpdates();
