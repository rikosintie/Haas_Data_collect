# Security Policy

The Haas Data Collect project takes security seriously. This policy explains what's in scope, how to report a vulnerability, and what to expect after you do.

## Reporting a Vulnerability

**Email: mhubbard [at] network-dev.com**

Please do not open a public GitHub issue for a suspected vulnerability — report it privately by email so it can be assessed and, if needed, fixed before details are public.

### What to include

- A clear description of the issue and its potential impact
- Precise, step-by-step reproduction instructions (screenshots or terminal output are helpful)
- The affected file(s), script(s), or component(s), and the commit/version if known
- Any known mitigation or suggested fix, if you have one

### What to expect

- Acknowledgment of your report within a few days
- An assessment of severity and, where applicable, a fix or mitigation
- Credit in the fix's commit message or release notes, if you'd like it

## Scope

This applies to the appliance install/configuration scripts, the custom Cockpit extensions (`cockpit_firewall`, `cockpit_samba`, `cockpit_updates`, `cockpit_python`), and the Python data-collection scripts in this repository.

If the issue is in a third-party dependency this project uses (Samba, Cockpit, UFW, Ubuntu itself, etc.), please report it directly to that project's own security process instead — this repository can't fix vulnerabilities in software it doesn't maintain.

## Out of Scope

- General help configuring or deploying the appliance (use [GitHub Issues](https://github.com/rikosintie/Haas_Data_collect/issues) for that)
- Help applying OS or package security updates
- Issues that aren't security-related
