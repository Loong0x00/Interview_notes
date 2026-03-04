import crypto from "crypto";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const XFYUN_APP_ID = process.env.XFYUN_APP_ID!;
const XFYUN_API_KEY = process.env.XFYUN_API_KEY!;
const XFYUN_API_SECRET = process.env.XFYUN_API_SECRET!;

const UPLOAD_URL = "https://office-api-ist-dx.iflyaisol.com/v2/upload";
const RESULT_URL = "https://office-api-ist-dx.iflyaisol.com/v2/getResult";

export interface TranscriptSegment {
  speaker: string;
  start_ms: number;
  end_ms: number;
  text: string;
}

/** Strict URL-encode: also encodes !'()* to match Python's quote(safe='') */
function strictEncode(str: string): string {
  return encodeURIComponent(String(str)).replace(
    /[!'()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

function xfyunDateTime(): string {
  const now = new Date();
  const offset = 8 * 60; // UTC+8
  const local = new Date(now.getTime() + offset * 60 * 1000);
  const y = local.getUTCFullYear();
  const M = String(local.getUTCMonth() + 1).padStart(2, "0");
  const d = String(local.getUTCDate()).padStart(2, "0");
  const h = String(local.getUTCHours()).padStart(2, "0");
  const m = String(local.getUTCMinutes()).padStart(2, "0");
  const s = String(local.getUTCSeconds()).padStart(2, "0");
  return `${y}-${M}-${d}T${h}:${m}:${s}+0800`;
}

function xfyunRand(n = 16): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < n; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

function xfyunSignature(params: Record<string, string>): string {
  const pairs = Object.entries(params)
    .filter(([k, v]) => k !== "signature" && v)
    .sort(([a], [b]) => a.localeCompare(b));

  const baseString = pairs
    .map(([k, v]) => `${strictEncode(k)}=${strictEncode(v)}`)
    .join("&");

  return crypto
    .createHmac("sha1", XFYUN_API_SECRET)
    .update(baseString)
    .digest("base64");
}

function xfyunParams(extra: Record<string, string>): { params: Record<string, string>; signature: string } {
  const params: Record<string, string> = {
    appId: XFYUN_APP_ID,
    accessKeyId: XFYUN_API_KEY,
    dateTime: xfyunDateTime(),
    signatureRandom: xfyunRand(),
    ...extra,
  };
  const signature = xfyunSignature(params);
  return { params, signature };
}

export function getDurationMs(filePath: string): number {
  const result = execSync(
    `ffprobe -v quiet -print_format json -show_format "${filePath}"`,
    { encoding: "utf-8" }
  );
  const data = JSON.parse(result);
  return Math.floor(parseFloat(data.format.duration) * 1000);
}

async function uploadAudio(audioPath: string): Promise<{ orderId: string; estimate: number }> {
  const fileName = path.basename(audioPath);
  const fileSize = fs.statSync(audioPath).size;
  const durationMs = getDurationMs(audioPath);

  console.log(`  文件: ${fileName}  大小: ${(fileSize / 1024 / 1024).toFixed(1)}MB  时长: ${Math.floor(durationMs / 1000)}s`);

  const { params, signature } = xfyunParams({
    fileName,
    fileSize: String(fileSize),
    duration: String(durationMs),
    language: "autodialect",
    roleType: "1",
  });

  const queryString = Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");

  const body = fs.readFileSync(audioPath);

  const resp = await fetch(`${UPLOAD_URL}?${queryString}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      signature,
    },
    body,
  });

  const uploadResult = await resp.json();
  if (uploadResult.code !== "000000") {
    throw new Error(`上传失败: ${JSON.stringify(uploadResult)}`);
  }

  const orderId = uploadResult.content.orderId;
  const estimate = (uploadResult.content.taskEstimateTime || 0) / 1000;
  console.log(`  orderId: ${orderId}  预计: ${Math.floor(estimate)}s`);

  return { orderId, estimate };
}

async function pollResult(
  orderId: string,
  onProgress?: (attempt: number, maxAttempts: number) => void
): Promise<any> {
  const maxAttempts = 100;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, 15000));

    const { params, signature } = xfyunParams({
      orderId,
      resultType: "transfer",
    });

    const queryString = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");

    const resp = await fetch(`${RESULT_URL}?${queryString}`, {
      method: "POST",
      headers: { signature },
    });

    const result = await resp.json();
    const code = result.code;
    const status = result.content?.orderInfo?.status;

    onProgress?.(attempt + 1, maxAttempts);

    if (code === "000000" && status === 4) {
      console.log("  转写完成!");
      return result;
    }

    if (code !== "000000" && code !== "26682") {
      throw new Error(`转写异常: ${JSON.stringify(result)}`);
    }
  }

  throw new Error("转写超时（超过100次轮询）");
}

function parseResult(result: any): TranscriptSegment[] {
  let orderResult = result.content.orderResult;
  if (typeof orderResult === "string") {
    orderResult = JSON.parse(orderResult);
  }

  const structured: TranscriptSegment[] = [];

  for (const item of orderResult.lattice || []) {
    const seg = JSON.parse(item.json_1best || "{}");
    const st = seg.st || {};

    const text = (st.rt || [])
      .flatMap((rt: any) => rt.ws || [])
      .flatMap((ws: any) => ws.cw || [])
      .map((cw: any) => cw.w || "")
      .join("");

    if (text.trim()) {
      structured.push({
        speaker: st.rl || "0",
        start_ms: parseInt(st.bg || "0", 10),
        end_ms: parseInt(st.ed || "0", 10),
        text,
      });
    }
  }

  console.log(`  转写片段数: ${structured.length}`);
  return structured;
}

export async function transcribe(
  audioPath: string,
  onProgress?: (stage: string, detail?: string, percent?: number) => void
): Promise<TranscriptSegment[]> {
  onProgress?.("uploading", "正在上传音频文件...", 10);
  const { orderId } = await uploadAudio(audioPath);

  onProgress?.("transcribing", "正在转写，请等待...", 20);
  const result = await pollResult(orderId, (attempt, max) => {
    // 20% ~ 90% maps to polling progress
    const pct = Math.round(20 + (attempt / max) * 70);
    onProgress?.("transcribing", `轮询中 (${attempt}/${max})...`, pct);
  });

  onProgress?.("parsing", "正在解析结果...", 95);
  return parseResult(result);
}
