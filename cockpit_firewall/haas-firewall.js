(function() {
    const cockpit = window.cockpit;

    // Sanitizes dynamic text (usernames, raw script output, etc.) before
    // it's interpolated into output.innerHTML.
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");
    }

    // configure_ufw_from_csv.sh and validate_users_csv.sh tag their own
    // log lines with these brackets (see their log()/log_error() helpers
    // and the bare "echo [*] ..." progress lines) — color those the same
    // way our own synthetic [SUCCESS]/[ERROR]/[OK] lines already are, so
    // streamed script output matches. Call only on already-escaped text —
    // none of these tags contain characters escapeHtml() would touch, so
    // order relative to escaping doesn't matter, but it must run on text
    // that's about to be treated as HTML either way.
    function colorizeLogTags(escapedText) {
        return escapedText
            .replace(/\[ERROR\]/g, "<span class=\"error\">[ERROR]</span>")
            .replace(/\[WARN\]/g, "<span class=\"warn\">[WARN]</span>")
            .replace(/\[INFO\]/g, "<span class=\"info\">[INFO]</span>")
            .replace(/\[\*\]/g, "<span class=\"info\">[*]</span>");
    }

    document.addEventListener("DOMContentLoaded", function() {
        console.log("Page loaded, initializing...");

        const output = document.getElementById("output");
        const backupInput = document.getElementById("backup-name");

        // Opens the published docs page for this extension in a new tab —
        // window.open rather than a plain <a href> so the button matches
        // every other control on this page (all of which already require
        // JS to do anything), and to be explicit about noopener/noreferrer.
        document.getElementById("helpBtn").addEventListener("click", function() {
            window.open(
                "https://rikosintie.github.io/Haas_Data_collect/manage_the_appliance/firewall/",
                "_blank",
                "noopener,noreferrer"
            );
        });

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

        // `ufw status numbered` lists rules in the order they were added,
        // not sorted — this pulls the IP (or CIDR) out of a rule line's
        // "From" column and turns it into a single comparable number, so
        // rules can be displayed sorted by address instead of add-order.
        // Non-IPv4 entries ("Anywhere", IPv6 addresses) sort after every
        // real IPv4 address rather than crashing or sorting arbitrarily.
        function ufwRuleSortKey(line) {
            // Every rule from configure_ufw_from_csv.sh carries a trailing
            // "# comment" (e.g. "192.168.10.143   # haas-admin-ssh") — strip
            // it first, otherwise the "last token" below is the comment
            // text, not the IP, and every line ties at Infinity.
            const trimmed = line.trim().replace(/#.*$/, "").trim();
            const v6Match = trimmed.match(/\(v6\)\s*$/);
            const fromField = v6Match ? trimmed.slice(0, v6Match.index).trim() : trimmed;

            const tokens = fromField.split(/\s+/);
            const from = tokens[tokens.length - 1];
            const ip = from.split("/")[0];
            const octets = ip.split(".");

            const isIPv4 = octets.length === 4 && octets.every(function(o) {
                return /^\d+$/.test(o) && parseInt(o, 10) <= 255;
            });
            if (!isIPv4) return Infinity;

            return octets.reduce(function(acc, o) { return acc * 256 + parseInt(o, 10); }, 0);
        }

        // Sorts numbered UFW rule lines by IP (via ufwRuleSortKey) and
        // inserts a dashed divider between each group of same-IP rules —
        // each "user" in the CSV produces 2-3 consecutive rules (ssh/smb/
        // cockpit) that share one IP, so this visually separates one
        // user's rules from the next instead of it reading as one
        // undifferentiated block. Shared by the Active Firewall Rules
        // dashboard and the Show Current UFW Rules button, so both render
        // identically.
        function formatUfwRulesTable(ruleLines) {
            if (ruleLines.length === 0) return "No rules configured.";

            const sorted = ruleLines.slice().sort(function(a, b) {
                return ufwRuleSortKey(a) - ufwRuleSortKey(b);
            });

            const maxLen = sorted.reduce(function(m, l) { return Math.max(m, l.length); }, 0);
            const divider = "-".repeat(maxLen);

            const out = [];
            let prevKey = null;
            sorted.forEach(function(line, i) {
                const key = ufwRuleSortKey(line);
                if (i > 0 && key !== prevKey) {
                    out.push(divider);
                }
                out.push(line);
                prevKey = key;
            });
            out.push(divider);

            return "To                         Action      From\n" +
                   "--                         ------      ----\n" +
                   out.join('\n');
        }

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
                    const ruleLines = lines.filter(line => /^\s*\[\s*\d+\]/.test(line));
                    activeRules.textContent = formatUfwRulesTable(ruleLines);
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

        // Show the appliance's IPv4 + MAC for each active physical network
        // interface next to the page title — lets an admin confirm at a
        // glance which interface(s) Cockpit is actually reachable on,
        // without needing a terminal. Only physical interfaces (real NICs,
        // not bridges/VMs) are considered, via checking that
        // /sys/class/net/<iface>/device exists. No sudo needed — reading
        // interface info doesn't require root.
        (function loadNetworkInfo() {
            const el = document.getElementById("network-info");
            if (!el) return;

            const script = [
                'for i in $(ip -4 -o addr show scope global | awk \'{print $2}\'); do',
                '    if [ -e "/sys/class/net/$i/device" ]; then',
                '        ip_addr=$(ip -4 -o addr show dev "$i" scope global | awk \'{print $4}\' | cut -d/ -f1)',
                '        mac=$(cat "/sys/class/net/$i/address" 2>/dev/null)',
                '        echo "$i|$ip_addr|$mac"',
                '    fi',
                'done'
            ].join('\n');

            cockpit.spawn(["bash", "-c", script], { err: "message" })
                .then(function(result) {
                    const lines = result.trim().split('\n').filter(function(l) { return l.length > 0; });

                    if (lines.length === 0) {
                        el.textContent = "Network: no active interface found.";
                        return;
                    }

                    const parts = lines.map(function(line) {
                        const fields = line.split('|');
                        return fields[0] + ": " + fields[1] + " (MAC " + fields[2] + ")";
                    });

                    el.innerHTML = "";

                    const addressLine = document.createElement("div");
                    addressLine.textContent = "Network — " + parts.join("   |   ");
                    el.appendChild(addressLine);

                    if (lines.length > 1) {
                        const warningLine = document.createElement("div");
                        warningLine.className = "network-warning";
                        warningLine.textContent = "⚠ Multiple active interfaces — for best security and manageability, only one should be connected.";
                        el.appendChild(warningLine);
                    }
                })
                .catch(function() {
                    el.textContent = "";
                });
        })();

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

        // Helper to run commands. preamble (optional, trusted HTML) is kept
        // ahead of "Running: ..." in the same assignment rather than
        // appended beforehand — this function's first line assigns rather
        // than appends, so anything written to output right before calling
        // runCommand() would otherwise be wiped out the instant it runs.
        function runCommand(args, label, onSuccess, preamble) {
            output.innerHTML = (preamble || "") + "Running: " + escapeHtml(label) + "\nCommand: " + escapeHtml(args.join(" ")) + "\n\n";

            cockpit.spawn(args, { superuser: "require", err: "out" })
                .stream(function(data) {
                    output.innerHTML += colorizeLogTags(escapeHtml(data));
                    output.scrollTop = output.scrollHeight;
                })
                .then(function() {
                    output.innerHTML += "\n<span class=\"success\">[SUCCESS] Command completed.</span>\n";
                    output.scrollTop = output.scrollHeight;
                    if (onSuccess) onSuccess();
                })
                .catch(function(error) {
                    output.innerHTML += "\n<span class=\"error\">[ERROR] " + escapeHtml(error) + "</span>\n";
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
                output.innerHTML = "<span class=\"error\">Please enter a CSV file path to compare against.</span>\n";
                return;
            }
            runCommand(["/usr/local/sbin/configure_ufw_from_csv.sh", "--compare", csvPath], "Compare firewall rules against " + csvPath);
        });

        // Button 3: Show rules — captures the full output (rather than
        // runCommand's live streaming) so it can be sorted/grouped with
        // formatUfwRulesTable before display, the same as Active Firewall
        // Rules. Still runs the real script (not just `ufw status
        // numbered` directly), so the "Showing current UFW rules..." line
        // still lands in /var/log/haas-firewall.log via the script's own
        // logging.
        document.getElementById("btn-show-rules").addEventListener("click", function() {
            const args = ["/usr/local/sbin/configure_ufw_from_csv.sh", "--show-rules"];
            output.innerHTML = "Running: Show current UFW rules\nCommand: " + escapeHtml(args.join(" ")) + "\n\n";

            cockpit.spawn(args, { superuser: "require", err: "out" })
                .then(function(result) {
                    const lines = result.split('\n');
                    const ruleLines = lines.filter(function(line) { return /^\s*\[\s*\d+\]/.test(line); });
                    output.innerHTML += escapeHtml(formatUfwRulesTable(ruleLines)) +
                        "\n\n<span class=\"success\">[SUCCESS] Command completed.</span>\n";
                    output.scrollTop = output.scrollHeight;
                })
                .catch(function(error) {
                    output.innerHTML += "\n<span class=\"error\">[ERROR] " + escapeHtml(error) + "</span>\n";
                    output.scrollTop = output.scrollHeight;
                });
        });

        // Button 3a: Show network neighbor (LLDP) — answers "what switch/port
        // is this appliance plugged into", the same info haas-lldp-neighbors
        // gives from the terminal (see docs/manage_the_appliance/lldp.md),
        // without needing SSH access.
        document.getElementById("btn-lldp-neighbors").addEventListener("click", function() {
            runCommand(["lldpcli", "show", "neighbors"], "Show network neighbor (LLDP)");
            // This button lives at the top of the page, but its result
            // goes into the shared output pane further down — scroll it
            // into view so the result is actually visible without the
            // user having to know to scroll down and look for it.
            output.scrollIntoView({ behavior: "smooth", block: "start" });
        });

        // Button 4: Reset firewall
        document.getElementById("btn-reset").addEventListener("click", function() {
            if (!confirm("This will reset ALL firewall rules! Are you sure?")) {
                return;
            }
            output.innerHTML = "Resetting firewall...\n";

            cockpit.spawn(["/bin/bash", "-c", "echo 'y' | ufw reset"], { superuser: "require", err: "out" })
                .stream(function(data) {
                    output.innerHTML += colorizeLogTags(escapeHtml(data));
                    output.scrollTop = output.scrollHeight;
                })
                .then(function() {
                    output.innerHTML += "\n<span class=\"success\">[SUCCESS] Firewall reset completed.</span>\n";
                    output.scrollTop = output.scrollHeight;
                    updateFirewallStatus();
                })
                .catch(function(error) {
                    output.innerHTML += "\n<span class=\"error\">[ERROR] " + escapeHtml(error) + "</span>\n";
                    output.scrollTop = output.scrollHeight;
                });
        });

        // Checking "Use custom CSV file" pre-fills the path with the usual
        // convention (users1.csv, alongside the default users.csv) as a
        // starting point — only when the field is still empty, so it never
        // overwrites a path someone already typed.
        document.getElementById("use-custom-csv").addEventListener("change", function() {
            var pathInput = document.getElementById("custom-csv-path");
            if (this.checked && !pathInput.value.trim()) {
                pathInput.value = "/home/haas/Haas_Data_collect/users1.csv";
            }
        });

        // Button 5: Apply firewall changes
        document.getElementById("btn-apply").addEventListener("click", function() {
            const useCustom = document.getElementById("use-custom-csv").checked;
            const customPath = document.getElementById("custom-csv-path").value.trim();

            if (useCustom && !customPath) {
                output.innerHTML = "<span class=\"error\">Please enter a custom CSV file path or uncheck the option.</span>\n";
                return;
            }

            const fileToCheck = useCustom
                ? customPath
                : "/home/haas/Haas_Data_collect/users.csv";

            if (!confirm("This will reset and reapply firewall rules using:\n" + fileToCheck + "\n\nContinue?")) {
                return;
            }

            const configCommand = useCustom
                ? ["/usr/local/sbin/configure_ufw_from_csv.sh", customPath]
                : ["/usr/local/sbin/configure_ufw_from_csv.sh"];

            const validatingLine = "Validating CSV file path...\n";
            output.innerHTML = validatingLine;

            cockpit.spawn(["test", "-f", fileToCheck], { err: "out" })
                .then(function() {
                    const preamble = validatingLine +
                        "<span class=\"success\">[OK] CSV file found: " + escapeHtml(fileToCheck) + "</span>\n\n";
                    runCommand(configCommand, "Apply firewall changes from " + fileToCheck, function() {
                        // Force an immediate refresh once the apply
                        // actually finishes, rather than waiting for the
                        // next 2-second poll — Active Firewall Rules
                        // otherwise sat stale after Apply Firewall Changes
                        // until something else (e.g. Firewall Log -> Stop)
                        // happened to trigger updateFirewallStatus()
                        // manually.
                        updateFirewallStatus();
                        // Clear "Use custom CSV file" after every apply
                        // (whether or not it was checked) so it never sits
                        // checked from one apply to the next — the next
                        // Edit users.csv / Edit Custom CSV save is what
                        // sets it correctly for whichever file was just
                        // edited.
                        document.getElementById("use-custom-csv").checked = false;

                        // Firewall access (this CSV) and Samba/Linux
                        // accounts (Manage Samba's Create/Delete User) are
                        // two separate systems — applying this CSV doesn't
                        // create or remove either on its own. Diff the
                        // CSV's usernames against actual Samba accounts so
                        // an admin who only ever touches the firewall side
                        // doesn't leave a departed contractor's login
                        // account active, or forget to create a new one.
                        function runAccountCheck() {
                            cockpit.file(fileToCheck, { superuser: "require" }).read()
                                .then(function(csvContent) {
                                const csvUsernames = (csvContent || "").split("\n")
                                    .slice(1) // skip header row
                                    .map(function(line) { return line.split(",")[0].trim().toLowerCase(); })
                                    // "haas" excluded on both sides symmetrically — it's the
                                    // appliance's own account, always present in both, and
                                    // without this it would falsely show up as "new" every
                                    // single time (present in the CSV, but excluded from the
                                    // Samba-side list below).
                                    .filter(function(name) { return name.length > 0 && name !== "haas"; });

                                // Renders one "heading + one-username-per-line" block,
                                // or "" if there's nothing to report — keeps the four
                                // Samba/Linux x new/removed sections below identical
                                // in shape instead of repeating this four times.
                                function renderAccountSection(heading, users, cssClass) {
                                    if (users.length === 0) return "";
                                    return "<span class=\"" + cssClass + "\">" + escapeHtml(heading) + "</span>\n" +
                                        users.map(function(u) { return escapeHtml(u); }).join("\n") + "\n\n";
                                }

                                cockpit.spawn(["bash", "-c", "pdbedit -L | cut -d: -f1"], { superuser: "require", err: "message" })
                                    .then(function(sambaText) {
                                        const sambaUsers = (sambaText || "").trim().split("\n")
                                            .map(function(u) { return u.trim().toLowerCase(); })
                                            .filter(function(u) { return u.length > 0 && u !== "haas"; });

                                        const newSambaUsers = csvUsernames.filter(function(u) { return sambaUsers.indexOf(u) === -1; });
                                        const removedSambaUsers = sambaUsers.filter(function(u) { return csvUsernames.indexOf(u) === -1; });

                                        // Same HaasGroup-membership convention Manage Samba's
                                        // Delete User / Change Password dropdowns already use —
                                        // this is a separate check from the Samba one above
                                        // because manage_users.sh creates/deletes the Linux and
                                        // Samba accounts as two separate steps, so a partial
                                        // failure in one can leave them out of sync.
                                        cockpit.spawn(
                                            ["bash", "-c", "getent group HaasGroup | cut -d: -f4 | tr ',' '\\n' | grep -v '^haas$' | grep -v '^$' | sort"],
                                            { superuser: "require", err: "message" }
                                        )
                                            .then(function(linuxText) {
                                                const linuxUsers = (linuxText || "").trim().split("\n")
                                                    .map(function(u) { return u.trim().toLowerCase(); })
                                                    .filter(function(u) { return u.length > 0 && u !== "haas"; });

                                                const newLinuxUsers = csvUsernames.filter(function(u) { return linuxUsers.indexOf(u) === -1; });
                                                const removedLinuxUsers = linuxUsers.filter(function(u) { return csvUsernames.indexOf(u) === -1; });

                                                if (newSambaUsers.length === 0 && removedSambaUsers.length === 0 &&
                                                    newLinuxUsers.length === 0 && removedLinuxUsers.length === 0) {
                                                    return;
                                                }

                                                let detail = "\n" + "-".repeat(60) + "\n";
                                                detail += "<span class=\"info\">--- Samba/Linux account check ---</span>\n";
                                                detail += "Firewall rules were applied from this CSV.\n";
                                                detail += "Samba/Linux accounts are managed separately (Manage Samba's Create User / Delete User).\n\n";
                                                detail += renderAccountSection("New users in this CSV with no Samba account:", newSambaUsers, "info");
                                                detail += renderAccountSection("Samba accounts that aren't in this CSV:", removedSambaUsers, "warn");
                                                detail += renderAccountSection("New users in this CSV with no Linux account:", newLinuxUsers, "info");
                                                detail += renderAccountSection("Linux accounts that aren't in this CSV:", removedLinuxUsers, "warn");

                                                output.innerHTML += detail;
                                                output.scrollTop = output.scrollHeight;

                                                const accountsToCreate = newSambaUsers.length + newLinuxUsers.length;
                                                const accountsToDelete = removedSambaUsers.length + removedLinuxUsers.length;
                                                alert(
                                                    "Firewall applied.\n\n" +
                                                    (accountsToCreate > 0 ? accountsToCreate + " account(s) may need creating.\n" : "") +
                                                    (accountsToDelete > 0 ? accountsToDelete + " account(s) may need deleting.\n" : "") +
                                                    "\nSee the output pane for names, or go to Manage Samba to act on it."
                                                );
                                            })
                                            .catch(function() {
                                                // Non-fatal — see the .catch below.
                                            });
                                    })
                                    .catch(function() {
                                        // Non-fatal — the firewall change itself already
                                        // succeeded; this check is a bonus reminder, not
                                        // required for correctness.
                                    });
                            })
                            .catch(function() {
                                // Same — a failed re-read of the CSV shouldn't undo the
                                // fact that the firewall was already successfully applied.
                            });
                        }

                        // haas-firewall.timer fires haas-firewall.service once a
                        // day as a "self-heal" against manual drift, and that
                        // service runs configure_ufw_from_csv.sh with no
                        // arguments — which falls back to reading CSV_PATH from
                        // this conf file. Without updating it here, the next
                        // daily refresh silently reverts a deliberately-applied
                        // custom CSV back to plain users.csv within 24 hours.
                        cockpit.file("/etc/haas-firewall.conf", { superuser: "require" }).read()
                            .then(function(confContent) {
                                confContent = confContent || "";
                                const newConfContent = /^CSV_PATH=/m.test(confContent)
                                    ? confContent.replace(/^CSV_PATH=.*$/m, "CSV_PATH=\"" + fileToCheck + "\"")
                                    : confContent.replace(/\s*$/, "\n") + "CSV_PATH=\"" + fileToCheck + "\"\n";

                                return cockpit.file("/etc/haas-firewall.conf", { superuser: "require" }).replace(newConfContent)
                                    .then(function() {
                                        output.innerHTML += "<span class=\"info\">[INFO] haas-firewall.conf's CSV_PATH updated to " +
                                            escapeHtml(fileToCheck) + " — the daily self-heal timer will keep reapplying this file.</span>\n";
                                        output.scrollTop = output.scrollHeight;
                                    })
                                    .catch(function(error) {
                                        output.innerHTML += "<span class=\"warn\">[WARNING] Could not update haas-firewall.conf's CSV_PATH: " +
                                            escapeHtml(error) + " — the daily self-heal timer may revert to the previous CSV_PATH.</span>\n";
                                        output.scrollTop = output.scrollHeight;
                                    });
                            })
                            .catch(function(error) {
                                output.innerHTML += "<span class=\"warn\">[WARNING] Could not read haas-firewall.conf to update CSV_PATH: " +
                                    escapeHtml(error) + "</span>\n";
                                output.scrollTop = output.scrollHeight;
                            })
                            .then(function() {
                                runAccountCheck();
                            });
                    }, preamble);
                })
                .catch(function() {
                    output.innerHTML = validatingLine +
                        "<span class=\"error\">[ERROR] CSV file not found: " + escapeHtml(fileToCheck) + "</span>\n" +
                        "Please verify the file path and try again.\n" +
                        "Firewall was NOT modified.\n";
                    output.scrollTop = output.scrollHeight;
                });
        });

        // Button 6: Edit CSV
        // Shared validation for users.csv / custom CSV saves — mirrors what
        // configure_ufw_from_csv.sh actually parses (`tail -n +2` skips the
        // header line, `IFS=',' read -r user ip role`), so a bad edit is
        // caught here instead of silently producing an "UNKNOWN ROLE" or
        // skipped firewall rule later when Apply Firewall Changes runs.
        function validateUsersCsv(content) {
            const nameRe = /^[0-9a-zA-Z_-]+$/;
            const lines = content.split(/\r?\n/);

            for (let i = 1; i < lines.length; i++) {
                const line = lines[i];
                if (line.trim() === "") continue;

                const fields = line.split(",");
                if (fields.length !== 3) {
                    return "Line " + (i + 1) + ": expected 3 fields (name,ip_address,role), found " + fields.length + ": " + line;
                }

                const name = fields[0].trim();
                const ip = fields[1].trim();
                const role = fields[2].trim();

                if (!nameRe.test(name)) {
                    return "Line " + (i + 1) + ": invalid name \"" + name + "\" (letters, numbers, underscore, and hyphen only).";
                }

                const ipParts = ip.split(".");
                const ipValid = ipParts.length === 4 && ipParts.every(function(p) {
                    return /^\d+$/.test(p) && parseInt(p, 10) >= 0 && parseInt(p, 10) <= 255;
                });
                if (!ipValid) {
                    return "Line " + (i + 1) + ": invalid IP address \"" + ip + "\" (must be a valid IPv4 address, e.g. 192.168.10.143).";
                }

                const roleLower = role.toLowerCase();
                if (roleLower !== "administrator" && roleLower !== "user") {
                    return "Line " + (i + 1) + ": invalid role \"" + role + "\" (must be \"Administrator\" or \"user\").";
                }
            }

            return null;
        }

        // configure_ufw_from_csv.sh does `IFS=',' read -r user ip role`
        // with no trimming, so a stray space (e.g. "mike, 192.168.10.20,user")
        // reaches it as part of the IP field verbatim and fails there even
        // though validateUsersCsv() above — which trims each field before
        // checking it — accepted it. Normalizing what's actually written
        // keeps the saved file exactly matching what was validated.
        function normalizeUsersCsv(content) {
            const lines = content.split(/\r?\n/);
            return lines.map(function(line, i) {
                if (i === 0 || line.trim() === "") return line;
                return line.split(",").map(function(f) { return f.trim(); }).join(",");
            }).join("\n");
        }

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
                        const validationError = validateUsersCsv(textarea.value);
                        if (validationError) {
                            // Popup, not output.textContent — output is the
                            // <pre> the textarea itself lives inside, so
                            // overwriting its text would destroy the editor
                            // (and the user's unsaved edits) along with it.
                            alert("CSV not saved — invalid content:\n\n" + validationError);
                            return;
                        }
                        const normalized = normalizeUsersCsv(textarea.value);
                        cockpit.file(csvPath, { superuser: "require" })
                            .replace(normalized)
                            .then(function() {
                                output.textContent = "File saved successfully!\n";
                                // Apply Firewall Changes uses users.csv only
                                // when "Use custom CSV file" is unchecked —
                                // force that here rather than just warning
                                // about it, so Apply is guaranteed to use
                                // the file just saved, not a stale custom
                                // path left checked from an earlier edit.
                                document.getElementById("use-custom-csv").checked = false;
                                alert("File saved. Click \"Apply Firewall Changes\" to activate the new rules.");
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

        // Button 6a: Edit Custom CSV — same editor pattern as "Edit users.csv",
        // but against whatever path is currently typed in the Compare
        // Current vs Planned Rules box, read fresh at click time (not
        // whatever it was when the page loaded).
        document.getElementById("btn-edit-custom-csv").addEventListener("click", function() {
            const csvPath = document.getElementById("compare-csv-path").value.trim();
            if (!csvPath) {
                output.textContent = "Please enter a CSV file path in the Compare Current vs Planned Rules box first.\n";
                return;
            }
            output.textContent = "Loading " + csvPath + "...\n";

            cockpit.file(csvPath, { superuser: "require" })
                .read()
                .then(function(content) {
                    if (content === null) {
                        output.textContent = "ERROR: Could not read " + csvPath + " (file does not exist yet).\n";
                        return;
                    }

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
                        const validationError = validateUsersCsv(textarea.value);
                        if (validationError) {
                            // Popup, not output.textContent — output is the
                            // <pre> the textarea itself lives inside, so
                            // overwriting its text would destroy the editor
                            // (and the user's unsaved edits) along with it.
                            alert("CSV not saved — invalid content:\n\n" + validationError);
                            return;
                        }
                        const normalized = normalizeUsersCsv(textarea.value);
                        cockpit.file(csvPath, { superuser: "require" })
                            .replace(normalized)
                            .then(function() {
                                output.textContent = "File saved successfully!\n";
                                // Apply Firewall Changes only uses this path
                                // when "Use custom CSV file" is checked AND
                                // its path field matches what was just
                                // edited — set both here rather than just
                                // telling the user to, so the file just
                                // saved is guaranteed to be what Apply
                                // actually uses next, with no retyping.
                                document.getElementById("use-custom-csv").checked = true;
                                document.getElementById("custom-csv-path").value = csvPath;
                                alert("File saved to " + csvPath + ".\n\n\"Use custom CSV file\" has been checked and the path filled in — click \"Apply Firewall Changes\" to activate these rules.");
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
                output.innerHTML = "<span class=\"error\">Please enter a backup filename.</span>\n";
                return;
            }
            runCommand(["/usr/local/sbin/rollback_csv.sh", backupName], "Rollback from " + backupName, function() {
                // rollback_csv.sh always restores into plain users.csv
                // (see its own "Target:" line) — never a custom path — so,
                // same as Edit users.csv, make sure "Use custom CSV file"
                // is off before reminding the user to apply, rather than
                // risking Apply using a stale custom path instead of the
                // file that was just restored.
                document.getElementById("use-custom-csv").checked = false;
                alert("CSV restored to /home/haas/Haas_Data_collect/users.csv.\n\nClick \"Apply Firewall Changes\" to activate these rules.");
            });
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
