(function() {
    const cockpit = window.cockpit;

    document.addEventListener("DOMContentLoaded", function() {
        console.log("Page loaded, initializing...");

        const output = document.getElementById("output");
        const backupInput = document.getElementById("backup-name");

        // Real-time filtering: backup filenames are always flat names like
        // users_2025-01-13_12-00-00.csv, never a path. Blocking "/" and "."
        // as-you-type is just a UX nicety though — rollback_csv.sh itself is
        // the actual guard against a path-traversal filename reaching cp.
        backupInput.addEventListener("input", function() {
            var pos = backupInput.selectionStart;
            var cleaned = backupInput.value.replace(/[^0-9a-zA-Z_.-]/g, "");
            if (cleaned !== backupInput.value) {
                backupInput.value = cleaned;
                backupInput.setSelectionRange(pos - 1, pos - 1);
            }
        });
        const statusIndicator = document.getElementById("status-indicator");
        const statusText = document.getElementById("status-text");
        const statusDetail = document.getElementById("status-detail");
        const activeRules = document.getElementById("active-rules");
        const rulesHeading = document.getElementById("rules-heading");
        const userName = document.getElementById("user-name");
        const userId = document.getElementById("user-id");
        const userGroups = document.getElementById("user-groups");
        const userShell = document.getElementById("user-shell");
        const fwToggle = document.getElementById("fw-toggle");
        const fwLiveBtn = document.getElementById("fwLiveBtn");
        const stopLogBtn = document.getElementById("stopLogBtn");

        // Live log state
        var liveLogProcess = null;
        var isUfwLive = false;
        var logSessionId = 0;

        if (!fwToggle) {
            console.error("fw-toggle button not found!");
        } else {
            console.log("fw-toggle button found:", fwToggle);
        }

        // Get user information
        cockpit.user().then(function(user) {
            console.log("User object:", user);  // Add this line to see what's in the object
            userName.textContent = user.name || "Unknown";
            userId.textContent = user.id || "-";
            userGroups.textContent = user.groups ? user.groups.join(", ") : "-";
            userShell.textContent = user.shell || "-";
        }).catch(function(error) {
            console.error("Error getting user info:", error);
            userName.textContent = "Error loading user info";
        });

        // Function to update toggle button text based on status indicator
        function updateToggleButton() {
            if (!statusIndicator || !fwToggle) {
                console.error("updateToggleButton: Missing elements", statusIndicator, fwToggle);
                return;
            }

            const bgColor = window.getComputedStyle(statusIndicator).backgroundColor;
            console.log("updateToggleButton: bgColor =", bgColor);

            // Parse RGB values
            const rgbMatch = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
            if (rgbMatch) {
                const r = parseInt(rgbMatch[1]);
                const g = parseInt(rgbMatch[2]);
                const b = parseInt(rgbMatch[3]);

                // Green is around rgb(92, 185, 92) - allow small variance
                if (r > 80 && r < 100 && g > 175 && g < 195 && b > 80 && b < 100) {
                    // Firewall is enabled
                    fwToggle.textContent = "Disable Firewall (for testing)";
                    fwToggle.className = "btn btn-toggle";
                    fwToggle.style.backgroundColor = "#5cb85c";
                    fwToggle.style.color = "white";
                    console.log("Button set to: Disable Firewall (for testing)");
                }
                // Red is around rgb(217, 83, 79)
                else if (r > 200 && r < 230 && g > 70 && g < 100 && b > 70 && b < 100) {
                    // Firewall is disabled
                    fwToggle.textContent = "Enable Firewall";
                    fwToggle.className = "btn btn-toggle";
                    fwToggle.style.backgroundColor = "#d9534f";
                    fwToggle.style.color = "white";
                    console.log("Button set to: Enable Firewall");
                }
                // Gray is around rgb(153, 153, 153)
                else {
                    fwToggle.textContent = "Status Unknown";
                    fwToggle.className = "btn btn-toggle";
                    console.log("Button set to: Status Unknown, color was", bgColor);
                }
            }
        }

        // Toggle button click handler
        fwToggle.addEventListener("click", function() {
            const bgColor = window.getComputedStyle(statusIndicator).backgroundColor;
            const rgbMatch = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);

            if (!rgbMatch) {
                alert("Cannot toggle firewall - status unknown");
                return;
            }

            const r = parseInt(rgbMatch[1]);
            const g = parseInt(rgbMatch[2]);
            const b = parseInt(rgbMatch[3]);

            // Green - firewall is enabled
            if (r > 80 && r < 100 && g > 175 && g < 195 && b > 80 && b < 100) {
                if (!confirm("WARNING: Disabling the firewall will remove ALL rules!\n\nThe appliance will be vulnerable to attack!\n\nAre you absolutely sure?")) {
                    return;
                }
                cockpit.spawn(["ufw", "--force", "disable"], { superuser: "require", err: "out" })
                    .then(function() {
                        console.log("Firewall disabled");
                    })
                    .catch(function(error) {
                        console.error("Error disabling firewall:", error);
                        alert("Error disabling firewall: " + error);
                    });
            }
            // Red - firewall is disabled
            else if (r > 200 && r < 230 && g > 70 && g < 100 && b > 70 && b < 100) {
                if (!confirm("Enable the firewall?\n\nYou will be disconnected if your current IP address isn't in the rules")) {
                    return;
                }
                cockpit.spawn(["ufw", "--force", "enable"], { superuser: "require", err: "out" })
                    .then(function() {
                        console.log("Firewall enabled");
                    })
                    .catch(function(error) {
                        console.error("Error enabling firewall:", error);
                        alert("Error enabling firewall: " + error);
                    });
            } else {
                alert("Cannot toggle firewall - status unknown");
            }
        });

        // Function to update firewall status
        function updateFirewallStatus() {
            cockpit.spawn(["ufw", "status"], { superuser: "require", err: "out" })
                .then(function(output) {
                    const isActive = output.toLowerCase().includes("status: active");

                    if (isActive) {
                        statusIndicator.style.backgroundColor = "#5cb85c";
                        statusText.textContent = "Firewall: ENABLED";
                        statusDetail.textContent = "Protection active";
                    } else {
                        statusIndicator.style.backgroundColor = "#d9534f";
                        statusText.textContent = "Firewall: DISABLED";
                        statusDetail.textContent = "Warning: No protection";
                    }

                    // Update toggle button text
                    setTimeout(updateToggleButton, 100);

                    // Get numbered rules
                    return cockpit.spawn(["ufw", "status", "numbered"], { superuser: "require", err: "out" });
                })
                .then(function(rulesOutput) {
                    // Don't overwrite the live log display
                    if (isUfwLive) return;

                    const lines = rulesOutput.split('\n');
                    const ruleLines = lines.filter(line => line.includes('['));

                    if (ruleLines.length > 0) {
                        let formattedRules = "To                         Action      From\n";
                        formattedRules += "--                         ------      ----\n";
                        formattedRules += ruleLines.join('\n');
                        activeRules.textContent = formattedRules;
                    } else {
                        activeRules.textContent = "No rules configured.";
                    }
                })
                .catch(function(error) {
                    statusIndicator.style.backgroundColor = "#999";
                    statusText.textContent = "Status: UNKNOWN";
                    statusDetail.textContent = "Error checking status";
                    activeRules.textContent = "Unable to retrieve rules.";
                });
        }

        // Update status immediately and then every 2 seconds
        updateFirewallStatus();
        setInterval(updateFirewallStatus, 2000);

        // Resolve BACKUP_DIR from conf and show it in the Rollback section label
        cockpit.spawn(
            ["bash", "-c", "grep -E '^BACKUP_DIR=' /etc/haas-firewall.conf | cut -d'\"' -f2"],
            { superuser: "require", err: "message" }
        )
        .then(function(dir) {
            dir = dir.trim();
            var el = document.getElementById("backup-dir-display");
            el.textContent = dir || "BACKUP_DIR (not set)";
            if (dir) currentBackupDir = dir;
        })
        .catch(function() {
            document.getElementById("backup-dir-display").textContent = "BACKUP_DIR (error reading conf)";
        });

        // Clear output
        document.getElementById("btn-clear").addEventListener("click", function() {
            output.textContent = "Output will appear here...\n";
        });

        // Helper to run commands
        function runCommand(args, label) {
            output.textContent = "Running: " + label + "\nCommand: " + args.join(" ") + "\n\n";

            cockpit.spawn(args, { superuser: "require", err: "out" })
                .stream(function(data) {
                    output.textContent += data;
                    output.scrollTop = output.scrollHeight;
                })
                .then(function() {
                    output.textContent += "\n[SUCCESS] Command completed.\n";
                    output.scrollTop = output.scrollHeight;
                })
                .catch(function(error) {
                    output.textContent += "\n[ERROR] " + error + "\n";
                    output.scrollTop = output.scrollHeight;
                });
        }

        // Button 1: Dry-run
        document.getElementById("btn-dry-run").addEventListener("click", function() {
            runCommand(["/usr/local/sbin/configure_ufw_from_csv.sh", "--dry-run"], "Dry-run firewall update");
        });

        // Button 2: Compare
        document.getElementById("btn-compare").addEventListener("click", function() {
            var csvPath = document.getElementById("compare-csv-path").value.trim();
            if (!csvPath) {
                output.textContent = "Please enter a CSV file path to compare against.\n";
                return;
            }
            runCommand(["/usr/local/sbin/configure_ufw_from_csv.sh", "--compare", csvPath], "Compare firewall rules against " + csvPath);
        });

        // Button 3: Show rules
        document.getElementById("btn-show-rules").addEventListener("click", function() {
            runCommand(["/usr/local/sbin/configure_ufw_from_csv.sh", "--show-rules"], "Show current UFW rules");
        });

        // Button 4: Reset firewall
        document.getElementById("btn-reset").addEventListener("click", function() {
            if (!confirm("This will reset ALL firewall rules! Are you sure?")) {
                return;
            }
            output.textContent = "Resetting firewall...\n";

            cockpit.spawn(["/bin/bash", "-c", "echo 'y' | ufw reset"], { superuser: "require", err: "out" })
                .stream(function(data) {
                    output.textContent += data;
                    output.scrollTop = output.scrollHeight;
                })
                .then(function() {
                    output.textContent += "\n[SUCCESS] Firewall reset completed.\n";
                    output.scrollTop = output.scrollHeight;
                })
                .catch(function(error) {
                    output.textContent += "\n[ERROR] " + error + "\n";
                    output.scrollTop = output.scrollHeight;
                });
        });

        // Button 5: Apply firewall changes
        document.getElementById("btn-apply").addEventListener("click", function() {
            const useCustom = document.getElementById("use-custom-csv").checked;
            const customPath = document.getElementById("custom-csv-path").value.trim();

            if (useCustom && !customPath) {
                output.textContent = "Please enter a custom CSV file path or uncheck the option.\n";
                return;
            }

            if (!confirm("This will reset and reapply firewall rules. Continue?")) {
                return;
            }

            const configCommand = useCustom
                ? ["/usr/local/sbin/configure_ufw_from_csv.sh", customPath]
                : ["/usr/local/sbin/configure_ufw_from_csv.sh"];
            const fileToCheck = useCustom
                ? customPath
                : "/home/haas/Haas_Data_collect/users.csv";

            output.textContent = "Validating CSV file path...\n";

            cockpit.spawn(["test", "-f", fileToCheck], { err: "out" })
                .then(function() {
                    output.textContent += "[OK] CSV file found: " + fileToCheck + "\n\n";
                    runCommand(configCommand, "Apply firewall changes from " + fileToCheck);
                })
                .catch(function() {
                    output.textContent += "[ERROR] CSV file not found: " + fileToCheck + "\n";
                    output.textContent += "Please verify the file path and try again.\n";
                    output.textContent += "Firewall was NOT modified.\n";
                    output.scrollTop = output.scrollHeight;
                });
        });

        // Button 6: Edit CSV
        document.getElementById("btn-edit-csv").addEventListener("click", function() {
            const csvPath = "/home/haas/Haas_Data_collect/users.csv";
            output.textContent = "Loading " + csvPath + "...\n";

            cockpit.file(csvPath, { superuser: "require" })
                .read()
                .then(function(content) {
                    const textarea = document.createElement("textarea");
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

                    saveBtn.addEventListener("click", function() {
                        cockpit.file(csvPath, { superuser: "require" })
                            .replace(textarea.value)
                            .then(function() {
                                output.textContent = "File saved successfully!\n";
                            })
                            .catch(function(error) {
                                output.textContent = "Error saving file: " + error + "\n";
                            });
                    });

                    cancelBtn.addEventListener("click", function() {
                        output.textContent = "Edit cancelled.\n";
                    });
                })
                .catch(function(error) {
                    output.textContent = "Error reading file: " + error + "\n";
                });
        });

        // Button 6b: Edit conf file
        document.getElementById("btn-edit-conf").addEventListener("click", function() {
            const confPath = "/etc/haas-firewall.conf";
            output.textContent = "Loading " + confPath + "...\n";

            cockpit.file(confPath, { superuser: "require" })
                .read()
                .then(function(content) {
                    const textarea = document.createElement("textarea");
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

                    saveBtn.addEventListener("click", function() {
                        cockpit.file(confPath, { superuser: "require" })
                            .replace(textarea.value)
                            .then(function() {
                                output.textContent = "File saved successfully!\n";
                            })
                            .catch(function(error) {
                                output.textContent = "Error saving file: " + error + "\n";
                            });
                    });

                    cancelBtn.addEventListener("click", function() {
                        output.textContent = "Edit cancelled.\n";
                    });
                })
                .catch(function(error) {
                    output.textContent = "Error reading file: " + error + "\n";
                });
        });

        // Tracks the resolved backup directory for use by the change handler
        var currentBackupDir = "";

        // Button: List Backups — populates dropdown only, does not touch the Output box
        document.getElementById("btn-list-backups").addEventListener("click", function() {
            var backupList = document.getElementById("backup-list");

            cockpit.spawn(
                ["bash", "-c", "grep -E '^BACKUP_DIR=' /etc/haas-firewall.conf | cut -d'\"' -f2"],
                { superuser: "require", err: "message" }
            )
            .then(function(backupDir) {
                backupDir = backupDir.trim();
                if (!backupDir) {
                    backupList.innerHTML = "<option value=\"\">ERROR: BACKUP_DIR not set in haas-firewall.conf</option>";
                    backupList.classList.remove("hidden");
                    return;
                }

                currentBackupDir = backupDir;

                return cockpit.spawn(["ls", "-1t", backupDir], { superuser: "require", err: "message" })
                    .then(function(files) {
                        var fileList = files.trim().split("\n").filter(function(f) {
                            return f.endsWith(".csv");
                        });

                        backupList.innerHTML = "<option value=\"\">— select a backup file —</option>";

                        if (fileList.length === 0) {
                            backupList.innerHTML = "<option value=\"\">No CSV backups found in " + backupDir + "</option>";
                        } else {
                            fileList.forEach(function(f) {
                                var opt = document.createElement("option");
                                opt.value = f;
                                opt.textContent = f;
                                backupList.appendChild(opt);
                            });
                        }

                        backupList.classList.remove("hidden");
                    });
            })
            .catch(function(ex) {
                backupList.innerHTML = "<option value=\"\">ERROR: " + (ex.message || JSON.stringify(ex)) + "</option>";
                backupList.classList.remove("hidden");
            });
        });

        // Selecting from the dropdown populates the text input and previews the file
        document.getElementById("backup-list").addEventListener("change", function() {
            var selected = this.value;
            if (!selected) return;

            document.getElementById("backup-name").value = selected;

            if (!currentBackupDir) return;

            var fullPath = currentBackupDir + "/" + selected;
            output.textContent = "Previewing: " + fullPath + "\n\n";

            cockpit.file(fullPath, { superuser: "require" }).read()
                .then(function(content) {
                    output.textContent = "--- Preview: " + selected + " ---\n\n" + (content || "(empty file)");
                    output.scrollTop = 0;
                })
                .catch(function(ex) {
                    output.textContent = "ERROR reading " + fullPath + ": " + (ex.message || JSON.stringify(ex));
                });
        });

        // Button 7: Rollback
        document.getElementById("btn-rollback").addEventListener("click", function() {
            const backupName = backupInput.value.trim();
            if (!backupName) {
                output.textContent = "Please enter a backup filename.\n";
                return;
            }
            runCommand(["/usr/local/sbin/rollback_csv.sh", backupName], "Rollback from " + backupName);
        });

        // ── UFW filter radio helper ────────────────────────────────────────────
        function setUfwFilterEnabled(state) {
            document.querySelectorAll("input[name='ufwFilter']").forEach(function(r) {
                r.disabled = !state;
            });
        }

        // ── Stop live log ──────────────────────────────────────────────────────
        function stopLiveLog() {
            logSessionId++;
            if (liveLogProcess) {
                try { liveLogProcess.close("terminated"); } catch(e) {}
                liveLogProcess = null;
            }
            stopLogBtn.disabled = true;
            isUfwLive = false;
            setUfwFilterEnabled(false);
            rulesHeading.textContent = "Active Firewall Rules";
            // Refresh the rules now that the log is stopped
            updateFirewallStatus();
        }

        // ── Start UFW live log ─────────────────────────────────────────────────
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

            // Bump session ID and kill any existing stream
            logSessionId++;
            if (liveLogProcess) {
                try { liveLogProcess.close("terminated"); } catch(e) {}
                liveLogProcess = null;
            }
            var mySession = logSessionId;

            activeRules.textContent = "--- " + label + " (live) ---\n";
            activeRules.scrollTop = 0;
            rulesHeading.textContent = "Firewall Log (live)";
            stopLogBtn.disabled = false;
            isUfwLive = true;
            setUfwFilterEnabled(true);

            liveLogProcess = cockpit.spawn(
                ["journalctl", "-f", "--no-pager", "--grep=" + grepPattern],
                { superuser: "require", err: "message" }
            );

            liveLogProcess.stream(function(data) {
                if (logSessionId !== mySession) return;
                activeRules.textContent += data;
                activeRules.scrollTop = activeRules.scrollHeight;
            });

            liveLogProcess.done(function() {
                if (logSessionId !== mySession) return;
                activeRules.textContent += "\n[Stream ended]\n";
                stopLogBtn.disabled = true;
                isUfwLive = false;
                setUfwFilterEnabled(false);
                rulesHeading.textContent = "Active Firewall Rules";
            });

            liveLogProcess.fail(function(ex) {
                if (logSessionId !== mySession) return;
                if (ex.problem !== "terminated") {
                    activeRules.textContent += "\nERROR: " + (ex.message || JSON.stringify(ex));
                }
                stopLogBtn.disabled = true;
                isUfwLive = false;
                setUfwFilterEnabled(false);
                rulesHeading.textContent = "Active Firewall Rules";
            });
        }

        fwLiveBtn.addEventListener("click", startUfwLive);

        stopLogBtn.addEventListener("click", function() {
            stopLiveLog();
            activeRules.textContent += "\n[Stopped]\n";
        });

        // Changing the filter while live auto-restarts the stream
        document.querySelectorAll("input[name='ufwFilter']").forEach(function(radio) {
            radio.addEventListener("change", function() {
                if (isUfwLive) startUfwLive();
            });
        });

        console.log("All buttons initialized successfully");
    });
})();
