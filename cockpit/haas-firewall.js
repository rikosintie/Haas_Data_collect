/*
 * Haas Appliance - Cockpit Firewall Control Logic
 *
 * This file uses Cockpit's JavaScript APIs to run privileged commands on
 * the host system and display their output in the UI.
 *
 * Exposed actions:
 *   - Dry-run firewall update
 *   - Compare current vs planned rules
 *   - Show current UFW rules
 *   - Rollback CSV to a selected backup
 */

(function () {
    "use strict";

    window.addEventListener("load", () => {
        if (!window.cockpit) {
            console.error("Cockpit API not loaded");
            return;
        }

        cockpit.transport.wait(() => {
            const cockpit = window.cockpit;

  // Simple helper to append text to the output area.
  function appendOutput(text) {
    const out = document.getElementById("output");
    if (!out) return;
    const now = new Date().toISOString();
    out.textContent += `\n[${now}] ${text}`;
    out.scrollTop = out.scrollHeight;
  }

  // Helper to clear and set output.
  function setOutput(text) {
    const out = document.getElementById("output");
    if (!out) return;
    out.textContent = text;
  }

  // Run a shell command on the host and stream the result into the output.
  function runCommand(description, cmd, args) {
    setOutput(`Running: ${description}\nCommand: ${cmd} ${args.join(" ")}\n\n`);

    const proc = cockpit.spawn([cmd].concat(args), { superuser: "require", err: "out" });

    proc.stream(function(data) {
      appendOutput(data);
    });

    proc.done(function() {
      appendOutput("\n[INFO] Command completed successfully.");
    });

    proc.fail(function(ex) {
      appendOutput(`\n[ERROR] Command failed: ${ex}`);
    });
  }

  function onReady() {
    const btnDryRun = document.getElementById("btn-dry-run");
    const btnCompare = document.getElementById("btn-compare");
    const btnShowRules = document.getElementById("btn-show-rules");
    const btnRollback = document.getElementById("btn-rollback");
    const backupInput = document.getElementById("backup-name");

    if (btnDryRun) {
      btnDryRun.addEventListener("click", function() {
        runCommand(
          "Simulate firewall update (dry-run)",
          "/usr/local/sbin/configure_ufw_from_csv.sh",
          ["--dry-run"]
        );
      });
    }

    if (btnCompare) {
      btnCompare.addEventListener("click", function() {
        runCommand(
          "Compare current vs planned firewall rules",
          "/usr/local/sbin/configure_ufw_from_csv.sh",
          ["--compare"]
        );
      });
    }

    if (btnShowRules) {
      btnShowRules.addEventListener("click", function() {
        runCommand(
          "Show current UFW rules",
          "/usr/local/sbin/configure_ufw_from_csv.sh",
          ["--show-rules"]
        );
      });
    }

    if (btnRollback && backupInput) {
      btnRollback.addEventListener("click", function() {
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

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", onReady);
  } else {
    onReady();
  }

        }); // closes cockpit.transport.wait
    });   // closes window.load
})();   // closes IIFE
