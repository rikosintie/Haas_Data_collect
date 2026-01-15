(function () {
    "use strict";

    document.addEventListener("DOMContentLoaded", () => {

        cockpit.transport.wait(() => {
            const cockpit = window.cockpit;

            if (!cockpit) {
                console.error("Cockpit API not loaded");
                return;
            }

            function appendOutput(text) {
                const out = document.getElementById("output");
                if (!out) return;
                const now = new Date().toISOString();
                out.textContent += `\n[${now}] ${text}`;
                out.scrollTop = out.scrollHeight;
            }

            function setOutput(text) {
                const out = document.getElementById("output");
                if (!out) return;
                out.textContent = text;
            }

            function runCommand(description, cmd, args) {
                setOutput(`Running: ${description}\nCommand: ${cmd} ${args.join(" ")}\n\n`);

                const proc = cockpit.spawn([cmd].concat(args), {
                    superuser: "require",
                    err: "out"
                });

                proc.stream(data => appendOutput(data));
                proc.done(() => appendOutput("\n[INFO] Command completed successfully."));
                proc.fail(ex => appendOutput(`\n[ERROR] Command failed: ${ex}`));
            }

            function onReady() {
                const btnDryRun = document.getElementById("btn-dry-run");
                const btnCompare = document.getElementById("btn-compare");
                const btnShowRules = document.getElementById("btn-show-rules");
                const btnRollback = document.getElementById("btn-rollback");
                const backupInput = document.getElementById("backup-name");

                if (btnDryRun) {
                    btnDryRun.addEventListener("click", () => {
                        runCommand(
                            "Simulate firewall update (dry-run)",
                            "/usr/local/sbin/configure_ufw_from_csv.sh",
                            ["--dry-run"]
                        );
                    });
                }

                if (btnCompare) {
                    btnCompare.addEventListener("click", () => {
                        runCommand(
                            "Compare current vs planned firewall rules",
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

                if (btnRollback && backupInput) {
                    btnRollback.addEventListener("click", () => {
                        const backupName = backupInput.value.trim();
                        if (!backupName) {
                            setOutput("Please enter a backup filename before running rollback.");
                            return;
                        }

                        runCommand(
                            `Rollback CSV from backup ${backupName}`,
                            "/usr/local/sbin/rollback_csv.sh",
                            [backupName]
                        );
                    });
                }
            }

            onReady();
        });
    });
})()
