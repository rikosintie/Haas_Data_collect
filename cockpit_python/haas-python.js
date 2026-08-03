const output = document.getElementById("output");

const scriptsLogBtn = document.getElementById("scriptsLogBtn");
const stopLogBtn    = document.getElementById("stopLogBtn");

const serviceStateBtn      = document.getElementById("serviceStateBtn");
const editServicesBtn      = document.getElementById("editServicesBtn");
const createServiceBtn     = document.getElementById("createServiceBtn");
const deleteServiceBtn     = document.getElementById("deleteServiceBtn");
const dataFreshnessBtn     = document.getElementById("dataFreshnessBtn");
const servicesList         = document.getElementById("servicesList");
const serviceEditorSection = document.getElementById("serviceEditorSection");
const serviceEditorArea    = document.getElementById("serviceEditorArea");
const serviceEditorLabel   = document.getElementById("serviceEditorLabel");
const editorValidationMsg  = document.getElementById("editorValidationMsg");
const saveServiceBtn       = document.getElementById("saveServiceBtn");
const cancelServiceEditBtn = document.getElementById("cancelServiceEditBtn");
const createServiceForm    = document.getElementById("createServiceForm");
const svcDescription       = document.getElementById("svcDescription");
const svcName              = document.getElementById("svcName");
const svcIpAddress         = document.getElementById("svcIpAddress");
const svcPort              = document.getElementById("svcPort");

const HAAS_SYSTEMD_DIR = "/etc/systemd/system";

// Same pipeline as the haas-ports shell alias (haas-aliases.zsh), plus a
// duplicate-port check: two services both pointing "-t <ip> --port <port>"
// at the same address means one of them is very likely misconfigured
// against the wrong machine — the kind of thing that shows up as "this
// CNC just isn't writing a CSV" without an obvious error to explain why.
var HAAS_PORTS_SCRIPT = [
    "echo",
    "echo \"--- IP / Port / Name (from " + HAAS_SYSTEMD_DIR + "/haas-*.service) ---\"",
    "grep -Ei \"python3\" " + HAAS_SYSTEMD_DIR + "/haas*.service 2>/dev/null | cut -d' ' -f4- | sort -k 3 |",
    "awk '{",
    "    port=\"\"; name=\"\";",
    "    for (i=1;i<=NF;i++) {",
    "        if ($i==\"--port\") port=$(i+1);",
    "        if ($i==\"--name\") name=$(i+1);",
    "    }",
    "    print;",
    "    if (port != \"\") { count[port]++; names[port]=names[port]\" \"name }",
    "}",
    "END {",
    "    dup=0",
    "    for (p in count) if (count[p] > 1) { print \"  [DUPLICATE PORT] \" p \":\" names[p]; dup=1 }",
    "    if (dup == 0) print \"No duplicate ports found.\"",
    "}'"
].join("\n");

