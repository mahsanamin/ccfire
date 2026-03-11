# ccfire

A self-hosted web interface for [Claude Code](https://docs.anthropic.com/en/docs/claude-code), designed for on-the-go access from any browser or mobile device.

Instead of being tied to your terminal, ccfire acts as a lightweight access point to your existing Claude Code installation — same session, same user, no API keys involved. Fire off coding tasks from anywhere.

**Features**: chat-based UI, session history with persistence, model selection (Haiku / Sonnet / Opus), project directory browsing, usage tracking (cost, tokens, duration), REST API for scripting.

## Two Modes

ccfire runs in **local** or **docker** mode. Pick the one that fits your workflow.

### Getting Started

```bash
./ccfire configure    # interactive setup — picks mode, projects dir, port
./ccfire start        # start ccfire
open http://localhost:8283
```

The `configure` command walks you through choosing a mode and writes your `.env`. You only need to run it once.

### Local Mode (full power, use with care)

Runs directly on your host machine. Claude has access to your full toolchain — Java, Python, Go, Gradle, whatever you have installed. Use this when you need Claude to **build, test, and run** your projects.

> **Security note**: Local mode runs Claude Code with `--dangerously-skip-permissions`, which means Claude can read, write, and execute anything on your machine without confirmation prompts. This is powerful but comes with risk — only use this on a machine you control, and be mindful of the prompts you send. Do not expose ccfire to the public internet without authentication in front of it.

**Prerequisites**: [Node.js](https://nodejs.org/) 18+, [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code) (`npm install -g @anthropic-ai/claude-code`), authenticated (`claude` in your terminal first).

### Docker Mode (default — lightweight, isolated)

Runs in a container with **Node.js only**. The container does not include Java, Python, Go, or any other runtime. Claude **cannot** run builds, execute tests, or use project-specific tools.

**What it can do:**
- Read and write files in your projects
- Answer questions about your codebase
- Do code reviews, explain logic, suggest refactors
- Quick research and on-the-fly discussions

**What it cannot do:**
- Run `gradle build`, `pytest`, `go test`, `cargo build`, etc.
- Install or use any toolchain not in the container
- Execute project scripts or Makefiles

This is by design — Docker mode is a lightweight, sandboxed environment for conversation-level work, not full development.

After first start, authenticate Claude once:
```bash
./ccfire ssh
claude          # follow the auth flow, then exit
```

**Prerequisites**: [Docker](https://docs.docker.com/get-docker/) with Compose v2+.

### When to use which?

| | Local | Docker |
|---|---|---|
| Read/write project files | Yes | Yes |
| Answer questions about code | Yes | Yes |
| Run builds/tests (gradle, pytest, go test) | Yes | No |
| Install/use project toolchains | Yes | No |
| Isolated from host system | No | Yes |
| Auth setup | Already on host | One-time SSH + `claude` |

## Commands

```
./ccfire configure   Interactive setup (mode, projects dir, port)
./ccfire start       Start ccfire
./ccfire stop        Stop ccfire
./ccfire restart     Restart ccfire
./ccfire logs        Tail logs
./ccfire status      Show status
./ccfire ssh         Shell into container (docker mode only)
```

## Model Selection

Each session lets you pick a model:

| Model | Best for | Default when |
|-------|----------|-------------|
| **Haiku 4.5** | Quick questions, fast iteration | Free chat sessions |
| **Sonnet 4.6** | Code generation, project work | Project sessions |
| **Opus 4.6** | Complex reasoning, architecture | Manual selection |

You can switch models mid-conversation from the chat header.

## API

Full reference: [docs/API.md](docs/API.md)

```bash
# Fire a prompt against a project
curl -X POST http://localhost:8283/api/run \
  -H "Content-Type: application/json" \
  -d '{"prompt": "explain the auth flow", "cwd": "my-project", "session": "review"}'

# cwd also accepts absolute paths
curl -X POST http://localhost:8283/api/run \
  -H "Content-Type: application/json" \
  -d '{"prompt": "list files", "cwd": "/absolute/path/to/project"}'

# Poll for result
curl http://localhost:8283/api/status/<job_id>
```

| Endpoint | Description |
| --- | --- |
| `POST /api/run` | Submit a prompt (accepts `model` param) |
| `GET /api/status/:job_id` | Poll for result + usage stats |
| `GET /api/sessions` | List active sessions with metadata |
| `GET /api/sessions/:name/messages` | Get full chat history for a session |
| `GET /api/projects` | List available projects |

## How It Works

```
Browser / curl / script
        |
   POST /api/run  -->  Express server  -->  Claude Code CLI (in project dir)
        |                                        |
   GET /api/status  <--  { output, usage }  <----+
```

Sessions persist to `outputs/sessions.json` and survive restarts. In docker mode, auth persists in a named volume.

## Remote Access

Pair with [Tailscale](https://tailscale.com/) for secure access from your phone or another machine — no ports exposed to the public internet.

## Security

- ccfire doesn't use or expose Anthropic API keys. It uses your existing Claude Code authentication.
- Both modes run with `--dangerously-skip-permissions` — Claude executes without confirmation prompts. In Docker mode this is contained; in local mode Claude has full access to your machine.
- ccfire has **no built-in authentication**. Do not expose it to the public internet. Use [Tailscale](https://tailscale.com/) or a VPN for remote access.

## License

MIT
