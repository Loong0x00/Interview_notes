import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import express from "express";
import fs from "fs";
import multer from "multer";
import jwt from "jsonwebtoken";
import { convertMdToJson } from "./convert.js";
import { startPipeline, startTranscriptPipeline, getJob, getAllJobs, addJobListener } from "./pipeline.js";
import authRouter, { requireAuth } from "./auth.js";
import { getReportsByUser, userOwnsReport } from "./db.js";

const PORT = 8000;
const DATA_DIR = path.resolve(__dirname, "../../");
const UPLOAD_DIR = path.resolve(DATA_DIR, "uploads");

// Ensure uploads directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.text({ limit: "10mb" }));

// CORS headers
app.use((_req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  next();
});

// Preflight — handle OPTIONS in the CORS middleware above
app.use((req, res, next) => {
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// Multer config: store to disk, 500MB limit
const ALLOWED_EXTS = new Set([".m4a", ".mp3", ".wav", ".flac", ".mp4", ".aac", ".ogg", ".wma"]);

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的文件格式: ${ext}`));
    }
  },
});

// ═══════════════════════════════════════════════════════════════
// Auth routes (public, before requireAuth)
// ═══════════════════════════════════════════════════════════════

app.use("/api/auth", authRouter);

// ═══════════════════════════════════════════════════════════════
// Report endpoints (protected)
// ═══════════════════════════════════════════════════════════════

// Path sanitization helper
function sanitizeName(name: string | string[]): string | null {
  const n = Array.isArray(name) ? name[0] : name;
  if (!n) return null;
  // Reject path traversal attempts
  if (n.includes("..") || n.includes("/") || n.includes("\\")) {
    return null;
  }
  return n;
}

interface ReportListItem {
  name: string;
  position: string;
  date: string;
}

function findReports(userId: number): ReportListItem[] {
  const userReportNames = getReportsByUser(userId);

  return userReportNames.map((name) => {
    const file = `${name}_analysis_data.json`;
    try {
      const raw = fs.readFileSync(path.join(DATA_DIR, file), "utf-8");
      const data = JSON.parse(raw);
      const meta = data.meta || {};
      return {
        name,
        position: meta.position || name,
        date: meta.date || "",
      };
    } catch {
      return { name, position: name, date: "" };
    }
  });
}

function loadReport(name: string): object | null {
  const filePath = path.join(DATA_DIR, `${name}_analysis_data.json`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  return JSON.parse(raw);
}

// GET /api/reports - list user's reports
app.get("/api/reports", requireAuth, (req, res) => {
  const reports = findReports(req.user!.userId);
  res.json({ reports });
});

// GET /api/reports/:name - get specific report
app.get("/api/reports/:name", requireAuth, (req, res) => {
  const name = sanitizeName(req.params.name);
  if (!name) {
    res.status(400).json({ error: "Invalid report name" });
    return;
  }
  if (!userOwnsReport(req.user!.userId, name)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const data = loadReport(name);
  if (!data) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  res.json(data);
});

// GET /api/reports/:name/transcript - get transcript data
app.get("/api/reports/:name/transcript", requireAuth, (req, res) => {
  const name = sanitizeName(req.params.name);
  if (!name) {
    res.status(400).json({ error: "Invalid report name" });
    return;
  }
  if (!userOwnsReport(req.user!.userId, name)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const filePath = path.join(DATA_DIR, `${name}_transcript.json`);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "Transcript not found" });
    return;
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  res.json(JSON.parse(raw));
});

// POST /api/convert - convert markdown to JSON
app.post("/api/convert", requireAuth, async (req, res) => {
  try {
    const mdContent =
      typeof req.body === "string" ? req.body : req.body?.markdown;
    if (!mdContent) {
      res.status(400).json({ error: "Missing markdown content in request body" });
      return;
    }

    const saveName = req.body?.name;
    const result = await convertMdToJson(mdContent);

    if (saveName) {
      const outPath = path.join(DATA_DIR, `${saveName}_analysis_data.json`);
      fs.writeFileSync(outPath, JSON.stringify(result, null, 2), "utf-8");
      console.log(`[API] Saved: ${outPath}`);
    }

    res.json(result);
  } catch (err: any) {
    console.error("[API] Convert error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ═══════════════════════════════════════════════════════════════
// Pipeline endpoints (protected)
// ═══════════════════════════════════════════════════════════════

// POST /api/pipeline/start - upload audio and start pipeline
app.post("/api/pipeline/start", requireAuth, upload.single("audio"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "未上传音频文件" });
    return;
  }

  const audioPath = req.file.path;
  const originalName = Buffer.from(req.file.originalname, "latin1").toString("utf-8");

  console.log(`[API] Pipeline start: ${originalName} -> ${audioPath}`);
  const jobId = startPipeline(audioPath, originalName, req.user!.userId);

  res.json({ jobId });
});

// Multer config for transcript files: 10MB limit, text formats only
const TRANSCRIPT_EXTS = new Set([".txt", ".json", ".srt", ".vtt", ".docx"]);

const transcriptUpload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (TRANSCRIPT_EXTS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的转录文件格式: ${ext}，支持 .txt .json .srt .vtt .docx`));
    }
  },
});

