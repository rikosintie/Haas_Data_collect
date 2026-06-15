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
const scriptsLogBtn = document.getElementById("scriptsLogBtn");
const stopLogBtn = document.getElementById("stopLogBtn");

const serviceStateBtn      = document.getElementById("serviceStateBtn");
const editServicesBtn      = document.getElementById("editServicesBtn");
const createServiceBtn     = document.getElementById("createServiceBtn");
const deleteServiceBtn     = document.getElementById("deleteServiceBtn");
const servicesList         = document.getElementById("servicesList");
const serviceEditorSection = document.getElementById("serviceEditorSection");
const serviceEditorArea    = document.getElementById("serviceEditorArea");
const serviceEditorLabel   = document.getElementById("serviceEditorLabel");
const saveServiceBtn       = document.getElementById("saveServiceBtn");
const cancelServiceEditBtn = document.getElementById("cancelServiceEditBtn");
const createServiceForm    = document.getElementById("createServiceForm");
const svcDescription       = document.getElementById("svcDescription");
const svcName              = document.getElementById("svcName");
const svcIpAddress         = document.getElementById("svcIpAddress");
const svcPort              = document.getElementById("svcPort");

var currentServicePath = null;
var isCreatingService = false;
var serviceListMode = "edit"; // "edit" or "delete"

var liveLogProcess = null;
var isUfwLive = false;
var isScriptsLive = false;
var logSessionId = 0;

function setUfwFilterEnabled(state) {
    document.querySelectorAll("input[name='ufwFilter']").forEach(function(r) {
        r.disabled = !state;
    });
}

function setScriptsFilterEnabled(state) {
    document.getElementById("scriptsIpFilter").disabled = !state;
    document.getElementById("scriptsPortFilter").disabled = !state;
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
    cockpitLogBtn.disabled = state;
    sshLogBtn.disabled = state;
    sambaLogBtn.disabled = state;
    authLogBtn.disabled = state;
    ufwLiveBtn.disabled = state;
    scriptsLogBtn.disabled = state;
    if (state) stopLogBtn.disabled = true;
    serviceStateBtn.disabled = state;
    editServicesBtn.disabled = state;
    createServiceBtn.disabled = state;
    deleteServiceBtn.disabled = state;
}

// Show the service editor, hiding the output <pre>
function showServiceEditor(path, content) {
    currentServicePath = path;
    serviceEditorLabel.textContent = path + " — edit below, then click Save & Reload";
    serviceEditorArea.value = content;
    output.classList.add("hidden");
    serviceEditorSection.classList.remove("hidden");
    // Lock system/log buttons while editing; keep save/cancel accessible
    disableButtons(true);
    saveServiceBtn.disabled = false;
    cancelServiceEditBtn.disabled = false;
}

// Hide the service editor, restoring the output <pre>
function hideServiceEditor() {
    serviceEditorSection.classList.add("hidden");
    createServiceForm.classList.add("hidden");
    serviceEditorArea.classList.remove("hidden");
    svcDescription.value = "";
    svcName.value = "";
    svcIpAddress.value = "";
    svcPort.value = "";
    output.classList.remove("hidden");
    servicesList.classList.add("hidden");
    currentServicePath = null;
    disableButtons(false);
}

