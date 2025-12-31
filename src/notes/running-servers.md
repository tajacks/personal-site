---
layout: variable-note.njk
title: "Running Servers"
category: Infrastructure
description: "How I structure, setup, and maintain my servers"
tags:
  - infrastructure
  - servers
created: 2025-12-28
variables:
  - name: ADMIN_USER
    description: "Your admin username (e.g., thomas)"
  - name: ADMIN_USER_COMMENT
    description: "Full name or description for admin user"
  - name: ADMIN_SSH_KEY
    description: "Your SSH public key"
  - name: APP_USER
    description: "Application user name (e.g., app)"
  - name: SSH_PORT
    description: "Custom SSH port number (e.g., 2222)"
  - name: SERVER_IP
    description: "Your server's IP address"
---

## Introduction

This guide is a document for myself to capture what I know about running and managing
servers. It is used to document my personal architecture, setup, hardening, and ongoing maintenance procedures for hobby
servers.

It is not versioned and the current state reflects how I do things today. It is subject to change.

### Automation Tools

The steps in this note are intended to be manually executed. I've experimented with a variety of automation tools to
provision new servers (ansible, bash scripts, cloud-init, etc), and while they certainly are _neat_, they don't bring me
enough value. Setting up a new server manually takes ~30 minutes if you're decent on the command line (a skill
which setting up the server helps improve!) and I have found little to match the familiarity you build with your
infrastructure when you configure it manually.

I think of it like a construction project. If you were to do a small to medium-sized home renovation, it's likely worth
learning the skills to do much of the work yourself. You save money, learn new things, and know exactly what's going on
behind the walls. If you outsource the work, you declare the end state you wish to receive and the builder
(automation tool in this analogy) makes it so. While this works great for large projects, for small endeavours the
overhead of managing the builder, communicating requirements, and trusting work you didn't see happen can outweigh the
time saved. Similarly, declarative automation tools require investment in learning their syntax and maintaining their
configurations — time that may exceed the manual work they replace, especially when you only provision a server once
every few years.

This philosophy works where ultimately the stakes and volume of work are low. If I had to run a business to support my
livelihood, or provision tens to hundreds of servers, I would undoubtedly reach for an alternative.

For personal-use servers, it's great.

### Variable Usage

Setting shell variables can be skipped if you have configured custom values for all variables by using the
button at the top of this guide.

If setting variables in the shell, set the following to non-empty values.

```bash
ADMIN_USER=""           # I use 'tjack'
ADMIN_USER_COMMENT=""   # I use 'Thomas Jack'
ADMIN_SSH_KEY=""        # I use my personal SSH public key
APP_USER=""             # I use 'app'
SSH_PORT=""             # I use 2222
```

---

## Initial Setup

This section is intended to bring your server from the initial configuration to a hardened base with core configurations
that are ready to be built upon.

The commands in this section should be executed as the `root` user.

### System Updates

Update the `apt` cache to retrieve the latest versions of available packages.

```bash
apt update
```

Upgrade installed packages to their latest versions.

```bash
apt upgrade
```

Clean the local repository of packages that can no longer be downloaded.

```bash
apt autoclean
```

Remove any packages which were installed as a dependency of another package and are no longer needed.

```bash
apt autoremove
```

### Install Essential Packages

Install some core and generally useful software packages onto the server.

| Package             | Description                    |
|---------------------|--------------------------------|
| ca-certificates     | Common CA certificates         |
| curl                | Data transfer tool             |
| fail2ban            | Brute-force attack protection  |
| git                 | Version control system         |
| gnupg               | Encryption and signing toolkit |
| htop                | Interactive process viewer     |
| jq                  | JSON processor                 |
| lsb-release         | Linux distribution identifier  |
| net-tools           | Network utilities              |
| rsync               | File synchronization tool      |
| rsyslog             | System logging daemon          |
| sysstat             | System performance tools       |
| systemd-container   | Systemd container tools        |
| tree                | Directory listing tool         |
| ufw                 | Host-based firewall            |
| unattended-upgrades | Automatic security updates     |
| vim                 | Text editor                    |

