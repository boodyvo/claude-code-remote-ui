---
name: frp-skill
description: Manage FRP (Fast Reverse Proxy) TCP tunnels between this Mac and the Coolify server at automation.vocalyai.com. Use to expose local services (dev servers, databases, APIs) through the remote server on demand. Can add, remove, and list tunnels using the frp-proxy CLI.
---

# FRP Tunnel Management

`frpc` runs as a macOS LaunchAgent and maintains a persistent connection to `automation.vocalyai.com:7000`. Use `frp-proxy` to dynamically add/remove TCP tunnels without restarting frpc.

## Allowed Remote Ports

Remote ports must be in the range **10100–10200**.

## Commands

```bash
# Add a tunnel: expose local port on remote server
frp-proxy add <name> <local-port> <remote-port>

# Remove a tunnel
frp-proxy remove <name>

# List all configured tunnels (with public URLs)
frp-proxy list

# Check frpc process status + active tunnels
frp-proxy status

# Hot-reload config after manual edits
frp-proxy reload

# Follow live frpc logs
frp-proxy logs -f
```

## Agent Workflow

1. **Check existing tunnels first** to avoid port conflicts:
   ```bash
   frp-proxy list
   ```

2. **Pick an unused remote port** from 10100–10200 (not already in the list output).

3. **Add the tunnel**:
   ```bash
   frp-proxy add <name> <local-port> <chosen-remote-port>
   ```

4. **Verify it's active**:
   ```bash
   frp-proxy status
   ```

5. **Provide the public URL** to the user:
   `automation.vocalyai.com:<remote-port>`

6. **Clean up when done** to free the port:
   ```bash
   frp-proxy remove <name>
   ```

## Examples

Expose a local dev server on port 3000:
```bash
frp-proxy list                        # find a free port, e.g. 10150 is free
frp-proxy add devserver 3000 10150
frp-proxy status
# User accesses: automation.vocalyai.com:10150
```

Expose a local Postgres database temporarily:
```bash
frp-proxy add pgdev 5432 10110
# Remote connect: psql -h automation.vocalyai.com -p 10110 -U myuser mydb
frp-proxy remove pgdev               # always remove when done
```

## Troubleshooting

frpc not running:
```bash
launchctl start com.user.frpc
frp-proxy logs -f
```

frp-proxy command not found — run setup:
```bash
bash /Users/vlad/dev/scripts/frp/install-mac.sh
```

Remote port rejected (out of range) — use a port between 10100 and 10200.

Port already in use by another tunnel — run `frp-proxy list` and pick a different remote port.
