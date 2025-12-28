---
layout: note.njk
title: "Running Servers"
category: Infrastructure
description: "How I structure, setup, and maintain my servers"
tags:
  - infrastructure
  - servers
created: 2025-12-28
---

## Introduction

---

## Initial Setup

Update the `apt` cache.

```bash
apt update
```

Upgrade the system, using this upgrade command to remove packages if it is necessary.

```bash
apt full-upgrade
```

Clean the local repository of files that can no longer be downloaded.

```bash
apt autoclean
```

Remove any packages which were installed as a dependency of another package which are no longer needed.

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
| lsb-release         | Linux distribution identifier  |
| net-tools           | Network utilities              |
| rsync               | File synchronization tool      |
| rsyslog             | System logging daemon          |
| sysstat             | System performance tools       |
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
lsb-release \
net-tools \
rsync \
rsyslog \
sysstat \
tree \
ufw \
unattended-upgrades \
vim
```

### Create Admin User

The admin user will have privileged access to the server but does not run applications. This user will be configured to run `sudo` commands without a password prompt.

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
chmod 600 "/home/$ADMIN_USER/.ssh/authorized_keys"
chown "$ADMIN_USER:$ADMIN_USER" "/home/$ADMIN_USER/.ssh/authorized_keys"
```

### Create Application User

The application user will be a non-privileged user that runs containerized applications. This user has no `sudo` access and is isolated from administrative functions.

Create the user with a home directory.

```bash
useradd -m -s /usr/bin/bash -c "Application User" "$APP_USER"
```

### SSH Hardening

Hardening SSH access includes changing the default port, allowing only specific users to connect via SSH, and more. These changes can prevent the bulk of bots and scanners
which constantly attempt to find servers with open or weakly configured SSH access across the internet.

Take a backup of the configuration which shipped with the server before modifying it.

```bash
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak
```

Install the configuration, overwriting the current file.

```
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
```

```bash
echo '# Hardened SSH Configuration
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
Subsystem sftp /usr/lib/openssh/sftp-server' > /etc/ssh/sshd_config
```

Ensure the SSH service is enabled and reload the configuration.

```bash
systemctl enable ssh
systemctl reload ssh
```

If the connection succeeds, you can safely continue. If it fails, you still have your current session connected to fix any configuration issues.

### Setup fail2ban

fail2ban is a utility which monitors for unsuccessful SSH attempts in your authentication logs and temporarily bans IP
addresses which exceed a threshold. Write the configuration file.

```
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
destemail = root@localhost
sendername = Fail2Ban
action = %(action_)s
[sshd]
enabled = true
port = $SSH_PORT
filter = sshd
logpath = /var/log/auth.log
maxretry = 5
```

```bash
echo '[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5
destemail = root@localhost
sendername = Fail2Ban
action = %(action_)s
[sshd]
enabled = true
port = $SSH_PORT
filter = sshd
logpath = /var/log/auth.log
maxretry = 5' > /etc/fail2ban/jail.local
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

### Configure Firewall

`ufw` is the utility used for controlling the host firewall. A good starting place is to allow all outbound traffic,
deny all inbound traffic, and then selectively allow SSH + web traffic to your server. If your server will not serve
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

Set secure file permissions. The files may already have their permissions set appropriately, but nonetheless, it is good defensive practice to set them explicitly.

```bash
chmod 644 /etc/passwd
chmod 640 /etc/shadow
chmod 644 /etc/group
chmod 640 /etc/gshadow
chmod 600 /etc/ssh/sshd_config
```

### Configure Automatic Updates

The `unattended-upgrades` package automatically installs security updates to keep the system patched without manual intervention. This configuration enables automatic security updates while preventing automatic reboots, giving you control over when the server restarts.

Write the unattended-upgrades configuration.

```
Unattended-Upgrade::Allowed-Origins {
"${distro_id}:${distro_codename}";
"${distro_id}:${distro_codename}-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";
```

```bash
echo 'Unattended-Upgrade::Allowed-Origins {
"${distro_id}:${distro_codename}";
"${distro_id}:${distro_codename}-security";
};
Unattended-Upgrade::AutoFixInterruptedDpkg "true";
Unattended-Upgrade::MinimalSteps "true";
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";
Unattended-Upgrade::Automatic-Reboot "false";' > /etc/apt/apt.conf.d/50unattended-upgrades
chmod 644 /etc/apt/apt.conf.d/50unattended-upgrades
chown root:root /etc/apt/apt.conf.d/50unattended-upgrades
```

Write the automatic update schedule configuration.

```
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Unattended-Upgrade "1";
```

```bash
echo 'APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Download-Upgradeable-Packages "1";
APT::Periodic::AutocleanInterval "7";
APT::Periodic::Unattended-Upgrade "1";' > /etc/apt/apt.conf.d/20auto-upgrades
chmod 644 /etc/apt/apt.conf.d/20auto-upgrades
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

### Enable System Statistics

The `sysstat` package collects system performance and activity data, providing valuable metrics for monitoring CPU, memory, disk I/O, and network usage over time. Enable the service.

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

### Install Podman

Podman is a container engine and an alternative to Docker. Install the required packages.

```bash
apt install podman passt uidmap dbus-user-session systemd-container
```

Configure subordinate user and group ID ranges for the application user to enable rootless container operation.

```bash
usermod --add-subuids 100000-165535 "$APP_USER"
usermod --add-subgids 100000-165535 "$APP_USER"
```

Enable lingering for the application user. This allows this user's systemd manager to be spawned at boot time and keep running after this user has logged out.

```bash
loginctl enable-linger "$APP_USER"
```

Allow rootless Podman to bind to privileged ports below 1024.

```bash
echo "# Allow rootless Podman to bind to privileged ports (< 1024)
net.ipv4.ip_unprivileged_port_start=80" > /etc/sysctl.d/99-podman.conf
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

```
[storage]
driver = "overlay"
runroot = "/run/user/$APP_USER_UID/containers"
graphroot = "$HOME/.local/share/containers/storage"
```

```bash
APP_USER_UID=$(id -u "$APP_USER")
echo "[storage]
driver = \"overlay\"
runroot = \"/run/user/$APP_USER_UID/containers\"
graphroot = \"\$HOME/.local/share/containers/storage\"" > "/home/$APP_USER/.config/containers/storage.conf"
chmod 644 "/home/$APP_USER/.config/containers/storage.conf"
```

Set proper ownership.

```bash
chown -R "$APP_USER:$APP_USER" "/home/$APP_USER/.config"
chown -R "$APP_USER:$APP_USER" "/home/$APP_USER/.local"
```

Validate the Podman installation by running a test container as the application user. Use `machinectl` to start a login shell as the application user with proper systemd user session initialization.

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

### Post Installation Tasks

With the server configuration complete, a reboot ensures all changes take effect cleanly. After rebooting, reconnect using the newly configured admin user and SSH port. With the admin user established, it's time to audit and clean up any provisioning users (like `debian`) that may have been created by the cloud provider, and ensure the `root` account doesn't contain any SSH keys that would allow direct access.

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

