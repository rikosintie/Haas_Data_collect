const output = document.getElementById("output");

const scriptsLogBtn = document.getElementById("scriptsLogBtn");
const stopLogBtn    = document.getElementById("stopLogBtn");

// Sanitizes dynamic text (service names, IPs, etc.) before it's
// interpolated into output.innerHTML.
function escapeHtml(str) {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

// Colorizes the fixed section headers and summary/flag lines that
// Service State's underlying shell checks (HAAS_PORTS_SCRIPT,
// HAAS_BUFFERING_CHECK_SCRIPT, etc.) always produce verbatim, and puts a
// divider before every header after the first one seen in this call —
// same idea as cockpit_firewall's colorizeLogTags, but per-line since
// these checks mix fixed headers/summaries with per-service/per-machine
// dynamic lines rather than a small fixed set of bracket tags. Call only
// on already-escaped text.
function colorizeServiceOutput(escapedText) {
    var sawHeader = false;
    return escapedText.split("\n").map(function(line) {
        if (/^--- .+ ---$/.test(line)) {
            var divider = sawHeader ? ("-".repeat(60) + "\n") : "";
            sawHeader = true;
            return divider + "<span class=\"info\">" + line + "</span>";
        }
        if (
            line === "No duplicate ports found." ||
            line === "All services use python3 -u." ||
            line === "All services restart automatically on failure." ||
            line === "No services are stuck in a crash loop."
        ) {
            return "<span class=\"success\">" + line + "</span>";
        }
        if (/^\s*\[CRASH LOOP\]/.test(line)) {
            return "<span class=\"error\">" + line + "</span>";
        }
        if (/^\s*\[(DUPLICATE PORT|MISSING -u|MISSING Restart=on-failure)\]/.test(line)) {
            return "<span class=\"warn\">" + line + "</span>";
        }
        if (/\bnot reachable$/.test(line)) {
            return "<span class=\"info\">" + line + "</span>";
        }
        if (/\breachable$/.test(line) || /already connected \(skipped probe\)$/.test(line)) {
            return "<span class=\"success\">" + line + "</span>";
        }
        return line;
    }).join("\n");
}

const serviceStateBtn      = document.getElementById("serviceStateBtn");
const editServicesBtn      = document.getElementById("editServicesBtn");
const createServiceBtn     = document.getElementById("createServiceBtn");
const deleteServiceBtn     = document.getElementById("deleteServiceBtn");
const dataFreshnessBtn     = document.getElementById("dataFreshnessBtn");
const machineHealthBtn     = document.getElementById("machineHealthBtn");
const servicesList         = document.getElementById("servicesList");
const serviceEditorSection = document.getElementById("serviceEditorSection");
const serviceEditorArea    = document.getElementById("serviceEditorArea");
const serviceEditorLabel   = document.getElementById("serviceEditorLabel");
const editorValidationMsg  = document.getElementById("editorValidationMsg");
const saveServiceBtn       = document.getElementById("saveServiceBtn");
const cancelServiceEditBtn = document.getElementById("cancelServiceEditBtn");
const createServiceForm    = document.getElementById("createServiceForm");
const svcDescription       = document.getElementById("svcDescription");
const svcName              = document.getElementById("svcName");
const svcIpAddress         = document.getElementById("svcIpAddress");
const svcPort              = document.getElementById("svcPort");

const HAAS_SYSTEMD_DIR = "/etc/systemd/system";

// Shared by Create Service's structured IP/Port fields and Edit Services'
// validation of the ExecStart line it parses out of free-text unit-file
// content, so both paths enforce the same rules instead of drifting apart.
function isValidIpv4(ip) {
    var parts = ip.split(".");
    return parts.length === 4 && parts.every(function(p) {
        return /^\d+$/.test(p) && parseInt(p, 10) >= 0 && parseInt(p, 10) <= 255;
    });
}

function isValidServicePort(port) {
    var n = parseInt(port, 10);
    return /^\d+$/.test(port) && n >= 5001 && n <= 5099;
}

// Same idea as the haas-ports shell alias (haas-aliases.zsh), plus a
// duplicate-port check: two services both pointing "-t <ip> --port <port>"
// at the same address means one of them is very likely misconfigured
// against the wrong machine — the kind of thing that shows up as "this
// CNC just isn't writing a CSV" without an obvious error to explain why.
//
// Each ExecStart line is normalized by scanning for "-t"/"--port"/"--name"
// by NAME, not by field position — a fixed "cut -f4-" broke the moment
// some services had "-u" (an extra leading token) and others didn't:
// the cut point landed in a different place per line, which not only
// left "-a" inconsistently shown/hidden but corrupted the sort order
// entirely (whatever text happened to land in the sort key's start
// position got compared, not the port number), so a service without
// "-u" could jump to the top of the list with no indication why.
// Normalizing first means sort has a single, guaranteed-consistent
// field to sort on regardless of how many flags precede -t/--port/--name.
var HAAS_PORTS_SCRIPT = [
    "echo",
    "echo \"--- IP / Port / Name (from " + HAAS_SYSTEMD_DIR + "/haas-*.service) ---\"",
    "grep -Ei \"python3\" " + HAAS_SYSTEMD_DIR + "/haas*.service 2>/dev/null | awk '{",
    "    ip=\"\"; port=\"\"; name=\"\";",
    "    for (i=1;i<=NF;i++) {",
    "        if ($i==\"-t\") ip=$(i+1);",
    "        if ($i==\"--port\") port=$(i+1);",
    "        if ($i==\"--name\") name=$(i+1);",
    "    }",
    "    if (port != \"\") printf \"-t %s --port %s --name %s\\n\", ip, port, name;",
    "}' | sort -k4,4n | awk '{",
    "    print;",
    "    port=$4; name=$6;",
    "    count[port]++; names[port]=names[port]\" \"name;",
    "}",
    "END {",
    "    dup=0",
    "    for (p in count) if (count[p] > 1) { print \"  [DUPLICATE PORT] \" p \":\" names[p]; dup=1 }",
    "    if (dup == 0) print \"No duplicate ports found.\"",
    "}'"
].join("\n");

// Flags any haas-*.service whose ExecStart is missing "python3 -u". Without
// it, Python fully block-buffers stdout whenever it isn't a real terminal —
// which is always true under systemd — so the script's own log lines can
// sit unflushed and never reach journald in real time, even though the
// service is running and writing data correctly. This is the exact bug
// that made troubleshooting a working-but-silent service so confusing
// before it was understood; catching it here turns it into an instant,
// obvious flag instead of a multi-step debugging session.
//
// Only services that actually invoke python3 are considered — haas-*.service
// also covers non-CNC units like haas-firewall.service (a bash script, not
// Python), which would otherwise get flagged "[MISSING -u]" too. That's not
// wrong exactly (it genuinely has no -u), but it's not this service's
// concern, and it's not something helpdesk should be nudged to go touch.
var HAAS_BUFFERING_CHECK_SCRIPT = [
    "echo",
    "echo \"--- Buffering Check (python3 -u) ---\"",
    "echo \"Note: without -u, this service's own log lines can sit unflushed in a\"",
    "echo \"buffer and never reach journald in real time, even though the service\"",
    "echo \"is running and writing data correctly.\"",
    "echo",
    "missing=0",
    "for f in $(grep -liE \"python3\" " + HAAS_SYSTEMD_DIR + "/haas-*.service 2>/dev/null); do",
    "    [ -f \"$f\" ] || continue",
    "    name=$(basename \"$f\" .service)",
    "    execline=$(grep -E '^ExecStart=' \"$f\")",
    "    if ! echo \"$execline\" | grep -Eq 'python3[[:space:]]+-u([[:space:]]|$)'; then",
    "        echo \"  [MISSING -u] $name\"",
    "        missing=$((missing + 1))",
    "    fi",
    "done",
    "if [ \"$missing\" -eq 0 ]; then",
    "    echo \"All services use python3 -u.\"",
    "fi"
].join("\n");

// Flags any CNC python3 service without Restart=on-failure (or
// Restart=always). Without it, if haas_logger2.py crashes on an
// unhandled exception, the service just dies and stays dead — no
// automatic recovery — until someone happens to notice and restarts it
// by hand. Queried live via `systemctl show`, not by grepping the unit
// file text, since that reflects the actually-loaded config rather than
// requiring the file to spell the directive in exactly one format.
var HAAS_RESTART_POLICY_CHECK_SCRIPT = [
    "echo",
    "echo \"--- Restart Policy Check (Restart=on-failure) ---\"",
    "echo \"Note: without this, a crashed service stays down until someone manually restarts it.\"",
    "echo",
    "missing=0",
    "for f in $(grep -liE \"python3\" " + HAAS_SYSTEMD_DIR + "/haas-*.service 2>/dev/null); do",
    "    [ -f \"$f\" ] || continue",
    "    name=$(basename \"$f\" .service)",
    "    restart=$(systemctl show \"$name\" -p Restart --value 2>/dev/null)",
    "    if [ \"$restart\" != \"on-failure\" ] && [ \"$restart\" != \"always\" ]; then",
    "        echo \"  [MISSING Restart=on-failure] $name (currently: ${restart:-no})\"",
    "        missing=$((missing + 1))",
    "    fi",
    "done",
    "if [ \"$missing\" -eq 0 ]; then",
    "    echo \"All services restart automatically on failure.\"",
    "fi"
].join("\n");

// Flags any CNC python3 service currently stuck in systemd's
// "start-limit-hit" state. Even with Restart=on-failure set, a service
// that crashes repeatedly in a tight loop (e.g. instant connection-
// refused) can exceed systemd's default restart-rate limit and stop
// retrying entirely — it looks like "just broken" rather than a crash
// loop unless you know to check for this specific state, and Restart=
// alone won't bring it back; it needs an explicit `systemctl
// reset-failed`.
var HAAS_CRASH_LOOP_CHECK_SCRIPT = [
    "echo",
    "echo \"--- Crash Loop Check (start-limit-hit) ---\"",
    "found=0",
    "for f in $(grep -liE \"python3\" " + HAAS_SYSTEMD_DIR + "/haas-*.service 2>/dev/null); do",
    "    [ -f \"$f\" ] || continue",
    "    name=$(basename \"$f\" .service)",
    "    result=$(systemctl show \"$name\" -p Result --value 2>/dev/null)",
    "    if [ \"$result\" = \"start-limit-hit\" ]; then",
    "        echo \"  [CRASH LOOP] $name -- hit systemd's restart-rate limit and stopped retrying.\"",
    "        echo \"      Fix: sudo systemctl reset-failed $name && sudo systemctl start $name\"",
    "        found=$((found + 1))",
    "    fi",
    "done",
    "if [ \"$found\" -eq 0 ]; then",
    "    echo \"No services are stuck in a crash loop.\"",
    "fi"
].join("\n");

// One-shot TCP reachability check (nc -z) per service's "-t <ip> --port
// <port>". Run on demand from Service State, not automatically after
// Create Service — during initial deployment an MSP will often create
// every service before the machine shop has configured the actual CNCs
// to connect, so "not reachable" there would just be the normal,
// expected state rather than a problem to chase.
//
// A machine already showing an ESTABLISHED connection from a python3
// process to its ip:port is skipped rather than probed. Some CNC control
// network stacks are minimal enough to only accept one connection at a
// time; an extra probe against a machine that's already connected and
// streaming risks contending with (or even displacing) that real
// connection instead of just testing an idle port.
var HAAS_CONNECTIVITY_SCRIPT = [
    "echo",
    "echo \"--- Connectivity Check (nc -z, 2s timeout per machine) ---\"",
    "echo \"Note: 'not reachable' is expected until the machine/CNC is actually configured to connect on that port -- it isn't necessarily an error.\"",
    "echo",
    "established=$(ss -tnp state established 2>/dev/null)",
    // Same normalize-by-flag-name-then-sort as HAAS_PORTS_SCRIPT — a fixed
    // "cut -f4-" broke the moment some services had "-u" and others didn't.
    "grep -Ei \"python3\" " + HAAS_SYSTEMD_DIR + "/haas*.service 2>/dev/null | awk '{",
    "    ip=\"\"; port=\"\"; name=\"\";",
    "    for (i=1;i<=NF;i++) {",
    "        if ($i==\"-t\") ip=$(i+1);",
    "        if ($i==\"--port\") port=$(i+1);",
    "        if ($i==\"--name\") name=$(i+1);",
    "    }",
    "    if (port != \"\") printf \"-t %s --port %s --name %s\\n\", ip, port, name;",
    "}' | sort -k4,4n |",
    "while read -r line; do",
    "    ip=\"\"; port=\"\"; name=\"\"",
    "    set -- $line",
    "    while [ $# -gt 0 ]; do",
    "        case \"$1\" in",
    "            --port) port=\"$2\"; shift 2 ;;",
    "            --name) name=\"$2\"; shift 2 ;;",
    "            -t) ip=\"$2\"; shift 2 ;;",
    "            *) shift ;;",
    "        esac",
    "    done",
    "",
    "    if [ -z \"$ip\" ] || [ -z \"$port\" ]; then",
    "        continue",
    "    fi",
    "",
    "    if echo \"$established\" | awk -v target=\"$ip:$port\" '$4==target && /python3/ {found=1} END{exit !found}'; then",
    "        printf \"%-15s %s:%-6s already connected (skipped probe)\\n\" \"$name\" \"$ip\" \"$port\"",
    "        continue",
    "    fi",
    "",
    "    if nc -z -w 2 \"$ip\" \"$port\" 2>/dev/null; then",
    "        printf \"%-15s %s:%-6s reachable\\n\" \"$name\" \"$ip\" \"$port\"",
    "    else",
    "        printf \"%-15s %s:%-6s not reachable\\n\" \"$name\" \"$ip\" \"$port\"",
    "    fi",
    "done"
].join("\n");

const HAAS_MACHINES_DIR = "/home/haas/Haas_Data_collect/machines";

// For each machine directory, finds the newest file under its cnc_logs/
// (however it was set up — append mode or per-cycle files, doesn't
// matter, just the most recently modified one) and lists them oldest
// first, so a machine that's silently stopped writing data floats to the
// top instead of only being noticed when someone goes looking for it.
var HAAS_DATA_FRESHNESS_SCRIPT = [
    "base=\"" + HAAS_MACHINES_DIR + "\"",
    "now=$(date +%s)",
    "",
    "for dir in \"$base\"/*/; do",
    "    [ -d \"$dir\" ] || continue",
    "    machine=$(basename \"$dir\")",
    "    logdir=\"${dir}cnc_logs\"",
    "",
    "    if [ ! -d \"$logdir\" ]; then",
    "        echo \"0|$machine|no cnc_logs directory yet\"",
    "        continue",
    "    fi",
    "",
    "    newest_ts=$(find \"$logdir\" -maxdepth 1 -type f -printf '%T@\\n' 2>/dev/null | sort -rn | head -1)",
    "    newest_ts=${newest_ts%.*}",
    "",
    "    if [ -z \"$newest_ts\" ]; then",
    "        echo \"0|$machine|no data files found\"",
    "        continue",
    "    fi",
    "",
    "    age=$(( now - newest_ts ))",
    "    if [ $age -lt 60 ]; then agestr=\"${age}s ago\"",
    "    elif [ $age -lt 3600 ]; then agestr=\"$((age / 60))m ago\"",
    "    elif [ $age -lt 86400 ]; then agestr=\"$((age / 3600))h ago\"",
    "    else agestr=\"$((age / 86400))d ago\"",
    "    fi",
    "",
    "    when=$(date -d @\"$newest_ts\" '+%Y-%m-%d %H:%M:%S')",
    "    echo \"$newest_ts|$machine|$when ($agestr)\"",
    "done | sort -t'|' -k1,1n | awk -F'|' '{printf \"%-15s %s\\n\", $2, $3}'"
].join("\n");

var currentServicePath = null;
var isCreatingService = false;
var serviceListMode = "edit"; // "edit" or "delete"

var liveLogProcess = null;
var isScriptsLive = false;
var logSessionId = 0;

function setScriptsFilterEnabled(state) {
    document.getElementById("scriptsMachineFilter").disabled = !state;
    document.getElementById("scriptsIpFilter").disabled = !state;
    document.getElementById("scriptsPortFilter").disabled = !state;
    if (state) applyMachineFilterAvailability();
}

// Machine wins outright over IP/Port (see startScriptsLive) — grey IP/Port
// out whenever Machine has a value, so it's visually obvious they aren't
// being applied instead of silently having no effect. Only touches them
// while the Scripts stream is actually live; setScriptsFilterEnabled(false)
// already disables everything unconditionally otherwise.
function applyMachineFilterAvailability() {
    if (!isScriptsLive) return;
    var machineHasValue = document.getElementById("scriptsMachineFilter").value.trim() !== "";
    document.getElementById("scriptsIpFilter").disabled = machineHasValue;
    document.getElementById("scriptsPortFilter").disabled = machineHasValue;
}

function disableButtons(state) {
    scriptsLogBtn.disabled = state;
    if (state) stopLogBtn.disabled = true;
    serviceStateBtn.disabled = state;
    editServicesBtn.disabled = state;
    createServiceBtn.disabled = state;
    deleteServiceBtn.disabled = state;
    dataFreshnessBtn.disabled = state;
    machineHealthBtn.disabled = state;
}

// Show the service editor, hiding the output <pre>
function showServiceEditor(path, content) {
    currentServicePath = path;
    serviceEditorLabel.textContent = path + " — edit below, then click Save & Restart";
    saveServiceBtn.textContent = "Save & Restart";
    editorValidationMsg.classList.add("hidden");
    serviceEditorArea.value = content;
    output.classList.add("hidden");
    serviceEditorSection.classList.remove("hidden");
    // Lock everything else while editing; keep save/cancel accessible
    disableButtons(true);
    saveServiceBtn.disabled = false;
    cancelServiceEditBtn.disabled = false;
}

// Hide the service editor, restoring the output <pre>
function hideServiceEditor() {
    serviceEditorSection.classList.add("hidden");
    createServiceForm.classList.add("hidden");
    serviceEditorArea.classList.remove("hidden");
    editorValidationMsg.classList.add("hidden");
    svcDescription.value = "";
    svcName.value = "";
    svcIpAddress.value = "";
    svcPort.value = "";
    output.classList.remove("hidden");
    servicesList.classList.add("hidden");
    currentServicePath = null;
    disableButtons(false);
}

function showCreateServiceForm() {
    serviceEditorLabel.textContent = "New service — fill in all fields, then click Save & Reload";
    saveServiceBtn.textContent = "Save & Reload";
    editorValidationMsg.classList.add("hidden");
    createServiceForm.classList.remove("hidden");
    serviceEditorArea.classList.add("hidden");
    output.classList.add("hidden");
    serviceEditorSection.classList.remove("hidden");
    disableButtons(true);
    saveServiceBtn.disabled = false;
    cancelServiceEditBtn.disabled = false;
}

var activeLogBtn = null;

function setActiveLogBtn(btn) {
    if (activeLogBtn) activeLogBtn.classList.remove("active");
    activeLogBtn = btn || null;
    if (activeLogBtn) activeLogBtn.classList.add("active");
}

function onLiveLogEnd(session) {
    if (logSessionId !== session) return;
    liveLogProcess = null;
    stopLogBtn.disabled = true;
    isScriptsLive = false;
    setScriptsFilterEnabled(false);
    setActiveLogBtn(null);
}

function stopLiveLog() {
    logSessionId++;  // invalidate all callbacks from the previous stream
    if (liveLogProcess) {
        try { liveLogProcess.close("terminated"); } catch(e) { /* ignore */ }
        liveLogProcess = null;
    }
    stopLogBtn.disabled = true;
    isScriptsLive = false;
    setScriptsFilterEnabled(false);
    setActiveLogBtn(null);
}

// Guards the Services buttons (not Stop, not Scripts itself restarting its
// own stream on a filter change) — those two are expected/intentional ways
// to end a stream and confirming them would just be noise. Returns true
// when it's fine to proceed (nothing was streaming, or the user confirmed).
function confirmLeavingLiveLog() {
    if (!isScriptsLive) return true;
    return confirm("The Scripts log is currently streaming. Switch away and stop it?");
}

function startLiveLog(args, label) {
    stopLiveLog();                  // bumps logSessionId, kills old process
    var mySession = logSessionId;   // capture this stream's session

    output.textContent = "--- " + label + " (live) ---\n";
    output.scrollTop = 0;
    stopLogBtn.disabled = false;

    liveLogProcess = cockpit.spawn(args, { superuser: "require", err: "message" });

    liveLogProcess.stream(function(data) {
        if (logSessionId !== mySession) return;  // stale — silently discard
        output.textContent += data;
        output.scrollTop = output.scrollHeight;
    });

    liveLogProcess.done(function() {
        if (logSessionId !== mySession) return;
        output.textContent += "\n[Stream ended]\n";
        onLiveLogEnd(mySession);
    });

    liveLogProcess.fail(function(ex) {
        if (logSessionId !== mySession) return;
        if (ex.problem !== "terminated") {
            output.textContent += "\nERROR: " + (ex.message || JSON.stringify(ex));
        }
        onLiveLogEnd(mySession);
    });
}

function startScriptsLive() {
    var machine = document.getElementById("scriptsMachineFilter").value.trim();
    var ip      = document.getElementById("scriptsIpFilter").value.trim();
    var port    = document.getElementById("scriptsPortFilter").value.trim();

    // haas_logger2.py prefixes every line with "[MACHINE]", so Machine
    // alone already shows that machine's full chatter, including lines
    // like "Reconnecting in 5 seconds..." or "Data appended to: ..." that
    // never repeat its ip:port. Combining it with IP/Port as an AND (both
    // substrings on the same line) sounds like it would just narrow
    // further, but in practice only the initial "Attempting to connect"
    // lines actually contain the port again — everything else (connection
    // confirmation, cycle detection, file writes) would silently vanish
    // from the filter. So Machine wins outright when set; IP/Port only
    // apply when Machine is empty.
    var pattern, label;

    if (machine) {
        pattern = "\\[" + machine + "\\]";
        label   = "Scripts Log (" + machine + ")";
    } else if (ip && port) {
        pattern = ip + ":" + port;
        label   = "Scripts Log (" + ip + ":" + port + ")";
    } else if (ip) {
        pattern = ip;
        label   = "Scripts Log (" + ip + ")";
    } else if (port) {
        pattern = ":" + port;
        label   = "Scripts Log (port " + port + ")";
    } else {
        pattern = "";
        label   = "Scripts Log";
    }

    // -t python3 filters by syslog identifier (process name field, not message body).
    // --grep= is added only when Machine/IP/Port filtering is needed (searches message content).
    //
    // --case-sensitive=false is forced explicitly rather than relying on
    // journalctl's own "all-lowercase query = case-insensitive" default:
    // that default silently flips to case-SENSITIVE the moment the typed
    // query has even one capital letter (autocapitalize, muscle memory
    // from a machine tagged in caps like ST44, etc.), which then matches
    // nothing at all with no indication why — confirmed by reproducing it
    // against a real journal entry before writing this fix.
    var args = ["journalctl", "-t", "python3", "-n", "50", "-f", "--no-pager"];
    if (pattern) args.push("--grep=" + pattern, "--case-sensitive=false");
    startLiveLog(args, label);
    isScriptsLive = true;
    setScriptsFilterEnabled(true);
    setActiveLogBtn(scriptsLogBtn);
}

scriptsLogBtn.addEventListener("click", startScriptsLive);

// Real-time filtering: these values feed journalctl's --grep= regex, so
// restricting each to its expected character set (a real machine name, IP,
// or port never needs anything else) closes off any pathological-regex
// input entirely, not just the common cases — a paste is filtered the
// same as typing. Machine name uses the same character set Create
// Service enforces, since that's what actually produced the name.
document.getElementById("scriptsMachineFilter").addEventListener("input", function() {
    var el = this;
    var pos = el.selectionStart;
    var cleaned = el.value.replace(/[^0-9a-zA-Z_-]/g, "");
    if (cleaned !== el.value) {
        el.value = cleaned;
        el.setSelectionRange(pos - 1, pos - 1);
    }
    applyMachineFilterAvailability();
});

document.getElementById("scriptsIpFilter").addEventListener("input", function() {
    var el = this;
    var pos = el.selectionStart;
    var cleaned = el.value.replace(/[^0-9.]/g, "");
    if (cleaned !== el.value) {
        el.value = cleaned;
        el.setSelectionRange(pos - 1, pos - 1);
    }
});

document.getElementById("scriptsPortFilter").addEventListener("input", function() {
    var el = this;
    var pos = el.selectionStart;
    var cleaned = el.value.replace(/[^0-9]/g, "");
    if (cleaned !== el.value) {
        el.value = cleaned;
        el.setSelectionRange(pos - 1, pos - 1);
    }
});

// Changing Machine/IP/Port while Scripts is live auto-restarts the stream
["scriptsMachineFilter", "scriptsIpFilter", "scriptsPortFilter"].forEach(function(id) {
    document.getElementById(id).addEventListener("change", function() {
        if (isScriptsLive) {
            startScriptsLive();
        }
    });
});

stopLogBtn.addEventListener("click", function() {
    stopLiveLog();
    output.textContent += "\n[Stopped]\n";
});

// ── Service State ─────────────────────────────────────────────────────────────

serviceStateBtn.addEventListener("click", function() {
    if (!confirmLeavingLiveLog()) return;
    stopLiveLog();
    setActiveLogBtn(serviceStateBtn);
    // Locked for the whole run, including the connectivity sweep below —
    // it can take a couple seconds per machine, and a re-click mid-run
    // would stack a second overlapping sweep against the same targets.
    disableButtons(true);
    output.innerHTML = "<span class=\"info\">--- Haas Service Status ---</span>\n";
    output.innerHTML += "Files are located in " + escapeHtml(HAAS_SYSTEMD_DIR) + "\n\n";

    cockpit.spawn(
        ["bash", "-c", "systemctl list-unit-files --type=service | grep haas"],
        { superuser: "require", err: "message" }
    )
        .done(function(data) {
            output.innerHTML += escapeHtml(data || "(no haas services found)");

            cockpit.spawn(["bash", "-c", HAAS_PORTS_SCRIPT], { superuser: "require", err: "message" })
                .done(function(portData) {
                    output.innerHTML += "\n" + "-".repeat(60) + "\n" + colorizeServiceOutput(escapeHtml(portData));

                    cockpit.spawn(["bash", "-c", HAAS_BUFFERING_CHECK_SCRIPT + "\n" + HAAS_RESTART_POLICY_CHECK_SCRIPT], { superuser: "require", err: "message" })
                        .done(function(bufData) {
                            output.innerHTML += "\n" + "-".repeat(60) + "\n" + colorizeServiceOutput(escapeHtml(bufData));
                        })
                        .fail(function(ex, data4) {
                            output.innerHTML += "\n<span class=\"error\">ERROR checking for -u / restart policy: " + escapeHtml(ex.message || JSON.stringify(ex)) + "</span>";
                            if (data4) output.innerHTML += "\n" + escapeHtml(data4);
                        })
                        .always(function() {
                            output.innerHTML += "\n" + "-".repeat(60) + "\n";
                            output.innerHTML += "Running connectivity check (this can take several seconds)...\n";

                            cockpit.spawn(["bash", "-c", HAAS_CONNECTIVITY_SCRIPT + "\n" + HAAS_CRASH_LOOP_CHECK_SCRIPT], { superuser: "require", err: "message" })
                                .done(function(connData) {
                                    output.innerHTML += colorizeServiceOutput(escapeHtml(connData));
                                })
                                .fail(function(ex, data3) {
                                    output.innerHTML += "\n<span class=\"error\">ERROR checking connectivity / crash loop: " + escapeHtml(ex.message || JSON.stringify(ex)) + "</span>";
                                    if (data3) output.innerHTML += "\n" + escapeHtml(data3);
                                })
                                .always(function() {
                                    setActiveLogBtn(null);
                                    disableButtons(false);
                                });
                        });
                })
                .fail(function(ex, data2) {
                    output.innerHTML += "\n<span class=\"error\">ERROR checking ports: " + escapeHtml(ex.message || JSON.stringify(ex)) + "</span>";
                    if (data2) output.innerHTML += "\n" + escapeHtml(data2);
                    setActiveLogBtn(null);
                    disableButtons(false);
                });
        })
        .fail(function(ex, data) {
            output.innerHTML += "\n<span class=\"error\">ERROR: " + escapeHtml(ex.message || JSON.stringify(ex)) + "</span>";
            if (data) output.innerHTML += "\n" + escapeHtml(data);
            setActiveLogBtn(null);
            disableButtons(false);
        });
});

// ── Data Freshness ────────────────────────────────────────────────────────────

// Colorizes Data Freshness's per-machine lines the same way Manage Samba's
// Users button colors its lists — alternating blue/white rows so a long
// machine list is easy to scan — and flags the two "found a problem"
// messages the script itself already emits (no cnc_logs directory yet /
// no data files found) in warn, matching Service State's convention of
// flagging problem lines instead of leaving everything one color. Call
// only on already-escaped text.
function colorizeDataFreshness(escapedText) {
    var i = 0;
    return escapedText.split("\n").map(function(line) {
        if (line.trim() === "") return line;
        var colored;
        if (/no cnc_logs directory yet$/.test(line) || /no data files found$/.test(line)) {
            colored = "<span class=\"warn\">" + line + "</span>";
        } else {
            colored = (i % 2 === 1) ? "<span class=\"info\">" + line + "</span>" : line;
        }
        i++;
        return colored;
    }).join("\n");
}

dataFreshnessBtn.addEventListener("click", function() {
    if (!confirmLeavingLiveLog()) return;
    stopLiveLog();
    setActiveLogBtn(dataFreshnessBtn);
    output.innerHTML = "<span class=\"info\">--- Data Freshness (newest file in each machine's cnc_logs/) ---</span>\n\n";

    cockpit.spawn(["bash", "-c", HAAS_DATA_FRESHNESS_SCRIPT], { superuser: "require", err: "message" })
        .done(function(data) {
            output.innerHTML += data
                ? colorizeDataFreshness(escapeHtml(data))
                : "(no machine directories found under " + escapeHtml(HAAS_MACHINES_DIR) + ")";
        })
        .fail(function(ex, data) {
            output.innerHTML += "\n<span class=\"error\">ERROR: " + escapeHtml(ex.message || JSON.stringify(ex)) + "</span>";
            if (data) output.innerHTML += "\n" + escapeHtml(data);
        })
        .always(function() {
            setActiveLogBtn(null);
        });
});

// ── Machine Health ─────────────────────────────────────────────────────────────
//
// Reuses the four existing checks completely unchanged (same scripts Service
// State and Data Freshness already run) and joins their plain-text output
// into one table, one row per machine, in JavaScript rather than a bash/awk
// cross-reference — the join key needs to be case-insensitive (Create
// Service always lowercases the machine directory/unit filename, but
// "--name" inside ExecStart can be any case, e.g. "ST44"), which is far
// simpler to get right with a JS object than shell associative arrays.

function parsePortsOutput(text) {
    var byMachine = {};
    var dupPortSet = {};
    text.split("\n").forEach(function(line) {
        if (line.indexOf("---") === 0) return;
        var m = line.match(/^-t (\S+) --port (\S+) --name (\S+)$/);
        if (m) byMachine[m[3].toLowerCase()] = { ip: m[1], port: m[2] };
        var d = line.match(/\[DUPLICATE PORT\] (\S+):/);
        if (d) dupPortSet[d[1]] = true;
    });
    Object.keys(byMachine).forEach(function(key) {
        if (dupPortSet[byMachine[key].port]) byMachine[key].dup = true;
    });
    return byMachine;
}

function parseBufferingOutput(text) {
    var missing = {};
    text.split("\n").forEach(function(line) {
        var m = line.match(/\[MISSING -u\]\s+haas-(\S+)/i);
        if (m) missing[m[1].toLowerCase()] = true;
    });
    return missing;
}

function parseConnectivityOutput(text) {
    var byMachine = {};
    text.split("\n").forEach(function(line) {
        if (line.indexOf("---") === 0 || line.indexOf("Note:") === 0) return;
        var m = line.match(/^(\S+)\s+(\S+:\S+)\s+(.+)$/);
        if (m) byMachine[m[1].toLowerCase()] = m[3].trim();
    });
    return byMachine;
}

function parseFreshnessOutput(text) {
    var byMachine = {};
    text.split("\n").forEach(function(line) {
        if (line.indexOf("---") === 0) return;
        var m = line.match(/^(\S+)\s+(.+)$/);
        if (m) byMachine[m[1].toLowerCase()] = m[2].trim();
    });
    return byMachine;
}

// Pads first, then escapes, then wraps in a colored span — in that order
// specifically, so the span tag's own characters never count toward the
// padded column width and alignment stays intact.
function colorMachineHealthField(text, width, cssClass) {
    var padded = width ? String(text).padEnd(width) : String(text);
    var escaped = escapeHtml(padded);
    return cssClass ? "<span class=\"" + cssClass + "\">" + escaped + "</span>" : escaped;
}

// Mirrors colorizeServiceOutput's own connectivity color choices exactly
// (info for "not reachable", success for "reachable"/"already connected")
// — same underlying script, same meaning, same colors, just applied to a
// table cell instead of a full log line.
function machineHealthConnClass(value) {
    if (/\bnot reachable$/.test(value)) return "info";
    if (/\breachable$/.test(value) || /already connected \(skipped probe\)$/.test(value)) return "success";
    return null;
}

function buildMachineHealthTable(portsText, bufferingText, connText, freshText) {
    var ports = parsePortsOutput(portsText);
    var missingU = parseBufferingOutput(bufferingText);
    var conn = parseConnectivityOutput(connText);
    var fresh = parseFreshnessOutput(freshText);

    var allKeys = {};
    [ports, missingU, conn, fresh].forEach(function(src) {
        Object.keys(src).forEach(function(k) { allKeys[k] = true; });
    });

    var rows = Object.keys(allKeys).map(function(key) {
        var p = ports[key] || {};
        return {
            machine: key,
            port: p.port || "—",
            portSortKey: p.port ? parseInt(p.port, 10) : Infinity,
            dup: p.dup ? "DUP" : "",
            uStatus: (key in missingU) ? "MISSING" : ((key in ports) ? "OK" : "—"),
            connectivity: conn[key] || "—",
            freshness: fresh[key] || "—"
        };
    });

    rows.sort(function(a, b) {
        if (a.portSortKey !== b.portSortKey) return a.portSortKey - b.portSortKey;
        return a.machine < b.machine ? -1 : (a.machine > b.machine ? 1 : 0);
    });

    var header = "Machine".padEnd(15) + "Port".padEnd(7) + "Dup".padEnd(5) + "-u".padEnd(9) + "Connectivity".padEnd(36) + "Data Age";
    // Header + divider colored the same blue as Service State's "--- X ---"
    // section headers, for a consistent visual anchor across extensions.
    var lines = [
        "<span class=\"info\">" + escapeHtml(header) + "</span>",
        "<span class=\"info\">" + escapeHtml("-".repeat(header.length)) + "</span>"
    ];
    rows.forEach(function(r) {
        var freshnessClass = (/no cnc_logs directory yet$/.test(r.freshness) || /no data files found$/.test(r.freshness))
            ? "warn"
            : null;
        lines.push(
            colorMachineHealthField(r.machine, 15, null) +
            colorMachineHealthField(r.port, 7, null) +
            colorMachineHealthField(r.dup, 5, r.dup ? "warn" : null) +
            colorMachineHealthField(r.uStatus, 9, r.uStatus === "MISSING" ? "warn" : (r.uStatus === "OK" ? "success" : null)) +
            colorMachineHealthField(r.connectivity, 36, machineHealthConnClass(r.connectivity)) +
            colorMachineHealthField(r.freshness, 0, freshnessClass)
        );
    });
    return lines.join("\n");
}

machineHealthBtn.addEventListener("click", function() {
    if (!confirmLeavingLiveLog()) return;
    stopLiveLog();
    setActiveLogBtn(machineHealthBtn);
    disableButtons(true);
    output.innerHTML = "<span class=\"info\">--- Machine Health ---</span>\nGathering port/duplicate, buffering, and data freshness info...\n";

    cockpit.spawn(["bash", "-c", HAAS_PORTS_SCRIPT], { superuser: "require", err: "message" })
        .done(function(portsData) {
            cockpit.spawn(["bash", "-c", HAAS_BUFFERING_CHECK_SCRIPT], { superuser: "require", err: "message" })
                .done(function(bufData) {
                    cockpit.spawn(["bash", "-c", HAAS_DATA_FRESHNESS_SCRIPT], { superuser: "require", err: "message" })
                        .done(function(freshData) {
                            output.innerHTML += "\nRunning connectivity check (this can take several seconds)...\n";

                            cockpit.spawn(["bash", "-c", HAAS_CONNECTIVITY_SCRIPT], { superuser: "require", err: "message" })
                                .done(function(connData) {
                                    output.innerHTML = "<span class=\"info\">--- Machine Health ---</span>\n\n" +
                                        buildMachineHealthTable(portsData, bufData, connData, freshData);
                                })
                                .fail(function(ex, data) {
                                    output.innerHTML += "\n<span class=\"error\">ERROR checking connectivity: " + escapeHtml(ex.message || JSON.stringify(ex)) + "</span>";
                                    if (data) output.innerHTML += "\n" + escapeHtml(data);
                                })
                                .always(function() {
                                    setActiveLogBtn(null);
                                    disableButtons(false);
                                });
                        })
                        .fail(function(ex, data) {
                            output.innerHTML += "\n<span class=\"error\">ERROR checking data freshness: " + escapeHtml(ex.message || JSON.stringify(ex)) + "</span>";
                            if (data) output.innerHTML += "\n" + escapeHtml(data);
                            setActiveLogBtn(null);
                            disableButtons(false);
                        });
                })
                .fail(function(ex, data) {
                    output.innerHTML += "\n<span class=\"error\">ERROR checking for -u: " + escapeHtml(ex.message || JSON.stringify(ex)) + "</span>";
                    if (data) output.innerHTML += "\n" + escapeHtml(data);
                    setActiveLogBtn(null);
                    disableButtons(false);
                });
        })
        .fail(function(ex, data) {
            output.innerHTML += "\n<span class=\"error\">ERROR checking ports: " + escapeHtml(ex.message || JSON.stringify(ex)) + "</span>";
            if (data) output.innerHTML += "\n" + escapeHtml(data);
            setActiveLogBtn(null);
            disableButtons(false);
        });
});

// ── Shared: populate the services dropdown ────────────────────────────────────

function populateServicesList() {
    servicesList.innerHTML = "<option value=\"\">— loading... —</option>";
    servicesList.classList.remove("hidden");

    cockpit.spawn(
        ["bash", "-c", "ls /etc/systemd/system/haas-*.service 2>/dev/null"],
        { superuser: "require", err: "message" }
    )
        .done(function(data) {
            var files = data.trim() ? data.trim().split("\n") : [];
            servicesList.innerHTML = "<option value=\"\">— select a service file —</option>";
            if (files.length === 0) {
                servicesList.innerHTML = "<option value=\"\">No haas-*.service files found</option>";
            } else {
                files.forEach(function(f) {
                    f = f.trim();
                    var opt = document.createElement("option");
                    opt.value = f;
                    // Every entry here is "haas-<machine>.service" (the ls
                    // glob guarantees the prefix/suffix), so both are dead
                    // weight in the label — with 20-99 machines, they'd
                    // also defeat the browser's native type-ahead (jump to
                    // an option by typing its first letters), since every
                    // option would start with the same "haas-" text. With
                    // the prefix/suffix stripped, "s" jumps straight to
                    // st10y/st30/st40/etc, no custom filtering UI needed.
                    opt.textContent = f
                        .replace("/etc/systemd/system/haas-", "")
                        .replace(/\.service$/, "");
                    servicesList.appendChild(opt);
                });
            }
        })
        .fail(function(ex) {
            servicesList.innerHTML = "<option value=\"\">Error: " + (ex.message || "failed to list files") + "</option>";
        });
}

// ── Edit Services ─────────────────────────────────────────────────────────────

editServicesBtn.addEventListener("click", function() {
    if (!confirmLeavingLiveLog()) return;
    stopLiveLog();
    setActiveLogBtn(editServicesBtn);
    serviceListMode = "edit";
    populateServicesList();
});

// ── Delete Service ────────────────────────────────────────────────────────────

deleteServiceBtn.addEventListener("click", function() {
    if (!confirmLeavingLiveLog()) return;
    stopLiveLog();
    setActiveLogBtn(deleteServiceBtn);
    serviceListMode = "delete";
    populateServicesList();
});

servicesList.addEventListener("change", function() {
    var path = servicesList.value;
    if (!path) return;

    if (serviceListMode === "delete") {
        var name = path.replace("/etc/systemd/system/", "");
        var machine = name.replace(/^haas-/, "").replace(/\.service$/, "");
        if (!confirm("Delete " + name + "? This cannot be undone.\n\nThe directory " + machine + " will NOT be deleted.")) {
            servicesList.value = "";
            return;
        }

        output.classList.remove("hidden");
        output.textContent = "Stopping " + name + "...\n";
        disableButtons(true);

        cockpit.spawn(["systemctl", "stop", name], { superuser: "require", err: "message" })
            .done(function() {
                output.textContent += "Stopped.\n\nDisabling " + name + "...\n";
                cockpit.spawn(["systemctl", "disable", name], { superuser: "require", err: "message" })
                    .done(function() {
                        output.textContent += "Disabled.\n\nRemoving " + path + "...\n";
                        cockpit.spawn(["rm", path], { superuser: "require", err: "message" })
                            .done(function() {
                                output.textContent += "Removed.\n\nRunning systemctl daemon-reload...\n";
                                cockpit.spawn(["systemctl", "daemon-reload"], { superuser: "require", err: "message" })
                                    .done(function() {
                                        output.textContent += name + " deleted successfully.\n";
                                        disableButtons(false);
                                        servicesList.classList.add("hidden");
                                    })
                                    .fail(function(ex, data) {
                                        output.textContent += "daemon-reload failed: " + (ex.message || JSON.stringify(ex)) + "\n";
                                        if (data) output.textContent += data;
                                        disableButtons(false);
                                        servicesList.classList.add("hidden");
                                    });
                            })
                            .fail(function(ex, data) {
                                output.textContent += "rm failed: " + (ex.message || JSON.stringify(ex)) + "\n";
                                if (data) output.textContent += data;
                                disableButtons(false);
                            });
                    })
                    .fail(function(ex, data) {
                        output.textContent += "disable failed: " + (ex.message || JSON.stringify(ex)) + "\n";
                        if (data) output.textContent += data;
                        disableButtons(false);
                    });
            })
            .fail(function(ex, data) {
                output.textContent += "stop failed: " + (ex.message || JSON.stringify(ex)) + "\n";
                if (data) output.textContent += data;
                disableButtons(false);
            });
        return;
    }

    // edit mode
    output.textContent = "Loading " + path + "...\n";

    cockpit.file(path, { superuser: "require" })
        .read()
        .done(function(content) {
            if (content === null) {
                output.textContent = "ERROR: Could not read " + path + "\n";
                return;
            }
            showServiceEditor(path, content);
        })
        .fail(function(ex) {
            output.textContent = "ERROR reading " + path + ": " + (ex.message || JSON.stringify(ex)) + "\n";
        });
});

// ── Create Service ────────────────────────────────────────────────────────────

// Real-time character filtering for Create Service fields
svcName.addEventListener("input", function() {
    var pos = svcName.selectionStart;
    var cleaned = svcName.value.replace(/[^0-9a-zA-Z_-]/g, "");
    if (cleaned !== svcName.value) {
        svcName.value = cleaned;
        svcName.setSelectionRange(pos - 1, pos - 1);
    }
});

svcDescription.addEventListener("input", function() {
    var pos = svcDescription.selectionStart;
    var cleaned = svcDescription.value.replace(/[^0-9a-zA-Z_ -]/g, "");
    if (cleaned !== svcDescription.value) {
        svcDescription.value = cleaned;
        svcDescription.setSelectionRange(pos - 1, pos - 1);
    }
});

svcIpAddress.addEventListener("input", function() {
    var pos = svcIpAddress.selectionStart;
    var cleaned = svcIpAddress.value.replace(/[^0-9.]/g, "");
    if (cleaned !== svcIpAddress.value) {
        svcIpAddress.value = cleaned;
        svcIpAddress.setSelectionRange(pos - 1, pos - 1);
    }
});

createServiceBtn.addEventListener("click", function() {
    if (!confirmLeavingLiveLog()) return;
    stopLiveLog();
    isCreatingService = true;
    showCreateServiceForm();
});

// ── Save & Reload daemon ──────────────────────────────────────────────────────

saveServiceBtn.addEventListener("click", function() {
    if (isCreatingService) {
        var description = svcDescription.value.trim();
        var machine     = svcName.value.trim().toLowerCase();
        var ipAddress   = svcIpAddress.value.trim();
        var port        = svcPort.value.trim();

        if (!description || !machine || !ipAddress || !port) {
            output.textContent = "ERROR: All four fields are required.\n";
            output.classList.remove("hidden");
            return;
        }

        if (!isValidIpv4(ipAddress)) {
            output.textContent = "ERROR: IP address must be a valid IPv4 address (e.g. 192.168.10.143).\n";
            output.classList.remove("hidden");
            return;
        }

        if (!isValidServicePort(port)) {
            output.textContent = "ERROR: Port must be an integer between 5001 and 5099 (Haas's recommended TCP/IP port range).\n";
            output.classList.remove("hidden");
            return;
        }

        var content = [
            "[Unit]",
            "Description=" + description,
            "After=network.target",
            "",
            "[Service]",
            "User=haas",
            "WorkingDirectory=/home/haas/Haas_Data_collect/machines/" + machine,
            "ExecStart=/usr/bin/python3 -u /home/haas/Haas_Data_collect/haas_logger2.py -a -t " + ipAddress + " --port " + port + " --name " + machine.toUpperCase(),
            "Type=idle",
            "Restart=on-failure",
            "RestartSec=5",
            "",
            "[Install]",
            "WantedBy=multi-user.target"
        ].join("\n");

        var serviceName = "haas-" + machine + ".service";
        var path = "/etc/systemd/system/" + serviceName;

        isCreatingService = false;
        hideServiceEditor();
        output.textContent = "Saving " + path + "...\n";

        cockpit.file(path, { superuser: "require" })
            .replace(content)
            .done(function() {
                var workDir = "/home/haas/Haas_Data_collect/machines/" + machine;
                output.textContent += "Saved.\n\nCreating " + workDir + "...\n";
                cockpit.spawn(["mkdir", "-p", workDir], { superuser: "require", err: "message" })
                    .done(function() {
                        output.textContent += "Directory ready.\n\nRunning systemctl daemon-reload...\n";
                        cockpit.spawn(["systemctl", "daemon-reload"], { superuser: "require", err: "message" })
                            .done(function() {
                                output.textContent += "daemon-reload complete.\n\nEnabling " + serviceName + "...\n";
                                cockpit.spawn(["systemctl", "enable", serviceName], { superuser: "require", err: "message" })
                                    .done(function() {
                                        output.textContent += "Enabled.\n\nStarting " + serviceName + "...\n";
                                        cockpit.spawn(["systemctl", "start", serviceName], { superuser: "require", err: "message" })
                                            .done(function() {
                                                output.textContent += serviceName + " started successfully.\n\n--- systemctl status ---\n";
                                                cockpit.spawn(["systemctl", "status", serviceName], { superuser: "require", err: "message" })
                                                    .done(function(data) {
                                                        output.textContent += data;

                                                        cockpit.spawn(["bash", "-c", HAAS_PORTS_SCRIPT], { superuser: "require", err: "message" })
                                                            .done(function(portData) {
                                                                output.textContent += "\n" + portData;
                                                            })
                                                            .fail(function(ex, data2) {
                                                                output.textContent += "\nERROR checking ports: " + (ex.message || JSON.stringify(ex));
                                                                if (data2) output.textContent += "\n" + data2;
                                                            });
                                                    })
                                                    .fail(function(ex, data) {
                                                        if (data) output.textContent += data;
                                                    });
                                            })
                                            .fail(function(ex, data) {
                                                output.textContent += "start failed: " + (ex.message || JSON.stringify(ex)) + "\n";
                                                if (data) output.textContent += data;
                                            });
                                    })
                                    .fail(function(ex, data) {
                                        output.textContent += "enable failed: " + (ex.message || JSON.stringify(ex)) + "\n";
                                        if (data) output.textContent += data;
                                    });
                            })
                            .fail(function(ex, data) {
                                output.textContent += "daemon-reload failed: " + (ex.message || JSON.stringify(ex)) + "\n";
                                if (data) output.textContent += data;
                            });
                    })
                    .fail(function(ex, data) {
                        output.textContent += "mkdir failed: " + (ex.message || JSON.stringify(ex)) + "\n";
                        if (data) output.textContent += data;
                    });
            })
            .fail(function(ex) {
                output.textContent += "ERROR saving file: " + (ex.message || JSON.stringify(ex)) + "\n";
            });
        return;
    }

    var content = serviceEditorArea.value;
    if (!content.trim()) {
        output.textContent = "ERROR: Editor is empty — not saving.\n";
        hideServiceEditor();
        return;
    }

    // Create Service validates IP/port on its structured fields, but this
    // editor is free text — an admin can type anything into ExecStart, and
    // nothing here would otherwise catch it (e.g. a mistyped IP octet like
    // "192.168.10.1435" would save and restart the service unchecked).
    // Only validate when the expected -t/--port/--name flags are actually
    // present, so edits to non-standard unit files aren't blocked.
    var execStartMatch = content.match(/^ExecStart=.*$/m);
    if (execStartMatch) {
        var execStartLine = execStartMatch[0];

        var ipMatch = execStartLine.match(/-t\s+(\S+)/);
        if (ipMatch && !isValidIpv4(ipMatch[1])) {
            output.textContent = "ERROR: Invalid IP address in ExecStart (-t " + ipMatch[1] + ") — must be a valid IPv4 address.\n";
            output.classList.remove("hidden");
            return;
        }

        var portMatch = execStartLine.match(/--port\s+(\S+)/);
        if (portMatch && !isValidServicePort(portMatch[1])) {
            output.textContent = "ERROR: Invalid port in ExecStart (--port " + portMatch[1] + ") — must be an integer between 5001 and 5099.\n";
            output.classList.remove("hidden");
            return;
        }

        var nameMatch = execStartLine.match(/--name\s+(\S+)/);
        if (nameMatch && /[^0-9a-zA-Z_-]/.test(nameMatch[1])) {
            output.textContent = "ERROR: Invalid machine name in ExecStart (--name " + nameMatch[1] + ") — letters, digits, underscore, and hyphen only.\n";
            output.classList.remove("hidden");
            return;
        }
    }

    var path = currentServicePath;
    var editedService = path.replace("/etc/systemd/system/", "");

    if (!confirm("This will overwrite " + path + " and restart " + editedService + ". Continue?")) {
        return;
    }

    hideServiceEditor();
    output.textContent = "Saving " + path + "...\n";

    cockpit.file(path, { superuser: "require" })
        .replace(content)
        .done(function() {
            output.textContent += "Saved.\n\nRunning systemctl daemon-reload...\n";

            cockpit.spawn(["systemctl", "daemon-reload"], { superuser: "require", err: "message" })
                .done(function() {
                    output.textContent += "daemon-reload complete.\n\nRestarting " + editedService + "...\n";
                    cockpit.spawn(["systemctl", "restart", editedService], { superuser: "require", err: "message" })
                        .done(function() {
                            output.textContent += editedService + " restarted.\n\n--- systemctl status ---\n";
                            cockpit.spawn(["systemctl", "status", editedService], { superuser: "require", err: "message" })
                                .done(function(data) {
                                    output.textContent += data;
                                })
                                .fail(function(ex, data) {
                                    if (data) output.textContent += data;
                                });
                        })
                        .fail(function(ex, data) {
                            output.textContent += "restart failed: " + (ex.message || JSON.stringify(ex)) + "\n";
                            if (data) output.textContent += data;
                        });
                })
                .fail(function(ex, data) {
                    output.textContent += "daemon-reload failed: " + (ex.message || JSON.stringify(ex)) + "\n";
                    if (data) output.textContent += data;
                });
        })
        .fail(function(ex) {
            output.textContent += "ERROR saving file: " + (ex.message || JSON.stringify(ex)) + "\n";
        });
});

cancelServiceEditBtn.addEventListener("click", function() {
    isCreatingService = false;
    hideServiceEditor();
    output.textContent = "Edit cancelled.\n";
    setActiveLogBtn(null);
});

// Show "Ready" state on load
output.textContent = "Ready.";

// Show the appliance's IPv4 + MAC for each active physical network
// interface next to the page title — lets an admin confirm at a glance
// which interface(s) Cockpit is actually reachable on, without needing
// a terminal. Only physical interfaces (real NICs, not bridges/VMs) are
// considered, via checking that /sys/class/net/<iface>/device exists.
// No sudo needed — reading interface info doesn't require root.
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

// Opens the published docs page for this extension in a new tab.
document.getElementById("helpBtn").addEventListener("click", function() {
    window.open(
        "https://rikosintie.github.io/Haas_Data_collect/manage_the_appliance/python_scripts/",
        "_blank",
        "noopener,noreferrer"
    );
});
