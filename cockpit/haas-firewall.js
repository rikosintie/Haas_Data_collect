(function () {
    "use strict";

    window.haas_firewall_loaded = true;
    console.log("haas-firewall.js LOADED");

    let csvPath = null;
    let backupDir = null;

    function bindUI(cockpit) {
        console.log("bindUI() running");

        const out = document.getElementById("output");
        const backupInput = document.getElementById("backup-name");
        const spinner = document.getElementById("spinner");

        /* -----------------------------
         *  Output Helpers
         * ----------------------------- */
        function appendOutput(text) {
            if (!out) {
                console.error("Output element not found");
                return;
            }

            let cls = "info";
            if (text.includes("[ERROR]")) cls = "error";
            if (text.includes("Command completed")) cls = "success";

            const now = new Date().toISOString();
            const line = `<span class="${cls}">[${now}] ${text}</span><br>`;
            out.innerHTML += line;
            out.scrollTop = out.scrollHeight;
        }

        function setOutput(text) {
            if (!out) {
                console.error("Output element not found");
                return;
            }
            out.innerHTML = text ? `<span class="info">${text}</span><br>` : "";
        }

        /* -----------------------------
         *  Spinner Helpers
         * ----------------------------- */
        function showSpinner() {
            if (spinner) spinner.classList.remove("hidden");
        }

        function hideSpinner() {
            if (spinner) spinner.classList.add("hidden");
        }

        /* -----------------------------
         *  Load Config File
         * ----------------------------- */
        cockpit.file("/etc/haas-firewall.conf").read()
            .then(text => {
                const csvMatch = text.match(/CSV_PATH="?(.*)"?/);
                const backupMatch = text.match(/BACKUP_DIR="?(.*)"?/);

                if (csvMatch) {
                    csvPath = csvMatch[1].trim();
                    console.log("Loaded CSV_PATH:", csvPath);
                }

                if (backupMatch) {
                    backupDir = backupMatch[1].trim();
                    console.log("Loaded BACKUP_DIR:", backupDir);
                }
            })
            .catch(err => {
                console.error("Failed to read config:", err);
                appendOutput("[ERROR] Could not read /etc/haas-firewall.conf");
            });

        /* -----------------------------
         *  Limited Mode Banner
         * ----------------------------- */
        if (!cockpit.user["is-superuser"]) {
            const banner = document.createElement("div");
            banner.className = "warning-banner";
            banner.textContent = "Limited access mode: Commands requiring root may fail.";
            document.body.prepend(banner);
        }

        /* -----------------------------
         *  Command Runner
         * ----------------------------- */
        function runCommand(label, cmd, args) {
            showSpinner();
            setOutput(`Running: ${label}\nCommand: ${cmd} ${args.join(" ")}\n\n`);

            const proc = cockpit.spawn([cmd].concat(args), {
                superuser: "require",
                err: "out"
            });

            proc.stream(data => appendOutput(data));

            proc.done(() => {
                appendOutput("[INFO] Command completed successfully.");
                hideSpinner();
            });

            proc.fail(ex => {
                appendOutput(`[ERROR] Command failed: ${ex}`);
                hideSpinner();
            });
        }

        /* -----------------------------
         *  Button Bindings
         * ----------------------------- */
        const btnDryRun = document.getElementById("btn-dry-run");
        const btnCompare = document.getElementById("btn-compare");
        const btnShowRules = document.getElementById("btn-show-rules");
        const btnRollback = document.getElementById("btn-rollback");
        const btnEditCsv = document.getElementById("btn-edit-csv");
        const btnClear = document.getElementById("btn-clear");

        if (!btnDryRun || !btnCompare || !btnShowRules || !btnRollback || !btnEditCsv || !btnClear) {
            console.warn("One or more buttons not found in DOM");
        }

        if (btnDryRun) {
            btnDryRun.addEventListener("click", () => {
                runCommand(
                    "Dry-run firewall update",
                    "/usr/local/sbin/configure_ufw_from_csv.sh",
                    ["--dry-run"]
                );
            });
        }

        if (btnCompare) {
            btnCompare.addEventListener("click", () => {
                runCommand(
                    "Compare firewall rules",
                    "/usr/local/sbin/configure_ufw_from_csv.sh",
                    ["--compare"]
                );
            });
        }

        if (btnShowRules) {
            btnShowRules.addEventListener("click", () => {
                runCommand(
                    "Show current UFW rules",
                    "/usr/local/sbin/configure_ufw_from_csv.sh",
                    ["--show-rules"]
                );
            });
        }

        if (btnRollback) {
            btnRollback.addEventListener("click", () => {
                const backupName = backupInput ? backupInput.value.trim() : "";
                if (!backupName) {
                    setOutput("Please enter a backup filename before running rollback.");
                    return;
                }

                if (!backupDir) {
                    appendOutput("[ERROR] BACKUP_DIR not loaded from config.");
                    return;
                }

                runCommand(
                    `Rollback from ${backupName}`,
                    "/usr/local/sbin/rollback_csv.sh",
                    [`${backupDir}/${backupName}`]
                );
            });
        }

        if (btnEditCsv) {
            btnEditCsv.addEventListener("click", () => {
                if (!csvPath) {
                    appendOutput("[ERROR] CSV_PATH not loaded from config.");
                    return;
                }

                const host = (cockpit.transport && cockpit.transport.host) || "localhost";

                cockpit.jump(
                    `/@${host}/terminal`,
                    { command: `nano ${csvPath}` }
                );
            });
        }

        if (btnClear) {
            btnClear.addEventListener("click", () => {
                setOutput("Output cleared.");
            });
        }
    }

    /* -----------------------------
     *  DOM + Cockpit Ready
     * ----------------------------- */
    document.addEventListener("DOMContentLoaded", () => {
        console.log("DOMContentLoaded fired");

        if (!window.cockpit) {
            console.error("cockpit object not available");
            return;
        }

        // Wait for Cockpit transport & iframe context to be fully ready
        window.cockpit.transport.wait(() => {
            console.log("cockpit.transport.wait fired, binding UI");
            bindUI(window.cockpit);
        });
    });

})();