// One-shot TCP reachability check (nc -z) per service's "-t <ip> --port
// <port>". Run on demand from Service State, not automatically after
// Create Service — during initial deployment an MSP will often create
// every service before the machine shop has configured the actual CNCs
// to connect, so "not reachable" there would just be the normal,
// expected state rather than a problem to chase.
//
// A machine already showing an ESTABLISHED connection from a python3
// process to its ip:port is skipped rather than probed. Some CNC control
// network stacks are minimal enough to only accept one connection at a
// time; an extra probe against a machine that's already connected and
// streaming risks contending with (or even displacing) that real
// connection instead of just testing an idle port.
var HAAS_CONNECTIVITY_SCRIPT = [
    "echo",
    "echo \"--- Connectivity Check (nc -z, 2s timeout per machine) ---\"",
    "echo \"Note: 'not reachable' is expected until the machine/CNC is actually configured to connect on that port -- it isn't necessarily an error.\"",
    "echo",
    "established=$(ss -tnp state established 2>/dev/null)",
    "grep -Ei \"python3\" " + HAAS_SYSTEMD_DIR + "/haas*.service 2>/dev/null | cut -d' ' -f4- | sort -k 3 |",
    "while read -r line; do",
    "    ip=\"\"; port=\"\"; name=\"\"",
    "    set -- $line",
    "    while [ $# -gt 0 ]; do",
    "        case \"$1\" in",
    "            --port) port=\"$2\"; shift 2 ;;",
    "            --name) name=\"$2\"; shift 2 ;;",
    "            -t) ip=\"$2\"; shift 2 ;;",
    "            *) shift ;;",
    "        esac",
    "    done",
    "",
    "    if [ -z \"$ip\" ] || [ -z \"$port\" ]; then",
    "        continue",
    "    fi",
    "",
    "    if echo \"$established\" | awk -v target=\"$ip:$port\" '$4==target && /python3/ {found=1} END{exit !found}'; then",
    "        printf \"%-15s %s:%-6s already connected (skipped probe)\\n\" \"$name\" \"$ip\" \"$port\"",
    "        continue",
    "    fi",
    "",
    "    if nc -z -w 2 \"$ip\" \"$port\" 2>/dev/null; then",
    "        printf \"%-15s %s:%-6s reachable\\n\" \"$name\" \"$ip\" \"$port\"",
    "    else",
    "        printf \"%-15s %s:%-6s not reachable\\n\" \"$name\" \"$ip\" \"$port\"",
    "    fi",
    "done"
].join("\n");

const HAAS_MACHINES_DIR = "/home/haas/Haas_Data_collect/machines";

// For each machine directory, finds the newest file under its cnc_logs/
// (however it was set up — append mode or per-cycle files, doesn't
// matter, just the most recently modified one) and lists them oldest
// first, so a machine that's silently stopped writing data floats to the
// top instead of only being noticed when someone goes looking for it.
var HAAS_DATA_FRESHNESS_SCRIPT = [
    "base=\"" + HAAS_MACHINES_DIR + "\"",
    "now=$(date +%s)",
    "",
    "for dir in \"$base\"/*/; do",
    "    [ -d \"$dir\" ] || continue",
    "    machine=$(basename \"$dir\")",
    "    logdir=\"${dir}cnc_logs\"",
    "",
    "    if [ ! -d \"$logdir\" ]; then",
    "        echo \"0|$machine|no cnc_logs directory yet\"",
    "        continue",
    "    fi",
    "",
    "    newest_ts=$(find \"$logdir\" -maxdepth 1 -type f -printf '%T@\\n' 2>/dev/null | sort -rn | head -1)",
    "    newest_ts=${newest_ts%.*}",
    "",
    "    if [ -z \"$newest_ts\" ]; then",
    "        echo \"0|$machine|no data files found\"",
    "        continue",
    "    fi",
    "",
    "    age=$(( now - newest_ts ))",
    "    if [ $age -lt 60 ]; then agestr=\"${age}s ago\"",
    "    elif [ $age -lt 3600 ]; then agestr=\"$((age / 60))m ago\"",
    "    elif [ $age -lt 86400 ]; then agestr=\"$((age / 3600))h ago\"",
    "    else agestr=\"$((age / 86400))d ago\"",
    "    fi",
    "",
    "    when=$(date -d @\"$newest_ts\" '+%Y-%m-%d %H:%M:%S')",
    "    echo \"$newest_ts|$machine|$when ($agestr)\"",
    "done | sort -t'|' -k1,1n | awk -F'|' '{printf \"%-15s %s\\n\", $2, $3}'"
].join("\n");

var currentServicePath = null;
var isCreatingService = false;
var serviceListMode = "edit"; // "edit" or "delete"

var liveLogProcess = null;
var isScriptsLive = false;
var logSessionId = 0;

function setScriptsFilterEnabled(state) {
    document.getElementById("scriptsIpFilter").disabled = !state;
    document.getElementById("scriptsPortFilter").disabled = !state;
}

