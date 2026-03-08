const express = require("express");
const { spawn } = require("child_process");
const { v4: uuidv4 } = require("uuid");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 8283;

// In-memory job store
const jobs = {};

app.use(express.json());

// Serve frontend
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// Submit a new job
app.post("/api/run", (req, res) => {
  const { prompt, cwd } = req.body;

  if (!prompt || !prompt.trim()) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  const jobId = uuidv4();
  const workDir = cwd || process.cwd();

  const sanitized = prompt.replace(/'/g, "'\\''");
  const child = spawn("sh", ["-c", `claude -p '${sanitized}' --dangerously-skip-permissions`], {
    cwd: workDir,
    env: { ...process.env, HOME: "/home/ccfire" },
    stdio: ["ignore", "pipe", "pipe"],
  });

  const job = {
    status: "running",
    startedAt: new Date().toISOString(),
    stdout: "",
    stderr: "",
  };

  jobs[jobId] = job;

  child.stdout.on("data", (chunk) => { job.stdout += chunk.toString(); });
  child.stderr.on("data", (chunk) => { job.stderr += chunk.toString(); });

  child.on("close", (code) => {
    job.status = code === 0 ? "done" : "error";
    job.exitCode = code;
    job.finishedAt = new Date().toISOString();
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
    result.output = job.stdout;
    result.stderr = job.stderr;
    result.exitCode = job.exitCode;
  }

  res.json(result);
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`ccfire running on http://0.0.0.0:${PORT}`);
});
