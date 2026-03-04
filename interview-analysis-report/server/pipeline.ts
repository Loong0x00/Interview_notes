import crypto from "crypto";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { transcribe, type TranscriptSegment } from "./transcribe.js";
import { formatTranscript, analyze } from "./analyze.js";
import { registerReport, saveJob, getPersistedJob, getActiveJobs, deleteOldJobs, saveReportContext } from "./db.js";
import { parseTranscriptFile } from "./parseTranscript.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, "../../");

export type JobStatus =
  | "uploading"
  | "transcribing"
  | "analyzing"
  | "done"
  | "error";

export interface PipelineJob {
  id: string;
  fileName: string;
  status: JobStatus;
  progress: string;
  createdAt: number;
  userId?: number;
  result?: string; // report name for loading
  error?: string;
}

export interface PipelineContext {
  jdText?: string;
  cvText?: string;
}

const jobs = new Map<string, PipelineJob>();

// Listeners for SSE progress push
type ProgressListener = (job: PipelineJob) => void;
const listeners = new Map<string, Set<ProgressListener>>();

export function getJob(id: string): PipelineJob | undefined {
  return jobs.get(id);
}

export function getAllJobs(userId?: number): PipelineJob[] {
  let all = Array.from(jobs.values());
  if (userId !== undefined) {
    all = all.filter((j) => j.userId === userId);
  }
  return all.sort((a, b) => b.createdAt - a.createdAt);
}

export function addJobListener(jobId: string, listener: ProgressListener): () => void {
  if (!listeners.has(jobId)) {
    listeners.set(jobId, new Set());
  }
  listeners.get(jobId)!.add(listener);
  return () => {
    listeners.get(jobId)?.delete(listener);
  };
}

function updateJob(job: PipelineJob) {
  jobs.set(job.id, { ...job });
  saveJob(job);
  const jobListeners = listeners.get(job.id);
  if (jobListeners) {
    for (const listener of jobListeners) {
      listener({ ...job });
    }
  }
}

/** Generate a short UUID suffix (8 hex chars) for unique file naming */
function shortUuid(): string {
  return crypto.randomBytes(4).toString("hex");
}

// ═══════════════════════════════════════════════════════════════
// Shared analysis + register + cleanup
// ═══════════════════════════════════════════════════════════════

async function runAnalysis(
  job: PipelineJob,
  baseName: string,
  segments: TranscriptSegment[],
  tempFilePath: string,
  stepPrefix: string,
  context?: PipelineContext
): Promise<void> {
  const transcriptPath = path.join(DATA_DIR, `${baseName}_transcript.json`);
  const analysisJsonPath = path.join(DATA_DIR, `${baseName}_analysis_data.json`);

  // Save normalized transcript
  fs.writeFileSync(transcriptPath, JSON.stringify(segments, null, 2), "utf-8");
  console.log(`[Pipeline] Saved transcript (${segments.length} segments): ${transcriptPath}`);

  // AI Analysis (directly outputs JSON)
  job.status = "analyzing";
  job.progress = `${stepPrefix} AI 分析中...`;
  updateJob(job);

  const transcriptText = formatTranscript(segments);
  const jsonData = await analyze(transcriptText, context, (detail) => {
    job.progress = `${stepPrefix} AI 分析 - ${detail}`;
    updateJob(job);
  });

  fs.writeFileSync(analysisJsonPath, JSON.stringify(jsonData, null, 2), "utf-8");
  console.log(`[Pipeline] Saved analysis JSON: ${analysisJsonPath}`);

  // Save JD/CV context if provided
  if (context?.jdText || context?.cvText) {
    saveReportContext(baseName, context?.jdText ?? null, context?.cvText ?? null);
  }

  // Register report ownership
  if (job.userId) {
    registerReport(job.userId, baseName);
  }

  // Done
  job.status = "done";
  job.progress = "处理完成";
  job.result = baseName;
  updateJob(job);

  // Cleanup temp upload file
  try {
    if (fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
      console.log(`[Pipeline] Cleaned up temp file: ${tempFilePath}`);
    }
  } catch {
    // Ignore cleanup errors
  }
}

// ═══════════════════════════════════════════════════════════════
// Audio pipeline (transcribe + analyze)
// ═══════════════════════════════════════════════════════════════

