(function () {
    const cockpit = window.cockpit;

    document.addEventListener("DOMContentLoaded", function () {
        console.log("Page loaded, initializing...");

        const output = document.getElementById("output");
        const backupInput = document.getElementById("backup-name");

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

        // Button 4: Edit CSV (simple file editor)
        document.getElementById("btn-edit-csv").addEventListener("click", function () {
            const csvPath = "/home/mhubbard/test/Haas_Data_collect/users.csv";
            output.textContent = "Loading " + csvPath + "...\n";

            cockpit.file(csvPath, { superuser: "require" })
                .read()
                .then(function (content) {
                    const textarea = document.createElement("textarea");
                    textarea.id = "csv-editor";
                    textarea.style.width = "100%";
                    textarea.style.height = "400px";
                    textarea.style.fontFamily = "monospace";
                    textarea.value = content;

                    const saveBtn = document.createElement("button");
                    saveBtn.textContent = "Save Changes";
                    saveBtn.className = "btn";
                    saveBtn.style.marginTop = "10px";

                    const cancelBtn = document.createElement("button");
                    cancelBtn.textContent = "Cancel";
                    cancelBtn.className = "btn";
                    cancelBtn.style.marginLeft = "10px";

                    output.innerHTML = "";
                    output.appendChild(textarea);
                    output.appendChild(document.createElement("br"));
                    output.appendChild(saveBtn);
                    output.appendChild(cancelBtn);

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

        // Button 5: Rollback
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
