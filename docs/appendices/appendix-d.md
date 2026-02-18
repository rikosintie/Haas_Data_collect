# Other options for the service file

systemd has capabilities far beyond what is needed for this script. I used Gemini to research systemd for this project. Gemini has a lot of knowledge of `systemd` if you want to add more services to your appliance :smiley:

The `Type=` directive in a systemd service file's [Service] section defines how the service manager determines that a service has successfully started.

Beyond simple, the available Type options include:

- **exec:** Similar to simple, but systemd considers the service started only after the main service binary has been successfully executed. This is often the preferred choice for long-running processes because it ensures errors like "missing file" are caught during startup.
- **forking:** Used for traditional UNIX daemons that "fork" into the background. Systemd considers the service started when the parent process exits. It is highly recommended to use PIDFile= with this type so systemd can track the correct child process.
- **oneshot:* Ideal for scripts that perform a task and then exit. Unlike simple, systemd waits for the process to exit before starting follow-up units. It is often paired with RemainAfterExit=yes to keep the service marked as "active" after completion.
- **notify:** Similar to exec, but the application must explicitly send a "READY=1" signal to systemd (via sd_notify) once it is fully initialized. This is the most reliable way to handle services with long internal initialization periods.
- **notify-reload:** A more recent addition that behaves like notify but also implements a standardized protocol for reloading. It expects the service to send "RELOADING=1" when it starts a configuration reload.
- **dbus:** The service is considered started once it acquires a specific name on the D-Bus bus. You must specify the expected name using the BusName= directive.
- **idle:** Similar to simple, but execution is delayed until all other active jobs are finished. This is primarily used to prevent service output from cluttering the boot console.

----------------------------------------------------------------
