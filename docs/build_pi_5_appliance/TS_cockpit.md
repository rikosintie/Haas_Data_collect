# Troubleshooting cockpit

The extension `Privacy Badger` will cause the:

- Accounts
-Services

Pages to flash constantly. If this occurs, click on the `Privacy Badger` and then click "Disable for this site"

The web console in `Developer tools` is useful for troubleshooting Cockpit. While the cockpit homepage is displayed (https://localhost:9090 or https://[appliance_ip:9090]) press F12 to view the developer tools. The click on `console` to view real time messages.

So we can now eliminate:

permissions

- directory visibility
-manifest structure
- manifest encoding
- missing files
- browser cache
- stale routing
- wrong URL
- wrong HTML structure

----------------------------------------------------------------

$ ls -ld /usr/share/cockpit
drwxr-xr-x 15 root root 4096 Jan 15 14:59 /usr/share/cockpit

/usr/share/cockpit/haas-firewall ⌚ 18:34:28
$ namei -l /usr/share/cockpit/haas-firewall
f: /usr/share/cockpit/haas-firewall
drwxr-xr-x root root /
drwxr-xr-x root root usr
drwxr-xr-x root root share
drwxr-xr-x root root cockpit
drwxr-xr-x root root haas-firewall

----------------------------------------------------------------

/usr/share/cockpit/haas-firewall ⌚ 18:29:09
$ cat manifest.json
{
    "version": 2,
    "name": "haas-firewall",
    "label": "Haas Firewall",
    "icon": "icon.png",
    "requires": {
        "cockpit": "*"
    },
    "translation": false,
    "entry": "index.html",

    "files": [
	"manifest.json",
        "index.html",
        "haas-firewall.js",
	"haas-firewall.css",
        "icon.png"
    ],
    "menu": {
        "index.html": {
            "label": "Firewall Control",
            "order": 10,
            "category": "system"
        }
    }
}

----------------------------------------------------------------

$ jq . /usr/share/cockpit/haas-firewall/manifest.json
{
  "version": 2,
  "name": "haas-firewall",
  "label": "Haas Firewall",
  "icon": "icon.png",
  "requires": {
    "cockpit": "*"
  },
  "translation": false,
  "entry": "index.html",
  "files": [
    "manifest.json",
    "index.html",
    "haas-firewall.js",
    "haas-firewall.css",
    "icon.png"
  ],
  "menu": {
    "index.html": {
      "label": "Firewall Control",
      "order": 10,
      "category": "system"
    }
  }
}

----------------------------------------------------------------

cockpit.js ERROR_CORRUPTED_CONTENT

sudo iconv -f utf-8 -t utf-8 /usr/share/cockpit/haas-firewall/manifest.json -o /tmp/manifest.fixed
