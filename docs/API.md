# ccfire API Reference

Base URL: `http://localhost:8283`

---

## POST /api/run

Submit a prompt to Claude Code.

### Request

```bash
curl -X POST http://localhost:8283/api/run \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "explain this codebase",
    "cwd": "my-project",
    "session": "my-project"
  }'
```

| Field     | Type   | Required | Description                                                        |
| --------- | ------ | -------- | ------------------------------------------------------------------ |
| `prompt`  | string | Yes      | The prompt to send to Claude                                       |
| `cwd`     | string | No       | Project directory name (relative to mounted `PROJECTS_DIR`). Defaults to `/projects` root |
| `session` | string | No       | Session name for conversation continuity. Reuse the same name to maintain context across multiple prompts |

### Response

```json
{ "job_id": "a346989f-f34e-451e-bbce-e95d3ec1b1bc" }
```

---

## GET /api/status/:job_id

Poll for job status and results.

### Request

```bash
curl http://localhost:8283/api/status/a346989f-f34e-451e-bbce-e95d3ec1b1bc
```

### Response — Running

```json
{
  "status": "running",
  "startedAt": "2026-03-08T17:27:58.812Z",
  "finishedAt": null
}
```

### Response — Done

```json
{
  "status": "done",
  "startedAt": "2026-03-08T17:27:58.812Z",
  "finishedAt": "2026-03-08T17:28:04.803Z",
  "output": "Hi! How can I help you today?",
  "stderr": "",
  "exitCode": 0,
  "usage": {
    "duration_ms": 2199,
    "cost_usd": 0.007185,
    "input_tokens": 3,
    "output_tokens": 12,
    "cache_read_tokens": 13740,
    "cache_creation_tokens": 0,
    "num_turns": 1
  },
  "session": "my-project"
}
```

### Response — Error

```json
{
  "status": "error",
  "startedAt": "2026-03-08T17:27:58.812Z",
  "finishedAt": "2026-03-08T17:28:04.803Z",
  "output": "",
  "stderr": "Error message here",
  "exitCode": 1,
  "usage": null,
  "session": null
}
```

### Status Values

| Status    | Meaning                          |
| --------- | -------------------------------- |
| `running` | Claude is still processing       |
| `done`    | Completed successfully           |
| `error`   | Failed (check stderr, exitCode)  |

### Usage Fields

| Field                  | Type   | Description                            |
| ---------------------- | ------ | -------------------------------------- |
| `duration_ms`          | number | Total execution time in milliseconds   |
| `cost_usd`            | number | API cost in USD                         |
| `input_tokens`         | number | Input tokens sent                      |
| `output_tokens`        | number | Output tokens generated                |
| `cache_read_tokens`    | number | Tokens read from cache                 |
| `cache_creation_tokens`| number | Tokens written to cache                |
| `num_turns`            | number | Number of agent turns taken            |

---

## GET /api/sessions

List all active session names.

### Request

```bash
curl http://localhost:8283/api/sessions
```

### Response

```json
["my-project", "debug-session", "refactor"]
```

---

## GET /api/projects

List available project directories (from mounted `PROJECTS_DIR`).

### Request

```bash
curl http://localhost:8283/api/projects
```

### Response

```json
["my-app", "backend-api", "infra"]
```

---

## Usage Patterns

### One-shot prompt (no session)

```bash
curl -X POST http://localhost:8283/api/run \
  -H "Content-Type: application/json" \
  -d '{"prompt": "what does this function do?", "cwd": "my-app"}'
```

### Multi-turn conversation

```bash
# First message — creates session
curl -X POST http://localhost:8283/api/run \
  -H "Content-Type: application/json" \
  -d '{"prompt": "read the codebase and summarize it", "cwd": "my-app", "session": "onboard"}'

# Wait for completion, then follow up — same session
curl -X POST http://localhost:8283/api/run \
  -H "Content-Type: application/json" \
  -d '{"prompt": "now explain the auth flow in detail", "session": "onboard"}'
```

### Poll until done (bash example)

```bash
JOB_ID=$(curl -s -X POST http://localhost:8283/api/run \
  -H "Content-Type: application/json" \
  -d '{"prompt": "say hello", "cwd": "my-app"}' | jq -r '.job_id')

while true; do
  RESULT=$(curl -s http://localhost:8283/api/status/$JOB_ID)
  STATUS=$(echo $RESULT | jq -r '.status')
  if [ "$STATUS" != "running" ]; then
    echo $RESULT | jq .
    break
  fi
  sleep 2
done
```

### Integration with scripts

```python
import requests, time

# Submit
r = requests.post("http://localhost:8283/api/run", json={
    "prompt": "refactor this file for readability",
    "cwd": "my-app",
    "session": "refactor"
})
job_id = r.json()["job_id"]

# Poll
while True:
    r = requests.get(f"http://localhost:8283/api/status/{job_id}")
    data = r.json()
    if data["status"] != "running":
        print(data["output"])
        print(f"Cost: ${data['usage']['cost_usd']:.4f}")
        break
    time.sleep(2)
```
