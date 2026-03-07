import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

import express from "express";
import fs from "fs";
import multer from "multer";
import jwt from "jsonwebtoken";
import { convertMdToJson } from "./convert.js";
import { startPipeline, startTranscriptPipeline, getJob, getAllJobs, addJobListener, restoreJobs, type PipelineContext } from "./pipeline.js";
import { getDurationMs } from "./transcribe.js";
import authRouter, { requireAuth } from "./auth.js";
import { getReportsByUser, userOwnsReport, getReportContext, setReportInterviewType, getReportInterviewType, getReportTags, addReportTag, removeReportTag, getAllTagsByUser, getReportUploadTime, getReportOriginalFilename, getReportDisplayName, setReportDisplayName, getTranscriptionQuotaMs, deductTranscriptionQuota } from "./db.js";
import { extractCVText } from "./parseCV.js";

const PORT = 8000;
const DATA_DIR = path.resolve(__dirname, "../../");
const UPLOAD_DIR = path.resolve(DATA_DIR, "uploads");

// Ensure uploads directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// SSE nonce store (short-lived, one-time-use tokens for EventSource auth)
const sseNonces = new Map<string, { userId: number; expires: number }>();

// Periodically clean expired nonces (every 5 minutes)
setInterval(() => {
  const now = Date.now();
  for (const [nonce, data] of sseNonces) {
    if (data.expires < now) sseNonces.delete(nonce);
  }
}, 5 * 60 * 1000);

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(express.text({ limit: "10mb" }));

// CORS headers
const allowedOrigins = process.env.NODE_ENV === "production"
  ? [] // same-origin in production, no CORS needed
  : ["http://localhost:3000"];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  }
  if (req.method === "OPTIONS") {
    res.sendStatus(204);
    return;
  }
  next();
});

// Multer config: store to disk, 500MB limit
const ALLOWED_EXTS = new Set([".m4a", ".mp3", ".wav", ".flac", ".mp4", ".aac", ".ogg", ".wma"]);

const CV_EXTS = new Set([".pdf", ".docx", ".doc", ".txt"]);

const audioUpload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.fieldname === "cv") {
      cb(null, CV_EXTS.has(ext));
    } else if (ALLOWED_EXTS.has(ext)) {
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
  interviewType?: string;
  tags: string[];
  uploadTime?: string;
  originalFilename?: string;
  displayName?: string;
}

function findReports(userId: number): ReportListItem[] {
  const userReportNames = getReportsByUser(userId);

  return userReportNames.map((name) => {
    const file = `${name}_analysis_data.json`;
    const tags = getReportTags(name);
    try {
      const raw = fs.readFileSync(path.join(DATA_DIR, file), "utf-8");
      const data = JSON.parse(raw);
      const meta = data.meta || {};
      const interviewType = getReportInterviewType(name);
      const uploadTime = getReportUploadTime(name);
      const originalFilename = getReportOriginalFilename(name);
      const displayName = getReportDisplayName(name);
      return {
        name,
        position: meta.position || name,
        date: meta.date || "",
        interviewType: interviewType || undefined,
        tags,
        uploadTime: uploadTime || undefined,
        originalFilename: originalFilename || undefined,
        displayName: displayName || undefined,
      };
    } catch {
      const uploadTime = getReportUploadTime(name);
      const originalFilename = getReportOriginalFilename(name);
      const displayName = getReportDisplayName(name);
      return { name, position: name, date: "", tags, uploadTime: uploadTime || undefined, originalFilename: originalFilename || undefined, displayName: displayName || undefined };
    }
  });
}

function loadReport(name: string): object | null {
  const filePath = path.join(DATA_DIR, `${name}_analysis_data.json`);
  if (!fs.existsSync(filePath)) return null;
  const raw = fs.readFileSync(filePath, "utf-8");
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
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
  try {
    res.json(JSON.parse(raw));
  } catch {
    res.status(500).json({ error: "转录数据损坏" });
  }
});

