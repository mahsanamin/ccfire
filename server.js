const express = require("express");
const { spawn } = require("child_process");
const { v4: uuidv4 } = require("uuid");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8283;

// In-memory stores
const jobs = {};
const sessions = {}; // sessionName -> claude session_id

app.use(express.json());

// Serve frontend
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Submit a new job
app.post("/api/run", (req, res) => {
  const { prompt, cwd, session } = req.body;

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  const jobId = uuidv4();
  const PROJECTS_ROOT = "/projects";

  // cwd can be: project name (resolved under /projects), absolute path, or empty
  let workDir = PROJECTS_ROOT;
  if (cwd) {
    if (path.isAbsolute(cwd)) {
      workDir = cwd;
    } else {
      workDir = path.join(PROJECTS_ROOT, cwd);
    }
  }

  // Build command with JSON output for usage stats
  const sanitized = prompt.replace(/'/g, "'\\''");
  let cmd = `claude -p '${sanitized}' --dangerously-skip-permissions --output-format json`;

  // Resume session if provided
  const sessionName = session?.trim();
  if (sessionName && sessions[sessionName]) {
    cmd += ` --resume '${sessions[sessionName]}'`;
  }

  const child = spawn("sh", ["-c", cmd], {
    cwd: workDir,
    env: { ...process.env, HOME: "/home/ccfire" },
    stdio: ["ignore", "pipe", "pipe"],
  });

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
      // Store session_id for conversation continuity
      if (parsed.session_id && sessionName) {
        sessions[sessionName] = parsed.session_id;
      }
    } catch {
      // Fallback if JSON parsing fails
      job.status = code === 0 ? "done" : "error";
      job.result = job.stdout;
      job.usage = null;
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

// List active sessions
app.get("/api/sessions", (_req, res) => {
  res.json(Object.keys(sessions));
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