function disableButtons(state) {
    scriptsLogBtn.disabled = state;
    if (state) stopLogBtn.disabled = true;
    serviceStateBtn.disabled = state;
    editServicesBtn.disabled = state;
    createServiceBtn.disabled = state;
    deleteServiceBtn.disabled = state;
    dataFreshnessBtn.disabled = state;
}

// Show the service editor, hiding the output <pre>
function showServiceEditor(path, content) {
    currentServicePath = path;
    serviceEditorLabel.textContent = path + " — edit below, then click Save & Restart";
    saveServiceBtn.textContent = "Save & Restart";
    editorValidationMsg.classList.add("hidden");
    serviceEditorArea.value = content;
    output.classList.add("hidden");
    serviceEditorSection.classList.remove("hidden");
    // Lock everything else while editing; keep save/cancel accessible
    disableButtons(true);
    saveServiceBtn.disabled = false;
    cancelServiceEditBtn.disabled = false;
}

// Hide the service editor, restoring the output <pre>
function hideServiceEditor() {
    serviceEditorSection.classList.add("hidden");
    createServiceForm.classList.add("hidden");
    serviceEditorArea.classList.remove("hidden");
    editorValidationMsg.classList.add("hidden");
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
    saveServiceBtn.textContent = "Save & Reload";
    editorValidationMsg.classList.add("hidden");
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
    isScriptsLive = false;
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
    isScriptsLive = false;
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

scriptsLogBtn.addEventListener("click", startScriptsLive);

// Real-time filtering: these values feed journalctl's --grep= regex, so
// keeping them digits/dots-only (a real IP or port never needs anything
// else) closes off any pathological-regex input entirely, not just the
// common cases — a paste is filtered the same as typing.
document.getElementById("scriptsIpFilter").addEventListener("input", function() {
    var el = this;
    var pos = el.selectionStart;
    var cleaned = el.value.replace(/[^0-9.]/g, "");
    if (cleaned !== el.value) {
        el.value = cleaned;
        el.setSelectionRange(pos - 1, pos - 1);
    }
});

document.getElementById("scriptsPortFilter").addEventListener("input", function() {
    var el = this;
    var pos = el.selectionStart;
    var cleaned = el.value.replace(/[^0-9]/g, "");
    if (cleaned !== el.value) {
        el.value = cleaned;
        el.setSelectionRange(pos - 1, pos - 1);
    }
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
    // Locked for the whole run, including the connectivity sweep below —
    // it can take a couple seconds per machine, and a re-click mid-run
    // would stack a second overlapping sweep against the same targets.
    disableButtons(true);
    output.textContent = "--- Haas Service Status ---\n";
    output.textContent += "Files are located in " + HAAS_SYSTEMD_DIR + "\n\n";

    cockpit.spawn(
        ["bash", "-c", "systemctl list-unit-files --type=service | grep haas"],
        { superuser: "require", err: "message" }
    )
        .done(function(data) {
            output.textContent += data || "(no haas services found)";

            cockpit.spawn(["bash", "-c", HAAS_PORTS_SCRIPT], { superuser: "require", err: "message" })
                .done(function(portData) {
                    output.textContent += portData;
                    output.textContent += "\nRunning connectivity check (this can take several seconds)...\n";

                    cockpit.spawn(["bash", "-c", HAAS_CONNECTIVITY_SCRIPT], { superuser: "require", err: "message" })
                        .done(function(connData) {
                            output.textContent += connData;
                        })
                        .fail(function(ex, data3) {
                            output.textContent += "\nERROR checking connectivity: " + (ex.message || JSON.stringify(ex));
                            if (data3) output.textContent += "\n" + data3;
                        })
                        .always(function() {
                            setActiveLogBtn(null);
                            disableButtons(false);
                        });
                })
                .fail(function(ex, data2) {
                    output.textContent += "\nERROR checking ports: " + (ex.message || JSON.stringify(ex));
                    if (data2) output.textContent += "\n" + data2;
                    setActiveLogBtn(null);
                    disableButtons(false);
                });
        })
        .fail(function(ex, data) {
            output.textContent += "\nERROR: " + (ex.message || JSON.stringify(ex));
            if (data) output.textContent += "\n" + data;
            setActiveLogBtn(null);
            disableButtons(false);
        });
});

// ── Data Freshness ────────────────────────────────────────────────────────────

dataFreshnessBtn.addEventListener("click", function() {
    stopLiveLog();
    setActiveLogBtn(dataFreshnessBtn);
    output.textContent = "--- Data Freshness (newest file in each machine's cnc_logs/) ---\n\n";

    cockpit.spawn(["bash", "-c", HAAS_DATA_FRESHNESS_SCRIPT], { superuser: "require", err: "message" })
        .done(function(data) {
            output.textContent += data || "(no machine directories found under " + HAAS_MACHINES_DIR + ")";
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
                    // Every entry here is "haas-<machine>.service" (the ls
                    // glob guarantees the prefix/suffix), so both are dead
                    // weight in the label — with 20-99 machines, they'd
                    // also defeat the browser's native type-ahead (jump to
                    // an option by typing its first letters), since every
                    // option would start with the same "haas-" text. With
                    // the prefix/suffix stripped, "s" jumps straight to
                    // st10y/st30/st40/etc, no custom filtering UI needed.
                    opt.textContent = f
                        .replace("/etc/systemd/system/haas-", "")
                        .replace(/\.service$/, "");
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

svcIpAddress.addEventListener("input", function() {
    var pos = svcIpAddress.selectionStart;
    var cleaned = svcIpAddress.value.replace(/[^0-9.]/g, "");
    if (cleaned !== svcIpAddress.value) {
        svcIpAddress.value = cleaned;
        svcIpAddress.setSelectionRange(pos - 1, pos - 1);
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
        if (!/^\d+$/.test(port) || portNum < 5001 || portNum > 5099) {
            output.textContent = "ERROR: Port must be an integer between 5001 and 5099 (Haas's recommended TCP/IP port range).\n";
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

                                                        cockpit.spawn(["bash", "-c", HAAS_PORTS_SCRIPT], { superuser: "require", err: "message" })
                                                            .done(function(portData) {
                                                                output.textContent += "\n" + portData;
                                                            })
                                                            .fail(function(ex, data2) {
                                                                output.textContent += "\nERROR checking ports: " + (ex.message || JSON.stringify(ex));
                                                                if (data2) output.textContent += "\n" + data2;
                                                            });
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

    if (!confirm("This will overwrite " + path + " and restart " + editedService + ". Continue?")) {
        return;
    }

    hideServiceEditor();
    output.textContent = "Saving " + path + "...\n";

    cockpit.file(path, { superuser: "require" })
        .replace(content)
        .done(function() {
            output.textContent += "Saved. Running systemctl daemon-reload...\n";

            cockpit.spawn(["systemctl", "daemon-reload"], { superuser: "require", err: "message" })
                .done(function() {
                    output.textContent += "daemon-reload complete. Restarting " + editedService + "...\n";
                    cockpit.spawn(["systemctl", "restart", editedService], { superuser: "require", err: "message" })
                        .done(function() {
                            output.textContent += editedService + " restarted.\n\n--- systemctl status ---\n";
                            cockpit.spawn(["systemctl", "status", editedService], { superuser: "require", err: "message" })
                                .done(function(data) {
                                    output.textContent += data;
                                })
                                .fail(function(ex, data) {
                                    if (data) output.textContent += data;
                                });
                        })
                        .fail(function(ex, data) {
                            output.textContent += "restart failed: " + (ex.message || JSON.stringify(ex)) + "\n";
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

// Show "Ready" state on load
output.textContent = "Ready.";
