const output = document.getElementById("output");
const statusBox = document.getElementById("status");
const tableContainer = document.getElementById("tableContainer");
const lastRun = document.getElementById("lastRun");

const checkBtn = document.getElementById("checkBtn");
const updateBtn = document.getElementById("updateBtn");
const rebootBtn = document.getElementById("rebootBtn");

function setStatus(text, cls) {
    statusBox.className = "status " + cls;
    statusBox.textContent = text;
}

function disableButtons(state) {
    checkBtn.disabled = state;
    updateBtn.disabled = state;
    rebootBtn.disabled = state;
}

function renderTable(data) {
    if (!data.trim()) {
        tableContainer.innerHTML = "";
        return;
    }

    let rows = data.trim().split("\n");
    let html = "<table><tr><th>Package</th><th>Version</th></tr>";

    rows.forEach(function(line) {
        let parts = line.split("|");
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

    try {
        cockpit.spawn(["/usr/local/sbin/update-check.sh"], { superuser: "require" })
            .then(function(data) {
                output.textContent += data;

                let lines = data.split("\n");
                let tableData = lines.filter(function(l) { return l.includes("|"); }).join("\n");

                renderTable(tableData);

                if (data.includes("REBOOT_REQUIRED")) {
                    setStatus("Reboot required", "bad");
                } else if (data.includes("UPDATES_AVAILABLE")) {
                    setStatus("Updates available", "warn");
                } else {
                    setStatus("System up to date", "ok");
                }
            })
            .catch(function(err) {
                output.textContent += "\nERROR:\n" + (err.message || JSON.stringify(err));
                setStatus("Error checking updates", "bad");
            })
            .finally(function() { disableButtons(false); });
    } catch (err) {
        output.textContent += "\nFATAL ERROR:\n" + (err.message || err);
        setStatus("Cockpit API error", "bad");
        disableButtons(false);
    }
}

function runUpdate() {
    disableButtons(true);
    output.textContent = "Installing updates...\n";

    cockpit.spawn(["/usr/local/sbin/update-system.sh"], { superuser: "require" })
        .stream(function(data) { output.textContent += data; })
        .then(function() {
            let now = new Date().toLocaleString();
            lastRun.textContent = "Last updated: " + now;
            checkUpdates();
        })
        .catch(function(err) {
            output.textContent += "\nERROR:\n" + err;
            setStatus("Update failed", "bad");
        })
        .finally(function() { disableButtons(false); });
}

function rebootSystem() {
    if (!confirm("Are you sure you want to reboot the system?")) return;

    disableButtons(true);
    output.textContent = "Rebooting system...\n";

    cockpit.spawn(["reboot"], { superuser: "require" });
}

// Auto check on load
checkUpdates();