```bash
apt install \
ca-certificates \
curl \
fail2ban \
git \
gnupg \
htop \
jq \
lsb-release \
net-tools \
rsync \
rsyslog \
sysstat \
systemd-container \
tree \
ufw \
unattended-upgrades \
vim
```

### Create Admin User

The admin user will have privileged access to the server but does not run applications. This user will be configured to
run `sudo` commands without a password prompt.

Create the user with a home directory.

```bash
useradd -m -s /usr/bin/bash -c "$ADMIN_USER_COMMENT" "$ADMIN_USER"
```

Add the user to the `sudo` group.

```bash
usermod -aG sudo "$ADMIN_USER"
```

Configure passwordless `sudo` for the admin user.

```bash
echo "$ADMIN_USER ALL=(ALL) NOPASSWD:ALL" > "/etc/sudoers.d/$ADMIN_USER"
```

Set the correct file permissions.

```bash
chmod 0440 "/etc/sudoers.d/$ADMIN_USER"
```

Create the admin user's SSH directory with proper ownership and file modes.

```bash
mkdir -p "/home/$ADMIN_USER/.ssh"
chmod 700 "/home/$ADMIN_USER/.ssh"
chown "$ADMIN_USER:$ADMIN_USER" "/home/$ADMIN_USER/.ssh"
```

Add the admin user's key to the authorized keys file.

```bash
echo "$ADMIN_SSH_KEY" > "/home/$ADMIN_USER/.ssh/authorized_keys"
```

Set the correct file permissions and ownership.

```bash
chmod 600 "/home/$ADMIN_USER/.ssh/authorized_keys"
chown "$ADMIN_USER:$ADMIN_USER" "/home/$ADMIN_USER/.ssh/authorized_keys"
```

### Create Application User

The application user will be a non-privileged user that runs containerized applications. This user has no `sudo` access
and is isolated from administrative functions.

Create the user with a home directory.

```bash
useradd -m -s /usr/bin/bash -c "Application User" "$APP_USER"
```

Enable lingering for the application user. This allows this user's systemd manager to be spawned at boot time and keep
running after this user has logged out.

```bash
loginctl enable-linger "$APP_USER"
```

### SSH Hardening

Hardening SSH access includes changing the default port, allowing only specific users to connect via SSH, disallowing
password based authentication, and more. These changes can prevent the bulk of bots and scanners which constantly
attempt to find servers with open or weakly configured SSH access across the internet.

Take a backup of the configuration which shipped with the server before modifying it.

```bash
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak
```

Install the configuration, overwriting the current file.

```bash
cat > /etc/ssh/sshd_config <<EOF
# Hardened SSH Configuration
# Network
Port $SSH_PORT
AddressFamily any
ListenAddress 0.0.0.0
ListenAddress ::
# Host Keys
HostKey /etc/ssh/ssh_host_ed25519_key
HostKey /etc/ssh/ssh_host_ecdsa_key
HostKey /etc/ssh/ssh_host_rsa_key
# Ciphers and keying
KexAlgorithms curve25519-sha256,curve25519-sha256@libssh.org,diffie-hellman-group16-sha512,diffie-hellman-group18-sha512
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com,aes256-ctr,aes192-ctr,aes128-ctr
MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com,hmac-sha2-512,hmac-sha2-256
# Authentication
PermitRootLogin no
PubkeyAuthentication yes
PasswordAuthentication no
PermitEmptyPasswords no
ChallengeResponseAuthentication no
UsePAM yes
# Security settings
MaxAuthTries 3
MaxSessions 10
LoginGraceTime 60
ClientAliveInterval 300
ClientAliveCountMax 2
MaxStartups 10:30:60
# Access control
AllowUsers $ADMIN_USER
# Logging
SyslogFacility AUTH
LogLevel VERBOSE
# Disable unnecessary features
X11Forwarding no
PrintMotd no
PrintLastLog yes
TCPKeepAlive yes
AcceptEnv LANG LC_*
# Subsystem
Subsystem sftp /usr/lib/openssh/sftp-server
EOF
```

