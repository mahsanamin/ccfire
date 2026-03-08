# ccfire — Execution Plan

## Summary

Dockerized web app that wraps `claude` CLI. User SSHs into the container to authenticate Claude Code once, then uses the browser UI to fire prompts.

---

## Project Structure

```
ccfire/
├── ccfire                  # CLI entrypoint (bash script)
├── docker-compose.yml
├── Dockerfile
├── server.js
├── index.html
├── package.json
├── outputs/                # auto-created, gitignored
└── docs/specs/
    ├── draft.md
    └── executionPlan.md
```

---

## Steps

### 1. Dockerfile

- Base: `node:22-slim`
- Install: `openssh-server`, `curl`
- Install Claude CLI (`claude` binary via Anthropic's install script)
- Configure SSHD:
  - Allow root login with password (default password: `ccfire` — user can change)
  - Expose port 22 internally
- Copy app files, `npm install`
- Entrypoint: start SSHD + start Node server (`node server.js`)

### 2. docker-compose.yml

```yaml
services:
  ccfire:
    build: .
    container_name: ccfire
    ports:
      - "8283:8283"   # web UI
      - "2222:22"     # SSH
    volumes:
      - ./outputs:/app/outputs
      - ccfire-claude-config:/root/.claude  # persist auth across restarts

volumes:
  ccfire-claude-config:
```

### 3. `ccfire` CLI wrapper (bash script at project root)

Make executable (`chmod +x ccfire`). Commands:

| Command | Maps to |
|---|---|
| `./ccfire start` | `docker compose up -d --build` |
| `./ccfire stop` | `docker compose down` |
| `./ccfire restart` | `docker compose restart` |
| `./ccfire ssh` | `docker exec -it ccfire /bin/bash` |
| `./ccfire logs` | `docker compose logs -f` |
| `./ccfire status` | `docker compose ps` |

### 4. server.js

Exactly as draft specifies:
- `POST /api/run` — spawn `claude -p "<prompt>" --dangerously-skip-permissions`, return `job_id`
- `GET /api/status/:job_id` — poll for result
- Serve `index.html` at `/`
- Port `8283`
- Auto-create `./outputs/` on startup

### 5. index.html

Single file, inline CSS/JS as draft specifies:
- Textarea for prompt, optional cwd input
- Submit → poll → display output
- Minimal clean UI

### 6. package.json

Dependencies: `express`, `uuid`
Script: `"start": "node server.js"`

---

## Workflow

```
./ccfire start          # builds & starts container
./ccfire ssh            # drops into container shell
> claude                # authenticate interactively (one-time)
> exit
# Open http://localhost:8283 — fire prompts from browser
./ccfire stop           # tear down
```

---

## Key Decisions

- **`docker exec` over SSH**: `./ccfire ssh` uses `docker exec -it` (simpler, no SSH keys needed). SSHD is still available on port 2222 as a fallback if user prefers real SSH.
- **Named volume for `~/.claude`**: Persists Claude auth across container rebuilds.
- **`outputs/` bind mount**: Results accessible from host filesystem.
- **No auth on the web UI**: Runs locally, as specified in draft.
