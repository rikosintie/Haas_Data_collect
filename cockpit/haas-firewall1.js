
(function () {
    const cockpit = window.cockpit;

    document.addEventListener("DOMContentLoaded", function () {
        console.log("Page loaded, initializing...");

        const output = document.getElementById("output");
        const backupInput = document.getElementById("backup-name");
        const statusIndicator = document.getElementById("status-indicator");
        const statusText = document.getElementById("status-text");
        const statusDetail = document.getElementById("status-detail");
        const activeRules = document.getElementById("active-rules");
        const userName = document.getElementById("user-name");
        const userId = document.getElementById("user-id");
        const userGid = document.getElementById("user-gid");
        const userGroups = document.getElementById("user-groups");

        // Get user information
        cockpit.user().then(function (user) {
            userName.textContent = user.name || "Unknown";
            userId.textContent = user.id || "-";
            userGid.textContent = user.gid || "-";
            userGroups.textContent = user.groups ? user.groups.join(", ") : "-";
        }).catch(function (error) {
            console.error("Error getting user info:", error);
            userName.textContent = "Error loading user info";
        });

        // Function to update firewall status
        function updateFirewallStatus() {
            // Check if UFW is active
            cockpit.spawn(["ufw", "status"], { superuser: "require", err: "out" })
                .then(function (output) {
                    const isActive = output.toLowerCase().includes("status: active");

                    if (isActive) {
                        statusIndicator.style.backgroundColor = "#5cb85c"; // Green
                        statusText.textContent = "Firewall: ENABLED";
                        statusDetail.textContent = "Protection active";
                    } else {
                        statusIndicator.style.backgroundColor = "#d9534f"; // Red
                        statusText.textContent = "Firewall: DISABLED";
                        statusDetail.textContent = "Warning: No protection";
                    }

                    // Get numbered rules
                    cockpit.spawn(["ufw", "status", "numbered"], { superuser: "require", err: "out" })
                        .then(function (rulesOutput) {
                            // Extract only the numbered rules (lines with [ ])
                            const lines = rulesOutput.split('\n');
                            const ruleLines = lines.filter(line => line.includes('['));

                            if (ruleLines.length > 0) {
                                // Format the output with proper spacing
                                let formattedRules = "To                         Action      From\n";
                                formattedRules += "--                         ------      ----\n";
                                formattedRules += ruleLines.join('\n');
                                activeRules.textContent = formattedRules;
                            } else {
                                activeRules.textContent = "No rules configured.";
                            }
                        })
                        .catch(function (error) {
                            activeRules.textContent = "Error loading rules: " + error;
                        });
                })
                .catch(function (error) {
                    statusIndicator.style.backgroundColor = "#999"; // Gray
                    statusText.textContent = "Status: UNKNOWN";
                    statusDetail.textContent = "Error checking status: " + error;
                    activeRules.textContent = "Unable to retrieve rules.";
                });
        }

        // Update status immediately and then every 2 seconds
        updateFirewallStatus();
        setInterval(updateFirewallStatus, 2000);

        // Clear output
        document.getElementById("btn-clear").addEventListener("click", function () {
            output.textContent = "Output will appear here...\n";
        });

        // Helper to run commands
        function runCommand(args, label) {
            output.textContent = "Running: " + label + "\nCommand: " + args.join(" ") + "\n\n";

            cockpit.spawn(args, { superuser: "require", err: "out" })
                .stream(function (data) {
                    output.textContent += data;
                    output.scrollTop = output.scrollHeight;
                })
                .then(function () {
                    output.textContent += "\n[SUCCESS] Command completed.\n";
                    output.scrollTop = output.scrollHeight;
                })
                .catch(function (error) {
                    output.textContent += "\n[ERROR] " + error + "\n";
                    output.scrollTop = output.scrollHeight;
                });
        }

        // Button 1: Dry-run
        document.getElementById("btn-dry-run").addEventListener("click", function () {
            runCommand(["/usr/local/sbin/configure_ufw_from_csv.sh", "--dry-run"], "Dry-run firewall update");
        });

        // Button 2: Compare
        document.getElementById("btn-compare").addEventListener("click", function () {
            runCommand(["/usr/local/sbin/configure_ufw_from_csv.sh", "--compare"], "Compare firewall rules");
        });

        // Button 3: Show rules
        document.getElementById("btn-show-rules").addEventListener("click", function () {
            runCommand(["/usr/local/sbin/configure_ufw_from_csv.sh", "--show-rules"], "Show current UFW rules");
        });

        // Button 4: Reset firewall
        document.getElementById("btn-reset").addEventListener("click", function () {
            if (!confirm("This will reset ALL firewall rules! Are you sure?")) {
                return;
            }
            output.textContent = "Resetting firewall...\n";

            cockpit.spawn(["/bin/bash", "-c", "echo 'y' | ufw reset"], { superuser: "require", err: "out" })
                .stream(function (data) {
                    output.textContent += data;
                    output.scrollTop = output.scrollHeight;
                })
                .then(function () {
                    output.textContent += "\n[SUCCESS] Firewall reset completed.\n";
                    output.scrollTop = output.scrollHeight;
                })
                .catch(function (error) {
                    output.textContent += "\n[ERROR] " + error + "\n";
                    output.scrollTop = output.scrollHeight;
                });
        });

        // Button 5: Apply firewall changes
        document.getElementById("btn-apply").addEventListener("click", function () {
            const autoReset = document.getElementById("auto-reset").checked;
            const useCustom = document.getElementById("use-custom-csv").checked;
            const customPath = document.getElementById("custom-csv-path").value.trim();

            if (useCustom && !customPath) {
                output.textContent = "Please enter a custom CSV file path or uncheck the option.\n";
                return;
            }

            if (!confirm("This will apply firewall changes. Continue?")) {
                return;
            }

            // Determine which file to check and which command to run
            let configCommand;
            let fileToCheck;

            if (useCustom) {
                configCommand = ["/usr/local/sbin/configure_ufw_from_csv.sh", customPath];
                fileToCheck = customPath;
            } else {
                configCommand = ["/usr/local/sbin/configure_ufw_from_csv.sh"];
                fileToCheck = "/home/mhubbard/test/Haas_Data_collect/users.csv";
            }

            // CRITICAL: Check if CSV file exists BEFORE resetting firewall
            output.textContent = "Validating CSV file path...\n";

            cockpit.spawn(["test", "-f", fileToCheck], { err: "out" })
                .then(function () {
                    // File exists - safe to proceed
                    output.textContent += "[OK] CSV file found: " + fileToCheck + "\n\n";

                    if (autoReset) {
                        // Step 1: Reset firewall
                        output.textContent += "Step 1: Resetting firewall...\n";
                        cockpit.spawn(["/bin/bash", "-c", "echo 'y' | ufw reset"], { superuser: "require", err: "out" })
                            .stream(function (data) {
                                output.textContent += data;
                                output.scrollTop = output.scrollHeight;
                            })
                            .then(function () {
                                output.textContent += "\n[SUCCESS] Firewall reset completed.\n";
                                output.textContent += "\nStep 2: Applying new rules from " + fileToCheck + "...\n";
                                output.scrollTop = output.scrollHeight;

                                // Step 2: Apply new rules
                                cockpit.spawn(configCommand, { superuser: "require", err: "out" })
                                    .stream(function (data) {
                                        output.textContent += data;
                                        output.scrollTop = output.scrollHeight;
                                    })
                                    .then(function () {
                                        output.textContent += "\n[SUCCESS] Firewall configuration completed.\n";
                                        output.scrollTop = output.scrollHeight;
                                    })
                                    .catch(function (error) {
                                        output.textContent += "\n[ERROR] Failed to apply rules: " + error + "\n";
                                        output.scrollTop = output.scrollHeight;
                                    });
                            })
                            .catch(function (error) {
                                output.textContent += "\n[ERROR] Reset failed: " + error + "\n";
                                output.scrollTop = output.scrollHeight;
                            });
                    } else {
                        // Just apply without reset
                        runCommand(configCommand, "Apply firewall changes from " + fileToCheck);
                    }
                })
                .catch(function () {
                    // File does NOT exist - abort before touching firewall
                    output.textContent += "\n[ERROR] CSV file not found: " + fileToCheck + "\n";
                    output.textContent += "\nPlease verify the file path and try again.\n";
                    output.textContent += "Firewall was NOT modified.\n";
                    output.scrollTop = output.scrollHeight;
                });
        });

        // Button 6: Edit CSV
        document.getElementById("btn-edit-csv").addEventListener("click", function () {
            const csvPath = "/home/mhubbard/test/Haas_Data_collect/users.csv";
            output.textContent = "Loading " + csvPath + "...\n";

            cockpit.file(csvPath, { superuser: "require" })
                .read()
                .then(function (content) {
                    const textarea = document.createElement("textarea");
                    textarea.id = "csv-editor";
                    textarea.className = "csv-editor";
                    textarea.value = content;

                    const saveBtn = document.createElement("button");
                    saveBtn.textContent = "Save Changes";
                    saveBtn.className = "btn";

                    const cancelBtn = document.createElement("button");
                    cancelBtn.textContent = "Cancel";
                    cancelBtn.className = "btn";

                    const btnContainer = document.createElement("div");
                    btnContainer.className = "button-row";
                    btnContainer.appendChild(saveBtn);
                    btnContainer.appendChild(cancelBtn);

                    output.innerHTML = "";
                    output.appendChild(textarea);
                    output.appendChild(btnContainer);

                    saveBtn.addEventListener("click", function () {
                        const newContent = textarea.value;
                        cockpit.file(csvPath, { superuser: "require" })
                            .replace(newContent)
                            .then(function () {
                                output.textContent = "File saved successfully!\n";
                            })
                            .catch(function (error) {
                                output.textContent = "Error saving file: " + error + "\n";
                            });
                    });

                    cancelBtn.addEventListener("click", function () {
                        output.textContent = "Edit cancelled.\n";
                    });
                })
                .catch(function (error) {
                    output.textContent = "Error reading file: " + error + "\n";
                });
        });

        // Button 7: Rollback
        document.getElementById("btn-rollback").addEventListener("click", function () {
            const backupName = backupInput.value.trim();
            if (!backupName) {
                output.textContent = "Please enter a backup filename.\n";
                return;
            }
            runCommand(["/usr/local/sbin/rollback_csv.sh", backupName], "Rollback from " + backupName);
        });

        console.log("All buttons initialized successfully");
    });
})();