Ensure the SSH service is enabled and reload the configuration.

```bash
systemctl enable ssh
systemctl reload ssh
```

If the connection succeeds, you can safely continue. If it fails, you still have your current session connected to fix
any configuration issues.

### Setup fail2ban

fail2ban is a utility which monitors for unsuccessful SSH attempts in your authentication logs and temporarily bans IP
addresses which exceed a threshold. Write the configuration file.

```bash
cat > /etc/fail2ban/jail.local <<EOF
[sshd]
enabled = true
port = $SSH_PORT
backend = systemd
maxretry = 5
findtime = 10m
bantime = 1h
EOF
```

Set file permissions and ownership.

```bash
chmod 644 /etc/fail2ban/jail.local
chown root:root /etc/fail2ban/jail.local
```

Enable and start fail2ban.

```bash
systemctl enable fail2ban
systemctl restart fail2ban
```

Check if fail2ban is running.

```bash
systemctl status fail2ban
```

Ensure the fail2ban SSH configuration is loaded.

```bash
fail2ban-client status sshd
```

### Configure Firewall

`ufw` is the utility used for controlling the host firewall. A good starting place is to allow all outbound traffic,
deny all inbound traffic, and then selectively allow SSH & web traffic to your server. If your server does not serve
web content, those rules can be omitted.

Set the default policies to deny incoming and allow outgoing traffic.

```bash
ufw default deny incoming
ufw default allow outgoing
```

Allow SSH and web traffic.

```bash
ufw allow "$SSH_PORT/tcp" comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
```

Enable the firewall.

```bash
ufw --force enable
```

Validate the rules.

```bash
ufw status verbose
```

### Secure File Permissions

Set secure file permissions. The files may already have their permissions set appropriately, but nonetheless, it is good
defensive practice to set them explicitly.

```bash
chmod 644 /etc/passwd
chmod 640 /etc/shadow
chmod 644 /etc/group
chmod 640 /etc/gshadow
chmod 600 /etc/ssh/sshd_config
```

### Configure Automatic Updates

The `unattended-upgrades` package automatically installs updates to keep the system patched without manual intervention.
This configuration enables automatic security updates while preventing automatic reboots, giving you control over when
the server restarts.

Reconfigure unattended-upgrades. Select 'Yes' in the dialog box.

```bash
dpkg-reconfigure -plow unattended-upgrades
```

Take a backup of the existing configuration files.

```bash
cp /etc/apt/apt.conf.d/50unattended-upgrades /etc/apt/apt.conf.d/50unattended-upgrades.bak
cp /etc/apt/apt.conf.d/20auto-upgrades /etc/apt/apt.conf.d/20auto-upgrades.bak
```

Write the unattended-upgrades configuration.

```bash
cat > /etc/apt/apt.conf.d/50unattended-upgrades <<'EOF'
Unattended-Upgrade::Origins-Pattern {
    "origin=Debian,codename=${distro_codename},label=Debian-Security";
    "origin=Debian,codename=${distro_codename}-security,label=Debian-Security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
EOF
```

Write the automatic update schedule configuration.

```bash
cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Unattended-Upgrade "1";
EOF
```

Set the correct file permissions and ownership.

```bash
chmod 644 /etc/apt/apt.conf.d/50unattended-upgrades
chmod 644 /etc/apt/apt.conf.d/20auto-upgrades
chown root:root /etc/apt/apt.conf.d/50unattended-upgrades
chown root:root /etc/apt/apt.conf.d/20auto-upgrades
```

Enable and start the service.

```bash
systemctl enable unattended-upgrades
systemctl start unattended-upgrades
```

Validate that the service is running.

```bash
systemctl status unattended-upgrades
```

