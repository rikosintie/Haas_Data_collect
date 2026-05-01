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

var liveLogProcess = null;
var isUfwLive = false;

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
    cockpitLogBtn.disabled = state;
    sshLogBtn.disabled = state;
    sambaLogBtn.disabled = state;
    authLogBtn.disabled = state;
    ufwLiveBtn.disabled = state;
    if (state) stopLogBtn.disabled = true;
}

function onLiveLogEnd() {
    liveLogProcess = null;
    stopLogBtn.disabled = true;
    isUfwLive = false;
    setUfwFilterEnabled(false);
}

function stopLiveLog() {
    if (liveLogProcess) {
        liveLogProcess.close("terminated");
        liveLogProcess = null;
    }
    stopLogBtn.disabled = true;
    isUfwLive = false;
    setUfwFilterEnabled(false);
}

function startLiveLog(args, label) {
    stopLiveLog();
    output.textContent = "--- " + label + " (live) ---\n";
    output.scrollTop = 0;
    stopLogBtn.disabled = false;

    liveLogProcess = cockpit.spawn(args, { superuser: "require", err: "message" })
        .stream(function(data) {
            output.textContent += data;
            output.scrollTop = output.scrollHeight;
        })
        .done(function() {
            output.textContent += "\n[Stream ended]\n";
            onLiveLogEnd();
        })
        .fail(function(ex) {
            if (ex.problem !== "terminated") {
                output.textContent += "\nERROR: " + (ex.message || JSON.stringify(ex));
            }
            onLiveLogEnd();
        });
}

function startUfwLive() {
    var filter = document.querySelector("input[name='ufwFilter']:checked").value;
    var typeFilter, label;

    if (filter === "block") {
        typeFilter = "UFW BLOCK"; label = "UFW Live — BLOCK";
    } else if (filter === "allow") {
        typeFilter = "UFW ALLOW"; label = "UFW Live — ALLOW";
    } else if (filter === "audit") {
        typeFilter = "UFW AUDIT"; label = "UFW Live — Audit";
    } else {
        typeFilter = "UFW "; label = "UFW Live — All";
    }

    var cmd = "tail -f /var/log/syslog" +
              " | grep --line-buffered -E '" + typeFilter + "'" +
              " | grep --line-buffered -Ev 'DST=224\\.'";

    isUfwLive = true;
    setUfwFilterEnabled(true);
    startLiveLog(["bash", "-c", cmd], label);
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
        ["bash", "-c", "journalctl -u cockpit -n 50 -f --no-pager | grep -v 'gnutls_handshake failed'"],
        "Cockpit Log"
    );
});

sshLogBtn.addEventListener("click", function() {
    startLiveLog(
        ["journalctl", "-u", "ssh", "-n", "50", "-f", "--no-pager"],
        "SSH Log"
    );
});

sambaLogBtn.addEventListener("click", function() {
    startLiveLog(
        ["journalctl", "-u", "smbd", "-n", "50", "-f", "--no-pager"],
        "Samba Log"
    );
});

authLogBtn.addEventListener("click", function() {
    startLiveLog(
        ["tail", "-n", "50", "-f", "/var/log/auth.log"],
        "Auth Log"
    );
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

// Auto check on load
checkUpdates();