// GET /api/reports/:name/context - get JD/CV context for a report
app.get("/api/reports/:name/context", requireAuth, (req, res) => {
  const name = sanitizeName(req.params.name);
  if (!name) {
    res.status(400).json({ error: "Invalid report name" });
    return;
  }
  if (!userOwnsReport(req.user!.userId, name)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const context = getReportContext(name);
  if (!context) {
    res.json({ jd_text: null, cv_text: null });
    return;
  }
  res.json(context);
});

// PUT /api/reports/:name/type - set interview type
app.put("/api/reports/:name/type", requireAuth, (req, res) => {
  const name = sanitizeName(req.params.name);
  if (!name) { res.status(400).json({ error: "Invalid report name" }); return; }
  if (!userOwnsReport(req.user!.userId, name)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { interviewType } = req.body;
  if (!interviewType || typeof interviewType !== "string") { res.status(400).json({ error: "Missing interviewType" }); return; }
  setReportInterviewType(name, req.user!.userId, interviewType.trim());
  res.json({ ok: true });
});

// PUT /api/reports/:name/display-name - set display name
app.put("/api/reports/:name/display-name", requireAuth, (req, res) => {
  const name = sanitizeName(req.params.name);
  if (!name) { res.status(400).json({ error: "Invalid report name" }); return; }
  if (!userOwnsReport(req.user!.userId, name)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { displayName } = req.body;
  if (!displayName || typeof displayName !== "string") { res.status(400).json({ error: "Missing displayName" }); return; }
  const trimmed = displayName.trim().slice(0, 100);
  if (trimmed.length === 0) { res.status(400).json({ error: "displayName cannot be empty" }); return; }
  setReportDisplayName(name, req.user!.userId, trimmed);
  res.json({ ok: true });
});

// GET /api/reports/:name/tags - get tags for a report
app.get("/api/reports/:name/tags", requireAuth, (req, res) => {
  const name = sanitizeName(req.params.name);
  if (!name) { res.status(400).json({ error: "Invalid report name" }); return; }
  if (!userOwnsReport(req.user!.userId, name)) { res.status(403).json({ error: "Forbidden" }); return; }
  res.json({ tags: getReportTags(name) });
});

// POST /api/reports/:name/tags - add a tag
app.post("/api/reports/:name/tags", requireAuth, (req, res) => {
  const name = sanitizeName(req.params.name);
  if (!name) { res.status(400).json({ error: "Invalid report name" }); return; }
  if (!userOwnsReport(req.user!.userId, name)) { res.status(403).json({ error: "Forbidden" }); return; }
  const { tag } = req.body;
  if (!tag || typeof tag !== "string" || tag.trim().length === 0) { res.status(400).json({ error: "Missing tag" }); return; }
  addReportTag(name, tag.trim().slice(0, 20));
  res.json({ tags: getReportTags(name) });
});

// DELETE /api/reports/:name/tags/:tag - remove a tag
app.delete("/api/reports/:name/tags/:tag", requireAuth, (req, res) => {
  const name = sanitizeName(req.params.name);
  if (!name) { res.status(400).json({ error: "Invalid report name" }); return; }
  if (!userOwnsReport(req.user!.userId, name)) { res.status(403).json({ error: "Forbidden" }); return; }
  const rawTag = Array.isArray(req.params.tag) ? req.params.tag[0] : req.params.tag;
  const tag = decodeURIComponent(rawTag);
  removeReportTag(name, tag);
  res.json({ tags: getReportTags(name) });
});

// GET /api/tags - get all tags for current user
app.get("/api/tags", requireAuth, (req, res) => {
  res.json({ tags: getAllTagsByUser(req.user!.userId) });
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
    console.error("[API] Convert error:", err);
    res.status(500).json({ error: "内部服务器错误" });
  }
});

// ═══════════════════════════════════════════════════════════════
// Pipeline endpoints (protected)
// ═══════════════════════════════════════════════════════════════

// POST /api/pipeline/start - upload audio and start pipeline
app.post("/api/pipeline/start", requireAuth, audioUpload.fields([{ name: "audio", maxCount: 1 }, { name: "cv", maxCount: 1 }]), async (req, res) => {
  const files = req.files as Record<string, Express.Multer.File[]>;
  const audioFile = files["audio"]?.[0];
  if (!audioFile) {
    res.status(400).json({ error: "未上传音频文件" });
    return;
  }

  const audioPath = audioFile.path;
  const originalName = Buffer.from(audioFile.originalname, "latin1").toString("utf-8");

  // Check transcription quota
  const userId = req.user!.userId;
  let audioDurationMs: number;
  try {
    audioDurationMs = getDurationMs(audioPath);
  } catch (err) {
    try { fs.unlinkSync(audioPath); } catch { /* ignore */ }
    res.status(400).json({ error: "无法读取音频时长，请检查文件格式" });
    return;
  }

  const quotaMs = getTranscriptionQuotaMs(userId);
  if (audioDurationMs > quotaMs) {
    try { fs.unlinkSync(audioPath); } catch { /* ignore */ }
    const quotaMin = Math.floor(quotaMs / 60000);
    const durationMin = Math.ceil(audioDurationMs / 60000);
    res.status(403).json({ error: `转写时长不足：剩余 ${quotaMin} 分钟，本次需要 ${durationMin} 分钟` });
    return;
  }

  // Deduct quota upfront
  deductTranscriptionQuota(userId, audioDurationMs);

  // Build context from JD text and CV file
  const context: PipelineContext = {};
  const jdText = typeof req.body.jdText === "string" ? req.body.jdText.trim().slice(0, 2000) : undefined;
  if (jdText) context.jdText = jdText;

  const cvFile = files["cv"]?.[0];
  if (cvFile) {
    try {
      const cvExt = path.extname(cvFile.originalname);
      const rawCv = await extractCVText(cvFile.path, cvExt);
      context.cvText = rawCv.slice(0, 5000);
    } catch (err) {
      console.error("[API] CV extraction error:", err);
    } finally {
      try { fs.unlinkSync(cvFile.path); } catch { /* ignore */ }
    }
  }

  console.log(`[API] Pipeline start: ${originalName} -> ${audioPath}${context.jdText ? " [+JD]" : ""}${context.cvText ? " [+CV]" : ""}`);
  const jobId = startPipeline(audioPath, originalName, userId, Object.keys(context).length > 0 ? context : undefined);

  res.json({ jobId });
});

// Multer config for transcript files: 10MB limit, text formats only
const TRANSCRIPT_EXTS = new Set([".txt", ".json", ".srt", ".vtt", ".docx"]);

const transcriptUpload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.fieldname === "cv") {
      cb(null, CV_EXTS.has(ext));
    } else if (TRANSCRIPT_EXTS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`不支持的转录文件格式: ${ext}，支持 .txt .json .srt .vtt .docx`));
    }
  },
});

