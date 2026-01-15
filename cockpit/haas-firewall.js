window.haas_firewall_loaded = true;
console.log("haas-firewall.js LOADED");
console.log("JS loaded, entering cockpitReady()");
cockpitReady((cockpit) => {
    console.log("cockpitReady() callback fired");
    bindUI(cockpit);
});

(function () {
    "use strict";

    // Global debug marker
    window.haas_firewall_loaded = true;
    console.log("haas-firewall.js LOADED");

    // Wait for Cockpit to be ready
    function cockpitReady(callback) {
        console.log("cockpitReady() waiting…");

        const check = setInterval(() => {
            if (window.cockpit && window.cockpit.transport) {
                clearInterval(check);
                console.log("cockpitReady() callback fired");

                window.cockpit.transport.wait(() => {
                    callback(window.cockpit);
                });
            }
        }, 50);
    }

    // Main UI binding function
    function bindUI(cockpit) {
        console.log("bindUI() running");

        const out = document.getElementById("output");
        const backupInput = document.getElementById("backup-name");

        function appendOutput(text) {
            if (!out) return;
            const now = new Date().toISOString();
            out.textContent += `\n[${now}] ${text}`;
            out.scrollTop = out.scrollHeight;
        }

        function setOutput(text) {
            if (!out) return;
            out.textContent = text;
        }

        function runCommand(label, cmd, args) {
            setOutput(`Running: ${label}\nCommand: ${cmd} ${args.join(" ")}\n\n`);

            const proc = cockpit.spawn([cmd].concat(args), {
                superuser: "require",
                err: "out"
            });

            proc.stream(data => appendOutput(data));
            proc.done(() => appendOutput("\n[INFO] Command completed successfully."));
            proc.fail(ex => appendOutput(`\n[ERROR] Command failed: ${ex}`));
        }

        // Button bindings
        document.getElementById("btn-dry-run")?.addEventListener("click", () => {
            runCommand("Dry-run firewall update", "/usr/local/sbin/configure_ufw_from_csv.sh", ["--dry-run"]);
        });

        document.getElementById("btn-compare")?.addEventListener("click", () => {
            runCommand("Compare firewall rules", "/usr/local/sbin/configure_ufw_from_csv.sh", ["--compare"]);
        });

        document.getElementById("btn-show-rules")?.addEventListener("click", () => {
            runCommand("Show current UFW rules", "/usr/local/sbin/configure_ufw_from_csv.sh", ["--show-rules"]);
        });

        document.getElementById("btn-rollback")?.addEventListener("click", () => {
            const backupName = backupInput?.value.trim();
            if (!backupName) {
                setOutput("Please enter a backup filename before running rollback.");
                return;
            }
            runCommand(`Rollback from ${backupName}`, "/usr/local/sbin/rollback_csv.sh", [backupName]);
        });
    }

    // Start everything once DOM is ready
    document.addEventListener("DOMContentLoaded", () => {
        console.log("DOMContentLoaded fired");
        cockpitReady(bindUI);
    });

})();
