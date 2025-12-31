---
layout: variable-note.njk
title: "Running Podman"
category: Infrastructure
description: "Installation and configuration of the Podman container runtime"
tags:
  - infrastructure
  - servers
  - podman
created: 2025-12-31
series: how-i-run
seriesOrder: 3
variables:
  - name: APP_USER
    description: "Application user name (e.g., app)"
---

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
