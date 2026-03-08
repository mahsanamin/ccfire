# ccfire

A local web interface for firing prompts at [Claude Code](https://docs.anthropic.com/en/docs/claude-code). Runs entirely in Docker — no cloud, no auth layer. Authenticate Claude once inside the container, then use the browser to submit prompts and view results.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) with Compose v2+

## Quick Start

```bash
# 1. Start the container
./ccfire start

# 2. Shell into the container and authenticate Claude
./ccfire ssh
claude          # follow the interactive auth flow, then /login
exit

# 3. Open the web UI
open http://localhost:8283
```

That's it. Type a prompt, hit **Run with Claude**, and see the output.

## Commands

```
./ccfire start     Build and start the container
./ccfire stop      Stop and remove the container
./ccfire restart   Restart the container
./ccfire ssh       Open a shell inside the container
./ccfire logs      Tail container logs
./ccfire status    Show container status
```

## How It Works

```
Browser (localhost:8283)
   │
   ├─ POST /api/run        → spawns: claude -p "<prompt>" --dangerously-skip-permissions
   └─ GET  /api/status/:id → polls until done, returns output
   │
Docker container (node:22-slim)
   ├─ Express server (server.js)
   ├─ Claude Code CLI (authenticated)
   └─ SSHD (fallback access on port 8322)
```

1. The web UI sends a prompt to the Express backend
2. The backend spawns `claude -p` as a child process
3. The frontend polls every 2 seconds until the job completes
4. Output is returned and displayed in the browser

## Ports

| Port   | Purpose                |
| ------ | ---------------------- |
| `8283` | Web UI                 |
| `8322` | SSH into container     |

## Persistence

- **Claude auth** — stored in a named Docker volume (`ccfire-claude-config`), survives container rebuilds. You only need to `/login` once.
- **Outputs** — kept in memory on the server. The `outputs/` bind mount is available for future use.

## API

#### `POST /api/run`

```json
{ "prompt": "your prompt here", "cwd": "/optional/working/dir" }
```

Returns: `{ "job_id": "uuid" }`

#### `GET /api/status/:job_id`

Returns:

```json
{
  "status": "done",
  "output": "Claude's response...",
  "startedAt": "...",
  "finishedAt": "...",
  "exitCode": 0
}
```

Status values: `running` | `done` | `error`

## Project Structure

```
ccfire/
├── ccfire                # CLI wrapper (bash)
├── docker-compose.yml
├── Dockerfile
├── entrypoint.sh         # Starts SSHD + Node server
├── server.js             # Express backend
├── index.html            # Single-file frontend
├── package.json
└── docs/specs/
    ├── draft.md          # Original spec
    └── executionPlan.md  # Implementation plan
```

## License

MIT
