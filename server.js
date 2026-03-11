const express = require("express");
const { spawn } = require("child_process");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8283;

// In-memory stores
const jobs = {};
let sessions = {}; // sessionName -> { claudeSessionId, project, messages[] }

// Session persistence
const SESSIONS_FILE = path.join(__dirname, "outputs", "sessions.json");

function loadSessionsFromDisk() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      sessions = JSON.parse(fs.readFileSync(SESSIONS_FILE, "utf-8"));
      console.log(`Loaded ${Object.keys(sessions).length} session(s) from disk`);
    }
  } catch (err) {
    console.error("Failed to load sessions:", err.message);
  }
}

function saveSessionsToDisk() {
  try {
    fs.mkdirSync(path.dirname(SESSIONS_FILE), { recursive: true });
    fs.writeFileSync(SESSIONS_FILE, JSON.stringify(sessions, null, 2));
  } catch (err) {
    console.error("Failed to save sessions:", err.message);
  }
}

loadSessionsFromDisk();

app.use(express.json());

// Serve frontend
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Submit a new job
app.post("/api/run", (req, res) => {
  const { prompt, cwd, session, model } = req.body;

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  const jobId = uuidv4();
  const PROJECTS_ROOT = "/projects";

  const sessionName = session?.trim();

  // Resolve working directory: use session's project if available, else cwd param
  let workDir = PROJECTS_ROOT;
  const cwdOrProject = cwd || (sessionName && sessions[sessionName]?.project) || null;
  if (cwdOrProject) {
    if (path.isAbsolute(cwdOrProject)) {
      workDir = cwdOrProject;
    } else {
      workDir = path.join(PROJECTS_ROOT, cwdOrProject);
    }
  }

  // Resolve which model to use: explicit param > session stored > default
  const resolvedModel = model || (sessionName && sessions[sessionName]?.model) || null;

  // Build command with JSON output for usage stats
  const sanitized = prompt.replace(/'/g, "'\\''");
  let cmd = `claude -p '${sanitized}' --dangerously-skip-permissions --output-format json`;

  if (resolvedModel) {
    cmd += ` --model '${resolvedModel}'`;
  }

  // Resume session if provided
  if (sessionName && sessions[sessionName]?.claudeSessionId) {
    cmd += ` --resume '${sessions[sessionName].claudeSessionId}'`;
  }

  const child = spawn("sh", ["-c", cmd], {
    cwd: workDir,
    env: { ...process.env, HOME: "/home/ccfire" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  // Create session if it doesn't exist yet
  if (sessionName && !sessions[sessionName]) {
    sessions[sessionName] = {
      claudeSessionId: null,
      project: cwd || null,
      model: resolvedModel || null,
      messages: [],
    };
  }

  // Update model if explicitly changed
  if (sessionName && sessions[sessionName] && model) {
    sessions[sessionName].model = model;
  }

  // Push user message into history
  if (sessionName && sessions[sessionName]) {
    sessions[sessionName].messages.push({
      role: "user",
      content: prompt,
      timestamp: new Date().toISOString(),
      usage: null,
    });
    saveSessionsToDisk();
  }

  const job = {
    status: "running",
    startedAt: new Date().toISOString(),
    stdout: "",
    stderr: "",
    session: sessionName || null,
  };

  jobs[jobId] = job;

  child.stdout.on("data", (chunk) => { job.stdout += chunk.toString(); });
  child.stderr.on("data", (chunk) => { job.stderr += chunk.toString(); });

  child.on("close", (code) => {
    job.exitCode = code;
    job.finishedAt = new Date().toISOString();

    // Parse JSON output for usage stats and result text
    try {
      const parsed = JSON.parse(job.stdout);
      job.status = parsed.is_error ? "error" : "done";
      job.result = parsed.result || "";
      job.usage = {
        duration_ms: parsed.duration_ms,
        cost_usd: parsed.total_cost_usd,
        input_tokens: parsed.usage?.input_tokens || 0,
        output_tokens: parsed.usage?.output_tokens || 0,
        cache_read_tokens: parsed.usage?.cache_read_input_tokens || 0,
        cache_creation_tokens: parsed.usage?.cache_creation_input_tokens || 0,
        num_turns: parsed.num_turns,
      };
      // Store session_id and assistant message
      if (sessionName && sessions[sessionName]) {
        if (parsed.session_id) {
          sessions[sessionName].claudeSessionId = parsed.session_id;
        }
        sessions[sessionName].messages.push({
          role: "assistant",
          content: job.result,
          timestamp: job.finishedAt,
          usage: job.usage,
        });
        saveSessionsToDisk();
      }
    } catch {
      // Fallback if JSON parsing fails
      job.status = code === 0 ? "done" : "error";
      job.result = job.stdout;
      job.usage = null;
      if (sessionName && sessions[sessionName]) {
        sessions[sessionName].messages.push({
          role: "assistant",
          content: job.result || job.stderr || "No response",
          timestamp: job.finishedAt,
          usage: null,
        });
        saveSessionsToDisk();
      }
    }
  });

  child.on("error", (err) => {
    job.status = "error";
    job.stderr += err.message;
    job.finishedAt = new Date().toISOString();
  });

  res.json({ job_id: jobId });
});

// Check job status
app.get("/api/status/:jobId", (req, res) => {
  const job = jobs[req.params.jobId];

  if (!job) {
    return res.status(404).json({ error: "Job not found" });
  }

  const result = {
    status: job.status,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt || null,
  };

  if (job.status === "done" || job.status === "error") {
    result.output = job.result || job.stdout;
    result.stderr = job.stderr;
    result.exitCode = job.exitCode;
    result.usage = job.usage;
    result.session = job.session;
  }

  res.json(result);
});

// List active sessions with metadata
app.get("/api/sessions", (_req, res) => {
  const list = Object.entries(sessions).map(([name, s]) => ({
    name,
    project: s.project,
    model: s.model || null,
    messageCount: s.messages.length,
    lastActivity: s.messages.length > 0
      ? s.messages[s.messages.length - 1].timestamp
      : null,
  }));
  // Sort by most recent activity
  list.sort((a, b) => (b.lastActivity || "").localeCompare(a.lastActivity || ""));
  res.json(list);
});

// Get message history for a session
app.get("/api/sessions/:name/messages", (req, res) => {
  const s = sessions[req.params.name];
  if (!s) {
    return res.status(404).json({ error: "Session not found" });
  }
  res.json({
    name: req.params.name,
    project: s.project,
    model: s.model || null,
    messages: s.messages,
  });
});

// List available projects
app.get("/api/projects", (_req, res) => {
  const PROJECTS_ROOT = "/projects";
  try {
    const entries = fs.readdirSync(PROJECTS_ROOT, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    res.json(dirs);
  } catch {
    res.json([]);
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ccfire running on http://0.0.0.0:${PORT}`);
});
