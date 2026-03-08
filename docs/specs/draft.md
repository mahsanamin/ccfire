# Build ccfire — A Remote Trigger Interface for Claude Code

## Overview
Build **ccfire** — a local web app that lets me type a prompt in a browser, fires it at the locally installed `claude` CLI (already authenticated), and shows the output once complete. No authentication, no cloud — everything runs locally.

The project folder should be named `ccfire`.

---

## Stack
- **Backend**: Node.js + Express (single `server.js` file)
- **Frontend**: Single `index.html` file (vanilla JS, no framework)
- **No database**: Use in-memory job store (plain JS object)
- **Output**: Each job writes stdout to `./outputs/<job_id>.txt`

---

## Backend: `server.js`

### POST `/api/run`
- Accepts JSON body: `{ prompt: string, cwd?: string }`
- Generates a unique `job_id` (uuid or timestamp-based)
- Spawns the following command asynchronously (non-blocking):
  ```
  claude -p "<prompt>" --dangerously-skip-permissions
  ```
  - Run in `cwd` if provided, otherwise `process.cwd()`
  - Pipe stdout to `./outputs/<job_id>.txt`
  - Pipe stderr to `./outputs/<job_id>.err.txt`
- Stores job state in memory: `{ status: "running", startedAt }`
- Returns immediately: `{ job_id }`

### GET `/api/status/:job_id`
- Checks in-memory job store
- If job is done: returns `{ status: "done", output: "<file contents>" }`
- If still running: returns `{ status: "running" }`
- If job not found: returns 404

### Job completion detection
- When the spawned process emits `close` event, mark job as `done` in memory
- Read the output file contents into memory at that point

### Static file serving
- Serve `index.html` at `/`

---

## Frontend: `index.html`

Single self-contained HTML file with inline CSS and JS.

### UI Elements
- Textarea for prompt input (large, full-width)
- Optional text input for `cwd` (working directory path)
- Submit button labeled "Run with Claude"
- Status area showing: Idle / Running... / Done
- Output area: pre-formatted scrollable box, hidden until done

### Behavior
1. On submit: POST to `/api/run`, receive `job_id`
2. Start polling `GET /api/status/:job_id` every 2 seconds
3. While running: show a spinner or "Running..." indicator
4. On `status: done`: stop polling, display output in the output box
5. Allow submitting a new prompt after completion (reset state)

---

## Project Structure
```
ccfire/
├── server.js
├── package.json        # dependencies: express, uuid
├── outputs/            # auto-created by server on startup
└── index.html
```

## package.json scripts
```json
"scripts": {
  "start": "node server.js"
}
```
Default port: `3456`

---

## Constraints
- `claude` binary is already in PATH and authenticated — do not add any auth logic
- No React, no build step, no TypeScript — keep it simple and runnable with `npm start`
- Output directory `./outputs` should be created automatically if it doesn't exist
- Handle edge cases: empty prompt, claude binary not found, output file read errors