export function startPipeline(audioPath: string, originalFileName: string, userId?: number, context?: PipelineContext): string {
  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const job: PipelineJob = {
    id,
    fileName: originalFileName,
    status: "uploading",
    progress: "准备中...",
    createdAt: Date.now(),
    userId,
  };
  jobs.set(id, job);
  saveJob(job);

  // Run async pipeline - don't await
  runPipeline(job, audioPath, originalFileName, context).catch((err) => {
    console.error(`[Pipeline] Job ${id} failed:`, err);
    job.status = "error";
    job.error = err.message || String(err);
    job.progress = "处理失败";
    updateJob(job);
  });

  return id;
}

async function runPipeline(
  job: PipelineJob,
  audioPath: string,
  originalFileName: string,
  context?: PipelineContext
): Promise<void> {
  const fileBase = path.basename(originalFileName, path.extname(originalFileName));
  const baseName = `${fileBase}_${shortUuid()}`;

  try {
    // Step 1: Transcribe
    job.status = "transcribing";
    job.progress = "[1/2] 语音转写 - 上传中...";
    updateJob(job);

    const segments = await transcribe(audioPath, (stage, detail) => {
      job.progress = `[1/2] 语音转写 - ${detail || stage}`;
      updateJob(job);
    });

    await runAnalysis(job, baseName, segments, audioPath, "[2/2]", context);
  } catch (err: any) {
    job.status = "error";
    job.error = err.message || String(err);
    job.progress = "处理失败";
    updateJob(job);
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════
// Transcript file pipeline (skip transcription step)
// ═══════════════════════════════════════════════════════════════

export function startTranscriptPipeline(filePath: string, originalFileName: string, userId?: number, context?: PipelineContext): string {
  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const job: PipelineJob = {
    id,
    fileName: originalFileName,
    status: "uploading",
    progress: "准备中...",
    createdAt: Date.now(),
    userId,
  };
  jobs.set(id, job);
  saveJob(job);

  // Run async pipeline - don't await
  runTranscriptPipeline(job, filePath, originalFileName, context).catch((err) => {
    console.error(`[Pipeline] Transcript job ${id} failed:`, err);
    job.status = "error";
    job.error = err.message || String(err);
    job.progress = "处理失败";
    updateJob(job);
  });

  return id;
}

async function runTranscriptPipeline(
  job: PipelineJob,
  filePath: string,
  originalFileName: string,
  context?: PipelineContext
): Promise<void> {
  const fileBase = path.basename(originalFileName, path.extname(originalFileName));
  const ext = path.extname(originalFileName);
  const baseName = `${fileBase}_${shortUuid()}`;

  try {
    // Parse transcript file
    job.status = "analyzing";
    job.progress = "解析转录文件...";
    updateJob(job);

    const segments = await parseTranscriptFile(filePath, ext);

    if (!segments || segments.length === 0) {
      throw new Error("无法解析转录文件：未提取到有效对话片段");
    }

    await runAnalysis(job, baseName, segments, filePath, "[1/1]", context);
  } catch (err: any) {
    job.status = "error";
    job.error = err.message || String(err);
    job.progress = "处理失败";
    updateJob(job);
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════
// Startup: restore persisted jobs + cleanup
// ═══════════════════════════════════════════════════════════════

const IN_PROGRESS_STATUSES: Set<string> = new Set(["uploading", "transcribing", "analyzing"]);

export function restoreJobs(): void {
  // Clean up old jobs (>24 hours)
  deleteOldJobs(24 * 60 * 60 * 1000);

  // Load persisted jobs into memory
  const persisted = getActiveJobs();
  for (const row of persisted) {
    const job: PipelineJob = {
      id: row.id,
      fileName: row.file_name,
      status: row.status as JobStatus,
      progress: row.progress,
      createdAt: row.created_at,
      userId: row.user_id ?? undefined,
      result: row.result ?? undefined,
      error: row.error ?? undefined,
    };

    // Mark interrupted jobs as error
    if (IN_PROGRESS_STATUSES.has(job.status)) {
      job.status = "error";
      job.error = "服务器重启，任务中断";
      job.progress = "处理失败";
      saveJob(job);
    }

    jobs.set(job.id, job);
  }

  console.log(`[Pipeline] Restored ${persisted.length} jobs from database`);
}