// POST /api/pipeline/start-transcript - upload transcript file and start analysis
app.post("/api/pipeline/start-transcript", requireAuth, transcriptUpload.single("transcript"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "未上传转录文件" });
    return;
  }

  const filePath = req.file.path;
  const originalName = Buffer.from(req.file.originalname, "latin1").toString("utf-8");

  console.log(`[API] Transcript pipeline start: ${originalName} -> ${filePath}`);
  const jobId = startTranscriptPipeline(filePath, originalName, req.user!.userId);

  res.json({ jobId });
});

// GET /api/pipeline/status/:id - get job status
app.get("/api/pipeline/status/:id", requireAuth, (req, res) => {
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const job = getJob(id);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  if (job.userId !== req.user!.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  res.json(job);
});

// GET /api/pipeline/jobs - list user's jobs
app.get("/api/pipeline/jobs", requireAuth, (req, res) => {
  res.json({ jobs: getAllJobs(req.user!.userId) });
});

// GET /api/pipeline/events/:id - SSE endpoint for real-time progress
// Special auth: accept token from query param OR header (EventSource can't send headers)
app.get("/api/pipeline/events/:id", (req, res) => {
  // Manual auth for SSE
  let token = req.headers.authorization?.replace("Bearer ", "");
  if (!token && typeof req.query.token === "string") token = req.query.token;
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  let user: { userId: number; username: string };
  try {
    user = jwt.verify(token, process.env.JWT_SECRET!) as any;
  } catch {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  const jobId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const job = getJob(jobId);

  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }

  if (job.userId !== user.userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  // Set up SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });

  // Send current state immediately
  res.write(`data: ${JSON.stringify(job)}\n\n`);

  // If already done/error, close immediately
  if (job.status === "done" || job.status === "error") {
    res.end();
    return;
  }

  // Listen for updates
  const removeListener = addJobListener(jobId, (updatedJob) => {
    res.write(`data: ${JSON.stringify(updatedJob)}\n\n`);

    if (updatedJob.status === "done" || updatedJob.status === "error") {
      res.end();
      removeListener();
    }
  });

  // Client disconnect
  req.on("close", () => {
    removeListener();
  });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API server running on http://0.0.0.0:${PORT}`);
  console.log(`  POST /api/auth/register        - Register (invite code)`);
  console.log(`  POST /api/auth/login           - Login`);
  console.log(`  GET  /api/auth/me              - Current user`);
  console.log(`  GET  /api/reports              - List reports`);
  console.log(`  GET  /api/reports/{name}        - Get report data`);
  console.log(`  POST /api/convert              - Convert markdown to JSON`);
  console.log(`  POST /api/pipeline/start       - Upload audio & start pipeline`);
  console.log(`  POST /api/pipeline/start-transcript - Upload transcript & start analysis`);
  console.log(`  GET  /api/pipeline/status/{id} - Get job status`);
  console.log(`  GET  /api/pipeline/jobs        - List all jobs`);
  console.log(`  GET  /api/pipeline/events/{id} - SSE progress stream`);
  console.log(`Data directory: ${DATA_DIR}`);
  console.log(`Upload directory: ${UPLOAD_DIR}`);
});
