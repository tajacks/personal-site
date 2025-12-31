---
layout: note.njk
title: "Running Caddy"
category: Infrastructure
description: "Installation and configuration of the Caddy webserver"
tags:
  - infrastructure
  - servers
  - caddy
created: 2025-12-31
series: how-i-run
seriesOrder: 2
---

## Install Caddy

Caddy is my webserver of choice. I find it easier to manage upgrades, format configuration files, and generally reason
about the service when it is installed on the host directly, not in a container.

As `$ADMIN_USER`, install prerequisites for Caddy.

```bash
sudo apt install \
debian-keyring \
debian-archive-keyring
```

Import Caddy's signing key and create the an `apt` source.

```bash
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
```

Set the correct file permissions.

```bash
sudo chmod o+r /usr/share/keyrings/caddy-stable-archive-keyring.gpg
sudo chmod o+r /etc/apt/sources.list.d/caddy-stable.list
```

Update the `apt` cache.

```bash
sudo apt update
```

Install Caddy.

```bash
sudo apt install caddy
```

Stop and disable the system service for Caddy - we will run it under `$APP_USER`.

```bash
sudo systemctl disable --now caddy
```

Ensure that Caddy is stopped. Caddy should be reported as `Active: inactive (dead)`.

```bash
sudo systemctl status caddy
```

Allow the Caddy binary to bind to privileged ports without running as root. This is necessary when we run Caddy as
`$APP_USER`.

```bash
sudo setcap 'cap_net_bind_service=+ep' /usr/bin/caddy
```

Become the application user for the remainder of this section.

```bash
sudo machinectl shell "$APP_USER@"
```

### Create Caddy Configuration

Create the directory structure.

```bash
mkdir -p ~/caddy/data
mkdir -p ~/caddy/config
mkdir -p ~/www
```

Set the correct file permissions.

```bash
chmod 700 ~/caddy/data
chmod 700 ~/caddy/config
```

Create a basic, sample, Caddy configuration file (Caddyfile).

```bash
# Create Caddyfile
cat > ~/caddy/Caddyfile <<'EOF'
{
    admin localhost:2019
}

# Example static site
# example.com {
#     root * /home/app/www/demo
#     file_server
# }

# Example reverse proxy
# api.example.com {
#     reverse_proxy localhost:8080
# }
EOF
```

Create the systemd user service for Caddy.

```bash
mkdir -p ~/.config/systemd/user

cat > ~/.config/systemd/user/caddy.service <<'EOF'
[Unit]
Description=Caddy Web Server
After=network-online.target
Wants=network-online.target

[Service]
Type=notify
ExecStart=/usr/bin/caddy run --config %h/caddy/Caddyfile --adapter caddyfile
ExecReload=/usr/bin/caddy reload --config %h/caddy/Caddyfile --adapter caddyfile
Environment=XDG_DATA_HOME=%h/caddy/data
Environment=XDG_CONFIG_HOME=%h/caddy/config
Restart=always
RestartSec=10
TimeoutStopSec=5s
LimitNOFILE=1048576

[Install]
WantedBy=default.target
EOF
```

Enable and start Caddy

```bash
systemctl --user daemon-reload
systemctl --user enable caddy.service
systemctl --user start caddy.service
```

Ensure Caddy is running

```bash
systemctl --user status caddy.service
```


RANDOM NOTES

sudo tee /etc/fail2ban/filter.d/caddy.conf << 'EOF'
[Definition]
failregex = ^.*"client_ip":"<HOST>".*"status":\s*403.*$
ignoreregex =
EOF

sudo tee /etc/fail2ban/jail.d/caddy.local << 'EOF'
[caddy]
enabled = true
port = http,https
filter = caddy
logpath = /home/app/caddy/logs/*.log
maxretry = 5
findtime = 60
bantime = 1h
banaction = iptables-multiport
EOF

sudo systemctl restart fail2ban

app@sandbox:~$ tree
.
├── caddy
│   ├── Caddyfile
│   ├── config
│   │   └── caddy
│   │       └── autosave.json
│   ├── data
│   │   └── caddy
│   │       ├── acme
│   │       │   └── acme-v02.api.letsencrypt.org-directory
│   │       │       ├── challenge_tokens
│   │       │       └── users
│   │       │           └── default
│   │       │               ├── default.json
│   │       │               └── default.key
│   │       ├── certificates
│   │       │   └── acme-v02.api.letsencrypt.org-directory
│   │       │       └── sandbox.thomasjack.ca
│   │       │           ├── sandbox.thomasjack.ca.crt
│   │       │           ├── sandbox.thomasjack.ca.json
│   │       │           └── sandbox.thomasjack.ca.key
│   │       ├── instance.uuid
│   │       ├── last_clean.json
│   │       └── locks
│   ├── logs
│   │   └── sandbox.thomasjack.ca.log
│   └── sites
│       └── sandbox.thomasjack.ca.caddyfile
└── www
└── sandbox.thomasjack.ca
└── index.html


```caddy
{
        admin localhost:2019
}

(security) {
        @blocked {
                path /wp-* /wordpress/* /xmlrpc.php
                path /.env /.env.* /.git /.git/* /.svn /.svn/* /.hg /.hg/*
                path /.aws/* /.docker/* /config.json
                path /phpmyadmin/* /phpMyAdmin/* /adminer* /cgi-bin/*
                path /vendor/phpunit/* /eval-stdin.php
                path *.php *.asp *.aspx *.jsp
                path /alfa* /c99* /r57* /shell* /cmd* /upload*
                path /wlwmanifest.xml /tinymce/* /filemanager/*
                path */passwd */shadow */etc/shadow */etc/passwd
        }
        respond @blocked 403
}

(logging) {
        log {
                output file /home/app/caddy/logs/{args[0]}.log {
                        roll_size 25MiB
                        roll_keep 10
                        roll_keep_for 7d
                }
                format json
        }
}

(static) {
        import logging {args[0]}
        import security

        root * /home/app/www/{args[0]}
        file_server
}

(proxy) {
        import logging {args[0]}
        import security

        reverse_proxy {args[1]}
}

import sites/*.caddyfile
```


```
app@sandbox:~/caddy$ cat sites/sandbox.thomasjack.ca.caddyfile
sandbox.thomasjack.ca {
        import static sandbox.thomasjack.ca
}
```