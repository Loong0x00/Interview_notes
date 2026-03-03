import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import { convertMdToJson } from "./convert.js";
import { startPipeline, getJob, getAllJobs, addJobListener } from "./pipeline.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  res.header("Access-Control-Allow-Headers", "Content-Type");
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
// Existing report endpoints (unchanged)
// ═══════════════════════════════════════════════════════════════

interface ReportListItem {
  name: string;
  position: string;
  date: string;
}

function findReports(): ReportListItem[] {
  const files = fs
    .readdirSync(DATA_DIR)
    .filter((f) => f.endsWith("_analysis_data.json"))
    .sort();

  return files.map((file) => {
    const name = file.replace("_analysis_data.json", "");
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

// GET /api/reports - list all reports
app.get("/api/reports", (_req, res) => {
  const reports = findReports();
  res.json({ reports });
});

// GET /api/reports/:name - get specific report
app.get("/api/reports/:name", (req, res) => {
  const data = loadReport(req.params.name);
  if (!data) {
    res.status(404).json({ error: "Report not found" });
    return;
  }
  res.json(data);
});

// GET /api/reports/:name/transcript - get transcript data
app.get("/api/reports/:name/transcript", (req, res) => {
  const filePath = path.join(DATA_DIR, `${req.params.name}_transcript.json`);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: "Transcript not found" });
    return;
  }
  const raw = fs.readFileSync(filePath, "utf-8");
  res.json(JSON.parse(raw));
});

// POST /api/convert - convert markdown to JSON
app.post("/api/convert", async (req, res) => {
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
// Pipeline endpoints
// ═══════════════════════════════════════════════════════════════

// POST /api/pipeline/start - upload audio and start pipeline
app.post("/api/pipeline/start", upload.single("audio"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "未上传音频文件" });
    return;
  }

  const audioPath = req.file.path;
  const originalName = Buffer.from(req.file.originalname, "latin1").toString("utf-8");

  console.log(`[API] Pipeline start: ${originalName} -> ${audioPath}`);
  const jobId = startPipeline(audioPath, originalName);

  res.json({ jobId });
});

// GET /api/pipeline/status/:id - get job status
app.get("/api/pipeline/status/:id", (req, res) => {
  const job = getJob(req.params.id);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(job);
});

// GET /api/pipeline/jobs - list all jobs
app.get("/api/pipeline/jobs", (_req, res) => {
  res.json({ jobs: getAllJobs() });
});

// GET /api/pipeline/events/:id - SSE endpoint for real-time progress
app.get("/api/pipeline/events/:id", (req, res) => {
  const jobId = req.params.id;
  const job = getJob(jobId);

  if (!job) {
    res.status(404).json({ error: "Job not found" });
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
  console.log(`  GET  /api/reports              - List reports`);
  console.log(`  GET  /api/reports/{name}        - Get report data`);
  console.log(`  POST /api/convert              - Convert markdown to JSON`);
  console.log(`  POST /api/pipeline/start       - Upload audio & start pipeline`);
  console.log(`  GET  /api/pipeline/status/{id} - Get job status`);
  console.log(`  GET  /api/pipeline/jobs        - List all jobs`);
  console.log(`  GET  /api/pipeline/events/{id} - SSE progress stream`);
  console.log(`Data directory: ${DATA_DIR}`);
  console.log(`Upload directory: ${UPLOAD_DIR}`);
  const reports = findReports();
  console.log(
    `Found ${reports.length} report(s): ${JSON.stringify(reports.map((r) => r.name))}`
  );
});
