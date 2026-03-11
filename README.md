# ccfire

A self-hosted web interface for [Claude Code](https://docs.anthropic.com/en/docs/claude-code), designed for on-the-go access from any browser or mobile device.

Instead of being tied to your terminal, ccfire acts as a lightweight access point to your existing Claude Code installation — same session, same user, no API keys involved. Spin it up via Docker, optionally tunnel through Tailscale, and fire off coding tasks from anywhere.

**Features**: usage tracking (cost, tokens, duration), multi-turn conversation sessions, REST API for scripting and automation.

## Quick Start

```bash
./ccfire start              # build & run
./ccfire ssh                # shell into container
claude                      # authenticate once, then exit
```

Open **http://localhost:8283** and start prompting.

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
# Fire a prompt
curl -X POST http://localhost:8283/api/run \
  -H "Content-Type: application/json" \
  -d '{"prompt": "explain this code", "session": "my-project"}'

# Poll for result
curl http://localhost:8283/api/status/<job_id>
```

| Endpoint                  | Description                    |
| ------------------------- | ------------------------------ |
| `POST /api/run`           | Submit a prompt                |
| `GET /api/status/:job_id` | Poll for result + usage stats  |
| `GET /api/sessions`       | List active sessions           |

## How It Works

```
Browser / curl / script
        |
   POST /api/run  -->  Express server  -->  Claude Code CLI
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
