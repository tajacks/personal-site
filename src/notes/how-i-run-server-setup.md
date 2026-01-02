---
layout: variable-note.njk
title: "Server Setup"
category: Infrastructure
description: "Initial setup runbook for new servers"
tags:
  - infrastructure
  - servers
created: 2025-12-28
series: how-i-run
seriesOrder: 1
variables:
  - name: ADMIN_USER
    description: "Your admin username (e.g., tjack)"
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