function showCreateServiceForm() {
    serviceEditorLabel.textContent = "New service — fill in all fields, then click Save & Reload";
    createServiceForm.classList.remove("hidden");
    serviceEditorArea.classList.add("hidden");
    output.classList.add("hidden");
    serviceEditorSection.classList.remove("hidden");
    disableButtons(true);
    saveServiceBtn.disabled = false;
    cancelServiceEditBtn.disabled = false;
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
    isScriptsLive = false;
    setUfwFilterEnabled(false);
    setScriptsFilterEnabled(false);
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
    isScriptsLive = false;
    setUfwFilterEnabled(false);
    setScriptsFilterEnabled(false);
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

function startScriptsLive() {
    var ip   = document.getElementById("scriptsIpFilter").value.trim();
    var port = document.getElementById("scriptsPortFilter").value.trim();

    var pattern, label;

    if (ip && port) {
        pattern = ip + ":" + port;
        label   = "Scripts Log (" + ip + ":" + port + ")";
    } else if (ip) {
        pattern = ip;
        label   = "Scripts Log (" + ip + ")";
    } else if (port) {
        pattern = ":" + port;
        label   = "Scripts Log (port " + port + ")";
    } else {
        label   = "Scripts Log";
    }

    // -t python3 filters by syslog identifier (process name field, not message body).
    // --grep= is added only when IP/port filtering is needed (searches message content).
    var args = ["journalctl", "-t", "python3", "-n", "50", "-f", "--no-pager"];
    if (ip || port) args.push("--grep=" + pattern);
    startLiveLog(args, label);
    isScriptsLive = true;
    setScriptsFilterEnabled(true);
    setActiveLogBtn(scriptsLogBtn);
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

scriptsLogBtn.addEventListener("click", startScriptsLive);

// Changing the filter while UFW Live is running auto-restarts the stream
document.querySelectorAll("input[name='ufwFilter']").forEach(function(radio) {
    radio.addEventListener("change", function() {
        if (isUfwLive) {
            startUfwLive();
        }
    });
});

// Changing IP/Port while Scripts is live auto-restarts the stream
["scriptsIpFilter", "scriptsPortFilter"].forEach(function(id) {
    document.getElementById(id).addEventListener("change", function() {
        if (isScriptsLive) {
            startScriptsLive();
        }
    });
});

stopLogBtn.addEventListener("click", function() {
    stopLiveLog();
    output.textContent += "\n[Stopped]\n";
});

// ── Service State ─────────────────────────────────────────────────────────────

serviceStateBtn.addEventListener("click", function() {
    stopLiveLog();
    setActiveLogBtn(serviceStateBtn);
    output.textContent = "--- Haas Service Status ---\n";

    cockpit.spawn(
        ["bash", "-c", "systemctl list-unit-files --type=service | grep haas"],
        { superuser: "require", err: "message" }
    )
        .done(function(data) {
            output.textContent += data || "(no haas services found)";
        })
        .fail(function(ex, data) {
            output.textContent += "\nERROR: " + (ex.message || JSON.stringify(ex));
            if (data) output.textContent += "\n" + data;
        })
        .always(function() {
            setActiveLogBtn(null);
        });
});

// ── Shared: populate the services dropdown ────────────────────────────────────

function populateServicesList() {
    servicesList.innerHTML = "<option value=\"\">— loading... —</option>";
    servicesList.classList.remove("hidden");

    cockpit.spawn(
        ["bash", "-c", "ls /etc/systemd/system/haas-*.service 2>/dev/null"],
        { superuser: "require", err: "message" }
    )
        .done(function(data) {
            var files = data.trim() ? data.trim().split("\n") : [];
            servicesList.innerHTML = "<option value=\"\">— select a service file —</option>";
            if (files.length === 0) {
                servicesList.innerHTML = "<option value=\"\">No haas-*.service files found</option>";
            } else {
                files.forEach(function(f) {
                    f = f.trim();
                    var opt = document.createElement("option");
                    opt.value = f;
                    opt.textContent = f.replace("/etc/systemd/system/", "");
                    servicesList.appendChild(opt);
                });
            }
        })
        .fail(function(ex) {
            servicesList.innerHTML = "<option value=\"\">Error: " + (ex.message || "failed to list files") + "</option>";
        });
}

// ── Edit Services ─────────────────────────────────────────────────────────────

editServicesBtn.addEventListener("click", function() {
    stopLiveLog();
    setActiveLogBtn(editServicesBtn);
    serviceListMode = "edit";
    populateServicesList();
});

// ── Delete Service ────────────────────────────────────────────────────────────

deleteServiceBtn.addEventListener("click", function() {
    stopLiveLog();
    setActiveLogBtn(deleteServiceBtn);
    serviceListMode = "delete";
    populateServicesList();
});

servicesList.addEventListener("change", function() {
    var path = servicesList.value;
    if (!path) return;

    if (serviceListMode === "delete") {
        var name = path.replace("/etc/systemd/system/", "");
        if (!confirm("Delete " + name + "? This cannot be undone.")) {
            servicesList.value = "";
            return;
        }

        output.classList.remove("hidden");
        output.textContent = "Stopping " + name + "...\n";
        disableButtons(true);

        cockpit.spawn(["systemctl", "stop", name], { superuser: "require", err: "message" })
            .done(function() {
                output.textContent += "Stopped. Disabling " + name + "...\n";
                cockpit.spawn(["systemctl", "disable", name], { superuser: "require", err: "message" })
                    .done(function() {
                        output.textContent += "Disabled. Removing " + path + "...\n";
                        cockpit.spawn(["rm", path], { superuser: "require", err: "message" })
                            .done(function() {
                                output.textContent += "Removed. Running systemctl daemon-reload...\n";
                                cockpit.spawn(["systemctl", "daemon-reload"], { superuser: "require", err: "message" })
                                    .done(function() {
                                        output.textContent += name + " deleted successfully.\n";
                                        disableButtons(false);
                                        servicesList.classList.add("hidden");
                                    })
                                    .fail(function(ex, data) {
                                        output.textContent += "daemon-reload failed: " + (ex.message || JSON.stringify(ex)) + "\n";
                                        if (data) output.textContent += data;
                                        disableButtons(false);
                                        servicesList.classList.add("hidden");
                                    });
                            })
                            .fail(function(ex, data) {
                                output.textContent += "rm failed: " + (ex.message || JSON.stringify(ex)) + "\n";
                                if (data) output.textContent += data;
                                disableButtons(false);
                            });
                    })
                    .fail(function(ex, data) {
                        output.textContent += "disable failed: " + (ex.message || JSON.stringify(ex)) + "\n";
                        if (data) output.textContent += data;
                        disableButtons(false);
                    });
            })
            .fail(function(ex, data) {
                output.textContent += "stop failed: " + (ex.message || JSON.stringify(ex)) + "\n";
                if (data) output.textContent += data;
                disableButtons(false);
            });
        return;
    }

    // edit mode
    output.textContent = "Loading " + path + "...\n";

    cockpit.file(path, { superuser: "require" })
        .read()
        .done(function(content) {
            if (content === null) {
                output.textContent = "ERROR: Could not read " + path + "\n";
                return;
            }
            showServiceEditor(path, content);
        })
        .fail(function(ex) {
            output.textContent = "ERROR reading " + path + ": " + (ex.message || JSON.stringify(ex)) + "\n";
        });
});

// ── Create Service ────────────────────────────────────────────────────────────

var SERVICE_TEMPLATE = [
    "[Unit]",
    "Description=<description>",
    "After=network.target",
    "",
    "[Service]",
    "User=haas",
    "WorkingDirectory=/home/haas/Haas_Data_collect/machines/<machine>",
    "ExecStart=/usr/bin/python3 /home/haas/Haas_Data_collect/haas_logger2.py -a -t <ip_address> --port <port> --name <machine>",
    "Type=idle",
    "",
    "[Install]",
    "WantedBy=multi-user.target"
].join("\n");

// Real-time character filtering for Create Service fields
svcName.addEventListener("input", function() {
    var pos = svcName.selectionStart;
    var cleaned = svcName.value.replace(/[^0-9a-zA-Z_-]/g, "");
    if (cleaned !== svcName.value) {
        svcName.value = cleaned;
        svcName.setSelectionRange(pos - 1, pos - 1);
    }
});

svcDescription.addEventListener("input", function() {
    var pos = svcDescription.selectionStart;
    var cleaned = svcDescription.value.replace(/[^0-9a-zA-Z_ -]/g, "");
    if (cleaned !== svcDescription.value) {
        svcDescription.value = cleaned;
        svcDescription.setSelectionRange(pos - 1, pos - 1);
    }
});

createServiceBtn.addEventListener("click", function() {
    stopLiveLog();
    isCreatingService = true;
    showCreateServiceForm();
});

// ── Save & Reload daemon ──────────────────────────────────────────────────────

saveServiceBtn.addEventListener("click", function() {
    if (isCreatingService) {
        var description = svcDescription.value.trim();
        var machine     = svcName.value.trim().toLowerCase();
        var ipAddress   = svcIpAddress.value.trim();
        var port        = svcPort.value.trim();

        if (!description || !machine || !ipAddress || !port) {
            output.textContent = "ERROR: All four fields are required.\n";
            output.classList.remove("hidden");
            return;
        }

        var ipParts = ipAddress.split(".");
        var ipValid = ipParts.length === 4 && ipParts.every(function(p) {
            return /^\d+$/.test(p) && parseInt(p, 10) >= 0 && parseInt(p, 10) <= 255;
        });
        if (!ipValid) {
            output.textContent = "ERROR: IP address must be a valid IPv4 address (e.g. 192.168.10.143).\n";
            output.classList.remove("hidden");
            return;
        }

        var portNum = parseInt(port, 10);
        if (!/^\d+$/.test(port) || portNum < 5001 || portNum > 5999) {
            output.textContent = "ERROR: Port must be an integer between 5001 and 5999.\n";
            output.classList.remove("hidden");
            return;
        }

        var content = [
            "[Unit]",
            "Description=" + description,
            "After=network.target",
            "",
            "[Service]",
            "User=haas",
            "WorkingDirectory=/home/haas/Haas_Data_collect/machines/" + machine,
            "ExecStart=/usr/bin/python3 /home/haas/Haas_Data_collect/haas_logger2.py -a -t " + ipAddress + " --port " + port + " --name " + machine.toUpperCase(),
            "Type=idle",
            "",
            "[Install]",
            "WantedBy=multi-user.target"
        ].join("\n");

        var serviceName = "haas-" + machine + ".service";
        var path = "/etc/systemd/system/" + serviceName;

        isCreatingService = false;
        hideServiceEditor();
        output.textContent = "Saving " + path + "...\n";

        cockpit.file(path, { superuser: "require" })
            .replace(content)
            .done(function() {
                var workDir = "/home/haas/Haas_Data_collect/machines/" + machine;
                output.textContent += "Saved. Creating " + workDir + "...\n";
                cockpit.spawn(["mkdir", "-p", workDir], { superuser: "require", err: "message" })
                    .done(function() {
                        output.textContent += "Directory ready. Running systemctl daemon-reload...\n";
                        cockpit.spawn(["systemctl", "daemon-reload"], { superuser: "require", err: "message" })
                            .done(function() {
                                output.textContent += "daemon-reload complete. Enabling " + serviceName + "...\n";
                                cockpit.spawn(["systemctl", "enable", serviceName], { superuser: "require", err: "message" })
                                    .done(function() {
                                        output.textContent += "Enabled. Starting " + serviceName + "...\n";
                                        cockpit.spawn(["systemctl", "start", serviceName], { superuser: "require", err: "message" })
                                            .done(function() {
                                                output.textContent += serviceName + " started successfully.\n";
                                                cockpit.spawn(["systemctl", "status", serviceName], { superuser: "require", err: "message" })
                                                    .done(function(data) {
                                                        output.textContent += data;
                                                    })
                                                    .fail(function(ex, data) {
                                                        if (data) output.textContent += data;
                                                    });
                                            })
                                            .fail(function(ex, data) {
                                                output.textContent += "start failed: " + (ex.message || JSON.stringify(ex)) + "\n";
                                                if (data) output.textContent += data;
                                            });
                                    })
                                    .fail(function(ex, data) {
                                        output.textContent += "enable failed: " + (ex.message || JSON.stringify(ex)) + "\n";
                                        if (data) output.textContent += data;
                                    });
                            })
                            .fail(function(ex, data) {
                                output.textContent += "daemon-reload failed: " + (ex.message || JSON.stringify(ex)) + "\n";
                                if (data) output.textContent += data;
                            });
                    })
                    .fail(function(ex, data) {
                        output.textContent += "mkdir failed: " + (ex.message || JSON.stringify(ex)) + "\n";
                        if (data) output.textContent += data;
                    });
            })
            .fail(function(ex) {
                output.textContent += "ERROR saving file: " + (ex.message || JSON.stringify(ex)) + "\n";
            });
        return;
    }

    var content = serviceEditorArea.value;
    if (!content.trim()) {
        output.textContent = "ERROR: Editor is empty — not saving.\n";
        hideServiceEditor();
        return;
    }

    var path = currentServicePath;
    var editedService = path.replace("/etc/systemd/system/", "");
    hideServiceEditor();
    output.textContent = "Saving " + path + "...\n";

    cockpit.file(path, { superuser: "require" })
        .replace(content)
        .done(function() {
            output.textContent += "Saved. Running systemctl daemon-reload...\n";

            cockpit.spawn(["systemctl", "daemon-reload"], { superuser: "require", err: "message" })
                .done(function() {
                    output.textContent += "daemon-reload complete. Restart the service to apply changes.\n";
                    cockpit.spawn(["systemctl", "status", editedService], { superuser: "require", err: "message" })
                        .done(function(data) {
                            output.textContent += data;
                        })
                        .fail(function(ex, data) {
                            if (data) output.textContent += data;
                        });
                })
                .fail(function(ex, data) {
                    output.textContent += "daemon-reload failed: " + (ex.message || JSON.stringify(ex)) + "\n";
                    if (data) output.textContent += data;
                });
        })
        .fail(function(ex) {
            output.textContent += "ERROR saving file: " + (ex.message || JSON.stringify(ex)) + "\n";
        });
});

cancelServiceEditBtn.addEventListener("click", function() {
    isCreatingService = false;
    hideServiceEditor();
    output.textContent = "Edit cancelled.\n";
    setActiveLogBtn(null);
});

// Auto check on load
checkUpdates();