// POST /api/pipeline/start-transcript - upload transcript file and start analysis
app.post("/api/pipeline/start-transcript", requireAuth, transcriptUpload.fields([{ name: "transcript", maxCount: 1 }, { name: "cv", maxCount: 1 }]), async (req, res) => {
  const files = req.files as Record<string, Express.Multer.File[]>;
  const transcriptFile = files["transcript"]?.[0];
  if (!transcriptFile) {
    res.status(400).json({ error: "未上传转录文件" });
    return;
  }

  const filePath = transcriptFile.path;
  const originalName = Buffer.from(transcriptFile.originalname, "latin1").toString("utf-8");

  // Pre-check file size (rough char estimate: 1 byte ≈ 1 char for CJK in UTF-8 is ~3 bytes, so 90KB ≈ 30000 CJK chars)
  const fileSize = transcriptFile.size;
  if (fileSize > 300000) {  // 300KB safety limit
    try { fs.unlinkSync(filePath); } catch { /* ignore */ }
    res.status(400).json({ error: `文件过大（${(fileSize / 1024).toFixed(0)}KB），逐字稿上限约 30000 字` });
    return;
  }

  // Build context from JD text and CV file
  const context: PipelineContext = {};
  const jdText = typeof req.body.jdText === "string" ? req.body.jdText.trim().slice(0, 2000) : undefined;
  if (jdText) context.jdText = jdText;

  const cvFile = files["cv"]?.[0];
  if (cvFile) {
    try {
      const cvExt = path.extname(cvFile.originalname);
      const rawCv = await extractCVText(cvFile.path, cvExt);
      context.cvText = rawCv.slice(0, 5000);
    } catch (err) {
      console.error("[API] CV extraction error:", err);
    } finally {
      try { fs.unlinkSync(cvFile.path); } catch { /* ignore */ }
    }
  }

  console.log(`[API] Transcript pipeline start: ${originalName} -> ${filePath}${context.jdText ? " [+JD]" : ""}${context.cvText ? " [+CV]" : ""}`);
  const jobId = startTranscriptPipeline(filePath, originalName, req.user!.userId, Object.keys(context).length > 0 ? context : undefined);

  res.json({ jobId });
});

// GET /api/user/quota - get remaining transcription quota
app.get("/api/user/quota", requireAuth, (req, res) => {
  const quotaMs = getTranscriptionQuotaMs(req.user!.userId);
  res.json({ transcriptionQuotaMs: quotaMs, transcriptionQuotaMin: Math.floor(quotaMs / 60000) });
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
  res.json(getAllJobs(req.user!.userId));
});

// POST /api/pipeline/nonce - get a one-time nonce for SSE auth
app.post("/api/pipeline/nonce", requireAuth, (req, res) => {
  const nonce = crypto.randomUUID();
  sseNonces.set(nonce, { userId: req.user!.userId, expires: Date.now() + 60_000 });
  res.json({ nonce });
});

// GET /api/pipeline/events/:id - SSE endpoint for real-time progress
// Auth: accept nonce from query param OR Authorization header (EventSource can't send headers)
app.get("/api/pipeline/events/:id", (req, res) => {
  let user: { userId: number; username: string } | null = null;

  // Try nonce-based auth first
  const nonce = typeof req.query.nonce === "string" ? req.query.nonce : null;
  if (nonce) {
    const nonceData = sseNonces.get(nonce);
    if (nonceData && nonceData.expires >= Date.now()) {
      user = { userId: nonceData.userId, username: "" };
      sseNonces.delete(nonce); // one-time use
    }
  }

  // Fall back to Authorization header
  if (!user) {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (token) {
      try {
        user = jwt.verify(token, process.env.JWT_SECRET!) as any;
      } catch {
        // invalid token
      }
    }
  }

  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
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
  const sseHeaders: Record<string, string> = {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  };
  const reqOrigin = req.headers.origin;
  if (reqOrigin && allowedOrigins.includes(reqOrigin)) {
    sseHeaders["Access-Control-Allow-Origin"] = reqOrigin;
  }
  res.writeHead(200, sseHeaders);

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

// Restore persisted jobs on startup (mark interrupted ones as error)
restoreJobs();

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