You should see `active (running)` in the output. Verify the automatic upgrade configuration is recognised.

```bash
apt-config dump APT::Periodic::Unattended-Upgrade
```

This should return `APT::Periodic::Unattended-Upgrade "1";` confirming automatic upgrades are enabled.

Finally, perform a dry run.

```bash
unattended-upgrades --dry-run --debug
```

### Enable System Statistics

The `sysstat` package collects system performance and activity data, providing valuable metrics for monitoring CPU,
memory, disk I/O, and network usage over time. Enable the service.

```bash
systemctl enable sysstat
systemctl start sysstat
```

Configure sysstat to retain 28 days of history instead of the default 7 days.

```bash
sed -i 's/^HISTORY=.*/HISTORY=28/' /etc/sysstat/sysstat
```

Verify the configuration change.

```bash
grep HISTORY /etc/sysstat/sysstat
```

This should return `HISTORY=28`.

### Post Installation Tasks

With the server configuration complete, a reboot ensures all changes take effect cleanly. After rebooting, reconnect
using the newly configured admin user and SSH port. With the admin user established, it's time to audit and clean up any
provisioning users (like `debian`) that may have been created by the cloud provider, and ensure the `root` account
doesn't contain any SSH keys that would allow direct access.

Reboot the server.

```bash
reboot
```

After the server comes back online, reconnect using the admin user on the new SSH port. These variables won't be set
in your host. Replace them with the correct values.

```bash
ssh -p $SSH_PORT $ADMIN_USER@$SERVER_IP
```

Once connected, check for other interactive users with login shells that can be deleted.

```bash
sudo grep -E '/bin/(bash|sh|fish|zsh)' /etc/passwd
```

If you see any provisioning users like `debian` that are no longer needed, remove them.

```bash
sudo userdel -r debian
```

Finally, ensure the `root` account doesn't contain any SSH keys in its authorized keys file.

```bash
sudo rm /root/.ssh/authorized_keys
```

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


## Install Podman

Podman is a container engine and an alternative to Docker. Install the required packages.

```bash
apt install podman passt uidmap dbus-user-session systemd-container
```

Configure subordinate user and group ID ranges for the application user to enable rootless container operation.

```bash
usermod --add-subuids 100000-165535 "$APP_USER"
usermod --add-subgids 100000-165535 "$APP_USER"
```

Allow rootless Podman to bind to privileged ports below 1024.

```bash
cat > /etc/sysctl.d/99-podman.conf <<'EOF'
# Allow rootless Podman to bind to privileged ports (< 1024)
net.ipv4.ip_unprivileged_port_start=80
EOF
sysctl --system
```

Create the Podman storage configuration for the application user.

Create the required directories.

```bash
mkdir -p "/home/$APP_USER/.config/containers"
mkdir -p "/home/$APP_USER/.local/share/containers/storage"
chmod 755 "/home/$APP_USER/.config/containers"
```

Write the storage configuration file.

```bash
APP_USER_UID=$(id -u "$APP_USER")
cat > "/home/$APP_USER/.config/containers/storage.conf" <<EOF
[storage]
driver = "overlay"
runroot = "/run/user/$APP_USER_UID/containers"
graphroot = "\$HOME/.local/share/containers/storage"
EOF
```

Set the correct file permissions and ownership.

```bash
chmod 644 "/home/$APP_USER/.config/containers/storage.conf"
chown -R "$APP_USER:$APP_USER" "/home/$APP_USER/.config"
chown -R "$APP_USER:$APP_USER" "/home/$APP_USER/.local"
```

Validate the Podman installation by running a test container as the application user. Use `machinectl` to start a login
shell as the application user with proper systemd user session initialization.

```bash
machinectl shell "$APP_USER@"
```

Run a `hello-world` container to ensure Podman is working.

```bash
podman run --rm hello-world
```

If successful, you should see a welcome message from the container. Exit the application user's shell.

```bash
exit
```
