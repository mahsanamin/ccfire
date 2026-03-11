# ccfire

A self-hosted web interface for [Claude Code](https://docs.anthropic.com/en/docs/claude-code), designed for on-the-go access from any browser or mobile device.

Instead of being tied to your terminal, ccfire acts as a lightweight access point to your existing Claude Code installation — same session, same user, no API keys involved. Spin it up via Docker, optionally tunnel through Tailscale, and fire off coding tasks from anywhere.

**Features**: project directory mounting, usage tracking (cost, tokens, duration), multi-turn conversation sessions, REST API for scripting.

## Quick Start

```bash
# 1. Configure your projects directory
cp .env.example .env
# Edit .env and set PROJECTS_DIR to your repos path (e.g. ~/repos)

# 2. Start the container
./ccfire start

# 3. Shell into the container and authenticate Claude
./ccfire ssh
claude          # follow the auth flow, then exit

# 4. Open the web UI
open http://localhost:8283
```

Select a project from the dropdown, type a prompt, and go.

## Mounting Projects

ccfire mounts your host projects directory at `/projects` inside the container. Set it in `.env`:

```bash
PROJECTS_DIR=/path/to/your/repos
```

All subdirectories appear in the **Project** dropdown in the web UI. Claude can read and modify files in the selected project.

## Commands

```
./ccfire start       Build and start the container
./ccfire stop        Stop and remove the container
./ccfire restart     Restart the container
./ccfire ssh         Shell into the container
./ccfire logs        Tail container logs
./ccfire status      Show container status
```

## API

Full reference: [docs/API.md](docs/API.md)

```bash
# Fire a prompt against a project
curl -X POST http://localhost:8283/api/run \
  -H "Content-Type: application/json" \
  -d '{"prompt": "explain the auth flow", "cwd": "my-project", "session": "review"}'

# Poll for result
curl http://localhost:8283/api/status/<job_id>
```

| Endpoint                  | Description                              |
| ------------------------- | ---------------------------------------- |
| `POST /api/run`           | Submit a prompt                          |
| `GET /api/status/:job_id` | Poll for result + usage stats            |
| `GET /api/sessions`       | List active sessions                     |
| `GET /api/projects`       | List available projects from mounted dir |

## How It Works

```
Browser / curl / script
        |
   POST /api/run  -->  Express server  -->  Claude Code CLI (in /projects/<name>)
        |                                        |
   GET /api/status  <--  { output, usage }  <----+
```

Everything runs inside a single Docker container: Node.js server + Claude Code CLI. Auth persists in a named volume across restarts.

## Remote Access

Pair with [Tailscale](https://tailscale.com/) for secure access from your phone or another machine — no ports exposed to the public internet.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) with Compose v2+

## Note

ccfire doesn't use or expose Anthropic API keys. It provides web-based access to an existing Claude Code installation for the same local user — consistent with personal, non-commercial use.

## License

MIT
