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

// Auto check on load
checkUpdates();
