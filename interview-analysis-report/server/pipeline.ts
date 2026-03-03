import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { transcribe, type TranscriptSegment } from "./transcribe.js";
import { formatTranscript, analyze } from "./analyze.js";
import { convertMdToJson } from "./convert.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, "../../");

export type JobStatus =
  | "uploading"
  | "transcribing"
  | "analyzing"
  | "converting"
  | "done"
  | "error";

export interface PipelineJob {
  id: string;
  fileName: string;
  status: JobStatus;
  progress: string;
  createdAt: number;
  result?: string; // report name for loading
  error?: string;
}

const jobs = new Map<string, PipelineJob>();

// Listeners for SSE progress push
type ProgressListener = (job: PipelineJob) => void;
const listeners = new Map<string, Set<ProgressListener>>();

export function getJob(id: string): PipelineJob | undefined {
  return jobs.get(id);
}

export function getAllJobs(): PipelineJob[] {
  return Array.from(jobs.values()).sort((a, b) => b.createdAt - a.createdAt);
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
  const jobListeners = listeners.get(job.id);
  if (jobListeners) {
    for (const listener of jobListeners) {
      listener({ ...job });
    }
  }
}

export function startPipeline(audioPath: string, originalFileName: string): string {
  const id = `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const job: PipelineJob = {
    id,
    fileName: originalFileName,
    status: "uploading",
    progress: "准备中...",
    createdAt: Date.now(),
  };
  jobs.set(id, job);

  // Run async pipeline - don't await
  runPipeline(job, audioPath, originalFileName).catch((err) => {
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
  originalFileName: string
): Promise<void> {
  const baseName = path.basename(originalFileName, path.extname(originalFileName));
  const transcriptPath = path.join(DATA_DIR, `${baseName}_transcript.json`);
  const analysisPath = path.join(DATA_DIR, `${baseName}_analysis.md`);
  const analysisJsonPath = path.join(DATA_DIR, `${baseName}_analysis_data.json`);

  try {
    // Step 1: Transcribe
    job.status = "transcribing";
    job.progress = "[1/3] 语音转写 - 上传中...";
    updateJob(job);

    const segments = await transcribe(audioPath, (stage, detail) => {
      job.progress = `[1/3] 语音转写 - ${detail || stage}`;
      updateJob(job);
    });

    // Save transcript
    fs.writeFileSync(transcriptPath, JSON.stringify(segments, null, 2), "utf-8");
    console.log(`[Pipeline] Saved transcript: ${transcriptPath}`);

    // Step 2: AI Analysis
    job.status = "analyzing";
    job.progress = "[2/3] AI 分析中...";
    updateJob(job);

    const transcriptText = formatTranscript(segments);
    const report = await analyze(transcriptText, (detail) => {
      job.progress = `[2/3] AI 分析 - ${detail}`;
      updateJob(job);
    });

    fs.writeFileSync(analysisPath, report, "utf-8");
    console.log(`[Pipeline] Saved analysis: ${analysisPath}`);

    // Step 3: Convert to structured JSON
    job.status = "converting";
    job.progress = "[3/3] 结构化转换中...";
    updateJob(job);

    const jsonData = await convertMdToJson(report);
    fs.writeFileSync(analysisJsonPath, JSON.stringify(jsonData, null, 2), "utf-8");
    console.log(`[Pipeline] Saved JSON: ${analysisJsonPath}`);

    // Done
    job.status = "done";
    job.progress = "处理完成";
    job.result = baseName;
    updateJob(job);

    // Cleanup temp upload file
    try {
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
        console.log(`[Pipeline] Cleaned up temp file: ${audioPath}`);
      }
    } catch {
      // Ignore cleanup errors
    }
  } catch (err: any) {
    job.status = "error";
    job.error = err.message || String(err);
    job.progress = "处理失败";
    updateJob(job);
    throw err;
  }
}
