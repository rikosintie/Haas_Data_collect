(function () {
    "use strict";

    window.haas_firewall_loaded = true;
    console.log("haas-firewall.js LOADED");

    let csvPath = null;
    let backupDir = null;

    function haasReady(callback) {
        console.log("haasReady() firing immediately");
        callback(window.cockpit);
    }

    function bindUI(cockpit) {
        console.log("bindUI() running");

        const out = document.getElementById("output");
        const backupInput = document.getElementById("backup-name");
        const spinner = document.getElementById("spinner");

        /* -----------------------------
         *  Output Helpers
         * ----------------------------- */
        function appendOutput(text) {
            if (!out) return;

            let cls = "info";
            if (text.includes("[ERROR]")) cls = "error";
            if (text.includes("Command completed")) cls = "success";

            const now = new Date().toISOString();
            const line = `<span class="${cls}">[${now}] ${text}</span><br>`;
            out.innerHTML += line;
            out.scrollTop = out.scrollHeight;
        }

        function setOutput(text) {
            if (!out) return;
            out.innerHTML = text ? `<span class="info">${text}</span><br>` : "";
        }

        /* -----------------------------
         *  Spinner Helpers
         * ----------------------------- */
        function showSpinner() {
            spinner?.classList.remove("hidden");
        }

        function hideSpinner() {
            spinner?.classList.add("hidden");
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
        document.getElementById("btn-dry-run")?.addEventListener("click", () => {
            runCommand("Dry-run firewall update",
                "/usr/local/sbin/configure_ufw_from_csv.sh",
                ["--dry-run"]);
        });

        document.getElementById("btn-compare")?.addEventListener("click", () => {
            runCommand("Compare firewall rules",
                "/usr/local/sbin/configure_ufw_from_csv.sh",
                ["--compare"]);
        });

        document.getElementById("btn-show-rules")?.addEventListener("click", () => {
            runCommand("Show current UFW rules",
                "/usr/local/sbin/configure_ufw_from_csv.sh",
                ["--show-rules"]);
        });

        document.getElementById("btn-rollback")?.addEventListener("click", () => {
            const backupName = backupInput?.value.trim();
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

        /* -----------------------------
         *  Edit CSV Button (host-aware)
         * ----------------------------- */
        document.getElementById("btn-edit-csv")?.addEventListener("click", () => {
            if (!csvPath) {
                appendOutput("[ERROR] CSV_PATH not loaded from config.");
                return;
            }

            const host = cockpit.transport.host;
            if (!host) {
                appendOutput("[ERROR] Could not determine Cockpit host.");
                return;
            }

            cockpit.jump(
                `/@${host}/terminal`,
                { command: `nano ${csvPath}` }
            );
        });

        /* -----------------------------
         *  Clear Output
         * ----------------------------- */
        document.getElementById("btn-clear")?.addEventListener("click", () => {
            setOutput("Output cleared.");
        });
    }

    /* -----------------------------
     *  DOM Ready
     * ----------------------------- */
    document.addEventListener("DOMContentLoaded", () => {
        console.log("DOMContentLoaded fired");
        haasReady(bindUI);
    });

})();
