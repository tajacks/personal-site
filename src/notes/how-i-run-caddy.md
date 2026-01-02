---
layout: variable-note.njk
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
variables:
  - name: ADMIN_USER
    description: "Your admin username (e.g., tjack)"
  - name: APP_USER
    description: "Application user name (e.g., app)"
  - name: SAMPLE_DOMAIN
    description: "The domain that will host the sample website served by Caddy (e.g. sandbox.thomasjack.ca)"
---

Caddy is my webserver of choice. I find it easier to manage upgrades, format configuration files, and generally reason
about the service when it is installed on the host directly, not in a container.

## Architecture

Caddy will be run as `$APP_USER`. Systemd lingering must be enabled for this user - this should already be done
if following the setup instructions in this series. 

The following directory structures will be created.

### Caddy

```
├── caddy
│   ├── Caddyfile // Main configuration file
│   ├── config
│   │   └── // Directory content managed by Caddy
│   ├── data 
│   │   └── // Directory content managed by Caddy
│   ├── logs
│   │   └── name.of.site.log // One logfile per domain
│   └── sites
│       └── sandbox.thomasjack.ca.caddyfile // One configuration file per domain
└── www
    └── sandbox.thomasjack.ca // Site content under www/domain.of.site
        └── index.html
```

In brief, the Caddyfile contains reusable configuration snippets which are read by individual configurations under the 
`sites` directory. This keeps centralized configuration in one file (Caddyfile) while allowing individual sites to use
or override those values in their own file.

I like keeping the site files separate from the Caddyfile so I can check them into version control in their own
repositories, reason about them individually, etc. 

### Web Content

```
└── www
    └── sandbox.thomasjack.ca // One directory named per domain
        └── index.html
```

The static website content layout is simple - one directory per domain, sharing the name of that domain, with static
content beneath it.

## Install

As `$ADMIN_USER`, install prerequisites for Caddy.

```bash
sudo apt install \
debian-keyring \
debian-archive-keyring
```

Import Caddy's signing key and create an `apt` source.

```bash
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
```

Set the correct file modes.

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

Stop and disable the generated systemd service for Caddy - we will run it under `$APP_USER`. "Masking" symlinks the 
global Caddy unit file to `/dev/null`, effectively preventing it from being started.

```bash
sudo systemctl disable --now caddy
sudo systemctl mask caddy
```

Ensure that Caddy is stopped. Caddy should be reported as `masked (Reason: Unit caddy.service is masked.)`.

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

### Create Web Content

This section will create some static placeholder web content to be served at `$SAMPLE_DOMAIN`. This is important to
ensure that Caddy is operating as expected.

Make the `www` directory, where all web content will be served from. Also create the domain specific directory.

```bash
mkdir -p ~/www/$SAMPLE_DOMAIN
```

Create a basic index page to server as placeholder content.

```bash
cat > ~/www/$SAMPLE_DOMAIN/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hello World</title>
    <style>
        body {
            font-family: system-ui, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: #f5f5f5;
        }
        main {
            text-align: center;
        }
        h1 {
            color: #333;
        }
        p {
            color: #666;
        }
    </style>
</head>
<body>
    <main>
        <h1>Hello World</h1>
        <p>Caddy is running.</p>
    </main>
</body>
</html>
EOF
```

### Create Caddy Configuration

Create the directory structure.

```bash
mkdir -p ~/caddy/config
mkdir -p ~/caddy/data
mkdir -p ~/caddy/logs
mkdir -p ~/caddy/sites
```

Set the correct file permissions.

```bash
chmod 700 ~/caddy/config
chmod 700 ~/caddy/data
chmod 700 ~/caddy/logs
chmod 700 ~/caddy/sites
```

Create the base Caddyfile with reusable snippets defined.

```bash
cat > ~/caddy/Caddyfile <<'EOF'
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
EOF
```

Create a placeholder site configuration.

```bash
cat > ~/caddy/sites/$SAMPLE_DOMAIN.caddyfile <<EOF
$SAMPLE_DOMAIN {
        import static $SAMPLE_DOMAIN
}
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

If everything went well, and so long as you have a DNS record pointing at this server, you should be able to visit
`https://$SAMPLE_DOMAIN` in your browser.

## Configure Fail2ban

This section is experimental. There are arguments that introducing a `fail2ban` jail for web traffic has limited
benefits. This said, I currently am trying it, and thus here it is. This will likely change or get removed.

Understand the following risks:

- If you use a CDN, blocking based on the host IP will block your CDN edge servers. Ouch!
- If you block an IP that uses a commercial VPN node, users who share that IP will be blocked. Double ouch!
- If you host other services through Caddy that require authentication, and may validly respond with a 403, you may block legitimate traffic. Triple ouch!

That being said...

Bots, scrapers, crawlers, and scanners are a fact of life. Here is a _very small_ snippet of some requests I receive.

```
<ip, request type, path, response code>
49.12.0.158 GET /wp-content/admin.php 403
109.61.89.58 GET /wp-includes/js/thickbox/ 403
109.248.43.162 GET /wp-includes/js/crop/ 403
109.248.43.117 GET /bb.php 403
169.150.247.180 GET /wso.php 403
109.248.43.236 GET /wp-includes/js/thickbox/ 403
185.111.111.169 GET /alfa.php 403
185.111.111.172 GET /as.php 403
109.248.43.179 GET /wp-admin/css/colors/blue/ 403
78.47.94.156 GET /wso.php 403
79.127.226.194 GET /info.php 403
109.248.43.179 GET /as.php 403
```

I don't use PHP nor WordPress. This traffic is just garbage from scanners looking for vulnerabilities and open data.
Recall the very limited security configuration from the Caddyfile.

```
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
```

This is far from a comprehensive block list, however, the intention here is to detect requests which are obviously wrong
based on the technologies I use and known attempted exploit paths. This directive, when used, instructs Caddy to respond
to requests that match these paths with a `403` (Forbidden) status. We can configure `fail2ban` to block hosts which 
request these paths too frequently at the host firewall level.

Execute these commands as the `$ADMIN_USER`.

Create a filter to look for 403 responses.

```bash
sudo tee /etc/fail2ban/filter.d/caddy.conf > /dev/null <<'EOF'
[Definition]
failregex = ^.*"client_ip":"<HOST>".*"status":\s*403.*$
ignoreregex =
EOF
```

Create a new jail configuration named `caddy`.

```bash
sudo tee /etc/fail2ban/jail.d/caddy.local > /dev/null <<'EOF'
[caddy]
enabled = true
port = http,https
filter = caddy
logpath = /home/app/caddy/logs/*.log
maxretry = 3
findtime = 60
bantime = 1d
banaction = iptables-multiport
EOF
```

Restart `fail2ban`.

```bash
sudo systemctl restart fail2ban
```

Ensure the configuration was picked up properly.

```bash
sudo fail2ban-client status caddy
```

After some time, you'll probably start to see hosts being blocked.

```
tjack@host:~$ sudo fail2ban-client status caddy
Status for the jail: caddy
|- Filter
|  |- Currently failed: 0
|  |- Total failed:     55
|  `- File list:        /home/app/caddy/logs/thomasjack.ca.log
`- Actions
   |- Currently banned: 13
   |- Total banned:     14
   `- Banned IP list:   94.130.222.48 4.194.133.126 74.225.136.96 20.184.35.52 74.176.56.30 13.74.146.113 4.190.203.84 52.147.68.81 74.176.59.137 4.194.52.158 213.202.253.4 217.182.64.155 4.197.176.45
```